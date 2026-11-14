import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, getFirebaseAccessToken, FIREBASE_RTDB_URL } from '../../lib/auth';
import {
  enforceApiSecurity,
  handleUnauthorizedAdminProbe,
  SILENT_SECURITY_HEADERS,
} from '../../lib/security';

export interface TelemetryDeviceRecord {
  deviceId: string;
  sessionId: string;
  ip: string;
  serverId: string;
  serverName: string;
  protocol: string;
  country: string;
  status: 'connected' | 'disconnected' | 'standby';
  sessionBytesUp: number;
  sessionBytesDown: number;
  totalBytesUp: number;
  totalBytesDown: number;
  connectedAt: number;
  lastPing: number;
}

export interface ServerTelemetryStats {
  serverId: string;
  serverName: string;
  country: string;
  protocol: string;
  totalBytesUp: number;
  totalBytesDown: number;
  uniqueDevices?: Record<string, boolean>;
  lastActiveAt: number;
}

interface PersistedTelemetryState {
  devices: Record<string, TelemetryDeviceRecord>;
  servers: Record<string, ServerTelemetryStats>;
  cumulativeUpBytes: number;
  cumulativeDownBytes: number;
  updatedAt: number;
}

// Active session timeout: 90 seconds (Android app sends heartbeat every 10 seconds while connected)
const ACTIVE_SESSION_TIMEOUT_MS = 90 * 1000;

let cachedState: PersistedTelemetryState | null = null;
let lastCacheSync = 0;

function sanitizeKey(raw: string): string {
  return String(raw || 'unknown')
    .trim()
    .replace(/[.#$/[\]\s]+/g, '_')
    .slice(0, 80);
}

function formatDataUsage(bytes: number): string {
  const safeBytes = Math.max(0, Number(bytes) || 0);
  const mb = safeBytes / (1024 * 1024);
  const gb = safeBytes / (1024 * 1024 * 1024);
  const tb = safeBytes / (1024 * 1024 * 1024 * 1024);
  if (tb >= 1) {
    return `${tb.toFixed(2)} TB`;
  }
  if (gb >= 1) {
    return `${gb.toFixed(2)} GB`;
  }
  return `${mb.toFixed(2)} MB`;
}

async function loadTelemetryState(forceRefresh = false): Promise<PersistedTelemetryState> {
  const now = Date.now();
  if (!forceRefresh && cachedState && now - lastCacheSync < 4000) {
    return cachedState;
  }

  try {
    const token = await getFirebaseAccessToken();
    if (token) {
      const res = await fetch(
        `${FIREBASE_RTDB_URL}/tweve_telemetry.json?access_token=${encodeURIComponent(token)}`,
        { cache: 'no-store' }
      );
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object') {
          cachedState = {
            devices: data.devices && typeof data.devices === 'object' ? data.devices : {},
            servers: data.servers && typeof data.servers === 'object' ? data.servers : {},
            cumulativeUpBytes: Number(data.cumulativeUpBytes) || 0,
            cumulativeDownBytes: Number(data.cumulativeDownBytes) || 0,
            updatedAt: Number(data.updatedAt) || now,
          };
          lastCacheSync = now;
          return cachedState;
        }
      }
    }
  } catch {
    // Fallback to in-memory cache if network hiccups
  }

  if (!cachedState) {
    cachedState = {
      devices: {},
      servers: {},
      cumulativeUpBytes: 0,
      cumulativeDownBytes: 0,
      updatedAt: now,
    };
  }
  return cachedState;
}

