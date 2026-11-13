import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  createSessionToken,
  verifyAdminCredentials,
  verifyAdminRequest,
  getFirebaseAccessToken,
  SESSION_COOKIE_NAME,
  FIREBASE_RTDB_URL,
} from '../../lib/auth';
import { recordSecurityAuditLog } from '../../lib/audit';

export const dynamic = 'force-dynamic';

interface BanRecord {
  strikes: number;
  blockedUntil: number;
  lastReason: string;
  lastAttemptAt: number;
  ip: string;
}

// Fast in-memory cache synced with persistent Firebase RTDB `/security_bans`
const memoryBanMap = new Map<string, BanRecord>();

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip')?.trim() ||
    req.headers.get('cf-connecting-ip')?.trim() ||
    '127.0.0.1'
  );
}

function getBanKey(ip: string): string {
  return crypto.createHash('sha256').update(`tweve_ban_${ip}`).digest('hex').slice(0, 24);
}

/**
 * Progressive lockout duration based on cumulative strikes:
 * - 3–4 strikes: 1 Hour
 * - 5–6 strikes: 6 Hours
 * - 7–8 strikes: 24 Hours (1 Day)
 * - 9–11 strikes: 72 Hours (3 Days)
 * - 12+ strikes: 168 Hours (7 Days)
 */
function calculateLockoutMs(strikes: number): number {
  if (strikes < 3) return 0;
  if (strikes <= 4) return 1 * 60 * 60 * 1000; // 1 hour
  if (strikes <= 6) return 6 * 60 * 60 * 1000; // 6 hours
  if (strikes <= 8) return 24 * 60 * 60 * 1000; // 1 day (24 hours)
  if (strikes <= 11) return 3 * 24 * 60 * 60 * 1000; // 3 days (72 hours)
  return 7 * 24 * 60 * 60 * 1000; // 7 days (168 hours)
}

function formatRemainingDuration(ms: number): string {
  const totalMinutes = Math.max(1, Math.ceil(ms / (60 * 1000)));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const mins = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
  if (days === 0 && mins > 0) parts.push(`${mins} minute${mins > 1 ? 's' : ''}`);
  return parts.join(' ');
}

async function getBanRecord(ip: string): Promise<BanRecord | null> {
  const key = getBanKey(ip);
  const cached = memoryBanMap.get(key);
  const now = Date.now();

  if (cached && cached.blockedUntil > now) {
    return cached;
  }

  try {
    const fbToken = await getFirebaseAccessToken();
    if (fbToken) {
      const res = await fetch(
        `${FIREBASE_RTDB_URL}/security_bans/${key}.json?access_token=${fbToken}`,
        { cache: 'no-store' }
      );
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object' && typeof data.strikes === 'number') {
          const rec: BanRecord = {
            strikes: Number(data.strikes || 0),
            blockedUntil: Number(data.blockedUntil || 0),
            lastReason: String(data.lastReason || ''),
            lastAttemptAt: Number(data.lastAttemptAt || 0),
            ip,
          };
          memoryBanMap.set(key, rec);
          return rec;
        }
      }
    }
  } catch {
    // fallback to memory map
  }

  return cached || null;
}

