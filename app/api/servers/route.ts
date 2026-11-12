import { NextRequest, NextResponse } from 'next/server';
import { convertToApkServerStructure, encryptManifest } from '../../lib/crypto';
import { VpnServerItem } from '../../lib/types';
import {
  verifyAdminRequest,
  getFirebaseAccessToken,
  FIREBASE_RTDB_URL,
  FIREBASE_PROJECT_ID,
} from '../../lib/auth';

const FIRESTORE_DOC_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/tweve_fleet/manifest`;

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
          return {
            servers: serversList as VpnServerItem[],
            announcement: typeof parsed.announcement === 'string' ? parsed.announcement : '',
            updated_at: Number(parsed.updated_at || Date.now()),
          };
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
            return {
              servers: parsed.servers,
              announcement: parsed.announcement || '',
              updated_at: parsed.updated_at || Date.now(),
            };
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

  const apkManifest = convertToApkServerStructure(manifest.servers, manifest.announcement || '');

  // If format=raw_apk, return the unencrypted APK structure for authenticated admin preview only
  if (format === 'raw_apk') {
    return NextResponse.json(apkManifest);
  }

  // Default / format=apk: return AES-256-GCM encrypted payload (zero plaintext server URLs exposed)
  const encrypted = encryptManifest(apkManifest);
  return NextResponse.json({
    data: encrypted,
    encrypted_data: encrypted,
    announcement: manifest.announcement || '',
    updated_at: manifest.updated_at,
  });
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdminRequest(req);
  if (!auth.valid) {
    return NextResponse.json({ error: 'Unauthorized: Admin login required' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const manifest = await readManifest();

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
      connectedUsersCount: Number(body.connectedUsersCount || 0),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const existingIdx = manifest.servers.findIndex((s) => s.id === newServer.id);
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
        manifest.servers[idx] = {
          ...manifest.servers[idx],
          ...body,
          updatedAt: Date.now(),
        };
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
