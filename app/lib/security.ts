import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAccessToken, FIREBASE_RTDB_URL } from './auth';
import { extractRequestIp, recordSecurityAuditLog } from './audit';

export interface SecurityBanRecord {
  strikes: number;
  blockedUntil: number;
  lastReason: string;
  lastAttemptAt: number;
  ip: string;
}

const memoryBanMap = new Map<string, SecurityBanRecord>();
const lastAlertLogAt = new Map<string, number>();

export const SILENT_SECURITY_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  Pragma: 'no-cache',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

export function blankResponse(status = 403, extraHeaders?: Record<string, string>): NextResponse {
  return new NextResponse(null, {
    status,
    headers: {
      ...SILENT_SECURITY_HEADERS,
      ...(extraHeaders || {}),
    },
  });
}

export function getBanKey(ip: string): string {
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
export function calculateLockoutMs(strikes: number): number {
  if (strikes < 3) return 0;
  if (strikes <= 4) return 1 * 60 * 60 * 1000;
  if (strikes <= 6) return 6 * 60 * 60 * 1000;
  if (strikes <= 8) return 24 * 60 * 60 * 1000;
  if (strikes <= 11) return 3 * 24 * 60 * 60 * 1000;
  return 7 * 24 * 60 * 60 * 1000;
}

export function formatRemainingDuration(ms: number): string {
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

export async function getBanRecord(ip: string): Promise<SecurityBanRecord | null> {
  if (!ip || ip === 'unknown') return null;
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
          const rec: SecurityBanRecord = {
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

export async function recordSecurityStrike(
  ip: string,
  reason: string,
  strikeWeight = 1
): Promise<SecurityBanRecord> {
  const safeIp = ip || 'unknown';
  const key = getBanKey(safeIp);
  const now = Date.now();
  const existing = await getBanRecord(safeIp);

  const expiredWindow =
    existing &&
    existing.blockedUntil < now &&
    now - existing.lastAttemptAt > 7 * 24 * 60 * 60 * 1000;

  const strikes = (expiredWindow ? 0 : existing?.strikes || 0) + strikeWeight;
  const lockoutMs = calculateLockoutMs(strikes);
  const blockedUntil = lockoutMs > 0 ? now + lockoutMs : 0;

  const updated: SecurityBanRecord = {
    strikes,
    blockedUntil,
    lastReason: reason,
    lastAttemptAt: now,
    ip: safeIp,
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
    // keep in-memory ban active even if DB write fails transiently
  }

  return updated;
}

export async function clearBanRecord(ip: string): Promise<void> {
  if (!ip) return;
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

const SCANNER_UA_PATTERNS = [
  'sqlmap',
  'nikto',
  'nuclei',
  'gobuster',
  'dirbuster',
  'wpscan',
  'burpsuite',
  'acunetix',
  'nessus',
  'masscan',
  'zgrab',
  'nmap',
  'metasploit',
  'havij',
  'commix',
  'hydra',
  'medusa',
  'wfuzz',
  'ffuf',
  'jaeles',
  'feroxbuster',
];

const AI_AND_AUTOMATION_UA_PATTERNS = [
  'headlesschrome',
  'playwright',
  'puppeteer',
  'selenium',
  'webdriver',
  'phantomjs',
  'cypress',
  'gptbot',
  'chatgpt-user',
  'oai-searchbot',
  'claudebot',
  'claude-web',
  'anthropic-ai',
  'perplexitybot',
  'bytespider',
  'ccbot',
  'cohere-ai',
  'diffbot',
  'omgili',
  'applebot-extended',
  'meta-externalagent',
  'scrapy',
];

const SCRIPT_CLIENT_UA_PATTERNS = [
  'curl/',
  'wget/',
  'python-requests',
  'python-urllib',
  'aiohttp',
  'httpx',
  'go-http-client',
  'node-fetch',
  'undici',
  'postmanruntime',
  'insomnia',
  'httpie',
  'libwww-perl',
  'mechanize',
];

export function detectAutomatedClient(
  req: NextRequest,
  scope: 'browser_only' | 'public_api'
): { blocked: boolean; reason?: string; weight: number } {
  const ua = (req.headers.get('user-agent') || '').toLowerCase();

  for (const pat of SCANNER_UA_PATTERNS) {
    if (ua.includes(pat)) {
      return { blocked: true, reason: `scanner_ua:${pat}`, weight: 4 };
    }
  }

  for (const pat of AI_AND_AUTOMATION_UA_PATTERNS) {
    if (ua.includes(pat)) {
      return { blocked: true, reason: `ai_or_automation_ua:${pat}`, weight: 3 };
    }
  }

  if (scope === 'browser_only') {
    if (!ua || ua.length < 10) {
      return { blocked: true, reason: 'missing_browser_user_agent', weight: 3 };
    }
    for (const pat of SCRIPT_CLIENT_UA_PATTERNS) {
      if (ua.includes(pat)) {
        return { blocked: true, reason: `scripted_client_ua:${pat}`, weight: 3 };
      }
    }
    const secFetchSite = (req.headers.get('sec-fetch-site') || '').toLowerCase();
    if (secFetchSite === 'cross-site' && req.method !== 'GET') {
      return { blocked: true, reason: 'cross_site_admin_request', weight: 3 };
    }
    const origin = req.headers.get('origin');
    const host = req.headers.get('host');
    if (origin && host && req.method !== 'GET') {
      try {
        const originHost = new URL(origin).host;
        if (originHost && originHost !== host) {
          return { blocked: true, reason: `origin_mismatch:${originHost}`, weight: 3 };
        }
      } catch {
        return { blocked: true, reason: 'invalid_origin_header', weight: 3 };
      }
    }
  }

  return { blocked: false, weight: 0 };
}

export function inspectStringForAttack(input: string): string | null {
  if (!input) return null;
  const lower = input.toLowerCase();
  const patterns: Array<[string, string]> = [
    ['<script', 'xss_script_tag'],
    ['</script', 'xss_script_close'],
    ['javascript:', 'xss_js_uri'],
    ['onerror=', 'xss_onerror'],
    ['onload=', 'xss_onload'],
    ["' or '1'='1", 'sqli_or_true_sq'],
    ['" or "1"="1', 'sqli_or_true_dq'],
    ['or 1=1--', 'sqli_comment'],
    ['union select', 'sqli_union'],
    ['union all select', 'sqli_union_all'],
    ['; drop table', 'sqli_drop_table'],
    ['benchmark(', 'sqli_benchmark'],
    ['../', 'path_traversal_unix'],
    ['..\\', 'path_traversal_win'],
    ['/etc/passwd', 'lfi_passwd'],
    ['__proto__', 'prototype_pollution'],
    ['constructor.prototype', 'prototype_pollution_ctor'],
    ['\0', 'null_byte_injection'],
  ];
  for (const [needle, code] of patterns) {
    if (lower.includes(needle)) {
      return code;
    }
  }
  return null;
}

function shouldThrottleAlert(key: string, cooldownMs = 15000): boolean {
  const now = Date.now();
  const last = lastAlertLogAt.get(key) || 0;
  if (now - last < cooldownMs) return true;
  lastAlertLogAt.set(key, now);
  return false;
}

/**
 * Enforces IP ban checks, automated AI/bot/scanner blocking, and payload attack checks across API routes.
 * Returns a completely blank NextResponse when blocked, or null if safe to continue.
 */
export async function enforceApiSecurity(
  req: NextRequest,
  opts: {
    scope: 'browser_only' | 'public_api';
    inspectUrl?: boolean;
    extraInputs?: string[];
  }
): Promise<NextResponse | null> {
  const ip = extractRequestIp(req);
  const now = Date.now();

  // 1. Check persistent auto-ban first (works even when admin is completely offline)
  const ban = await getBanRecord(ip);
  if (ban && ban.blockedUntil > now) {
    if (!shouldThrottleAlert(`banned_${ip}`, 20000)) {
      await recordSecurityAuditLog({
        req,
        category: 'SECURITY_ALERT',
        severity: 'warning',
        action: 'BLOCKED_IP_REQUEST',
        actor: 'blocked_ip',
        ip,
        details: `Auto-banned IP ${ip} blocked on ${req.method} ${req.nextUrl.pathname} (strikes=${ban.strikes}, reason=${ban.lastReason}).`,
        metadata: { strikes: ban.strikes, blockedUntil: ban.blockedUntil, autoBanned: true },
      });
    }
    return blankResponse(403, {
      'Retry-After': String(Math.max(60, Math.ceil((ban.blockedUntil - now) / 1000))),
    });
  }

  // 2. Check scanners, headless AI browsers, or scripted automation
  const botCheck = detectAutomatedClient(req, opts.scope);
  if (botCheck.blocked) {
    const updated = await recordSecurityStrike(ip, botCheck.reason || 'bot_detected', botCheck.weight);
    await recordSecurityAuditLog({
      req,
      category: 'SECURITY_ALERT',
      severity: 'critical',
      action: 'BOT_OR_AI_BLOCKED',
      actor: 'anonymous',
      ip,
      details: `Blocked automated/AI/scanner request from ${ip} on ${req.method} ${req.nextUrl.pathname} (${botCheck.reason}; strikes=${updated.strikes}${updated.blockedUntil > now ? ', AUTO-BANNED' : ''}).`,
      metadata: {
        reason: botCheck.reason,
        strikes: updated.strikes,
        blockedUntil: updated.blockedUntil,
        autoBanned: updated.blockedUntil > now,
      },
    });
    return blankResponse(403);
  }

  // 3. Check URL query + extra untrusted inputs for exploit/injection attacks
  const toCheck: string[] = [];
  if (opts.inspectUrl !== false) {
    toCheck.push(decodeURIComponentSafe(req.nextUrl.search || ''));
    toCheck.push(decodeURIComponentSafe(req.nextUrl.pathname || ''));
  }
  if (opts.extraInputs) {
    for (const item of opts.extraInputs) {
      if (item) toCheck.push(item);
    }
  }

  for (const candidate of toCheck) {
    const attackCode = inspectStringForAttack(candidate);
    if (attackCode) {
      const updated = await recordSecurityStrike(ip, `attack:${attackCode}`, 4);
      await recordSecurityAuditLog({
        req,
        category: 'SECURITY_ALERT',
        severity: 'critical',
        action: 'ATTACK_DETECTED_AUTO_BAN',
        actor: 'attacker',
        ip,
        details: `Attack payload (${attackCode}) detected & auto-banned from ${ip} on ${req.method} ${req.nextUrl.pathname}.`,
        metadata: {
          attackCode,
          strikes: updated.strikes,
          blockedUntil: updated.blockedUntil,
          autoBanned: true,
        },
      });
      return blankResponse(403);
    }
  }

  return null;
}

/**
 * Logs unauthorized admin endpoint probe, issues a strike (+2 = auto-ban after 2 probes even offline),
 * and returns a completely blank 401 response with zero JSON/text body.
 */
export async function handleUnauthorizedAdminProbe(
  req: NextRequest,
  pathLabel: string
): Promise<NextResponse> {
  const ip = extractRequestIp(req);
  const now = Date.now();
  const updated = await recordSecurityStrike(ip, `unauthorized:${pathLabel}`, 2);
  const autoBanned = updated.blockedUntil > now;

  await recordSecurityAuditLog({
    req,
    category: 'SECURITY_ALERT',
    severity: 'critical',
    action: autoBanned ? 'UNAUTHORIZED_AUTO_BAN' : 'UNAUTHORIZED_ACCESS',
    actor: 'anonymous',
    ip,
    details: `Unauthorized ${req.method} attempt to ${pathLabel} from ${ip} (strikes=${updated.strikes}${autoBanned ? ', AUTO-BANNED' : ''}).`,
    metadata: {
      method: req.method,
      path: pathLabel,
      strikes: updated.strikes,
      blockedUntil: updated.blockedUntil,
      autoBanned,
    },
  });

  return blankResponse(401);
}

function decodeURIComponentSafe(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
