import { NextRequest, NextResponse } from 'next/server';
import {
  createSessionToken,
  verifyAdminCredentials,
  verifyAdminRequest,
  SESSION_COOKIE_NAME,
} from '@/app/lib/auth';
import { extractRequestIp, recordSecurityAuditLog } from '@/app/lib/audit';
import {
  blankResponse,
  clearBanRecord,
  enforceApiSecurity,
  inspectStringForAttack,
  recordSecurityStrike,
  SILENT_SECURITY_HEADERS,
} from '@/app/lib/security';

export const dynamic = 'force-dynamic';

const rapidAttemptMap = new Map<string, number[]>();

function isRapidBurst(ip: string, now: number): boolean {
  const recent = (rapidAttemptMap.get(ip) || []).filter((ts) => now - ts < 15_000);
  recent.push(now);
  rapidAttemptMap.set(ip, recent);
  return recent.length > 6;
}

export async function GET(req: NextRequest) {
  const blocked = await enforceApiSecurity(req, { scope: 'browser_only' });
  if (blocked) return blocked;

  const auth = await verifyAdminRequest(req);
  if (!auth.valid) {
    return blankResponse(204);
  }

  return NextResponse.json(
    { authenticated: true, email: auth.email },
    { headers: SILENT_SECURITY_HEADERS }
  );
}