async function saveTelemetryState(state: PersistedTelemetryState): Promise<void> {
  state.updatedAt = Date.now();
  cachedState = state;
  lastCacheSync = state.updatedAt;

  try {
    const token = await getFirebaseAccessToken();
    if (token) {
      await fetch(
        `${FIREBASE_RTDB_URL}/tweve_telemetry.json?access_token=${encodeURIComponent(token)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state),
          cache: 'no-store',
        }
      );
    }
  } catch {
    // Keep in-memory state if RTDB write fails
  }
}

export async function GET(req: NextRequest) {
  const blocked = await enforceApiSecurity(req, { scope: 'browser_only' });
  if (blocked) return blocked;

  const auth = await verifyAdminRequest(req);
  if (!auth.valid) {
    return await handleUnauthorizedAdminProbe(req, 'GET /api/analytics');
  }

  const now = Date.now();
  const state = await loadTelemetryState(true);

  const allDevices = Object.values(state.devices || {});
  const activeSessions = allDevices.filter(
    (d) => d && d.status === 'connected' && now - (Number(d.lastPing) || 0) <= ACTIVE_SESSION_TIMEOUT_MS
  );

  const totalActive = activeSessions.length;
  const totalConfiguredUsersCount = allDevices.length;

  const protocolCounts: Record<string, number> = {};
  const serverActiveCounts: Record<string, number> = {};

  for (const s of activeSessions) {
    const proto = s.protocol || 'slowdns';
    protocolCounts[proto] = (protocolCounts[proto] || 0) + 1;

    if (s.serverId) {
      serverActiveCounts[s.serverId] = (serverActiveCounts[s.serverId] || 0) + 1;
    }
    if (s.serverName && s.serverName !== s.serverId) {
      serverActiveCounts[s.serverName] = (serverActiveCounts[s.serverName] || 0) + 1;
    }
  }

  // Compute live session bytes and all-time cumulative bytes
  const liveUpBytes = activeSessions.reduce((acc, s) => acc + (Number(s.sessionBytesUp) || 0), 0);
  const liveDownBytes = activeSessions.reduce((acc, s) => acc + (Number(s.sessionBytesDown) || 0), 0);
  const liveTotalBytes = liveUpBytes + liveDownBytes;

  // Sum across all devices for ground-truth total
  const sumDevicesUp = allDevices.reduce((acc, d) => acc + (Number(d.totalBytesUp) || 0), 0);
  const sumDevicesDown = allDevices.reduce((acc, d) => acc + (Number(d.totalBytesDown) || 0), 0);

  const totalUpBytes = Math.max(Number(state.cumulativeUpBytes) || 0, sumDevicesUp, liveUpBytes);
  const totalDownBytes = Math.max(Number(state.cumulativeDownBytes) || 0, sumDevicesDown, liveDownBytes);
  const totalBytes = totalUpBytes + totalDownBytes;

  // Build per-server telemetry breakdown (keyed by both serverId and serverName for easy lookup)
  const serverTelemetry: Record<
    string,
    {
      serverId: string;
      serverName: string;
      activeUsers: number;
      totalUsers: number;
      bytesUp: number;
      bytesDown: number;
      totalBytes: number;
      totalMB: string;
      totalGB: string;
      totalTB: string;
      formattedTotal: string;
      formattedDown: string;
      formattedUp: string;
    }
  > = {};

  for (const srv of Object.values(state.servers || {})) {
    if (!srv) continue;
    const activeById = srv.serverId ? serverActiveCounts[srv.serverId] || 0 : 0;
    const activeByName = srv.serverName ? serverActiveCounts[srv.serverName] || 0 : 0;
    const activeUsers = Math.max(activeById, activeByName);
    const uniqueUsersCount = Math.max(
      activeUsers,
      srv.uniqueDevices ? Object.keys(srv.uniqueDevices).length : 0
    );
    const bUp = Number(srv.totalBytesUp) || 0;
    const bDown = Number(srv.totalBytesDown) || 0;
    const bTotal = bUp + bDown;

    const entry = {
      serverId: srv.serverId || srv.serverName,
      serverName: srv.serverName || srv.serverId,
      activeUsers,
      totalUsers: uniqueUsersCount,
      bytesUp: bUp,
      bytesDown: bDown,
      totalBytes: bTotal,
      totalMB: (bTotal / (1024 * 1024)).toFixed(2),
      totalGB: (bTotal / (1024 * 1024 * 1024)).toFixed(3),
      totalTB: (bTotal / (1024 * 1024 * 1024 * 1024)).toFixed(3),
      formattedTotal: formatDataUsage(bTotal),
      formattedDown: formatDataUsage(bDown),
      formattedUp: formatDataUsage(bUp),
    };

    if (srv.serverId) serverTelemetry[srv.serverId] = entry;
    if (srv.serverName) serverTelemetry[srv.serverName] = entry;
  }

  // Sort devices by active status first, then most recent ping
  const sortedDevices = [...allDevices]
    .sort((a, b) => {
      const aActive = a.status === 'connected' && now - a.lastPing <= ACTIVE_SESSION_TIMEOUT_MS ? 1 : 0;
      const bActive = b.status === 'connected' && now - b.lastPing <= ACTIVE_SESSION_TIMEOUT_MS ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      return (b.lastPing || 0) - (a.lastPing || 0);
    })
    .slice(0, 50)
    .map((d) => {
      const isOnline = d.status === 'connected' && now - (Number(d.lastPing) || 0) <= ACTIVE_SESSION_TIMEOUT_MS;
      const sessUp = Number(d.sessionBytesUp) || 0;
      const sessDown = Number(d.sessionBytesDown) || 0;
      const totUp = Math.max(Number(d.totalBytesUp) || 0, sessUp);
      const totDown = Math.max(Number(d.totalBytesDown) || 0, sessDown);
      return {
        deviceId: d.deviceId,
        serverId: d.serverId || 'custom',
        serverName: d.serverName || 'Tweve Server',
        protocol: d.protocol || 'slowdns',
        country: d.country || 'TZ',
        ip: d.ip || '0.0.0.0',
        status: isOnline ? 'connected' : 'offline',
        connectedSince: d.connectedAt || d.lastPing,
        lastPing: d.lastPing,
        bytesUp: sessUp,
        bytesDown: sessDown,
        totalBytesUp: totUp,
        totalBytesDown: totDown,
        formattedSessionTotal: formatDataUsage(sessUp + sessDown),
        formattedAllTimeTotal: formatDataUsage(totUp + totDown),
        formattedDown: formatDataUsage(totDown),
        formattedUp: formatDataUsage(totUp),
      };
    });

  return NextResponse.json({
    activeUsersCount: totalActive,
    totalConfiguredUsersCount,
    liveSampledSessions: sortedDevices,
    protocolBreakdown: protocolCounts,
    topServers: serverActiveCounts,
    serverTelemetry,
    bandwidth: {
      totalUpBytes,
      totalDownBytes,
      totalBytes,
      liveUpBytes,
      liveDownBytes,
      liveTotalBytes,
      totalUpMB: Number((totalUpBytes / (1024 * 1024)).toFixed(2)),
      totalDownMB: Number((totalDownBytes / (1024 * 1024)).toFixed(2)),
      totalMB: Number((totalBytes / (1024 * 1024)).toFixed(2)),
      totalGB: Number((totalBytes / (1024 * 1024 * 1024)).toFixed(3)),
      totalTB: Number((totalBytes / (1024 * 1024 * 1024 * 1024)).toFixed(3)),
      formattedTotal: formatDataUsage(totalBytes),
      formattedDown: formatDataUsage(totalDownBytes),
      formattedUp: formatDataUsage(totalUpBytes),
      formattedLiveTotal: formatDataUsage(liveTotalBytes),
    },
    updatedAt: now,
  });
}

export async function POST(req: NextRequest) {
  const blocked = await enforceApiSecurity(req, { scope: 'public_api' });
  if (blocked) return blocked;

  try {
    const body = await req.json();
    const {
      deviceId,
      sessionId,
      serverId,
      serverName,
      protocol,
      country,
      bytesUp,
      bytesDown,
      status,
    } = body;

    if (!deviceId) {
      return NextResponse.json({ error: 'deviceId is required' }, { status: 400 });
    }

    const now = Date.now();
    const safeDeviceKey = sanitizeKey(deviceId);
    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';

    const state = await loadTelemetryState(false);
    const prev = state.devices[safeDeviceKey];

    const incomingUp = Math.max(0, Number(bytesUp) || 0);
    const incomingDown = Math.max(0, Number(bytesDown) || 0);
    const incomingSessionId = String(sessionId || (prev?.sessionId ?? now));
    const normalizedStatus: 'connected' | 'disconnected' | 'standby' =
      status === 'disconnected'
        ? 'disconnected'
        : status === 'standby'
        ? 'standby'
        : 'connected';

    // Calculate incremental bytes delta since last ping for this session
    let deltaUp = 0;
    let deltaDown = 0;

    if (!prev || prev.sessionId !== incomingSessionId) {
      deltaUp = incomingUp;
      deltaDown = incomingDown;
    } else {
      deltaUp = incomingUp >= prev.sessionBytesUp ? incomingUp - prev.sessionBytesUp : incomingUp;
      deltaDown = incomingDown >= prev.sessionBytesDown ? incomingDown - prev.sessionBytesDown : incomingDown;
    }

    const resolvedServerId = String(serverId || prev?.serverId || 'fleet_default');
    const resolvedServerName = String(serverName || prev?.serverName || 'Tweve Server');
    const resolvedProtocol = String(protocol || prev?.protocol || 'slowdns');
    const resolvedCountry = String(country || prev?.country || 'TZ');

    const updatedDevice: TelemetryDeviceRecord = {
      deviceId: String(deviceId).slice(0, 64),
      sessionId: incomingSessionId,
      ip: clientIp,
      serverId: resolvedServerId,
      serverName: resolvedServerName,
      protocol: resolvedProtocol,
      country: resolvedCountry,
      status: normalizedStatus,
      sessionBytesUp: normalizedStatus === 'disconnected' ? 0 : incomingUp,
      sessionBytesDown: normalizedStatus === 'disconnected' ? 0 : incomingDown,
      totalBytesUp: (Number(prev?.totalBytesUp) || 0) + deltaUp,
      totalBytesDown: (Number(prev?.totalBytesDown) || 0) + deltaDown,
      connectedAt:
        !prev || prev.status !== 'connected' || prev.sessionId !== incomingSessionId
          ? now
          : prev.connectedAt || now,
      lastPing: now,
    };

    state.devices[safeDeviceKey] = updatedDevice;
    state.cumulativeUpBytes = (Number(state.cumulativeUpBytes) || 0) + deltaUp;
    state.cumulativeDownBytes = (Number(state.cumulativeDownBytes) || 0) + deltaDown;

    // Update per-server telemetry stats
    const serverKey = sanitizeKey(resolvedServerId !== 'custom' ? resolvedServerId : resolvedServerName);
    const prevServer = state.servers[serverKey];
    const uniqueDevices = prevServer?.uniqueDevices && typeof prevServer.uniqueDevices === 'object'
      ? { ...prevServer.uniqueDevices }
      : {};
    uniqueDevices[safeDeviceKey] = true;

    state.servers[serverKey] = {
      serverId: resolvedServerId,
      serverName: resolvedServerName,
      country: resolvedCountry,
      protocol: resolvedProtocol,
      totalBytesUp: (Number(prevServer?.totalBytesUp) || 0) + deltaUp,
      totalBytesDown: (Number(prevServer?.totalBytesDown) || 0) + deltaDown,
      uniqueDevices,
      lastActiveAt: now,
    };

    await saveTelemetryState(state);

    const activeCount = Object.values(state.devices).filter(
      (d) => d && d.status === 'connected' && now - (Number(d.lastPing) || 0) <= ACTIVE_SESSION_TIMEOUT_MS
    ).length;

    return NextResponse.json({
      success: true,
      activeUsers: activeCount,
      totalConfiguredUsers: Object.keys(state.devices).length,
      formattedDeviceTotal: formatDataUsage(updatedDevice.totalBytesUp + updatedDevice.totalBytesDown),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Telemetry error' }, { status: 500 });
  }
}
