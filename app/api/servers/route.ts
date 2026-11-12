import { NextRequest, NextResponse } from 'next/server';
import { convertToApkServerStructure, encryptManifest } from '../../lib/crypto';
import { VpnServerItem } from '../../lib/types';
import {
  verifyAdminRequest,
  getFirebaseAccessToken,
  FIREBASE_RTDB_URL,
  FIREBASE_PROJECT_ID,
} from '../../lib/auth';
import {
  getPaymentGatewayConfig,
  getServerPackages,
  getSubscriptionByKey,
} from '../../lib/pressopay';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, X-Admin-Session',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

const FIRESTORE_DOC_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/tweve_fleet/manifest`;

function computeExpiresAt(body: any, existingServer?: VpnServerItem): number | null {
  const unit = body.expireDurationUnit || existingServer?.expireDurationUnit || 'never';
  if (unit === 'never') return null;

  if (body.expiresAt !== undefined) {
    const explicit = Number(body.expiresAt);
    return explicit > 0 ? explicit : null;
  }

  const val = Number(body.expireDurationValue || 0);
  if (!val || val <= 0) return existingServer?.expiresAt || null;

  const now = Date.now();
  const unitMultipliers: Record<string, number> = {
    minutes: 60 * 1000,
    hours: 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000,
    weeks: 7 * 24 * 60 * 60 * 1000,
    months: 30 * 24 * 60 * 60 * 1000,
  };
  const mult = unitMultipliers[unit];
  return mult ? now + Math.round(val * mult) : existingServer?.expiresAt || null;
}

/**
 * Enforces server expiration lifecycle:
 * - If a server has reached `expiresAt` and `expireAction === 'delete'` (default),
 *   it is automatically deleted from the database.
 * - If `expireAction === 'hide'`, it is marked `isExpired = true` and `isActive = false`
 *   so users never see it while admins can still view or renew it.
 */
async function enforceServerExpirations(manifest: {
  servers: VpnServerItem[];
  announcement: string;
  updated_at: number;
}): Promise<{ servers: VpnServerItem[]; announcement: string; updated_at: number }> {
  const now = Date.now();
  let dirty = false;
  const survivingServers: VpnServerItem[] = [];

  for (const s of manifest.servers) {
    const exp = s.expiresAt ? Number(s.expiresAt) : 0;
    if (exp > 0 && now >= exp) {
      const action = s.expireAction || 'delete';
      if (action === 'delete') {
        // Auto-delete from database
        dirty = true;
        continue;
      } else {
        // Hide from users, keep in admin list
        if (!s.isExpired || s.isActive !== false) {
          s.isExpired = true;
          s.isActive = false;
          s.updatedAt = now;
          dirty = true;
        }
      }
    } else if (exp > 0 && now < exp && s.isExpired) {
      s.isExpired = false;
      dirty = true;
    }
    survivingServers.push(s);
  }

  if (dirty) {
    manifest.servers = survivingServers;
    manifest.updated_at = now;
    try {
      await writeManifest(manifest);
    } catch (err) {
      console.error('Failed to persist auto-expiration update:', err);
    }
  }

  return manifest;
}

/**
 * Reads the server fleet manifest strictly from private server-side Firebase Database
 * (Firebase Realtime Database `/tweve_fleet` with Cloud Firestore fallback).
 * Zero local JSON files or public Gist URLs are ever read or exposed.
 */
async function readManifest(): Promise<{ servers: VpnServerItem[]; announcement: string; updated_at: number }> {
  const fbToken = await getFirebaseAccessToken();
  if (fbToken) {
    // 1. Primary: Private Firebase Realtime Database (`/tweve_fleet.json`)
    try {
      const rtdbRes = await fetch(`${FIREBASE_RTDB_URL}/tweve_fleet.json?access_token=${fbToken}`, {
        cache: 'no-store',
      });
      if (rtdbRes.ok) {
        const parsed = await rtdbRes.json();
        if (parsed && typeof parsed === 'object') {
          const serversList = Array.isArray(parsed.servers)
            ? parsed.servers
            : parsed.servers && typeof parsed.servers === 'object'
              ? Object.values(parsed.servers)
              : [];
          return await enforceServerExpirations({
            servers: serversList as VpnServerItem[],
            announcement: typeof parsed.announcement === 'string' ? parsed.announcement : '',
            updated_at: Number(parsed.updated_at || Date.now()),
          });
        }
      }
    } catch (err) {
      console.error('Error reading private Firebase RTDB manifest:', err);
    }

    // 2. Secondary fallback: Private Cloud Firestore (`tweve_fleet/manifest`)
    try {
      const fsRes = await fetch(FIRESTORE_DOC_URL, {
        headers: { Authorization: `Bearer ${fbToken}` },
        cache: 'no-store',
      });
      if (fsRes.ok) {
        const doc = await fsRes.json();
        const jsonStr = doc?.fields?.payload?.stringValue;
        if (jsonStr) {
          const parsed = JSON.parse(jsonStr);
          if (parsed && Array.isArray(parsed.servers)) {
            return await enforceServerExpirations({
              servers: parsed.servers,
              announcement: parsed.announcement || '',
              updated_at: parsed.updated_at || Date.now(),
            });
          }
        }
      }
    } catch (err) {
      console.error('Error reading private Cloud Firestore manifest:', err);
    }
  }

  return { servers: [], announcement: '', updated_at: Date.now() };
}

/**
 * Writes the server fleet manifest strictly to private server-side Firebase Database
 * (Firebase Realtime Database `/tweve_fleet` + `/tweve_fleet_apk` and Cloud Firestore `tweve_fleet/manifest`).
 * Protected by OAuth2 Service Account credentials and `.read: false, .write: false` public security rules.
 */
async function writeManifest(manifest: { servers: VpnServerItem[]; announcement?: string }) {
  const updated_at = Date.now();
  const fullPayload = {
    servers: manifest.servers,
    announcement: manifest.announcement || '',
    updated_at,
  };

  const apkManifest = convertToApkServerStructure(manifest.servers, manifest.announcement || '');
  const encrypted = encryptManifest(apkManifest);
  const apkResponsePayload = {
    data: encrypted,
    encrypted_data: encrypted,
    announcement: manifest.announcement || '',
    updated_at,
  };

  const fbToken = await getFirebaseAccessToken();
  if (!fbToken) {
    throw new Error('Failed to authenticate with private Firebase Database');
  }

  // 1. Write raw admin manifest & AES-256-GCM encrypted APK payload to private Firebase RTDB
  await Promise.all([
    fetch(`${FIREBASE_RTDB_URL}/tweve_fleet.json?access_token=${fbToken}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullPayload),
      cache: 'no-store',
    }),
    fetch(`${FIREBASE_RTDB_URL}/tweve_fleet_apk.json?access_token=${fbToken}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apkResponsePayload),
      cache: 'no-store',
    }),
    // 2. Mirror encrypted backup to private Cloud Firestore (`tweve_fleet/manifest`)
    fetch(FIRESTORE_DOC_URL, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${fbToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          payload: { stringValue: JSON.stringify(fullPayload) },
          encrypted_apk: { stringValue: encrypted },
          updated_at: { integerValue: String(updated_at) },
        },
      }),
      cache: 'no-store',
    }).catch(() => null),
  ]);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format');

  // Protect raw admin & raw_apk formats: require authenticated admin session
  if (format === 'admin' || format === 'raw_apk') {
    const auth = await verifyAdminRequest(req);
    if (!auth.valid) {
      return NextResponse.json({ error: 'Unauthorized: Admin login required' }, { status: 401 });
    }
  }

  const manifest = await readManifest();

  // If format=admin, return raw server objects for the authenticated dashboard UI only
  if (format === 'admin') {
    return NextResponse.json(manifest);
  }

  // If format=store, return public store catalog of servers with package durations & TZS prices
  // Zero hosts, credentials, payloads, or UUIDs are exposed in format=store!
  if (format === 'store') {
    const gateway = await getPaymentGatewayConfig();
    const now = Date.now();
    const storeServers = manifest.servers
      .filter((s) => s.isActive !== false && !s.isExpired && (!s.expiresAt || Number(s.expiresAt) > now))
      .map((s) => {
        const isPaid = Boolean(
          s.requiresPackage || s.tier === 'VIP' || s.tier === 'PREMIUM'
        );
        const packages = getServerPackages(
          s,
          gateway.defaultPrice7Days,
          gateway.defaultPrice30Days
        );
        return {
          id: s.id,
          name: s.name,
          country: s.country || 'TZ',
          tier: s.tier || 'FREE',
          protocol: s.protocol,
          requiresPackage: isPaid,
          packagePricingMode: s.packagePricingMode || (isPaid ? 'default' : 'none'),
          price7DaysTzs: s.price7DaysTzs ?? gateway.defaultPrice7Days,
          price30DaysTzs: s.price30DaysTzs ?? gateway.defaultPrice30Days,
          packages,
          expiresAt: s.expiresAt || null,
          connectedUsersCount: Number(s.connectedUsersCount || 0),
        };
      });

    return NextResponse.json(
      {
        servers: storeServers,
        defaultPrice7Days: gateway.defaultPrice7Days,
        defaultPrice30Days: gateway.defaultPrice30Days,
        currency: 'TZS',
        announcement: manifest.announcement || '',
        updated_at: manifest.updated_at,
      },
      { headers: CORS_HEADERS }
    );
  }

  // Check if the APK client passed an X-API-Key header for an active paid package subscription
  const apiKey = (req.headers.get('x-api-key') || searchParams.get('key') || '').trim();
  const activeSub = apiKey ? await getSubscriptionByKey(apiKey).catch(() => null) : null;

  const apkManifest = convertToApkServerStructure(
    manifest.servers,
    manifest.announcement || '',
    activeSub
  );

  // If format=raw_apk, return the unencrypted APK structure for authenticated admin preview only
  if (format === 'raw_apk') {
    return NextResponse.json(apkManifest);
  }

  // Default / format=apk: return AES-256-GCM encrypted payload (zero plaintext server URLs exposed)
  const encrypted = encryptManifest(apkManifest);
  return NextResponse.json(
    {
      data: encrypted,
      encrypted_data: encrypted,
      announcement: manifest.announcement || '',
      updated_at: manifest.updated_at,
    },
    { headers: CORS_HEADERS }
  );
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdminRequest(req);
  if (!auth.valid) {
    return NextResponse.json({ error: 'Unauthorized: Admin login required' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const manifest = await readManifest();

    const existingIdx = manifest.servers.findIndex((s) => s.id === body.id);
    const existingSrv = existingIdx >= 0 ? manifest.servers[existingIdx] : undefined;
    const computedExpiry = computeExpiresAt(body, existingSrv);

    const newServer: VpnServerItem = {
      id:
        body.id ||
        `srv_${(body.name || 'server').toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString(36)}`,
      name: body.name || 'Unnamed Server',
      country: (body.country || 'TZ').toUpperCase(),
      tier: body.tier || 'FREE',
      protocol: body.protocol || 'slowdns',
      host: body.host || body.v2rayAddress || body.slipstreamDomain || body.dnsttNameserver || '',
      portDirect: Number(body.portDirect || 22),
      portHTTP: Number(body.portHTTP || 80),
      portSSL: Number(body.portSSL || 443),
      portDNSTT: Number(body.portDNSTT || 22),
      username: body.username || '',
      password: body.password || '',
      payload: body.payload || '',
      sni: body.sni || '',
      proxyHost: body.proxyHost || '',
      proxyPort: Number(body.proxyPort || 8080),
      cdnDomain: body.cdnDomain || '',
      cdnPayload: body.cdnPayload || '',
      dnsttNameserver: body.dnsttNameserver || '',
      dnsttPubkey: body.dnsttPubkey || '',
      dnsResolver: body.dnsResolver || '8.8.8.8:53',
      dnsttBase62: Boolean(body.dnsttBase62),
      dnsttBooster: body.dnsttBooster !== undefined ? Boolean(body.dnsttBooster) : true,
      dnsttBoosterSegments: Number(body.dnsttBoosterSegments || 4),
      dnsttTurbo: body.dnsttTurbo !== undefined ? Boolean(body.dnsttTurbo) : true,
      v2rayAddress: body.v2rayAddress || body.host || '',
      v2rayPort: Number(body.v2rayPort || 443),
      v2rayProtocol: body.v2rayProtocol || 'vless',
      v2rayUuid: body.v2rayUuid || '',
      v2raySecurity:
        body.v2raySecurity ||
        (body.protocol === 'v2ray_reality'
          ? 'reality'
          : body.protocol === 'v2ray_ws'
            ? 'tls'
            : 'none'),
      v2raySni: body.v2raySni || body.sni || '',
      v2rayPublicKey: body.v2rayPublicKey || '',
      v2rayShortId: body.v2rayShortId || '',
      v2rayFingerprint: body.v2rayFingerprint || 'chrome',
      v2rayNetwork: body.v2rayNetwork || (body.protocol === 'v2ray_ws' ? 'ws' : 'tcp'),
      v2rayWsHost: body.v2rayWsHost || '',
      v2rayWsPath: body.v2rayWsPath || '/',
      v2rayAllowInsecure: Boolean(body.v2rayAllowInsecure),
      hysteriaPort: Number(body.hysteriaPort || 443),
      hysteriaPorts: body.hysteriaPorts || '',
      hysteriaHopInterval: Number(body.hysteriaHopInterval || 30),
      hysteriaAuth: body.hysteriaAuth || '',
      hysteriaObfs: body.hysteriaObfs || '',
      hysteriaSni: body.hysteriaSni || '',
      hysteriaInsecure: body.hysteriaInsecure !== undefined ? Boolean(body.hysteriaInsecure) : true,
      hysteriaUp: Number(body.hysteriaUp || 20),
      hysteriaDown: Number(body.hysteriaDown || 100),
      slipstreamDomain: body.slipstreamDomain || '',
      slipstreamCert: body.slipstreamCert || '',
      slipstreamDirect: Boolean(body.slipstreamDirect),
      wireguardConfig: body.wireguardConfig || '',
      isLocked: body.isLocked !== undefined ? Boolean(body.isLocked) : true,
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
      expiresAt: computedExpiry,
      expireDurationValue: body.expireDurationValue !== undefined ? Number(body.expireDurationValue) : undefined,
      expireDurationUnit: body.expireDurationUnit || 'never',
      expireAction: body.expireAction === 'hide' ? 'hide' : 'delete',
      isExpired: Boolean(computedExpiry && computedExpiry > 0 && Date.now() >= computedExpiry),
      requiresPackage:
        body.requiresPackage !== undefined
          ? Boolean(body.requiresPackage)
          : body.tier === 'VIP' || body.tier === 'PREMIUM',
      packagePricingMode:
        body.packagePricingMode ||
        (body.requiresPackage || body.tier === 'VIP' || body.tier === 'PREMIUM' ? 'default' : 'none'),
      price7DaysTzs:
        body.price7DaysTzs !== undefined && body.price7DaysTzs !== null
          ? Number(body.price7DaysTzs)
          : 2700,
      price30DaysTzs:
        body.price30DaysTzs !== undefined && body.price30DaysTzs !== null
          ? Number(body.price30DaysTzs)
          : 8500,
      connectedUsersCount: Number(body.connectedUsersCount || 0),
      createdAt: existingSrv?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    if (existingIdx >= 0) {
      manifest.servers[existingIdx] = {
        ...manifest.servers[existingIdx],
        ...newServer,
        updatedAt: Date.now(),
      };
    } else {
      manifest.servers.push(newServer);
    }

    await writeManifest(manifest);
    return NextResponse.json({ success: true, server: newServer, manifest });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await verifyAdminRequest(req);
  if (!auth.valid) {
    return NextResponse.json({ error: 'Unauthorized: Admin login required' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const manifest = await readManifest();

    if (body.announcement !== undefined) {
      manifest.announcement = body.announcement;
    }

    if (body.id) {
      const idx = manifest.servers.findIndex((s) => s.id === body.id);
      if (idx >= 0) {
        const current = manifest.servers[idx];
        const nextServer: VpnServerItem = {
          ...current,
          ...body,
          updatedAt: Date.now(),
        };
        if (body.expireDurationUnit !== undefined || body.expiresAt !== undefined) {
          nextServer.expiresAt = computeExpiresAt(body, current);
          nextServer.isExpired = Boolean(
            nextServer.expiresAt && nextServer.expiresAt > 0 && Date.now() >= nextServer.expiresAt
          );
        } else if (body.isActive === true && current.isExpired) {
          // If admin manually re-enables a hidden expired server without setting a new timer, clear expired flag
          nextServer.expiresAt = null;
          nextServer.expireDurationUnit = 'never';
          nextServer.isExpired = false;
        }
        manifest.servers[idx] = nextServer;
      }
    }

    await writeManifest(manifest);
    return NextResponse.json({ success: true, manifest });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await verifyAdminRequest(req);
  if (!auth.valid) {
    return NextResponse.json({ error: 'Unauthorized: Admin login required' }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const manifest = await readManifest();

  if (id === 'ALL') {
    manifest.servers = [];
  } else if (id) {
    manifest.servers = manifest.servers.filter((s) => s.id !== id);
  }

  await writeManifest(manifest);
  return NextResponse.json({ success: true, manifest });
}
