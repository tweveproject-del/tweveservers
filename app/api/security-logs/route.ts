import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, getFirebaseAccessToken, FIREBASE_RTDB_URL } from '../../lib/auth';
import {
  readSecurityAuditLogs,
  readSecurityBans,
  removeSecurityBan,
  recordSecurityAuditLog,
} from '../../lib/audit';
import {
  enforceApiSecurity,
  handleUnauthorizedAdminProbe,
  SILENT_SECURITY_HEADERS,
} from '../../lib/security';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const blocked = await enforceApiSecurity(req, { scope: 'browser_only' });
  if (blocked) return blocked;

  const auth = await verifyAdminRequest(req);
  if (!auth.valid) {
    return await handleUnauthorizedAdminProbe(req, 'GET /api/security-logs');
  }

  const limitParam = Number(req.nextUrl.searchParams.get('limit') || 250);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 20), 500) : 250;

  const [logs, bans] = await Promise.all([
    readSecurityAuditLogs(limit),
    readSecurityBans(),
  ]);

  const criticalCount = logs.filter((l) => l.severity === 'critical').length;
  const warningCount = logs.filter((l) => l.severity === 'warning').length;
  const activeBansCount = bans.filter((b) => b.isActive).length;
  const adminActionsCount = logs.filter(
    (l) =>
      l.category !== 'SECURITY_ALERT' &&
      l.action !== 'ADMIN_LOGIN' &&
      l.action !== 'ADMIN_LOGOUT'
  ).length;

  return NextResponse.json(
    {
      ok: true,
      logs,
      bans,
      stats: {
        totalLogs: logs.length,
        criticalCount,
        warningCount,
        activeBansCount,
        adminActionsCount,
      },
    },
    { headers: SILENT_SECURITY_HEADERS }
  );
}

export async function POST(req: NextRequest) {
  const blocked = await enforceApiSecurity(req, { scope: 'browser_only' });
  if (blocked) return blocked;

  const auth = await verifyAdminRequest(req);
  if (!auth.valid) {
    return await handleUnauthorizedAdminProbe(req, 'POST /api/security-logs');
  }

  try {
    const body = await req.json();
    const action = String(body?.action || '');

    if (action === 'unban') {
      const banKey = String(body?.banKey || '').trim();
      const targetIp = String(body?.ip || banKey);
      if (!banKey) {
        return NextResponse.json({ error: 'Missing banKey' }, { status: 400 });
      }
      const ok = await removeSecurityBan(banKey);
      if (!ok) {
        return NextResponse.json({ error: 'Failed to remove IP ban' }, { status: 500 });
      }
      await recordSecurityAuditLog({
        req,
        category: 'ADMIN_ACTION',
        severity: 'warning',
        action: 'ADMIN_UNBAN_IP',
        actor: auth.email || 'admin',
        details: `Admin unbanned IP ${targetIp} (banKey=${banKey}).`,
        metadata: { banKey, targetIp },
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'clear_resolved') {
      const fbToken = await getFirebaseAccessToken();
      if (fbToken) {
        const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // older than 7 days
        const logs = await readSecurityAuditLogs(500);
        const oldIds = logs.filter((l) => l.timestamp < cutoff).map((l) => l.id);
        await Promise.all(
          oldIds.map((id) =>
            fetch(`${FIREBASE_RTDB_URL}/security_audit_logs/${encodeURIComponent(id)}.json?access_token=${fbToken}`, {
              method: 'DELETE',
              cache: 'no-store',
            })
          )
        );
        await recordSecurityAuditLog({
          req,
          category: 'ADMIN_ACTION',
          severity: 'info',
          action: 'ADMIN_PRUNE_LOGS',
          actor: auth.email || 'admin',
          details: `Pruned ${oldIds.length} audit log entries older than 7 days.`,
          metadata: { prunedCount: oldIds.length },
        });
        return NextResponse.json({ ok: true, prunedCount: oldIds.length });
      }
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to process security action' },
      { status: 500 }
    );
  }
}

