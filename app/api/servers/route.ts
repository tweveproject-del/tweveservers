import { NextRequest, NextResponse } from 'next/server';
import { convertToApkServerStructure, encryptManifest } from '../../lib/crypto';
import { VpnServerItem } from '../../lib/types';
import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'servers.json');
const ANNOUNCEMENT_FILE = path.join(process.cwd(), 'data', 'announcement.json');
const FIREBASE_FLEET_URL = 'https://tunnel-7a4c7-default-rtdb.firebaseio.com/fleet_servers.json';
const FIREBASE_ADMIN_URL = 'https://tunnel-7a4c7-default-rtdb.firebaseio.com/fleet_admin_manifest.json';

function readLocalManifest(): { servers: VpnServerItem[]; announcement: string; updated_at: number } {
  let servers: VpnServerItem[] = [];
  let announcement = '';
  let updated_at = Date.now();

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
  const local = readLocalManifest();
  try {
    const res = await fetch(FIREBASE_ADMIN_URL, { cache: 'no-store' });
    if (res.ok) {
      const cloud = await res.json();
      if (cloud && Array.isArray(cloud.servers)) {
        return {
          servers: cloud.servers,
          announcement: cloud.announcement || local.announcement || '',
          updated_at: cloud.updated_at || Date.now(),
        };
      }
    }
  } catch {
    // Fallback to local file when offline
  }
  return local;
}

async function writeManifest(manifest: { servers: VpnServerItem[]; announcement?: string }) {
  const updated_at = Date.now();
  // 1. Try writing local files (works in local dev; ignored on read-only Vercel serverless FS)
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
  } catch {
    // Read-only filesystem on Vercel serverless — cloud persistence handles it below
  }

  // 2. Persist admin manifest to Firebase RTDB so Vercel serverless functions stay stateless & persistent
  try {
    await fetch(FIREBASE_ADMIN_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        servers: manifest.servers,
        announcement: manifest.announcement || '',
        updated_at,
      }),
    });
  } catch (err) {
    console.error('Error syncing admin manifest to cloud:', err);
  }
}

async function syncFleetToCloudAndAssets(manifest: { servers: VpnServerItem[]; announcement?: string }) {
  try {
    const apkManifest = convertToApkServerStructure(manifest.servers, manifest.announcement || '');
    const encrypted = encryptManifest(apkManifest);

    // 1. Update local APK assets/servers.enc for offline fallback
    try {
      const assetsEncPath = path.resolve(process.cwd(), '..', 'assets', 'servers.enc');
      if (fs.existsSync(path.dirname(assetsEncPath))) {
        fs.writeFileSync(assetsEncPath, encrypted, 'utf8');
      }
    } catch {
      // ignore local fs errors
    }

    // 2. Sync encrypted manifest to Firebase RTDB so phones on Mobile Data or any Wi-Fi receive updates immediately
    await fetch(FIREBASE_FLEET_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        encrypted_data: encrypted,
        announcement: manifest.announcement || '',
        updated_at: Date.now(),
      }),
    });
  } catch (err) {
    console.error('Cloud fleet sync warning:', err);
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format');
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
  const encrypted = encryptManifest(apkManifest);
  return NextResponse.json({
    encrypted_data: encrypted,
    announcement: manifest.announcement || '',
    updated_at: manifest.updated_at,
  });
}

export async function POST(req: NextRequest) {
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
