'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Server,
  Shield,
  PlusCircle,
  Trash2,
  RefreshCw,
  Lock,
  Unlock,
  Zap,
  Globe,
  CheckCircle2,
  Copy,
  Send,
  Radio,
  Wifi,
  Terminal,
  KeyRound,
  Layers,
  Sparkles,
  Flame,
  Eye,
  EyeOff,
  Activity,
  Users,
  ClipboardPaste,
} from 'lucide-react';
import { VpnServerItem, VpnProtocolType } from './lib/types';

type ProtocolOption = {
  id: VpnProtocolType;
  label: string;
  badge: string;
  desc: string;
};

const PROTOCOL_OPTIONS: ProtocolOption[] = [
  {
    id: 'slowdns',
    label: 'SlowDNS (DNSTT)',
    badge: 'UDP 53 / DNS',
    desc: 'DNS tunnel over UDP/DoH with Base62 & segment booster',
  },
  {
    id: 'v2ray_reality',
    label: 'VLESS Reality',
    badge: 'XTLS Vision',
    desc: 'Zero-fingerprint TLS 1.3 Reality tunnel (Chrome uTLS)',
  },
  {
    id: 'v2ray_ws',
    label: 'V2Ray WS + TLS (CDN)',
    badge: 'Cloudflare / SNI',
    desc: 'VLESS / VMess / Trojan over WebSocket + Bug Host / CDN',
  },
  {
    id: 'dnstt_v2ray',
    label: 'SlowDNS + V2Ray',
    badge: 'DNSTT → Xray',
    desc: 'V2Ray (VLESS/VMess) multiplexed inside a SlowDNS tunnel',
  },
  {
    id: 'ssh_direct',
    label: 'SSH Direct',
    badge: 'TCP 22',
    desc: 'Direct SSH tunnel with username & password authentication',
  },
  {
    id: 'ssh_payload',
    label: 'SSH + HTTP Payload',
    badge: 'HTTP Injector',
    desc: 'Custom HTTP/WebSocket payload injection over SSH',
  },
  {
    id: 'ssh_ssl',
    label: 'SSH + SSL (TLS SNI)',
    badge: 'TLS 443',
    desc: 'Direct SSL/TLS handshake with custom SNI bug host',
  },
  {
    id: 'ssh_ssl_payload',
    label: 'SSH + SSL + Payload',
    badge: 'SSL + WS Payload',
    desc: 'TLS SNI handshake followed by custom HTTP/WebSocket payload',
  },
  {
    id: 'http_proxy_payload',
    label: 'HTTP Proxy + Payload',
    badge: 'Proxy + Payload',
    desc: 'SSH tunnel routed via remote HTTP Squid/Websocket proxy',
  },
  {
    id: 'http_proxy_ssl_payload',
    label: 'Proxy + SSL + Payload',
    badge: 'Proxy + TLS + WS',
    desc: 'HTTP Proxy + SSL SNI + custom WebSocket payload injection',
  },
  {
    id: 'stealth_link',
    label: 'Stealth Link (SOCKS5)',
    badge: 'DNSTT SOCKS',
    desc: 'Direct DNSTT SOCKS5 transport without SSH overhead',
  },
  {
    id: 'hysteria2',
    label: 'Hysteria 2 (QUIC)',
    badge: 'UDP Port Hop',
    desc: 'High-speed QUIC UDP protocol with Salamander obfuscation',
  },
  {
    id: 'wireguard',
    label: 'WireGuard Tunnel',
    badge: 'Kernel / UDP',
    desc: 'Full WireGuard [Interface] & [Peer] configuration profile',
  },
  {
    id: 'stealth_turbo',
    label: 'Stealth Turbo (Slipstream)',
    badge: 'Slipstream DNS',
    desc: 'High-throughput Slipstream DNS tunnel with certificate pinning',
  },
];

