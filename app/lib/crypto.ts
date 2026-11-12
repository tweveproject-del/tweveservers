import crypto from 'crypto';

// Native APK PBKDF2-HMAC-SHA256 Passphrase (from SecureConfigEncryption.smali)
// PASSPHRASE = "TunnelTweak-Secure-v1", ITERATIONS = 10000 (0x2710), KEY_LENGTH = 256 bits (32 bytes)
// Wire layout: Base64( SALT [16 bytes] + IV [12 bytes] + CIPHERTEXT + GCM_AUTH_TAG [16 bytes] )
const APK_PASSPHRASE = 'TunnelTweak-Secure-v1';
const PBKDF2_ITERATIONS = 10000;
const KEY_LEN_BYTES = 32;

export function encryptManifest(jsonObj: object): string {
  const plaintext = JSON.stringify(jsonObj);
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(APK_PASSPHRASE, salt, PBKDF2_ITERATIONS, KEY_LEN_BYTES, 'sha256');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag(); // 16 bytes (128 bits)
  return Buffer.concat([salt, iv, encrypted, authTag]).toString('base64');
}

export function decryptManifest(base64Blob: string): any {
  const raw = Buffer.from(base64Blob.trim(), 'base64');
  if (raw.length < 44) throw new Error('Invalid encrypted blob');
  const salt = raw.subarray(0, 16);
  const iv = raw.subarray(16, 28);
  const authTag = raw.subarray(raw.length - 16);
  const ciphertext = raw.subarray(28, raw.length - 16);
  const key = crypto.pbkdf2Sync(APK_PASSPHRASE, salt, PBKDF2_ITERATIONS, KEY_LEN_BYTES, 'sha256');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  return JSON.parse(decrypted);
}

/**
 * Converts our admin server list into the exact JSON structure expected by
 * ServerConfigManager.parseServerData() in the Tweve VPN Android APK:
 * {
 *   "servers": [ ...SSHServer items... ],
 *   "configs": { "cfg_<id>": ...SSHServerConfig item... },
 *   "announcement": "..."
 * }
 */