async function recordSecurityStrike(
  ip: string,
  reason: string,
  strikeWeight = 1
): Promise<BanRecord> {
  const key = getBanKey(ip);
  const now = Date.now();
  const existing = await getBanRecord(ip);

  // Reset strike counter only if more than 7 days have passed since last attempt and not currently blocked
  const expiredWindow =
    existing && existing.blockedUntil < now && now - existing.lastAttemptAt > 7 * 24 * 60 * 60 * 1000;

  const strikes = (expiredWindow ? 0 : existing?.strikes || 0) + strikeWeight;
  const lockoutMs = calculateLockoutMs(strikes);
  const blockedUntil = lockoutMs > 0 ? now + lockoutMs : 0;

  const updated: BanRecord = {
    strikes,
    blockedUntil,
    lastReason: reason,
    lastAttemptAt: now,
    ip,
  };

  memoryBanMap.set(key, updated);

  try {
    const fbToken = await getFirebaseAccessToken();
    if (fbToken) {
      await fetch(`${FIREBASE_RTDB_URL}/security_bans/${key}.json?access_token=${fbToken}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
        cache: 'no-store',
      });
    }
  } catch {
    // ignore
  }

  return updated;
}

async function clearBanRecord(ip: string): Promise<void> {
  const key = getBanKey(ip);
  memoryBanMap.delete(key);
  try {
    const fbToken = await getFirebaseAccessToken();
    if (fbToken) {
      await fetch(`${FIREBASE_RTDB_URL}/security_bans/${key}.json?access_token=${fbToken}`, {
        method: 'DELETE',
        cache: 'no-store',
      });
    }
  } catch {
    // ignore
  }
}

function hasSuspiciousInjection(input: string): boolean {
  const lower = input.toLowerCase();
  return (
    lower.includes('<script') ||
    lower.includes('javascript:') ||
    lower.includes("' or '1'='1") ||
    lower.includes('" or "1"="1') ||
    lower.includes('union select') ||
    lower.includes('../') ||
    lower.includes('..\\') ||
    lower.includes('\0')
  );
}

export async function GET(req: NextRequest) {
  const auth = await verifyAdminRequest(req);
  if (!auth.valid) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    email: auth.email,
  });
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const now = Date.now();

  try {
    // 1. Check if IP is currently locked out (hours or days)
    const currentBan = await getBanRecord(ip);
    if (currentBan && currentBan.blockedUntil > now) {
      const remainingMs = currentBan.blockedUntil - now;
      const retryAfterSec = Math.ceil(remainingMs / 1000);
      await recordSecurityAuditLog({
        req,
        category: 'SECURITY_ALERT',
        severity: 'warning',
        action: 'BLOCKED_IP_LOGIN_ATTEMPT',
        actor: 'blocked_ip',
        ip,
        details: `Blocked IP ${ip} attempted login while locked (${currentBan.strikes} strikes, reason: ${currentBan.lastReason}).`,
        metadata: { strikes: currentBan.strikes, blockedUntil: currentBan.blockedUntil },
      });
      return NextResponse.json(
        {
          authenticated: false,
          locked: true,
          blockedUntil: currentBan.blockedUntil,
          error: `Access blocked due to repeated failed or invalid login requests. Try again in ${formatRemainingDuration(remainingMs)}.`,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfterSec) },
        }
      );
    }

    // 2. Rapid-fire burst check (< 1.2s between login POSTs from same IP)
    if (currentBan && now - currentBan.lastAttemptAt < 1200) {
      const rec = await recordSecurityStrike(ip, 'rapid_burst_requests', 2);
      if (rec.blockedUntil > now) {
        await recordSecurityAuditLog({
          req,
          category: 'SECURITY_ALERT',
          severity: 'critical',
          action: 'RAPID_BURST_LOCKOUT',
          actor: 'anonymous',
          ip,
          details: `IP ${ip} locked due to rapid-fire login burst (${rec.strikes} strikes).`,
          metadata: { strikes: rec.strikes, blockedUntil: rec.blockedUntil },
        });
        return NextResponse.json(
          {
            authenticated: false,
            locked: true,
            blockedUntil: rec.blockedUntil,
            error: `Too many rapid login requests. Access blocked for ${formatRemainingDuration(rec.blockedUntil - now)}.`,
          },
          { status: 429 }
        );
      }
    }

    // 3. Parse JSON body & penalize malformed/corrupted payloads
    let body: any = null;
    try {
      body = await req.json();
    } catch {
      const rec = await recordSecurityStrike(ip, 'malformed_json_payload', 2);
      return NextResponse.json(
        {
          authenticated: false,
          error:
            rec.blockedUntil > now
              ? `Malformed request detected. Access blocked for ${formatRemainingDuration(rec.blockedUntil - now)}.`
              : 'Invalid request payload.',
        },
        { status: rec.blockedUntil > now ? 429 : 400 }
      );
    }

    if (!body || typeof body !== 'object' || body.action !== 'login') {
      const rec = await recordSecurityStrike(ip, 'missing_or_invalid_action', 2);
      return NextResponse.json(
        {
          authenticated: false,
          error:
            rec.blockedUntil > now
              ? `Invalid request action. Access blocked for ${formatRemainingDuration(rec.blockedUntil - now)}.`
              : 'Invalid authentication request.',
        },
        { status: rec.blockedUntil > now ? 429 : 400 }
      );
    }

    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '').trim();

    // 4. Block missing info, oversized payloads, or injection patterns
    if (
      !email ||
      !password ||
      !email.includes('@') ||
      email.length > 160 ||
      password.length > 256 ||
      hasSuspiciousInjection(email) ||
      hasSuspiciousInjection(password)
    ) {
      const weight = hasSuspiciousInjection(email) || hasSuspiciousInjection(password) ? 4 : 1;
      const rec = await recordSecurityStrike(ip, 'missing_or_invalid_credentials_info', weight);
      if (weight >= 4) {
        await recordSecurityAuditLog({
          req,
          category: 'SECURITY_ALERT',
          severity: 'critical',
          action: 'INJECTION_PATTERN_DETECTED',
          actor: email || 'anonymous',
          ip,
          details: `Suspicious injection/payload detected on admin login from ${ip}.`,
          metadata: { strikes: rec.strikes, blockedUntil: rec.blockedUntil },
        });
      }
      if (rec.blockedUntil > now) {
        return NextResponse.json(
          {
            authenticated: false,
            locked: true,
            blockedUntil: rec.blockedUntil,
            error: `Repeated missing or invalid login information. Access blocked for ${formatRemainingDuration(rec.blockedUntil - now)}.`,
          },
          { status: 429 }
        );
      }
      return NextResponse.json(
        {
          authenticated: false,
          error: 'Please enter a valid admin email and password.',
        },
        { status: 400 }
      );
    }

    // 5. Silent Google reCAPTCHA v3 verification
    const recaptchaSecret =
      process.env.RECAPTCHA_SECRET_KEY || '6LdfShwuAAAAAMM2ze3fH-Ml-T9fZ9_X5k6DmTG8';
    const tokenStr = String(body.recaptchaToken || '').trim();
    if (recaptchaSecret && tokenStr) {
      let human = false;
      try {
        const rcRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            secret: recaptchaSecret,
            response: tokenStr,
            remoteip: ip,
          }),
          cache: 'no-store',
        });
        const rc = await rcRes.json();
        human = Boolean(rc.success) && (rc.score === undefined || rc.score >= 0.3);
      } catch {
        human = true;
      }
      if (!human) {
        const rec = await recordSecurityStrike(ip, 'recaptcha_bot_score_failed', 2);
        await recordSecurityAuditLog({
          req,
          category: 'SECURITY_ALERT',
          severity: rec.blockedUntil > now ? 'critical' : 'warning',
          action: 'RECAPTCHA_FAILED',
          actor: email,
          ip,
          details: `reCAPTCHA verification failed for ${email} from ${ip} (strikes: ${rec.strikes}).`,
          metadata: { strikes: rec.strikes, blockedUntil: rec.blockedUntil },
        });
        return NextResponse.json(
          {
            authenticated: false,
            locked: rec.blockedUntil > now,
            blockedUntil: rec.blockedUntil,
            error:
              rec.blockedUntil > now
                ? `Automated login activity detected. Access blocked for ${formatRemainingDuration(rec.blockedUntil - now)}.`
                : 'Sign in could not be verified. Please try again.',
          },
          { status: rec.blockedUntil > now ? 429 : 403 }
        );
      }
    }

    // 6. Verify admin credentials strictly against Firebase Auth / Firebase DB
    const verifyRes = await verifyAdminCredentials(email, password);
    if (!verifyRes.valid || !verifyRes.email) {
      const rec = await recordSecurityStrike(ip, `invalid_credentials:${email.slice(0, 48)}`, 1);
      await recordSecurityAuditLog({
        req,
        category: 'SECURITY_ALERT',
        severity: rec.blockedUntil > now ? 'critical' : 'warning',
        action: rec.blockedUntil > now ? 'IP_LOCKED' : 'ADMIN_LOGIN_FAILED',
        actor: email,
        ip,
        details:
          rec.blockedUntil > now
            ? `IP ${ip} locked out after ${rec.strikes} failed login attempts (email: ${email}).`
            : `Failed admin login attempt for ${email} from ${ip} (strike ${rec.strikes}/3).`,
        metadata: { strikes: rec.strikes, blockedUntil: rec.blockedUntil },
      });
      if (rec.blockedUntil > now) {
        return NextResponse.json(
          {
            authenticated: false,
            locked: true,
            blockedUntil: rec.blockedUntil,
            error: `Too many failed login attempts. Access blocked for ${formatRemainingDuration(rec.blockedUntil - now)}.`,
          },
          { status: 429 }
        );
      }
      const remainingBeforeLock = Math.max(1, 3 - rec.strikes);
      return NextResponse.json(
        {
          authenticated: false,
          error: `${verifyRes.error || 'Invalid email or password.'} (${remainingBeforeLock} attempt${remainingBeforeLock > 1 ? 's' : ''} remaining before temporary lockout)`,
        },
        { status: 403 }
      );
    }

    // Successful login: clear ban record for this IP
    await clearBanRecord(ip);
    await recordSecurityAuditLog({
      req,
      category: 'AUTH',
      severity: 'info',
      action: 'ADMIN_LOGIN',
      actor: verifyRes.email,
      ip,
      details: `Admin ${verifyRes.email} signed in (${verifyRes.authSource || 'firebase'}).`,
      metadata: { authSource: verifyRes.authSource, role: verifyRes.role },
    });
    const token = createSessionToken(verifyRes.email);

    const res = NextResponse.json({
      authenticated: true,
      email: verifyRes.email,
      token,
    });

    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Authentication error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await verifyAdminRequest(req);
  await recordSecurityAuditLog({
    req,
    category: 'AUTH',
    severity: 'info',
    action: 'ADMIN_LOGOUT',
    actor: auth.email || 'admin',
    details: `Admin ${auth.email || 'session'} signed out.`,
  });
  const res = NextResponse.json({ authenticated: false });
  res.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return res;
}