export async function POST(req: NextRequest) {
  const blocked = await enforceApiSecurity(req, { scope: 'browser_only' });
  if (blocked) return blocked;

  const ip = extractRequestIp(req);
  const now = Date.now();

  if (isRapidBurst(ip, now)) {
    const rec = await recordSecurityStrike(ip, 'auth_rapid_burst', 2);
    await recordSecurityAuditLog({
      req,
      category: 'SECURITY_ALERT',
      severity: 'critical',
      action: 'RAPID_LOGIN_BURST_AUTO_BAN',
      actor: 'anonymous',
      ip,
      details: `Rapid brute-force login burst blocked & auto-banned from ${ip} (strikes=${rec.strikes}).`,
      metadata: {
        strikes: rec.strikes,
        blockedUntil: rec.blockedUntil,
        autoBanned: rec.blockedUntil > now,
      },
    });
    return blankResponse(429);
  }

  let body: { email?: unknown; password?: unknown; recaptchaToken?: unknown };
  try {
    body = await req.json();
  } catch {
    const rec = await recordSecurityStrike(ip, 'malformed_auth_json', 2);
    await recordSecurityAuditLog({
      req,
      category: 'SECURITY_ALERT',
      severity: 'critical',
      action: 'MALFORMED_AUTH_PAYLOAD',
      actor: 'anonymous',
      ip,
      details: `Malformed auth JSON payload rejected from ${ip} (strikes=${rec.strikes}${rec.blockedUntil > now ? ', AUTO-BANNED' : ''}).`,
      metadata: {
        strikes: rec.strikes,
        blockedUntil: rec.blockedUntil,
        autoBanned: rec.blockedUntil > now,
      },
    });
    return blankResponse(400);
  }

  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const tokenStr = typeof body?.recaptchaToken === 'string' ? body.recaptchaToken.trim() : '';

  // Inspect inputs for XSS / SQLi / injection attempts
  for (const field of [email, password, tokenStr]) {
    const attackCode = inspectStringForAttack(field);
    if (attackCode) {
      const rec = await recordSecurityStrike(ip, `auth_attack:${attackCode}`, 4);
      await recordSecurityAuditLog({
        req,
        category: 'SECURITY_ALERT',
        severity: 'critical',
        action: 'ATTACK_DETECTED_AUTO_BAN',
        actor: 'attacker',
        ip,
        details: `Login injection/exploit attempt (${attackCode}) blocked & auto-banned from ${ip}.`,
        metadata: {
          attackCode,
          strikes: rec.strikes,
          blockedUntil: rec.blockedUntil,
          autoBanned: true,
        },
      });
      return blankResponse(403);
    }
  }

  if (!email || !password) {
    await recordSecurityStrike(ip, 'empty_credentials', 1);
    return blankResponse(400);
  }

  // Mandatory strict Google reCAPTCHA v3 verification (fail CLOSED)
  const recaptchaSecret =
    process.env.RECAPTCHA_SECRET_KEY || '6LdfShwuAAAAAMM2ze3fH-Ml-T9fZ9_X5k6DmTG8';

  if (!tokenStr) {
    const rec = await recordSecurityStrike(ip, 'missing_recaptcha_token', 3);
    await recordSecurityAuditLog({
      req,
      category: 'SECURITY_ALERT',
      severity: 'critical',
      action: 'RECAPTCHA_BOT_REJECTED',
      actor: email || 'anonymous',
      ip,
      details: `Blocked login without Google reCAPTCHA token from ${ip} — suspected bot/AI & AUTO-BANNED (strikes=${rec.strikes}).`,
      metadata: {
        reason: 'missing_token',
        strikes: rec.strikes,
        blockedUntil: rec.blockedUntil,
        autoBanned: rec.blockedUntil > now,
      },
    });
    return blankResponse(403);
  }

  let humanVerified = false;
  let rcScore: number | null = null;
  let rcAction = '';
  let rcErrors: string[] = [];

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

    if (rcRes.ok) {
      const rc = await rcRes.json();
      rcScore = typeof rc.score === 'number' ? rc.score : null;
      rcAction = typeof rc.action === 'string' ? rc.action : '';
      rcErrors = Array.isArray(rc['error-codes']) ? rc['error-codes'] : [];

      if (
        rc.success === true &&
        rcScore !== null &&
        rcScore >= 0.5 &&
        (!rcAction || rcAction === 'login')
      ) {
        humanVerified = true;
      }
    }
  } catch {
    humanVerified = false; // Fail CLOSED on verification failure
  }

  if (!humanVerified) {
    const rec = await recordSecurityStrike(ip, 'recaptcha_bot_score_failed', 3);
    await recordSecurityAuditLog({
      req,
      category: 'SECURITY_ALERT',
      severity: 'critical',
      action: 'RECAPTCHA_BOT_REJECTED',
      actor: email || 'anonymous',
      ip,
      details: `Google reCAPTCHA rejected login from ${ip} (score=${rcScore ?? 'n/a'}, action=${rcAction || 'n/a'}) — AI/bot blocked & AUTO-BANNED (strikes=${rec.strikes}).`,
      metadata: {
        score: rcScore,
        action: rcAction,
        errorCodes: rcErrors,
        strikes: rec.strikes,
        blockedUntil: rec.blockedUntil,
        autoBanned: rec.blockedUntil > now,
      },
    });
    return blankResponse(403);
  }

  // Verify admin credentials via Firebase Auth REST API
  const verifyRes = await verifyAdminCredentials(email, password);
  if (!verifyRes.valid) {
    const rec = await recordSecurityStrike(ip, 'invalid_admin_credentials', 1);
    const autoBanned = rec.blockedUntil > now;
    await recordSecurityAuditLog({
      req,
      category: 'SECURITY_ALERT',
      severity: autoBanned ? 'critical' : 'warning',
      action: autoBanned ? 'IP_LOCKED' : 'ADMIN_LOGIN_FAILED',
      actor: email,
      ip,
      details: `Invalid admin credentials for ${email} from ${ip} (strikes=${rec.strikes}${autoBanned ? ', AUTO-BANNED' : ''}).`,
      metadata: {
        strikes: rec.strikes,
        blockedUntil: rec.blockedUntil,
        autoBanned,
      },
    });
    return blankResponse(autoBanned ? 429 : 401);
  }

  // Valid admin session: clear any previous transient strike, do NOT log passive login
  await clearBanRecord(ip);
  const authenticatedEmail = verifyRes.email || email;
  const sessionToken = createSessionToken(authenticatedEmail);
  const isHttps =
    req.headers.get('x-forwarded-proto') === 'https' || req.nextUrl.protocol === 'https:';

  const res = NextResponse.json(
    { authenticated: true, email: authenticatedEmail },
    { headers: SILENT_SECURITY_HEADERS }
  );

  res.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return res;
}

export async function DELETE(req: NextRequest) {
  const blocked = await enforceApiSecurity(req, { scope: 'browser_only' });
  if (blocked) return blocked;

  const isHttps =
    req.headers.get('x-forwarded-proto') === 'https' || req.nextUrl.protocol === 'https:';
  const res = blankResponse(204, {
    'Clear-Site-Data': '"cookies", "storage"',
  });
  res.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
  return res;
}