export function convertToApkServerStructure(servers: any[], announcement = '') {
  const apkServers: any[] = [];
  const apkConfigs: Record<string, any> = {};

  for (const s of servers) {
    if (s.isActive === false) continue;

    const configId = `cfg_${s.id}`;
    const tierStr = (s.tier || 'FREE').toLowerCase(); // "free", "vip", "premium"

    // Map protocol to APK connectionType:
    // 0 = SSH Direct
    // 1 = SSH + Payload
    // 2 = SSH + SSL (Stunnel)
    // 3 = SSH + SSL + Payload
    // 4 = HTTP Proxy
    // 5 = HTTP Proxy + Payload
    // 6 = SlowDNS (DNSTT over SSH)
    // 7 = HTTP Proxy + SSL + Payload
    // 8 = DNSTT + V2Ray
    // 9 = Standalone V2Ray (VLESS Reality / WS CDN / Custom)
    // 10 = Stealth Link (DNSTT SOCKS5)
    // 11 = Hysteria2
    // 12 = WireGuard
    // 13 = Stealth Turbo (Slipstream)
    let connectionType = 0;
    let v2rayMode = 3; // 3 = V2RAY_MODE_CUSTOM (reads all V2Ray fields directly from SSHServer)

    switch (s.protocol) {
      case 'ssh_direct':
        connectionType = 0;
        break;
      case 'ssh_payload':
        connectionType = 1;
        break;
      case 'ssh_ssl':
        connectionType = 2;
        break;
      case 'ssh_ssl_payload':
        connectionType = 3;
        break;
      case 'http_proxy':
        connectionType = 4;
        break;
      case 'http_proxy_payload':
        connectionType = 5;
        break;
      case 'slowdns':
        connectionType = 6;
        break;
      case 'http_proxy_ssl_payload':
        connectionType = 7;
        break;
      case 'dnstt_v2ray':
        connectionType = 8;
        break;
      case 'v2ray_reality':
        connectionType = 9;
        v2rayMode = 3;
        break;
      case 'v2ray_ws':
        connectionType = 9;
        v2rayMode = 3;
        break;
      case 'stealth_link':
        connectionType = 10;
        break;
      case 'hysteria2':
        connectionType = 11;
        break;
      case 'wireguard':
        connectionType = 12;
        break;
      case 'stealth_turbo':
        connectionType = 13;
        break;
      default:
        connectionType = 0;
    }

    const effectiveHost = s.host || s.v2rayAddress || s.slipstreamDomain || s.dnsttNameserver || '';
    const effectiveV2rayAddress = s.v2rayAddress || s.host || '';
    const effectiveV2rayPort = Number(s.v2rayPort || s.portSSL || 443);
    const effectiveV2rayNetwork =
      s.v2rayNetwork || (s.protocol === 'v2ray_ws' ? 'ws' : 'tcp');
    const effectiveV2raySecurity =
      s.v2raySecurity ||
      (s.protocol === 'v2ray_reality'
        ? 'reality'
        : s.protocol === 'v2ray_ws'
          ? 'tls'
          : 'none');
    const effectivePayload =
      s.protocol === 'wireguard'
        ? s.wireguardConfig || s.payload || ''
        : s.payload || '';

    const apkServer: Record<string, any> = {
      id: s.id,
      name: s.name,
      country: (s.country || 'TZ').toUpperCase(),
      tier: tierStr,
      requiredTier: tierStr,
      visible: true,
      configId: configId,
      host: effectiveHost,
      portDirect: Number(s.portDirect || 22),
      portHTTP: Number(s.portHTTP || s.portDirect || 80),
      portSSL: Number(s.portSSL || s.v2rayPort || 443),
      portDNSTT: Number(s.portDNSTT || s.portDirect || 22),
      username: s.username || '',
      password: s.password || '',
      payload: effectivePayload,
      sni: s.sni || s.v2raySni || s.hysteriaSni || '',
      cdnDomain: s.cdnDomain || s.v2rayWsHost || s.v2raySni || '',
      cdnPayload: s.cdnPayload || effectivePayload,
      // SlowDNS / DNSTT fields
      dnsttNameserver: s.dnsttNameserver || '',
      dnsttPubkey: s.dnsttPubkey || '',
      // V2Ray fields
      v2rayAddress: effectiveV2rayAddress,
      v2rayPort: effectiveV2rayPort,
      v2rayProtocol: s.v2rayProtocol || 'vless',
      v2rayUuid: s.v2rayUuid || '',
      v2raySecurity: effectiveV2raySecurity,
      v2raySni: s.v2raySni || s.sni || s.v2rayWsHost || '',
      v2rayPublicKey: s.v2rayPublicKey || '',
      v2rayShortId: s.v2rayShortId || '',
      v2rayFingerprint: s.v2rayFingerprint || 'chrome',
      v2rayNetwork: effectiveV2rayNetwork,
      v2rayWsHost: s.v2rayWsHost || s.v2raySni || '',
      v2rayWsPath: s.v2rayWsPath || '/',
      v2rayAllowInsecure: Boolean(s.v2rayAllowInsecure),
      // Hysteria2 fields
      hysteriaPort: Number(s.hysteriaPort || 443),
      hysteriaPorts: s.hysteriaPorts || '',
      hysteriaHopInterval: Number(s.hysteriaHopInterval || 30),
      hysteriaAuth: s.hysteriaAuth || '',
      hysteriaObfs: s.hysteriaObfs || '',
      hysteriaSni: s.hysteriaSni || s.sni || '',
      hysteriaInsecure: s.hysteriaInsecure !== undefined ? Boolean(s.hysteriaInsecure) : true,
      hysteriaUp: Number(s.hysteriaUp || 20),
      hysteriaDown: Number(s.hysteriaDown || 100),
      // Stealth Turbo (Slipstream) fields
      slipstreamDomain: s.slipstreamDomain || s.dnsttNameserver || '',
      slipstreamCert: s.slipstreamCert || s.dnsttPubkey || '',
      slipstreamDirect: Boolean(s.slipstreamDirect),
      // Protection flag
      isLocked: Boolean(s.isLocked),
    };

    const apkConfig: Record<string, any> = {
      id: configId,
      name: `${s.name} (${(s.protocol || '').toUpperCase().replace(/_/g, ' ')})`,
      description: `Tweve Managed ${(s.protocol || '').toUpperCase()} Profile`,
      tier: tierStr,
      requiredTier: tierStr,
      connectionType: connectionType,
      payload: effectivePayload,
      sni: s.sni || s.v2raySni || s.hysteriaSni || '',
      proxyHost: s.proxyHost || ([4, 5, 7].includes(connectionType) ? effectiveHost : ''),
      proxyPort: Number(s.proxyPort || s.portHTTP || s.portSSL || 8080),
      dnsResolver: s.dnsResolver || '8.8.8.8:53',
      dnstt_base62: Boolean(s.dnsttBase62),
      dnstt_booster: s.dnsttBooster !== undefined ? Boolean(s.dnsttBooster) : true,
      dnstt_booster_segments: Number(s.dnsttBoosterSegments || 4),
      dnstt_turbo: s.dnsttTurbo !== undefined ? Boolean(s.dnsttTurbo) : true,
      v2rayMode: v2rayMode,
      v2rayAddress: effectiveV2rayAddress,
      v2rayPort: effectiveV2rayPort,
    };

    apkServers.push(apkServer);
    apkConfigs[configId] = apkConfig;
  }

  return {
    servers: apkServers,
    configs: apkConfigs,
    announcement,
    updated_at: Date.now(),
  };
}
