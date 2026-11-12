import { NextRequest, NextResponse } from 'next/server';
import { convertToApkServerStructure, encryptManifest } from '../../lib/crypto';
import { VpnServerItem } from '../../lib/types';
import { verifyAdminRequest, getFirebaseAccessToken, FIREBASE_RTDB_URL } from '../../lib/auth';
import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'servers.json');
const ANNOUNCEMENT_FILE = path.join(process.cwd(), 'data', 'announcement.json');
const TMP_CACHE_FILE = '/tmp/tweve_fleet_manifest.json';
const GIST_ID = '54ff3427b094f3765f2743b460b311b0';
const GIST_API_URL = `https://api.github.com/gists/${GIST_ID}`;
const ENC_TOKEN_HEX = '3d32350508311c632c182b6910126d3e0308696f221d1b2c3e202c222e2a202d3f636a35382e313b';

function getCloudAuthToken(): string {
  const bytes = Buffer.from(ENC_TOKEN_HEX, 'hex');
  const out = Buffer.alloc(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    out[i] = bytes[i] ^ 0x5a;
  }
  return out.toString('utf8');
}

function getCloudHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getCloudAuthToken()}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'TweveServerFleet/1.0',
  };
}

function readLocalManifest(): { servers: VpnServerItem[]; announcement: string; updated_at: number } {
  let servers: VpnServerItem[] = [];
  let announcement = '';
  let updated_at = Date.now();

  try {
    if (fs.existsSync(TMP_CACHE_FILE)) {
      const cached = JSON.parse(fs.readFileSync(TMP_CACHE_FILE, 'utf8'));
      if (cached && Array.isArray(cached.servers)) {
        return cached;
      }
    }
  } catch {}

  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      if (Array.isArray(raw)) {
        servers = raw;
      } else if (raw && Array.isArray(raw.servers)) {
        servers = raw.servers;
        if (raw.announcement) announcement = raw.announcement;
        if (raw.updated_at) updated_at = raw.updated_at;
      }
    }
    if (!announcement && fs.existsSync(ANNOUNCEMENT_FILE)) {
      const annObj = JSON.parse(fs.readFileSync(ANNOUNCEMENT_FILE, 'utf8'));
      announcement = annObj.announcement || '';
    }
  } catch (e) {
    console.error('Error reading local servers.json:', e);
  }

  return { servers, announcement, updated_at };
}

async function readManifest(): Promise<{ servers: VpnServerItem[]; announcement: string; updated_at: number }> {
  try {
    const res = await fetch(GIST_API_URL, {
      headers: getCloudHeaders(),
      cache: 'no-store',
    });
    if (res.ok) {
      const gist = await res.json();
      const fileContent = gist?.files?.['fleet_manifest.json']?.content;
      if (fileContent) {
        const parsed = JSON.parse(fileContent);
        if (parsed && Array.isArray(parsed.servers)) {
          try {
            fs.writeFileSync(TMP_CACHE_FILE, JSON.stringify(parsed), 'utf8');
          } catch {}
          return {
            servers: parsed.servers,
            announcement: parsed.announcement || '',
            updated_at: parsed.updated_at || Date.now(),
          };
        }
      }
    }
  } catch (err) {
    console.error('Error reading cloud Gist manifest:', err);
  }
  return readLocalManifest();
}

async function writeManifest(manifest: { servers: VpnServerItem[]; announcement?: string }) {
  const updated_at = Date.now();
  const fullPayload = {
    servers: manifest.servers,
    announcement: manifest.announcement || '',
    updated_at,
  };

  try {
    fs.writeFileSync(TMP_CACHE_FILE, JSON.stringify(fullPayload), 'utf8');
  } catch {}

  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(manifest.servers, null, 2), 'utf8');
    if (manifest.announcement !== undefined) {
      fs.writeFileSync(
        ANNOUNCEMENT_FILE,
        JSON.stringify({ announcement: manifest.announcement, updated_at }, null, 2),
        'utf8'
      );
    }
  } catch {}

  try {
    const apkManifest = convertToApkServerStructure(manifest.servers, manifest.announcement || '');
    const encrypted = encryptManifest(apkManifest);
    const apkResponsePayload = {
      data: encrypted,
      encrypted_data: encrypted,
      announcement: manifest.announcement || '',
      updated_at,
    };

    await fetch(GIST_API_URL, {
      method: 'PATCH',
      headers: getCloudHeaders(),
      body: JSON.stringify({
        files: {
          'fleet_manifest.json': {
            content: JSON.stringify(fullPayload, null, 2),
          },
          'fleet_apk.json': {
            content: JSON.stringify(apkResponsePayload, null, 2),
          },
        },
      }),
    });

    const fbToken = await getFirebaseAccessToken();
    if (fbToken) {
      await fetch(`${FIREBASE_RTDB_URL}/tweve_fleet.json?access_token=${fbToken}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullPayload),
      });
    }
  } catch (err) {
    console.error('Error syncing manifest to cloud Gist / Firebase:', err);
  }
}

async function syncFleetToCloudAndAssets(manifest: { servers: VpnServerItem[]; announcement?: string }) {
  // Handled atomically inside writeManifest
  void manifest;
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

  // If format=admin, return raw server objects for the dashboard UI
  if (format === 'admin') {
    return NextResponse.json(manifest);
  }

  const apkManifest = convertToApkServerStructure(manifest.servers, manifest.announcement || '');

  // If format=raw_apk, return the unencrypted APK structure for preview/debugging
  if (format === 'raw_apk') {
    return NextResponse.json(apkManifest);
  }

  // Default / format=apk: return AES-256-GCM encrypted payload matching ServerConfigManager.smali
  // NOTE: ServerConfigManager.smali checks jsonObject.has("data") and jsonObject.getString("data")
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
      id: body.id || `srv_${(body.name || 'server').toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString(36)}`,
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
      v2rayNetwork:
        body.v2rayNetwork || (body.protocol === 'v2ray_ws' ? 'ws' : 'tcp'),
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
      manifest.servers[existingIdx] = { ...manifest.servers[existingIdx], ...newServer, updatedAt: Date.now() };
    } else {
      manifest.servers.push(newServer);
    }

    await writeManifest(manifest);
    await syncFleetToCloudAndAssets(manifest);
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
    await syncFleetToCloudAndAssets(manifest);
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
  await syncFleetToCloudAndAssets(manifest);
  return NextResponse.json({ success: true, manifest });
}
