import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { getFirebaseAccessToken, FIREBASE_RTDB_URL } from './auth';

export type AuditCategory =
  | 'ADMIN_ACTION'
  | 'SECURITY_ALERT'
  | 'AUTH'
  | 'SERVER'
  | 'PAYMENT'
  | 'SUBSCRIPTION';

export type AuditSeverity = 'info' | 'warning' | 'critical';

export interface SecurityAuditLog {
  id: string;
  timestamp: number;
  category: AuditCategory;
  severity: AuditSeverity;
  action: string;
  actor: string;
  ip: string;
  userAgent?: string;
  details: string;
  metadata?: Record<string, unknown>;
}

export interface SecurityBanEntry {
  key: string;
  ip: string;
  strikes: number;
  blockedUntil: number;
  lastReason: string;
  lastAttemptAt: number;
  isActive: boolean;
}

const memoryAuditCache: SecurityAuditLog[] = [];
const MAX_MEMORY_LOGS = 200;

export function extractRequestIp(req?: NextRequest | null): string {
  if (!req) return 'unknown';
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip')?.trim() ||
    req.headers.get('cf-connecting-ip')?.trim() ||
    '127.0.0.1'
  );
}

export function extractUserAgent(req?: NextRequest | null): string {
  if (!req) return '';
  return (req.headers.get('user-agent') || '').slice(0, 180);
}

/**
 * Records an admin activity or security event into Firebase RTDB (`/security_audit_logs`)
 * and the in-memory ring buffer. Never throws so it never interrupts primary API flows.
 */
export async function recordSecurityAuditLog(params: {
  req?: NextRequest | null;
  category: AuditCategory;
  severity: AuditSeverity;
  action: string;
  actor?: string;
  ip?: string;
  details: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const now = Date.now();
  const rand = crypto.randomBytes(4).toString('hex');
  const id = `${now}_${rand}`;

  const entry: SecurityAuditLog = {
    id,
    timestamp: now,
    category: params.category,
    severity: params.severity,
    action: params.action,
    actor: params.actor || 'anonymous',
    ip: params.ip || extractRequestIp(params.req),
    userAgent: extractUserAgent(params.req),
    details: params.details,
    metadata: params.metadata,
  };

  memoryAuditCache.unshift(entry);
  if (memoryAuditCache.length > MAX_MEMORY_LOGS) {
    memoryAuditCache.length = MAX_MEMORY_LOGS;
  }

  try {
    const fbToken = await getFirebaseAccessToken();
    if (!fbToken) return;
    await fetch(`${FIREBASE_RTDB_URL}/security_audit_logs/${id}.json?access_token=${fbToken}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
      cache: 'no-store',
    });
  } catch {
    // Non-fatal: keep in-memory cache even if RTDB write fails transiently
  }
}

/**
 * Reads security & admin activity logs from Firebase RTDB (`/security_audit_logs`)
 * merged with any recent in-memory logs, sorted newest-first.
 */
export async function readSecurityAuditLogs(limit = 250): Promise<SecurityAuditLog[]> {
  const byId = new Map<string, SecurityAuditLog>();
  for (const item of memoryAuditCache) {
    byId.set(item.id, item);
  }

  try {
    const fbToken = await getFirebaseAccessToken();
    if (fbToken) {
      const res = await fetch(
        `${FIREBASE_RTDB_URL}/security_audit_logs.json?orderBy=%22timestamp%22&limitToLast=${limit}&access_token=${fbToken}`,
        { cache: 'no-store' }
      );
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object') {
          for (const [k, raw] of Object.entries(data)) {
            if (raw && typeof raw === 'object') {
              const r = raw as Record<string, unknown>;
              byId.set(String(r.id || k), {
                id: String(r.id || k),
                timestamp: Number(r.timestamp || 0),
                category: (r.category as AuditCategory) || 'ADMIN_ACTION',
                severity: (r.severity as AuditSeverity) || 'info',
                action: String(r.action || 'UNKNOWN'),
                actor: String(r.actor || 'unknown'),
                ip: String(r.ip || 'unknown'),
                userAgent: r.userAgent ? String(r.userAgent) : undefined,
                details: String(r.details || ''),
                metadata:
                  r.metadata && typeof r.metadata === 'object'
                    ? (r.metadata as Record<string, unknown>)
                    : undefined,
              });
            }
          }
        }
      }
    }
  } catch {
    // fallback to in-memory cache
  }

  return Array.from(byId.values())
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

/**
 * Reads active and historical IP bans from Firebase RTDB (`/security_bans`).
 */
export async function readSecurityBans(): Promise<SecurityBanEntry[]> {
  const now = Date.now();
  const bans: SecurityBanEntry[] = [];
  try {
    const fbToken = await getFirebaseAccessToken();
    if (!fbToken) return bans;
    const res = await fetch(`${FIREBASE_RTDB_URL}/security_bans.json?access_token=${fbToken}`, {
      cache: 'no-store',
    });
    if (!res.ok) return bans;
    const data = await res.json();
    if (data && typeof data === 'object') {
      for (const [key, raw] of Object.entries(data)) {
        if (raw && typeof raw === 'object') {
          const r = raw as Record<string, unknown>;
          const blockedUntil = Number(r.blockedUntil || 0);
          bans.push({
            key,
            ip: String(r.ip || 'unknown'),
            strikes: Number(r.strikes || 0),
            blockedUntil,
            lastReason: String(r.lastReason || ''),
            lastAttemptAt: Number(r.lastAttemptAt || 0),
            isActive: blockedUntil > now,
          });
        }
      }
    }
  } catch {
    // ignore
  }
  return bans.sort((a, b) => b.lastAttemptAt - a.lastAttemptAt);
}

/**
 * Removes an IP ban record from Firebase RTDB (`/security_bans/<key>`).
 */
export async function removeSecurityBan(banKey: string): Promise<boolean> {
  try {
    const fbToken = await getFirebaseAccessToken();
    if (!fbToken) return false;
    const res = await fetch(
      `${FIREBASE_RTDB_URL}/security_bans/${encodeURIComponent(banKey)}.json?access_token=${fbToken}`,
      { method: 'DELETE', cache: 'no-store' }
    );
    return res.ok;
  } catch {
    return false;
  }
}

