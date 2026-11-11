import { NextRequest, NextResponse } from 'next/server';

interface UserSession {
  deviceId: string;
  ip: string;
  serverName: string;
  protocol: string;
  country: string;
  bytesUp: number;
  bytesDown: number;
  connectedAt: number;
  lastPing: number;
}

// In-memory active live sessions map (populated strictly by real incoming client pings)
const sessions = new Map<string, UserSession>();

export async function GET(req: NextRequest) {
  const now = Date.now();

  // Expire inactive device sessions older than 5 minutes (300,000 ms)
  for (const [id, sess] of sessions.entries()) {
    if (now - sess.lastPing > 300000) {
      sessions.delete(id);
    }
  }

  const activeSessions = Array.from(sessions.values());
  const totalActive = activeSessions.length;

  const protocolCounts: Record<string, number> = {};
  for (const s of activeSessions) {
    protocolCounts[s.protocol] = (protocolCounts[s.protocol] || 0) + 1;
  }

  const serverCounts: Record<string, number> = {};
  for (const s of activeSessions) {
    serverCounts[s.serverName] = (serverCounts[s.serverName] || 0) + 1;
  }

  const totalUpBytes = activeSessions.reduce((acc, s) => acc + s.bytesUp, 0);
  const totalDownBytes = activeSessions.reduce((acc, s) => acc + s.bytesDown, 0);

  return NextResponse.json({
    activeUsersCount: totalActive,
    liveSampledSessions: activeSessions,
    protocolBreakdown: protocolCounts,
    topServers: serverCounts,
    bandwidth: {
      totalUpMB: (totalUpBytes / 1024 / 1024).toFixed(1),
      totalDownMB: (totalDownBytes / 1024 / 1024).toFixed(1),
    },
    updatedAt: now,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { deviceId, serverName, protocol, country, bytesUp, bytesDown } = body;
    if (!deviceId) {
      return NextResponse.json({ error: 'deviceId is required' }, { status: 400 });
    }

    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';
    const existing = sessions.get(deviceId);

    sessions.set(deviceId, {
      deviceId,
      ip: clientIp,
      serverName: serverName || (existing ? existing.serverName : 'Custom Server'),
      protocol: protocol || (existing ? existing.protocol : 'slowdns'),
      country: country || 'TZ',
      bytesUp: bytesUp !== undefined ? bytesUp : (existing ? existing.bytesUp : 0),
      bytesDown: bytesDown !== undefined ? bytesDown : (existing ? existing.bytesDown : 0),
      connectedAt: existing ? existing.connectedAt : Date.now(),
      lastPing: Date.now(),
    });

    return NextResponse.json({ success: true, activeUsers: sessions.size });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