const COUNTRIES = [
  { code: 'TZ', name: 'Tanzania', flag: '🇹🇿' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪' },
  { code: 'UG', name: 'Uganda', flag: '🇺🇬' },
  { code: 'RW', name: 'Rwanda', flag: '🇷🇼' },
  { code: 'CD', name: 'DR Congo', flag: '🇨🇩' },
  { code: 'BI', name: 'Burundi', flag: '🇧🇮' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬' },
  { code: 'GH', name: 'Ghana', flag: '🇬🇭' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
];

interface FleetAnalytics {
  activeUsersCount: number;
  totalConfiguredUsersCount: number;
  activeServersCount: number;
  totalServersCount: number;
  protocolBreakdown: Record<string, number>;
  bandwidth: {
    totalUpMB: number;
    totalDownMB: number;
  };
  liveSampledSessions: Array<{
    deviceId: string;
    serverId: string;
    serverName: string;
    protocol: string;
    country: string;
    ip: string;
    connectedSince: number;
    lastPing: number;
    bytesUp: number;
    bytesDown: number;
  }>;
}

export default function TweveServerFleetAdmin() {
  const [authChecking, setAuthChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [loginEmailInput, setLoginEmailInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [allowedEmails, setAllowedEmails] = useState<string[]>([]);
  const [showAdminDbPanel, setShowAdminDbPanel] = useState(false);
  const [newAdminEmailInput, setNewAdminEmailInput] = useState('');

  const [servers, setServers] = useState<VpnServerItem[]>([]);
  const [announcement, setAnnouncement] = useState('');
  const [loading, setLoading] = useState(true);
  const [pushing, setPushing] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showConfigDetails, setShowConfigDetails] = useState<Record<string, boolean>>({});
  const [rawPasteInput, setRawPasteInput] = useState('');

  const [analytics, setAnalytics] = useState<FleetAnalytics>({
    activeUsersCount: 0,
    totalConfiguredUsersCount: 0,
    activeServersCount: 0,
    totalServersCount: 0,
    protocolBreakdown: {},
    bandwidth: { totalUpMB: 0, totalDownMB: 0 },
    liveSampledSessions: [],
  });

  // Form State
  const [formProtocol, setFormProtocol] = useState<VpnProtocolType>('slowdns');
  const [name, setName] = useState('');
  const [country, setCountry] = useState('TZ');
  const [tier, setTier] = useState<'FREE' | 'VIP' | 'PREMIUM'>('FREE');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('22');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [sni, setSni] = useState('');
  const [payload, setPayload] = useState('GET / HTTP/1.1[crlf]Host: [host][crlf]Upgrade: websocket[crlf][crlf]');
  const [proxyHost, setProxyHost] = useState('');
  const [proxyPort, setProxyPort] = useState('8080');
  const [isLocked, setIsLocked] = useState(true);

  // SlowDNS Specific
  const [dnsttNameserver, setDnsttNameserver] = useState('');
  const [dnsttPubkey, setDnsttPubkey] = useState('');
  const [dnsResolver, setDnsResolver] = useState('8.8.8.8:53');
  const [dnsttBooster, setDnsttBooster] = useState(true);
  const [dnsttTurbo, setDnsttTurbo] = useState(true);
  const [dnsttBoosterSegments, setDnsttBoosterSegments] = useState('4');

  // V2Ray Specific
  const [v2rayProtocol, setV2rayProtocol] = useState('vless');
  const [v2rayUuid, setV2rayUuid] = useState('');
  const [v2rayPort, setV2rayPort] = useState('443');
  const [v2rayPublicKey, setV2rayPublicKey] = useState('');
  const [v2rayShortId, setV2rayShortId] = useState('');
  const [v2raySni, setV2raySni] = useState('www.microsoft.com');
  const [v2rayWsHost, setV2rayWsHost] = useState('');
  const [v2rayWsPath, setV2rayWsPath] = useState('/vless-ws');

  // Hysteria2 Specific
  const [hysteriaPort, setHysteriaPort] = useState('443');
  const [hysteriaPorts, setHysteriaPorts] = useState('20000-50000');
  const [hysteriaAuth, setHysteriaAuth] = useState('');
  const [hysteriaObfs, setHysteriaObfs] = useState('');
  const [hysteriaSni, setHysteriaSni] = useState('');

  // Stealth Turbo (Slipstream) Specific
  const [slipstreamDomain, setSlipstreamDomain] = useState('');
  const [slipstreamCert, setSlipstreamCert] = useState('');
  const [slipstreamDirect, setSlipstreamDirect] = useState(false);

  // WireGuard Specific
  const [wireguardConfig, setWireguardConfig] = useState('');

  const notify = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const fetchServers = useCallback(async () => {
    try {
      const res = await fetch('/api/servers?format=admin', { cache: 'no-store' });
      if (res.status === 401) {
        setIsAuthenticated(false);
        return;
      }
      const data = await res.json();
      setServers(data.servers || []);
      setAnnouncement(data.announcement || '');
    } catch {
      notify('error', 'Failed to load server fleet manifest');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch('/api/analytics', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch {
      // silent telemetry poll
    }
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    (async () => {
      try {
        const res = await fetch('/api/auth', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            setIsAuthenticated(true);
            setAdminEmail(data.email || '');
            setAllowedEmails(data.allowedEmails || []);
            fetchServers();
            fetchAnalytics();
            interval = setInterval(fetchAnalytics, 5000);
          }
        }
      } catch {
        // not authenticated
      } finally {
        setAuthChecking(false);
      }
    })();
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [fetchServers, fetchAnalytics]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const trimmed = loginEmailInput.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      setLoginError('Please enter a valid admin email address.');
      return;
    }
    setLoginLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email: trimmed }),
      });
      const data = await res.json();
      if (!res.ok || !data.authenticated) {
        setLoginError(data.error || 'Access denied: Email not found in authorized DB.');
      } else {
        setIsAuthenticated(true);
        setAdminEmail(data.email);
        setAllowedEmails(data.allowedEmails || []);
        setLoginEmailInput('');
        fetchServers();
        fetchAnalytics();
      }
    } catch {
      setLoginError('Network error verifying admin credentials.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth', { method: 'DELETE' });
    } catch {}
    setIsAuthenticated(false);
    setAdminEmail('');
    setServers([]);
  };

  const handleAddAdminEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = newAdminEmailInput.trim().toLowerCase();
    if (!target || !target.includes('@')) {
      notify('error', 'Enter a valid email address to add to DB');
      return;
    }
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_email', email: target }),
      });
      const data = await res.json();
      if (res.ok && data.allowedEmails) {
        setAllowedEmails(data.allowedEmails);
        setNewAdminEmailInput('');
        notify('success', `Added ${target} to authorized DB`);
      } else {
        notify('error', data.error || 'Failed to add email');
      }
    } catch {
      notify('error', 'Failed to update admin DB');
    }
  };

  const handleRemoveAdminEmail = async (target: string) => {
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove_email', email: target }),
      });
      const data = await res.json();
      if (res.ok && data.allowedEmails) {
        setAllowedEmails(data.allowedEmails);
        notify('success', `Removed ${target} from authorized DB`);
      } else {
        notify('error', data.error || 'Cannot remove email');
      }
    } catch {
      notify('error', 'Failed to update admin DB');
    }
  };

  // Quick-Import Parser for VLESS / VMess / Trojan / Hysteria2 / SlowDNS / WireGuard URIs
  const handleParseRawUri = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    try {
      if (trimmed.includes('[Interface]') && trimmed.includes('[Peer]')) {
        setFormProtocol('wireguard');
        setWireguardConfig(trimmed);
        const epMatch = trimmed.match(/Endpoint\s*=\s*([^\s:]+):?(\d+)?/i);
        if (epMatch) {
          setHost(epMatch[1]);
          if (epMatch[2]) setPort(epMatch[2]);
        }
        if (!name) setName('WireGuard Server');
        notify('success', 'Parsed WireGuard configuration');
        return;
      }

      if (trimmed.startsWith('vless://') || trimmed.startsWith('trojan://')) {
        const url = new URL(trimmed);
        const isTrojan = trimmed.startsWith('trojan://');
        const uuid = decodeURIComponent(url.username);
        const serverHost = url.hostname;
        const serverPort = url.port || '443';
        const params = url.searchParams;
        const security = params.get('security') || (isTrojan ? 'tls' : 'none');
        const type = params.get('type') || 'tcp';
        const remark = decodeURIComponent(url.hash.replace('#', '')) || 'Imported V2Ray';

        setName(remark);
        setHost(serverHost);
        setV2rayProtocol(isTrojan ? 'trojan' : 'vless');
        setV2rayPort(serverPort);
        setV2rayUuid(uuid);

        if (security === 'reality') {
          setFormProtocol('v2ray_reality');
          setV2raySni(params.get('sni') || 'www.microsoft.com');
          setV2rayPublicKey(params.get('pbk') || '');
          setV2rayShortId(params.get('sid') || '');
        } else if (type === 'ws') {
          setFormProtocol('v2ray_ws');
          setV2rayWsHost(params.get('host') || params.get('sni') || serverHost);
          setV2rayWsPath(params.get('path') || '/');
          setV2raySni(params.get('sni') || params.get('host') || serverHost);
        } else {
          setFormProtocol('v2ray_ws');
          setV2raySni(params.get('sni') || serverHost);
        }
        notify('success', `Parsed ${isTrojan ? 'Trojan' : 'VLESS'} configuration: ${remark}`);
        return;
      }

      if (trimmed.startsWith('vmess://')) {
        const b64 = trimmed.replace('vmess://', '');
        const json = JSON.parse(atob(b64));
        setName(json.ps || 'Imported VMess');
        setHost(json.add || '');
        setV2rayProtocol('vmess');
        setV2rayPort(String(json.port || 443));
        setV2rayUuid(json.id || '');
        setFormProtocol('v2ray_ws');
        setV2rayWsHost(json.host || json.sni || json.add || '');
        setV2rayWsPath(json.path || '/');
        setV2raySni(json.sni || json.host || json.add || '');
        notify('success', `Parsed VMess configuration: ${json.ps || json.add}`);
        return;
      }

      if (trimmed.startsWith('hy2://') || trimmed.startsWith('hysteria2://')) {
        const url = new URL(trimmed.replace('hy2://', 'http://').replace('hysteria2://', 'http://'));
        setFormProtocol('hysteria2');
        setName(decodeURIComponent(url.hash.replace('#', '')) || 'Imported Hysteria2');
        setHost(url.hostname);
        setHysteriaPort(url.port || '443');
        setHysteriaAuth(decodeURIComponent(url.username));
        setHysteriaSni(url.searchParams.get('sni') || url.hostname);
        setHysteriaObfs(url.searchParams.get('obfs-password') || '');
        setHysteriaPorts(url.searchParams.get('mport') || '20000-50000');
        notify('success', 'Parsed Hysteria2 URI');
        return;
      }
    } catch {
      notify('error', 'Could not parse URI format');
    }
  };

  const handlePushServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      notify('error', 'Please enter a Server Remark / Name (e.g. Vodacom Tanzania)');
      return;
    }

    const effectiveHost =
      host.trim() ||
      (formProtocol === 'slowdns' || formProtocol === 'dnstt_v2ray' || formProtocol === 'stealth_link'
        ? dnsttNameserver.trim()
        : formProtocol === 'stealth_turbo'
          ? slipstreamDomain.trim()
          : '');

    if (!effectiveHost && formProtocol !== 'wireguard') {
      notify('error', 'Please enter a Server Host / IP or Domain');
      return;
    }

    setPushing(true);
    try {
      const payloadBody: Partial<VpnServerItem> = {
        name: name.trim(),
        country,
        tier,
        protocol: formProtocol,
        host: effectiveHost || '127.0.0.1',
        portDirect: Number(port || 22),
        portHTTP: Number(port || 80),
        portSSL: Number(v2rayPort || port || 443),
        portDNSTT: Number(port || 22),
        username: username.trim(),
        password: password.trim(),
        sni: sni.trim() || v2raySni.trim() || hysteriaSni.trim(),
        payload: formProtocol === 'wireguard' ? wireguardConfig : payload,
        proxyHost: proxyHost.trim() || effectiveHost,
        proxyPort: Number(proxyPort || 8080),
        isLocked,
        isActive: true,
        // SlowDNS / DNSTT
        dnsttNameserver: dnsttNameserver.trim(),
        dnsttPubkey: dnsttPubkey.trim(),
        dnsResolver: dnsResolver.trim() || '8.8.8.8:53',
        dnsttBooster,
        dnsttTurbo,
        dnsttBoosterSegments: Number(dnsttBoosterSegments || 4),
        // V2Ray
        v2rayAddress: effectiveHost,
        v2rayPort: Number(v2rayPort || 443),
        v2rayProtocol,
        v2rayUuid: v2rayUuid.trim(),
        v2raySecurity:
          formProtocol === 'v2ray_reality'
            ? 'reality'
            : formProtocol === 'v2ray_ws'
              ? 'tls'
              : 'none',
        v2raySni: v2raySni.trim() || sni.trim() || v2rayWsHost.trim(),
        v2rayPublicKey: v2rayPublicKey.trim(),
        v2rayShortId: v2rayShortId.trim(),
        v2rayNetwork: formProtocol === 'v2ray_ws' ? 'ws' : 'tcp',
        v2rayWsHost: v2rayWsHost.trim() || v2raySni.trim(),
        v2rayWsPath: v2rayWsPath.trim() || '/',
        // Hysteria2
        hysteriaPort: Number(hysteriaPort || 443),
        hysteriaPorts: hysteriaPorts.trim(),
        hysteriaAuth: hysteriaAuth.trim(),
        hysteriaObfs: hysteriaObfs.trim(),
        hysteriaSni: hysteriaSni.trim() || sni.trim(),
        // Stealth Turbo (Slipstream)
        slipstreamDomain: slipstreamDomain.trim() || dnsttNameserver.trim(),
        slipstreamCert: slipstreamCert.trim() || dnsttPubkey.trim(),
        slipstreamDirect,
        // WireGuard
        wireguardConfig,
      };

      const res = await fetch('/api/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadBody),
      });
      const data = await res.json();
      if (data.success) {
        setServers(data.manifest.servers);
        notify('success', `Deployed "${name.trim()}" (${formProtocol.toUpperCase()}) to App & Cloud Fleet!`);
        setName('');
        fetchAnalytics();
      } else {
        notify('error', data.error || 'Failed to deploy server');
      }
    } catch (err: any) {
      notify('error', err.message || 'Network error while pushing server');
    } finally {
      setPushing(false);
    }
  };

  const handleDeleteServer = async (id: string, srvName: string) => {
    try {
      const res = await fetch(`/api/servers?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setServers(data.manifest.servers);
        notify('success', `Removed "${srvName}" from Fleet`);
        fetchAnalytics();
      }
    } catch {
      notify('error', 'Failed to delete server');
    }
  };

  const handleToggleStatus = async (srv: VpnServerItem) => {
    try {
      const res = await fetch('/api/servers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: srv.id, isActive: !srv.isActive }),
      });
      const data = await res.json();
      if (data.success) {
        setServers(data.manifest.servers);
        notify('success', `${srv.name} is now ${!srv.isActive ? 'ACTIVE' : 'PAUSED'}`);
        fetchAnalytics();
      }
    } catch {
      notify('error', 'Failed to toggle status');
    }
  };

  const handleToggleLock = async (srv: VpnServerItem) => {
    try {
      const res = await fetch('/api/servers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: srv.id, isLocked: !srv.isLocked }),
      });
      const data = await res.json();
      if (data.success) {
        setServers(data.manifest.servers);
        notify('success', `${srv.name} protection ${!srv.isLocked ? 'LOCKED' : 'UNLOCKED'}`);
      }
    } catch {
      notify('error', 'Failed to update lock status');
    }
  };

  const handleSaveAnnouncement = async () => {
    try {
      const res = await fetch('/api/servers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ announcement }),
      });
      const data = await res.json();
      if (data.success) {
        notify('success', 'Synced Fleet Announcement & Encrypted Manifest to App & Cloud!');
      }
    } catch {
      notify('error', 'Failed to save announcement');
    }
  };

  const copyApkEndpoint = () => {
    const url = `${window.location.origin}/api/servers?format=apk`;
    navigator.clipboard.writeText(url);
    notify('success', `Copied APK Manifest Endpoint: ${url}`);
  };

  const needsSshCredentials = [
    'slowdns',
    'ssh_direct',
    'ssh_payload',
    'ssh_ssl',
    'ssh_ssl_payload',
    'http_proxy',
    'http_proxy_payload',
    'http_proxy_ssl_payload',
    'stealth_link',
    'stealth_turbo',
  ].includes(formProtocol);

  const needsDnsttFields = ['slowdns', 'dnstt_v2ray', 'stealth_link'].includes(formProtocol);
  const needsV2rayFields = ['v2ray_reality', 'v2ray_ws', 'dnstt_v2ray'].includes(formProtocol);
  const needsPayloadField = [
    'ssh_payload',
    'ssh_ssl_payload',
    'http_proxy_payload',
    'http_proxy_ssl_payload',
  ].includes(formProtocol);
  const needsSniField = ['ssh_ssl', 'ssh_ssl_payload', 'http_proxy_ssl_payload'].includes(formProtocol);
  const needsProxyFields = ['http_proxy', 'http_proxy_payload', 'http_proxy_ssl_payload'].includes(formProtocol);

  if (authChecking) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#020617',
          color: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#94a3b8', fontSize: '0.95rem' }}>
          <Shield style={{ width: '1.35rem', height: '1.35rem', color: '#34d399' }} />
          <span>Verifying Tweve Fleet Security Session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#020617',
          backgroundImage:
            'radial-gradient(circle at 50% 0%, rgba(16, 185, 129, 0.14), transparent 55%), radial-gradient(circle at 85% 90%, rgba(56, 189, 248, 0.1), transparent 45%)',
          color: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '430px',
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid rgba(56, 189, 248, 0.22)',
            borderRadius: '1.25rem',
            padding: '2.25rem 2rem',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.65)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '1.75rem' }}>
            <div
              style={{
                width: '3.5rem',
                height: '3.5rem',
                borderRadius: '1rem',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(6, 182, 212, 0.25))',
                border: '1px solid rgba(16, 185, 129, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
                boxShadow: '0 0 28px rgba(16, 185, 129, 0.28)',
              }}
            >
              <Lock style={{ width: '1.65rem', height: '1.65rem', color: '#34d399' }} />
            </div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
              TWEVE SERVER FLEET
            </h1>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.35rem' }}>
              Protected Admin Console • Authorized DB Email Required
            </p>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#cbd5e1',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '0.45rem',
                }}
              >
                Authorized Admin Email
              </label>
              <input
                type="email"
                required
                autoFocus
                value={loginEmailInput}
                onChange={(e) => setLoginEmailInput(e.target.value)}
                placeholder="Enter email registered in DB..."
                className="input-fleet"
                style={{ width: '100%' }}
              />
            </div>

            {loginError && (
              <div
                style={{
                  padding: '0.75rem 0.95rem',
                  borderRadius: '0.75rem',
                  backgroundColor: 'rgba(244, 63, 94, 0.14)',
                  border: '1px solid rgba(244, 63, 94, 0.4)',
                  color: '#fda4af',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                }}
              >
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="btn-fleet-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '0.8rem 1rem' }}
            >
              <Shield style={{ width: '1rem', height: '1rem' }} />
              <span>{loginLoading ? 'Verifying DB Allowlist...' : 'Unlock Server Fleet Console'}</span>
            </button>
          </form>

          <div
            style={{
              marginTop: '1.5rem',
              paddingTop: '1.1rem',
              borderTop: '1px solid rgba(148, 163, 184, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              fontSize: '0.72rem',
              color: '#64748b',
            }}
          >
            <KeyRound style={{ width: '0.85rem', height: '0.85rem', color: '#38bdf8' }} />
            <span>AES-256-GCM Encrypted APK Feed • HMAC-SHA256 Session</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#020617', color: '#f8fafc', paddingBottom: '4rem' }}>
      {/* Top Navbar */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backdropFilter: 'blur(16px)',
          backgroundColor: 'rgba(2, 6, 23, 0.88)',
          borderBottom: '1px solid rgba(56, 189, 248, 0.16)',
        }}
      >
        <div
          style={{
            maxWidth: '1320px',
            margin: '0 auto',
            padding: '1rem 1.5rem',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            <div
              style={{
                width: '2.75rem',
                height: '2.75rem',
                borderRadius: '0.85rem',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.22), rgba(6, 182, 212, 0.22))',
                border: '1px solid rgba(16, 185, 129, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 24px rgba(16, 185, 129, 0.25)',
              }}
            >
              <Flame style={{ width: '1.5rem', height: '1.5rem', color: '#34d399' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff' }}>
                  TWEVE SERVER FLEET
                </h1>
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.55rem',
                    borderRadius: '9999px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#34d399',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                  }}
                >
                  ALL 14 PROTOCOLS + CLOUD SYNC
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Signed in as <strong style={{ color: '#38bdf8' }}>{adminEmail}</strong>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setShowAdminDbPanel((v) => !v)}
              className="btn-fleet-secondary"
            >
              <Users style={{ width: '0.9rem', height: '0.9rem', color: '#a78bfa' }} />
              <span>DB Emails ({allowedEmails.length})</span>
            </button>
            <button type="button" onClick={handleSaveAnnouncement} className="btn-fleet-secondary">
              <RefreshCw style={{ width: '0.9rem', height: '0.9rem', color: '#34d399' }} />
              <span>Sync Fleet to Cloud & App</span>
            </button>
            <button type="button" onClick={copyApkEndpoint} className="btn-fleet-secondary">
              <Copy style={{ width: '0.9rem', height: '0.9rem', color: '#38bdf8' }} />
              <span>Copy APK Feed URL</span>
            </button>
            <button type="button" onClick={handleLogout} className="btn-fleet-secondary">
              <Lock style={{ width: '0.9rem', height: '0.9rem', color: '#fb7185' }} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main
        style={{
          maxWidth: '1320px',
          margin: '0 auto',
          padding: '1.75rem 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
        }}
      >
        {showAdminDbPanel && (
          <div
            style={{
              padding: '1.25rem 1.5rem',
              borderRadius: '1rem',
              backgroundColor: 'rgba(15, 23, 42, 0.92)',
              border: '1px solid rgba(167, 139, 250, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>
                  Authorized Admin Emails in Database (`data/admins.json` & Cloud DB)
                </h3>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  Only emails listed below can sign in to view or modify the Tweve Server Fleet.
                </p>
              </div>
              <form onSubmit={handleAddAdminEmail} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <input
                  type="email"
                  required
                  value={newAdminEmailInput}
                  onChange={(e) => setNewAdminEmailInput(e.target.value)}
                  placeholder="new-admin@email.com"
                  className="input-fleet"
                  style={{ width: '240px' }}
                />
                <button type="submit" className="btn-fleet-primary">
                  <PlusCircle style={{ width: '0.9rem', height: '0.9rem' }} />
                  <span>Add Email to DB</span>
                </button>
              </form>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {allowedEmails.map((em) => (
                <div
                  key={em}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '9999px',
                    backgroundColor: 'rgba(30, 41, 59, 0.9)',
                    border: '1px solid rgba(148, 163, 184, 0.25)',
                    fontSize: '0.78rem',
                    color: '#e2e8f0',
                  }}
                >
                  <span>{em}</span>
                  {allowedEmails.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveAdminEmail(em)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#fb7185',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      title="Remove email from DB"
                    >
                      <Trash2 style={{ width: '0.8rem', height: '0.8rem' }} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {notification && (
          <div
            style={{
              padding: '0.9rem 1.25rem',
              borderRadius: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              background:
                notification.type === 'success' ? 'rgba(16, 185, 129, 0.14)' : 'rgba(244, 63, 94, 0.15)',
              border: `1px solid ${notification.type === 'success' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)'
                }`,
              color: notification.type === 'success' ? '#6ee7b7' : '#fda4af',
            }}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 style={{ width: '1.1rem', height: '1.1rem', color: '#34d399' }} />
            ) : (
              <Flame style={{ width: '1.1rem', height: '1.1rem', color: '#fb7185' }} />
            )}
            <span style={{ fontWeight: 600 }}>{notification.message}</span>
          </div>
        )}

        {/* Real-time Fleet Telemetry Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          <div className="kpi-stat-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.675rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: '0.5rem', height: '0.5rem', borderRadius: '9999px', backgroundColor: analytics.activeUsersCount > 0 ? '#10b981' : '#64748b', boxShadow: analytics.activeUsersCount > 0 ? '0 0 10px #10b981' : 'none', display: 'inline-block' }}></span>
                Live Connected Users
              </span>
              <Users style={{ width: '1.1rem', height: '1.1rem', color: '#34d399', opacity: 0.8 }} />
            </div>
            <div style={{ marginTop: '0.65rem', display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
              <span style={{ fontSize: '1.9rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.03em', fontFamily: 'monospace' }}>
                {analytics.activeUsersCount}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 600 }}>Active Devices</span>
            </div>
            <p style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem' }}>Real-time heartbeat sessions</p>
          </div>

          <div className="kpi-stat-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.675rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Server style={{ width: '0.85rem', height: '0.85rem', color: '#38bdf8' }} />
                Active Fleet Nodes
              </span>
              <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '0.35rem', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontWeight: 700 }}>
                CLOUD + LAN
              </span>
            </div>
            <div style={{ marginTop: '0.65rem', display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
              <span style={{ fontSize: '1.9rem', fontWeight: 800, color: '#38bdf8', letterSpacing: '-0.03em', fontFamily: 'monospace' }}>
                {servers.filter(s => s.isActive).length}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>of {servers.length} configured</span>
            </div>
            <p style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem' }}>Synced to LAN & Firebase Cloud</p>
          </div>

          <div className="kpi-stat-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.675rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Zap style={{ width: '0.85rem', height: '0.85rem', color: '#c084fc' }} />
                Protocols Supported
              </span>
              <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '0.35rem', background: 'rgba(192, 132, 252, 0.15)', color: '#c084fc', fontWeight: 700 }}>
                14 MODES
              </span>
            </div>
            <div style={{ marginTop: '0.65rem', display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
              <span style={{ fontSize: '1.9rem', fontWeight: 800, color: '#c084fc', letterSpacing: '-0.03em', fontFamily: 'monospace' }}>
                {PROTOCOL_OPTIONS.length}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>Ready in APK</span>
            </div>
            <p style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem' }}>SlowDNS, V2Ray, SSH, Proxy, Hy2, WG, Slipstream</p>
          </div>

          <div className="kpi-stat-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.675rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Activity style={{ width: '0.85rem', height: '0.85rem', color: '#fbbf24' }} />
                Transferred Bandwidth
              </span>
              <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '0.35rem', background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', fontWeight: 700 }}>
                REAL TIME
              </span>
            </div>
            <div style={{ marginTop: '0.65rem', display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
              <span style={{ fontSize: '1.9rem', fontWeight: 800, color: '#fcd34d', letterSpacing: '-0.03em', fontFamily: 'monospace' }}>
                {analytics.bandwidth.totalDownMB} MB
              </span>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>Download</span>
            </div>
            <p style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem' }}>
              ↑ {analytics.bandwidth.totalUpMB} MB | ↓ {analytics.bandwidth.totalDownMB} MB
            </p>
          </div>
        </div>

        {/* Quick Link Import / Paste Bar */}
        <section className="fleet-card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <ClipboardPaste style={{ width: '1.2rem', height: '1.2rem', color: '#22d3ee' }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ffffff' }}>
              Quick Import URI / Config:
            </span>
            <input
              type="text"
              value={rawPasteInput}
              onChange={e => setRawPasteInput(e.target.value)}
              placeholder="Paste vless://, vmess://, trojan://, hy2:// or WireGuard [Interface] config to auto-fill..."
              style={{ flex: 1, minWidth: '260px', fontFamily: 'monospace', fontSize: '0.775rem' }}
            />
            <button
              type="button"
              onClick={() => handleParseRawUri(rawPasteInput)}
              className="btn-fleet-secondary"
              style={{ padding: '0.6rem 1rem' }}
            >
              <span>Auto-Fill Form</span>
            </button>
          </div>
        </section>

        {/* Server Push Suite */}
        <section className="fleet-card" style={{ padding: '1.5rem 1.75rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '1.25rem', borderBottom: '1px solid rgba(56, 189, 248, 0.18)', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ padding: '0.45rem', borderRadius: '0.75rem', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399' }}>
                  <PlusCircle style={{ width: '1.2rem', height: '1.2rem' }} />
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
                  Deploy Server to Tweve Tunnel VPN
                </h2>
              </div>
              <p style={{ fontSize: '0.775rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                Select any of the 14 supported tunnel protocols below. Pushed servers sync to LAN & Cloud immediately.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsLocked(!isLocked)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.55rem 1rem',
                borderRadius: '0.75rem',
                fontSize: '0.775rem',
                fontWeight: 700,
                cursor: 'pointer',
                background: isLocked ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                border: isLocked ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)',
                color: isLocked ? '#34d399' : '#fbbf24',
              }}
            >
              {isLocked ? <Lock style={{ width: '0.9rem', height: '0.9rem' }} /> : <Unlock style={{ width: '0.9rem', height: '0.9rem' }} />}
              <span>{isLocked ? 'Anti-Tamper Locked' : 'Unlocked (Visible)'}</span>
            </button>
          </div>

          {/* Protocol Selector Grid */}
          <div style={{ marginTop: '1.25rem' }}>
            <label style={{ fontSize: '0.725rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.65rem' }}>
              1. Select Tunnel Protocol ({PROTOCOL_OPTIONS.length} Supported Modes)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.65rem' }}>
              {PROTOCOL_OPTIONS.map(p => {
                const active = formProtocol === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setFormProtocol(p.id)}
                    style={{
                      textAlign: 'left',
                      padding: '0.75rem 0.9rem',
                      borderRadius: '0.75rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      background: active ? 'rgba(16, 185, 129, 0.16)' : 'rgba(15, 23, 42, 0.75)',
                      border: active ? '1.5px solid #10b981' : '1px solid rgba(56, 189, 248, 0.16)',
                      boxShadow: active ? '0 0 18px rgba(16, 185, 129, 0.2)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.825rem', fontWeight: 800, color: active ? '#34d399' : '#ffffff' }}>
                        {p.label}
                      </span>
                      <span style={{ fontSize: '0.625rem', padding: '0.1rem 0.4rem', borderRadius: '0.35rem', background: 'rgba(2, 6, 23, 0.8)', color: '#38bdf8', fontWeight: 700, fontFamily: 'monospace' }}>
                        {p.badge}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.3rem', lineHeight: 1.35 }}>
                      {p.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Core Identity Fields */}
          <div style={{ marginTop: '1.35rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.725rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                Server Remark / Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Vodacom Tanzania"
              />
            </div>

            <div>
              <label style={{ fontSize: '0.725rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                Country Flag
              </label>
              <select value={country} onChange={e => setCountry(e.target.value)}>
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.725rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                Server Badge Tier
              </label>
              <select value={tier} onChange={e => setTier(e.target.value as any)}>
                <option value="FREE">FREE (Standard)</option>
                <option value="VIP">VIP (High Speed)</option>
                <option value="PREMIUM">PREMIUM (Ultra Low Latency)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.725rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                Server Host / IP Address *
              </label>
              <input
                type="text"
                value={host}
                onChange={e => setHost(e.target.value)}
                placeholder="e.g. tr-voda.vpn4pros.com"
                style={{ fontFamily: 'monospace' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.725rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                Primary Port
              </label>
              <input
                type="number"
                value={port}
                onChange={e => setPort(e.target.value)}
                placeholder="22 / 80 / 443"
                style={{ fontFamily: 'monospace' }}
              />
            </div>
          </div>

          {/* Protocol-Specific Fields */}
          <div style={{ marginTop: '1.25rem', padding: '1.15rem', borderRadius: '0.85rem', backgroundColor: 'rgba(2, 6, 23, 0.65)', border: '1px solid rgba(56, 189, 248, 0.16)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.85rem' }}>
              2. Protocol Parameters — {PROTOCOL_OPTIONS.find(p => p.id === formProtocol)?.label}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              {needsDnsttFields && (
                <>
                  <div>
                    <label style={{ fontSize: '0.725rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                      DNSTT Nameserver (NS Domain) *
                    </label>
                    <input
                      type="text"
                      value={dnsttNameserver}
                      onChange={e => setDnsttNameserver(e.target.value)}
                      placeholder="e.g. ns.isp.tz.vpn4pros.com"
                      style={{ fontFamily: 'monospace' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.725rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                      DNSTT Public Key (64-char Hex) *
                    </label>
                    <input
                      type="text"
                      value={dnsttPubkey}
                      onChange={e => setDnsttPubkey(e.target.value)}
                      placeholder="64-character hex public key"
                      style={{ fontFamily: 'monospace' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.725rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                      DNS Resolver (UDP / DoH)
                    </label>
                    <input
                      type="text"
                      value={dnsResolver}
                      onChange={e => setDnsResolver(e.target.value)}
                      placeholder="8.8.8.8:53 or 1.1.1.1:53"
                      style={{ fontFamily: 'monospace' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.725rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                      Booster Segments (1-8)
                    </label>
                    <input
                      type="number"
                      value={dnsttBoosterSegments}
                      onChange={e => setDnsttBoosterSegments(e.target.value)}
                      placeholder="4"
                      style={{ fontFamily: 'monospace' }}
                    />
                  </div>
                </>
              )}

              {needsV2rayFields && (
                <>
                  <div>
                    <label style={{ fontSize: '0.725rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                      V2Ray Sub-Protocol
                    </label>
                    <select value={v2rayProtocol} onChange={e => setV2rayProtocol(e.target.value)}>
                      <option value="vless">VLESS</option>
                      <option value="vmess">VMess</option>
                      <option value="trojan">Trojan</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.725rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                      UUID / Trojan Password *
                    </label>
                    <input
                      type="text"
                      value={v2rayUuid}
                      onChange={e => setV2rayUuid(e.target.value)}
                      placeholder="e.g. 93a61219-c703-4f9e-a0e2-6dcfb4c48924"
                      style={{ fontFamily: 'monospace' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.725rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                      V2Ray Port
                    </label>
                    <input
                      type="number"
                      value={v2rayPort}
                      onChange={e => setV2rayPort(e.target.value)}
                      placeholder="443"
                      style={{ fontFamily: 'monospace' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.725rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                      TLS / Reality SNI Bug Host
                    </label>
                    <input
                      type="text"
                      value={v2raySni}
                      onChange={e => setV2raySni(e.target.value)}
                      placeholder="e.g. myvodacom.vodacom.co.tz"
                      style={{ fontFamily: 'monospace' }}
                    />
                  </div>
                </>
              )}

              {formProtocol === 'v2ray_reality' && (
                <>
                  <div>
                    <label style={{ fontSize: '0.725rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                      Reality Public Key (pbk) *
                    </label>
                    <input
                      type="text"
                      value={v2rayPublicKey}
                      onChange={e => setV2rayPublicKey(e.target.value)}
                      placeholder="Reality x25519 public key"
                      style={{ fontFamily: 'monospace' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.725rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                      Reality Short ID (sid)
                    </label>
                    <input
                      type="text"
                      value={v2rayShortId}
                      onChange={e => setV2rayShortId(e.target.value)}
                      placeholder="e.g. 6ba85179e30d4fc2"
                      style={{ fontFamily: 'monospace' }}
                    />
                  </div>
                </>
              )}

              {formProtocol === 'v2ray_ws' && (
                <>
                  <div>
                    <label style={{ fontSize: '0.725rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                      WebSocket Host / CDN Bug Host
                    </label>
                    <input
                      type="text"
                      value={v2rayWsHost}
                      onChange={e => setV2rayWsHost(e.target.value)}
                      placeholder="e.g. myvodacom.vodacom.co.tz"
                      style={{ fontFamily: 'monospace' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.725rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                      WebSocket Path
                    </label>
                    <input
                      type="text"
                      value={v2rayWsPath}
                      onChange={e => setV2rayWsPath(e.target.value)}
                      placeholder="e.g. /voda-ws"
                      style={{ fontFamily: 'monospace' }}
                    />
                  </div>
                </>
              )}

              {needsSshCredentials && (
                <>
                  <div>
                    <label style={{ fontSize: '0.725rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                      SSH Username (leave blank to use user&apos;s own SSH account)
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="Optional pre-bundled SSH username"
                      style={{ fontFamily: 'monospace' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.725rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                      SSH Password (leave blank to use user&apos;s own SSH password)
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Optional pre-bundled SSH password"
                    />
                  </div>
                </>
              )}

              {needsSniField && (
                <div>
                  <label style={{ fontSize: '0.725rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                    SSL / TLS SNI Host *
                  </label>
                  <input
                    type="text"
                    value={sni}
                    onChange={e => setSni(e.target.value)}
                    placeholder="e.g. zero.facebook.com"
                    style={{ fontFamily: 'monospace' }}
                  />
                </div>
              )}

              {needsProxyFields && (
                <>
                  <div>
                    <label style={{ fontSize: '0.725rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                      HTTP Proxy Host
                    </label>
                    <input
                      type="text"
                      value={proxyHost}
                      onChange={e => setProxyHost(e.target.value)}
                      placeholder="Defaults to Server Host if blank"
                      style={{ fontFamily: 'monospace' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.725rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                      HTTP Proxy Port
                    </label>
                    <input
                      type="number"
                      value={proxyPort}
                      onChange={e => setProxyPort(e.target.value)}
                      placeholder="8080 or 80"
                      style={{ fontFamily: 'monospace' }}
                    />
                  </div>
                </>
              )}

              {formProtocol === 'hysteria2' && (
                <>
                  <div>
                    <label style={{ fontSize: '0.725rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                      Hysteria2 Auth Password *
                    </label>
                    <input
                      type="text"
                      value={hysteriaAuth}
                      onChange={e => setHysteriaAuth(e.target.value)}
                      placeholder="Hysteria 2 auth password"
                      style={{ fontFamily: 'monospace' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.725rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                      Hysteria2 Port
                    </label>
                    <input
                      type="number"
                      value={hysteriaPort}
                      onChange={e => setHysteriaPort(e.target.value)}
                      placeholder="443"
                      style={{ fontFamily: 'monospace' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.725rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                      Port Hopping Range (mport)
                    </label>
                    <input
                      type="text"
                      value={hysteriaPorts}
                      onChange={e => setHysteriaPorts(e.target.value)}
                      placeholder="20000-50000"
                      style={{ fontFamily: 'monospace' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.725rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                      SNI / Bug Host
                    </label>
                    <input
                      type="text"
                      value={hysteriaSni}
                      onChange={e => setHysteriaSni(e.target.value)}
                      placeholder="e.g. www.bing.com"
                      style={{ fontFamily: 'monospace' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.725rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                      Salamander Obfs Password (Optional)
                    </label>
                    <input
                      type="text"
                      value={hysteriaObfs}
                      onChange={e => setHysteriaObfs(e.target.value)}
                      placeholder="Optional obfs password"
                      style={{ fontFamily: 'monospace' }}
                    />
                  </div>
                </>
              )}

              {formProtocol === 'stealth_turbo' && (
                <>
                  <div>
                    <label style={{ fontSize: '0.725rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                      Slipstream Domain *
                    </label>
                    <input
                      type="text"
                      value={slipstreamDomain}
                      onChange={e => setSlipstreamDomain(e.target.value)}
                      placeholder="e.g. s.domain.com"
                      style={{ fontFamily: 'monospace' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.725rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                      Slipstream Certificate (PEM / Base64)
                    </label>
                    <input
                      type="text"
                      value={slipstreamCert}
                      onChange={e => setSlipstreamCert(e.target.value)}
                      placeholder="Optional certificate pin"
                      style={{ fontFamily: 'monospace' }}
                    />
                  </div>
                </>
              )}

              {needsPayloadField && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '0.725rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                    HTTP Injector Payload *
                  </label>
                  <textarea
                    value={payload}
                    onChange={e => setPayload(e.target.value)}
                    rows={2}
                    placeholder="GET / HTTP/1.1[crlf]Host: [host][crlf]Upgrade: websocket[crlf][crlf]"
                    style={{ fontFamily: 'monospace', color: '#fbbf24', minHeight: '64px' }}
                  />
                </div>
              )}

              {formProtocol === 'wireguard' && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '0.725rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>
                    WireGuard Configuration ([Interface] & [Peer]) *
                  </label>
                  <textarea
                    value={wireguardConfig}
                    onChange={e => setWireguardConfig(e.target.value)}
                    rows={6}
                    placeholder={`[Interface]\nPrivateKey = ...\nAddress = 10.0.0.2/32\nDNS = 1.1.1.1\n\n[Peer]\nPublicKey = ...\nEndpoint = 1.2.3.4:51820\nAllowedIPs = 0.0.0.0/0`}
                    style={{ fontFamily: 'monospace', color: '#34d399', minHeight: '130px' }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Action Button Bar */}
          <div style={{ marginTop: '1.25rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(56, 189, 248, 0.16)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>
              <Shield style={{ width: '1rem', height: '1rem', color: '#34d399' }} />
              <span>
                {isLocked
                  ? 'Client Anti-Tamper Protection enabled: Users can connect to this server, but cannot view or extract credentials.'
                  : 'Unlocked: Parameters will be visible on test clients.'}
              </span>
            </div>

            <button
              type="button"
              onClick={handlePushServer}
              disabled={pushing}
              className="btn-fleet-primary"
            >
              {pushing ? <RefreshCw style={{ width: '1rem', height: '1rem' }} className="animate-spin" /> : <Send style={{ width: '1rem', height: '1rem' }} />}
              <span>Push Server Live to App & Cloud</span>
            </button>
          </div>
        </section>

        {/* Live Server Fleet Table */}
        <section className="fleet-card" style={{ padding: '1.5rem 1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '1rem', borderBottom: '1px solid rgba(56, 189, 248, 0.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{ padding: '0.45rem', borderRadius: '0.75rem', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8' }}>
                <Radio style={{ width: '1.2rem', height: '1.2rem' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff' }}>Active Fleet Servers ({servers.length})</h3>
                <p style={{ fontSize: '0.725rem', color: '#94a3b8' }}>Real-time persistent servers synced across LAN, Firebase Cloud & APK</p>
              </div>
            </div>

            <button
              type="button"
              onClick={fetchServers}
              disabled={loading}
              className="btn-fleet-secondary"
            >
              <RefreshCw style={{ width: '0.85rem', height: '0.85rem' }} className={loading ? 'animate-spin' : ''} />
              <span>Refresh Database</span>
            </button>
          </div>

          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {servers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b', fontSize: '0.825rem' }}>
                <Server style={{ width: '2rem', height: '2rem', margin: '0 auto 0.65rem', opacity: 0.4 }} />
                <div style={{ fontWeight: 700, color: '#94a3b8' }}>No servers deployed in the database yet</div>
                <p style={{ marginTop: '0.25rem', fontSize: '0.75rem' }}>
                  Use the configuration suite above or paste a config URI to deploy your first server.
                </p>
              </div>
            ) : (
              servers.map(s => {
                const detailsVisible = showConfigDetails[s.id] || false;
                const countryObj = COUNTRIES.find(c => c.code === s.country);
                return (
                  <div
                    key={s.id}
                    className="server-fleet-row"
                    style={{ opacity: s.isActive ? 1 : 0.6 }}
                  >
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', backgroundColor: '#030712', border: '1px solid rgba(56, 189, 248, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
                          {countryObj ? countryObj.flag : '🌐'}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.925rem', fontWeight: 800, color: '#ffffff' }}>{s.name}</span>
                            <span
                              style={{
                                padding: '0.15rem 0.5rem',
                                borderRadius: '0.4rem',
                                fontSize: '0.675rem',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                background: 'rgba(56, 189, 248, 0.15)',
                                color: '#38bdf8',
                                border: '1px solid rgba(56, 189, 248, 0.3)',
                              }}
                            >
                              {s.protocol.replace(/_/g, ' ')}
                            </span>
                            {s.isLocked && (
                              <span
                                onClick={() => handleToggleLock(s)}
                                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.675rem', backgroundColor: '#030712', color: '#34d399', padding: '0.15rem 0.45rem', borderRadius: '0.4rem', border: '1px solid rgba(16, 185, 129, 0.3)', fontWeight: 600 }}
                              >
                                <Lock style={{ width: '0.65rem', height: '0.65rem' }} />
                                Locked (Anti-Tamper)
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.65rem', fontFamily: 'monospace' }}>
                            <span>Host: {s.host}</span>
                            <span>•</span>
                            <span>Users: <strong style={{ color: '#ffffff' }}>{s.connectedUsersCount || 0}</strong></span>
                            <span>•</span>
                            <span style={{ color: '#34d399', fontWeight: 700 }}>{s.tier}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() =>
                            setShowConfigDetails(prev => ({
                              ...prev,
                              [s.id]: !prev[s.id],
                            }))
                          }
                          className="btn-fleet-secondary"
                          style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
                        >
                          {detailsVisible ? <EyeOff style={{ width: '0.8rem', height: '0.8rem' }} /> : <Eye style={{ width: '0.8rem', height: '0.8rem' }} />}
                          <span>{detailsVisible ? 'Hide' : 'Inspect'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleStatus(s)}
                          style={{
                            padding: '0.4rem 0.85rem',
                            borderRadius: '0.65rem',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            border: s.isActive ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(148, 163, 184, 0.3)',
                            background: s.isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.1)',
                            color: s.isActive ? '#34d399' : '#94a3b8',
                            cursor: 'pointer',
                          }}
                        >
                          {s.isActive ? 'Active' : 'Disabled'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteServer(s.id, s.name)}
                          style={{
                            padding: '0.45rem',
                            borderRadius: '0.65rem',
                            background: 'rgba(244, 63, 94, 0.15)',
                            border: '1px solid rgba(244, 63, 94, 0.3)',
                            color: '#fb7185',
                            cursor: 'pointer',
                          }}
                          title="Delete server"
                        >
                          <Trash2 style={{ width: '0.9rem', height: '0.9rem' }} />
                        </button>
                      </div>
                    </div>

                    {detailsVisible && (
                      <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid rgba(56, 189, 248, 0.16)', fontSize: '0.75rem', fontFamily: 'monospace', backgroundColor: '#030712', padding: '0.85rem', borderRadius: '0.75rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <div style={{ color: '#94a3b8', fontFamily: 'sans-serif', fontWeight: 700, marginBottom: '0.25rem' }}>
                          Encrypted Parameter Payload Manifest ({s.protocol.toUpperCase()}):
                        </div>
                        <div>Host: <span style={{ color: '#38bdf8' }}>{s.host}</span></div>
                        {s.dnsttNameserver && <div>DNSTT Nameserver: <span style={{ color: '#34d399' }}>{s.dnsttNameserver}</span></div>}
                        {s.dnsttPubkey && <div>DNSTT Pubkey: <span style={{ color: '#c084fc', wordBreak: 'break-all' }}>{s.dnsttPubkey}</span></div>}
                        {s.v2rayUuid && <div>V2Ray UUID: <span style={{ color: '#c084fc' }}>{s.v2rayUuid}</span></div>}
                        {s.v2raySni && <div>SNI: <span style={{ color: '#34d399' }}>{s.v2raySni}</span></div>}
                        {s.v2rayWsHost && <div>WS Host: <span style={{ color: '#34d399' }}>{s.v2rayWsHost}</span></div>}
                        {s.v2rayWsPath && <div>WS Path: <span style={{ color: '#38bdf8' }}>{s.v2rayWsPath}</span></div>}
                        {s.v2rayPublicKey && <div>Reality Public Key: <span style={{ color: '#38bdf8', wordBreak: 'break-all' }}>{s.v2rayPublicKey}</span></div>}
                        {s.hysteriaAuth && <div>Hysteria2 Auth: <span style={{ color: '#34d399' }}>{s.hysteriaAuth}</span></div>}
                        {s.slipstreamDomain && <div>Slipstream Domain: <span style={{ color: '#34d399' }}>{s.slipstreamDomain}</span></div>}
                        {s.payload && <div>Payload / Config: <span style={{ color: '#fbbf24', whiteSpace: 'pre-wrap' }}>{s.payload}</span></div>}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
