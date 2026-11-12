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
  CheckCircle2,
  Copy,
  Send,
  Radio,
  KeyRound,
  Flame,
  Eye,
  EyeOff,
  Activity,
  Users,
  ClipboardPaste,
  Edit3,
  Megaphone,
  Search,
  Database,
  LogOut,
  X,
} from 'lucide-react';
import { VpnServerItem, VpnProtocolType } from './lib/types';

type ProtocolCategory = 'all' | 'dns' | 'v2ray' | 'ssh' | 'udp';

type ProtocolOption = {
  id: VpnProtocolType;
  label: string;
  badge: string;
  desc: string;
  category: Exclude<ProtocolCategory, 'all'>;
};

const PROTOCOL_OPTIONS: ProtocolOption[] = [
  {
    id: 'slowdns',
    label: 'SlowDNS (DNSTT)',
    badge: 'UDP 53 / DNS',
    desc: 'DNS tunnel over UDP/DoH with Base62 & segment booster',
    category: 'dns',
  },
  {
    id: 'v2ray_reality',
    label: 'VLESS Reality',
    badge: 'XTLS Vision',
    desc: 'Zero-fingerprint TLS 1.3 Reality tunnel (Chrome uTLS)',
    category: 'v2ray',
  },
  {
    id: 'v2ray_ws',
    label: 'V2Ray WS + TLS (CDN)',
    badge: 'Cloudflare / SNI',
    desc: 'VLESS / VMess / Trojan over WebSocket + Bug Host / CDN',
    category: 'v2ray',
  },
  {
    id: 'dnstt_v2ray',
    label: 'SlowDNS + V2Ray',
    badge: 'DNSTT → Xray',
    desc: 'V2Ray (VLESS/VMess) multiplexed inside a SlowDNS tunnel',
    category: 'dns',
  },
  {
    id: 'ssh_direct',
    label: 'SSH Direct',
    badge: 'TCP 22',
    desc: 'Direct SSH tunnel with username & password authentication',
    category: 'ssh',
  },
  {
    id: 'ssh_payload',
    label: 'SSH + HTTP Payload',
    badge: 'HTTP Injector',
    desc: 'Custom HTTP/WebSocket payload injection over SSH',
    category: 'ssh',
  },
  {
    id: 'ssh_ssl',
    label: 'SSH + SSL (TLS SNI)',
    badge: 'TLS 443',
    desc: 'Direct SSL/TLS handshake with custom SNI bug host',
    category: 'ssh',
  },
  {
    id: 'ssh_ssl_payload',
    label: 'SSH + SSL + Payload',
    badge: 'SSL + WS Payload',
    desc: 'TLS SNI handshake followed by custom HTTP/WebSocket payload',
    category: 'ssh',
  },
  {
    id: 'http_proxy_payload',
    label: 'HTTP Proxy + Payload',
    badge: 'Proxy + Payload',
    desc: 'SSH tunnel routed via remote HTTP Squid/Websocket proxy',
    category: 'ssh',
  },
  {
    id: 'http_proxy_ssl_payload',
    label: 'Proxy + SSL + Payload',
    badge: 'Proxy + TLS + WS',
    desc: 'HTTP Proxy + SSL SNI + custom WebSocket payload injection',
    category: 'ssh',
  },
  {
    id: 'stealth_link',
    label: 'Stealth Link (SOCKS5)',
    badge: 'DNSTT SOCKS',
    desc: 'Direct DNSTT SOCKS5 transport without SSH overhead',
    category: 'dns',
  },
  {
    id: 'hysteria2',
    label: 'Hysteria 2 (QUIC)',
    badge: 'UDP Port Hop',
    desc: 'High-speed QUIC UDP protocol with Salamander obfuscation',
    category: 'udp',
  },
  {
    id: 'wireguard',
    label: 'WireGuard Tunnel',
    badge: 'Kernel / UDP',
    desc: 'Full WireGuard [Interface] & [Peer] configuration profile',
    category: 'udp',
  },
  {
    id: 'stealth_turbo',
    label: 'Stealth Turbo (Slipstream)',
    badge: 'Slipstream DNS',
    desc: 'High-throughput Slipstream DNS tunnel with certificate pinning',
    category: 'dns',
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

interface AdminRecord {
  id: string;
  email: string;
  password?: string;
  role?: string;
  source?: string;
}

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
  const [loginPasswordInput, setLoginPasswordInput] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [adminsList, setAdminsList] = useState<AdminRecord[]>([]);
  const [showAdminDbPanel, setShowAdminDbPanel] = useState(false);
  const [newAdminEmailInput, setNewAdminEmailInput] = useState('');
  const [newAdminPasswordInput, setNewAdminPasswordInput] = useState('');
  const [showAdminPasswords, setShowAdminPasswords] = useState<Record<string, boolean>>({});

  // Mobile/Tablet Responsive Tab Switcher ('all' | 'deploy' | 'fleet' | 'broadcast')
  const [mobileViewTab, setMobileViewTab] = useState<'all' | 'deploy' | 'fleet' | 'broadcast'>('all');
  const [protoCategory, setProtoCategory] = useState<ProtocolCategory>('all');
  const [fleetSearch, setFleetSearch] = useState('');

  const [servers, setServers] = useState<VpnServerItem[]>([]);
  const [announcement, setAnnouncement] = useState('');
  const [loading, setLoading] = useState(true);
  const [pushing, setPushing] = useState(false);
  const [editingServerId, setEditingServerId] = useState<string | null>(null);
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
            setAdminsList(data.admins || []);
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
    const trimmedEmail = loginEmailInput.trim().toLowerCase();
    const trimmedPassword = loginPasswordInput.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setLoginError('Please enter a valid admin email address.');
      return;
    }
    if (!trimmedPassword) {
      setLoginError('Please enter your Firebase admin password.');
      return;
    }
    setLoginLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          email: trimmedEmail,
          password: trimmedPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.authenticated) {
        setLoginError(data.error || 'Access denied: Invalid Firebase email or password.');
      } else {
        setIsAuthenticated(true);
        setAdminEmail(data.email);
        setAdminsList(data.admins || []);
        setLoginEmailInput('');
        setLoginPasswordInput('');
        fetchServers();
        fetchAnalytics();
      }
    } catch {
      setLoginError('Network error verifying Firebase credentials.');
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

  const handleAddFirebaseAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = newAdminEmailInput.trim().toLowerCase();
    const targetPassword = newAdminPasswordInput.trim();
    if (!targetEmail || !targetEmail.includes('@')) {
      notify('error', 'Enter a valid email address');
      return;
    }
    if (!targetPassword || targetPassword.length < 4) {
      notify('error', 'Enter a password (at least 4 characters)');
      return;
    }
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_admin',
          email: targetEmail,
          password: targetPassword,
          role: 'admin',
        }),
      });
      const data = await res.json();
      if (res.ok && data.admins) {
        setAdminsList(data.admins);
        setNewAdminEmailInput('');
        setNewAdminPasswordInput('');
        notify('success', `Saved ${targetEmail} to Firebase Admin DB`);
      } else {
        notify('error', data.error || 'Failed to save admin');
      }
    } catch {
      notify('error', 'Failed to update Firebase Admin DB');
    }
  };

  const handleRemoveFirebaseAdmin = async (target: string) => {
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove_admin', email: target }),
      });
      const data = await res.json();
      if (res.ok && data.admins) {
        setAdminsList(data.admins);
        notify('success', `Removed ${target} from Firebase Admin DB`);
      } else {
        notify('error', data.error || 'Cannot remove admin');
      }
    } catch {
      notify('error', 'Failed to update Firebase Admin DB');
    }
  };

  const handleLoadServerIntoForm = (s: VpnServerItem) => {
    setEditingServerId(s.id);
    setFormProtocol(s.protocol);
    setName(s.name || '');
    setCountry(s.country || 'TZ');
    setTier((s.tier as any) || 'FREE');
    setHost(s.host || '');
    setPort(String(s.portDirect || s.portHTTP || s.portSSL || 22));
    setUsername(s.username || '');
    setPassword(s.password || '');
    setSni(s.sni || '');
    setPayload(s.payload || '');
    setProxyHost(s.proxyHost || '');
    setProxyPort(String(s.proxyPort || 8080));
    setIsLocked(s.isLocked !== undefined ? s.isLocked : true);
    setDnsttNameserver(s.dnsttNameserver || '');
    setDnsttPubkey(s.dnsttPubkey || '');
    setDnsResolver(s.dnsResolver || '8.8.8.8:53');
    setDnsttBooster(s.dnsttBooster !== undefined ? s.dnsttBooster : true);
    setDnsttTurbo(s.dnsttTurbo !== undefined ? s.dnsttTurbo : true);
    setDnsttBoosterSegments(String(s.dnsttBoosterSegments || 4));
    setV2rayProtocol(s.v2rayProtocol || 'vless');
    setV2rayUuid(s.v2rayUuid || '');
    setV2rayPort(String(s.v2rayPort || 443));
    setV2rayPublicKey(s.v2rayPublicKey || '');
    setV2rayShortId(s.v2rayShortId || '');
    setV2raySni(s.v2raySni || '');
    setV2rayWsHost(s.v2rayWsHost || '');
    setV2rayWsPath(s.v2rayWsPath || '/');
    setHysteriaPort(String(s.hysteriaPort || 443));
    setHysteriaPorts(s.hysteriaPorts || '20000-50000');
    setHysteriaAuth(s.hysteriaAuth || '');
    setHysteriaObfs(s.hysteriaObfs || '');
    setHysteriaSni(s.hysteriaSni || '');
    setSlipstreamDomain(s.slipstreamDomain || '');
    setSlipstreamCert(s.slipstreamCert || '');
    setSlipstreamDirect(Boolean(s.slipstreamDirect));
    setWireguardConfig(s.wireguardConfig || '');
    if (mobileViewTab === 'fleet') {
      setMobileViewTab('deploy');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    notify('success', `Loaded "${s.name}" into editor`);
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
        ...(editingServerId ? { id: editingServerId } : {}),
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
        dnsttNameserver: dnsttNameserver.trim(),
        dnsttPubkey: dnsttPubkey.trim(),
        dnsResolver: dnsResolver.trim() || '8.8.8.8:53',
        dnsttBooster,
        dnsttTurbo,
        dnsttBoosterSegments: Number(dnsttBoosterSegments || 4),
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
        hysteriaPort: Number(hysteriaPort || 443),
        hysteriaPorts: hysteriaPorts.trim(),
        hysteriaAuth: hysteriaAuth.trim(),
        hysteriaObfs: hysteriaObfs.trim(),
        hysteriaSni: hysteriaSni.trim() || sni.trim(),
        slipstreamDomain: slipstreamDomain.trim() || dnsttNameserver.trim(),
        slipstreamCert: slipstreamCert.trim() || dnsttPubkey.trim(),
        slipstreamDirect,
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
        notify(
          'success',
          `${editingServerId ? 'Updated' : 'Deployed'} "${name.trim()}" (${formProtocol.toUpperCase()}) to App & Firebase!`
        );
        setName('');
        setEditingServerId(null);
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
        if (editingServerId === id) setEditingServerId(null);
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
        notify('success', 'Synced Fleet Announcement & Encrypted Manifest to App & Firebase!');
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

  const filteredProtocols = PROTOCOL_OPTIONS.filter(
    (p) => protoCategory === 'all' || p.category === protoCategory
  );

  const filteredServers = servers.filter((s) => {
    if (!fleetSearch.trim()) return true;
    const q = fleetSearch.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.host.toLowerCase().includes(q) ||
      s.protocol.toLowerCase().includes(q) ||
      s.country.toLowerCase().includes(q)
    );
  });

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
          padding: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#94a3b8', fontSize: '0.9rem' }}>
          <Shield style={{ width: '1.35rem', height: '1.35rem', color: '#34d399' }} />
          <span>Verifying Firebase Admin Session...</span>
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
            'radial-gradient(circle at 50% 0%, rgba(16, 185, 129, 0.16), transparent 55%), radial-gradient(circle at 85% 90%, rgba(56, 189, 248, 0.12), transparent 45%)',
          color: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}
      >
        <div
          className="fleet-card"
          style={{
            width: '100%',
            maxWidth: '430px',
            padding: '1.85rem 1.5rem',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '1.5rem' }}>
            <div
              style={{
                width: '3.4rem',
                height: '3.4rem',
                borderRadius: '1rem',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(6, 182, 212, 0.25))',
                border: '1px solid rgba(16, 185, 129, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '0.9rem',
                boxShadow: '0 0 28px rgba(16, 185, 129, 0.28)',
              }}
            >
              <Lock style={{ width: '1.55rem', height: '1.55rem', color: '#34d399' }} />
            </div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
              TWEVE SERVER FLEET
            </h1>
            <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.3rem' }}>
              Firebase Admin Authentication • Email & Password Required
            </p>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#cbd5e1',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '0.4rem',
                }}
              >
                Admin Email Address
              </label>
              <input
                type="email"
                required
                autoFocus
                autoComplete="username"
                value={loginEmailInput}
                onChange={(e) => setLoginEmailInput(e.target.value)}
                placeholder="tweveproject@gmail.com"
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#cbd5e1',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '0.4rem',
                }}
              >
                Admin Password
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={loginPasswordInput}
                  onChange={(e) => setLoginPasswordInput(e.target.value)}
                  placeholder="Enter Firebase admin password..."
                  style={{ paddingRight: '2.75rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword((v) => !v)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title={showLoginPassword ? 'Hide password' : 'Show password'}
                >
                  {showLoginPassword ? (
                    <EyeOff style={{ width: '1rem', height: '1rem' }} />
                  ) : (
                    <Eye style={{ width: '1rem', height: '1rem' }} />
                  )}
                </button>
              </div>
            </div>

            {loginError && (
              <div
                style={{
                  padding: '0.75rem 0.9rem',
                  borderRadius: '0.75rem',
                  backgroundColor: 'rgba(244, 63, 94, 0.14)',
                  border: '1px solid rgba(244, 63, 94, 0.4)',
                  color: '#fda4af',
                  fontSize: '0.78rem',
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
              style={{ width: '100%', justifyContent: 'center', marginTop: '0.25rem' }}
            >
              <Shield style={{ width: '1rem', height: '1rem' }} />
              <span>{loginLoading ? 'Verifying with Firebase...' : 'Sign In to Fleet Console'}</span>
            </button>
          </form>

          <div
            style={{
              marginTop: '1.35rem',
              paddingTop: '1rem',
              borderTop: '1px solid rgba(148, 163, 184, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              fontSize: '0.7rem',
              color: '#64748b',
              textAlign: 'center',
            }}
          >
            <KeyRound style={{ width: '0.85rem', height: '0.85rem', color: '#38bdf8' }} />
            <span>Firebase RTDB + Firestore + Auth (`tunnel-7a4c7`)</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#020617', color: '#f8fafc' }}>
      {/* Sticky Top Header */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backdropFilter: 'blur(16px)',
          backgroundColor: 'rgba(2, 6, 23, 0.9)',
          borderBottom: '1px solid rgba(56, 189, 248, 0.16)',
        }}
      >
        <div className="fleet-header-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
            <div
              style={{
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '0.75rem',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.22), rgba(6, 182, 212, 0.22))',
                border: '1px solid rgba(16, 185, 129, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 0 20px rgba(16, 185, 129, 0.22)',
              }}
            >
              <Flame style={{ width: '1.35rem', height: '1.35rem', color: '#34d399' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff' }}>
                  TWEVE SERVER FLEET
                </h1>
                <span
                  style={{
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    padding: '0.12rem 0.5rem',
                    borderRadius: '9999px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#34d399',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                  }}
                >
                  FIREBASE + APK SYNC
                </span>
              </div>
              <p style={{ fontSize: '0.7rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Admin: <strong style={{ color: '#38bdf8' }}>{adminEmail}</strong>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setShowAdminDbPanel((v) => !v)}
              className="btn-fleet-secondary"
              style={{
                borderColor: showAdminDbPanel ? '#a78bfa' : undefined,
                background: showAdminDbPanel ? 'rgba(139, 92, 246, 0.18)' : undefined,
              }}
            >
              <Database style={{ width: '0.85rem', height: '0.85rem', color: '#a78bfa' }} />
              <span>Firebase Admins ({adminsList.length})</span>
            </button>
            <button type="button" onClick={handleSaveAnnouncement} className="btn-fleet-secondary">
              <RefreshCw style={{ width: '0.85rem', height: '0.85rem', color: '#34d399' }} />
              <span>Sync Cloud</span>
            </button>
            <button type="button" onClick={copyApkEndpoint} className="btn-fleet-secondary">
              <Copy style={{ width: '0.85rem', height: '0.85rem', color: '#38bdf8' }} />
              <span>APK URL</span>
            </button>
            <button type="button" onClick={handleLogout} className="btn-fleet-secondary">
              <LogOut style={{ width: '0.85rem', height: '0.85rem', color: '#fb7185' }} />
              <span>Exit</span>
            </button>
          </div>
        </div>
      </header>

      <main className="fleet-shell" style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
        {/* Notification Banner */}
        {notification && (
          <div
            style={{
              padding: '0.8rem 1rem',
              borderRadius: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              background:
                notification.type === 'success' ? 'rgba(16, 185, 129, 0.16)' : 'rgba(244, 63, 94, 0.16)',
              border: `1px solid ${
                notification.type === 'success' ? 'rgba(16, 185, 129, 0.45)' : 'rgba(244, 63, 94, 0.45)'
              }`,
              color: notification.type === 'success' ? '#6ee7b7' : '#fda4af',
              fontSize: '0.82rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              {notification.type === 'success' ? (
                <CheckCircle2 style={{ width: '1.05rem', height: '1.05rem', color: '#34d399' }} />
              ) : (
                <Flame style={{ width: '1.05rem', height: '1.05rem', color: '#fb7185' }} />
              )}
              <span style={{ fontWeight: 600 }}>{notification.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotification(null)}
              style={{ color: '#94a3b8', cursor: 'pointer' }}
            >
              <X style={{ width: '0.95rem', height: '0.95rem' }} />
            </button>
          </div>
        )}

        {/* Firebase Admin Accounts Drawer */}
        {showAdminDbPanel && (
          <section
            className="fleet-card fleet-section-pad"
            style={{ border: '1px solid rgba(167, 139, 250, 0.45)' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Database style={{ width: '1.1rem', height: '1.1rem', color: '#a78bfa' }} />
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ffffff' }}>
                    Firebase Admin Accounts (`tunnel-7a4c7` / `admins`)
                  </h3>
                </div>
                <p style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                  Add or update admin email & password here or manually in Firebase Console → Realtime Database (`/admins`) / Firestore (`admins`) / Firebase Auth.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAdminDbPanel(false)}
                className="btn-fleet-secondary"
                style={{ padding: '0.35rem 0.65rem' }}
              >
                <X style={{ width: '0.85rem', height: '0.85rem' }} />
                <span>Close</span>
              </button>
            </div>

            <form
              onSubmit={handleAddFirebaseAdmin}
              className="fleet-form-grid-3"
              style={{ marginTop: '1rem', alignItems: 'end' }}
            >
              <div>
                <label style={{ fontSize: '0.7rem', color: '#cbd5e1', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                  Admin Email *
                </label>
                <input
                  type="email"
                  required
                  value={newAdminEmailInput}
                  onChange={(e) => setNewAdminEmailInput(e.target.value)}
                  placeholder="admin@email.com"
                />
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', color: '#cbd5e1', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                  Admin Password *
                </label>
                <input
                  type="text"
                  required
                  value={newAdminPasswordInput}
                  onChange={(e) => setNewAdminPasswordInput(e.target.value)}
                  placeholder="Enter password..."
                  style={{ fontFamily: 'monospace' }}
                />
              </div>
              <button type="submit" className="btn-fleet-primary" style={{ height: '42px' }}>
                <PlusCircle style={{ width: '0.95rem', height: '0.95rem' }} />
                <span>Save Admin to Firebase</span>
              </button>
            </form>

            <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '0.65rem' }}>
              {adminsList.map((adm) => {
                const pwVisible = showAdminPasswords[adm.email] || false;
                return (
                  <div
                    key={adm.email}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '0.8rem',
                      backgroundColor: 'rgba(15, 23, 42, 0.9)',
                      border: '1px solid rgba(148, 163, 184, 0.22)',
                      fontSize: '0.76rem',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {adm.email}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontFamily: 'monospace', marginTop: '0.15rem' }}>
                        Password: <span style={{ color: '#34d399' }}>{pwVisible ? adm.password || '(Firebase Auth)' : '••••••••'}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() =>
                          setShowAdminPasswords((prev) => ({ ...prev, [adm.email]: !prev[adm.email] }))
                        }
                        style={{ color: '#38bdf8', cursor: 'pointer', padding: '0.25rem' }}
                        title="Show/Hide Password"
                      >
                        {pwVisible ? <EyeOff style={{ width: '0.85rem', height: '0.85rem' }} /> : <Eye style={{ width: '0.85rem', height: '0.85rem' }} />}
                      </button>
                      {adminsList.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveFirebaseAdmin(adm.email)}
                          style={{ color: '#fb7185', cursor: 'pointer', padding: '0.25rem' }}
                          title="Delete Admin from Firebase"
                        >
                          <Trash2 style={{ width: '0.85rem', height: '0.85rem' }} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Real-time Fleet Telemetry Bar (2x2 on Phone/Tablet, 4-col on PC) */}
        <div className="fleet-kpi-grid">
          <div className="kpi-stat-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '0.45rem', height: '0.45rem', borderRadius: '9999px', backgroundColor: analytics.activeUsersCount > 0 ? '#10b981' : '#64748b', display: 'inline-block' }}></span>
                Connected
              </span>
              <Users style={{ width: '0.95rem', height: '0.95rem', color: '#34d399' }} />
            </div>
            <div style={{ marginTop: '0.45rem', display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', fontFamily: 'monospace' }}>
                {analytics.activeUsersCount}
              </span>
              <span style={{ fontSize: '0.68rem', color: '#34d399', fontWeight: 600 }}>Live</span>
            </div>
          </div>

          <div className="kpi-stat-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Active Nodes
              </span>
              <Server style={{ width: '0.95rem', height: '0.95rem', color: '#38bdf8' }} />
            </div>
            <div style={{ marginTop: '0.45rem', display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace' }}>
                {servers.filter((s) => s.isActive).length}
              </span>
              <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>/ {servers.length}</span>
            </div>
          </div>

          <div className="kpi-stat-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Protocols
              </span>
              <Zap style={{ width: '0.95rem', height: '0.95rem', color: '#c084fc' }} />
            </div>
            <div style={{ marginTop: '0.45rem', display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#c084fc', fontFamily: 'monospace' }}>
                {PROTOCOL_OPTIONS.length}
              </span>
              <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Modes</span>
            </div>
          </div>

          <div className="kpi-stat-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Traffic
              </span>
              <Activity style={{ width: '0.95rem', height: '0.95rem', color: '#fbbf24' }} />
            </div>
            <div style={{ marginTop: '0.45rem', display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fcd34d', fontFamily: 'monospace' }}>
                {analytics.bandwidth.totalDownMB}
              </span>
              <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>MB</span>
            </div>
          </div>
        </div>

        {/* Sticky Mobile & Tablet View Switcher */}
        <nav className="fleet-mobile-tabs">
          {[
            { id: 'all', label: 'Split All' },
            { id: 'deploy', label: editingServerId ? 'Edit Node' : '+ Deploy' },
            { id: 'fleet', label: `Servers (${servers.length})` },
            { id: 'broadcast', label: 'Broadcast' },
          ].map((tab) => {
            const active = mobileViewTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMobileViewTab(tab.id as any)}
                style={{
                  padding: '0.5rem 0.35rem',
                  borderRadius: '0.65rem',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: active
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : 'transparent',
                  color: active ? '#ffffff' : '#94a3b8',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Main Responsive Workspace: 2-Column Split on PC, Adaptive on Tablet/Phone */}
        <div className="fleet-workspace-grid">
          {/* LEFT COLUMN: Quick Import + Server Deployment Suite */}
          <div
            style={{
              display: mobileViewTab === 'all' || mobileViewTab === 'deploy' ? 'flex' : 'none',
              flexDirection: 'column',
              gap: '1.15rem',
              minWidth: 0,
            }}
          >
            {/* Quick Link Import / Paste Bar */}
            <section className="fleet-card" style={{ padding: '0.9rem 1.1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <ClipboardPaste style={{ width: '1.05rem', height: '1.05rem', color: '#22d3ee' }} />
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ffffff' }}>
                    Quick URI Auto-Fill:
                  </span>
                </div>
                <div style={{ display: 'flex', flex: 1, gap: '0.5rem', minWidth: '220px' }}>
                  <input
                    type="text"
                    value={rawPasteInput}
                    onChange={(e) => setRawPasteInput(e.target.value)}
                    placeholder="Paste vless://, vmess://, trojan://, hy2:// or WireGuard config..."
                    style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.76rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => handleParseRawUri(rawPasteInput)}
                    className="btn-fleet-secondary"
                    style={{ flexShrink: 0 }}
                  >
                    <span>Parse</span>
                  </button>
                </div>
              </div>
            </section>

            {/* Server Push / Edit Suite */}
            <section className="fleet-card fleet-section-pad">
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: '1rem',
                  borderBottom: '1px solid rgba(56, 189, 248, 0.18)',
                  gap: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div
                    style={{
                      padding: '0.45rem',
                      borderRadius: '0.75rem',
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      color: '#34d399',
                    }}
                  >
                    {editingServerId ? (
                      <Edit3 style={{ width: '1.15rem', height: '1.15rem' }} />
                    ) : (
                      <PlusCircle style={{ width: '1.15rem', height: '1.15rem' }} />
                    )}
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.08rem', fontWeight: 800, color: '#ffffff' }}>
                      {editingServerId ? 'Edit Existing Fleet Server' : 'Deploy Server to Tweve Tunnel'}
                    </h2>
                    <p style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                      Pushed configurations encrypt with AES-256-GCM and sync to APK & Firebase.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {editingServerId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingServerId(null);
                        setName('');
                      }}
                      className="btn-fleet-secondary"
                    >
                      <X style={{ width: '0.85rem', height: '0.85rem' }} />
                      <span>Cancel Edit</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsLocked(!isLocked)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.45rem 0.85rem',
                      borderRadius: '0.75rem',
                      fontSize: '0.73rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: isLocked ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      border: isLocked
                        ? '1px solid rgba(16, 185, 129, 0.4)'
                        : '1px solid rgba(245, 158, 11, 0.4)',
                      color: isLocked ? '#34d399' : '#fbbf24',
                    }}
                  >
                    {isLocked ? (
                      <Lock style={{ width: '0.85rem', height: '0.85rem' }} />
                    ) : (
                      <Unlock style={{ width: '0.85rem', height: '0.85rem' }} />
                    )}
                    <span>{isLocked ? 'Locked' : 'Unlocked'}</span>
                  </button>
                </div>
              </div>

              {/* Protocol Category Filter + Grid */}
              <div style={{ marginTop: '1rem' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    marginBottom: '0.65rem',
                  }}
                >
                  <label
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: '#94a3b8',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    1. Select Protocol ({PROTOCOL_OPTIONS.find((p) => p.id === formProtocol)?.label})
                  </label>
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {[
                      { id: 'all', label: 'All (14)' },
                      { id: 'dns', label: 'SlowDNS' },
                      { id: 'v2ray', label: 'V2Ray' },
                      { id: 'ssh', label: 'SSH / Proxy' },
                      { id: 'udp', label: 'Hy2 / WG' },
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setProtoCategory(cat.id as ProtocolCategory)}
                        style={{
                          padding: '0.22rem 0.6rem',
                          borderRadius: '9999px',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          background:
                            protoCategory === cat.id
                              ? 'rgba(56, 189, 248, 0.2)'
                              : 'rgba(15, 23, 42, 0.8)',
                          border:
                            protoCategory === cat.id
                              ? '1px solid #38bdf8'
                              : '1px solid rgba(148, 163, 184, 0.2)',
                          color: protoCategory === cat.id ? '#38bdf8' : '#94a3b8',
                        }}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="fleet-proto-grid">
                  {filteredProtocols.map((p) => {
                    const active = formProtocol === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setFormProtocol(p.id)}
                        style={{
                          textAlign: 'left',
                          padding: '0.65rem 0.75rem',
                          borderRadius: '0.75rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          background: active ? 'rgba(16, 185, 129, 0.16)' : 'rgba(15, 23, 42, 0.75)',
                          border: active ? '1.5px solid #10b981' : '1px solid rgba(56, 189, 248, 0.16)',
                          boxShadow: active ? '0 0 16px rgba(16, 185, 129, 0.2)' : 'none',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.3rem' }}>
                          <span style={{ fontSize: '0.76rem', fontWeight: 800, color: active ? '#34d399' : '#ffffff' }}>
                            {p.label}
                          </span>
                        </div>
                        <div style={{ marginTop: '0.2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span
                            style={{
                              fontSize: '0.6rem',
                              padding: '0.08rem 0.35rem',
                              borderRadius: '0.3rem',
                              background: 'rgba(2, 6, 23, 0.85)',
                              color: '#38bdf8',
                              fontWeight: 700,
                              fontFamily: 'monospace',
                            }}
                          >
                            {p.badge}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Core Identity Fields */}
              <div className="fleet-form-grid" style={{ marginTop: '1.15rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                    Server Remark / Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Vodacom Tanzania VIP"
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                    Server Host / IP Address *
                  </label>
                  <input
                    type="text"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="e.g. tz1.twevetunnel.com"
                    style={{ fontFamily: 'monospace' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                    Country Flag
                  </label>
                  <select value={country} onChange={(e) => setCountry(e.target.value)}>
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                      Badge Tier
                    </label>
                    <select value={tier} onChange={(e) => setTier(e.target.value as any)}>
                      <option value="FREE">FREE</option>
                      <option value="VIP">VIP</option>
                      <option value="PREMIUM">PREMIUM</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                      Primary Port
                    </label>
                    <input
                      type="number"
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                      placeholder="22 / 443"
                      style={{ fontFamily: 'monospace' }}
                    />
                  </div>
                </div>
              </div>

              {/* Protocol-Specific Fields */}
              <div
                style={{
                  marginTop: '1.1rem',
                  padding: '1rem',
                  borderRadius: '0.85rem',
                  backgroundColor: 'rgba(2, 6, 23, 0.65)',
                  border: '1px solid rgba(56, 189, 248, 0.16)',
                }}
              >
                <div
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: '#38bdf8',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '0.75rem',
                  }}
                >
                  2. {PROTOCOL_OPTIONS.find((p) => p.id === formProtocol)?.label} Parameters
                </div>

                <div className="fleet-form-grid">
                  {needsDnsttFields && (
                    <>
                      <div>
                        <label style={{ fontSize: '0.71rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                          DNSTT Nameserver (NS Domain) *
                        </label>
                        <input
                          type="text"
                          value={dnsttNameserver}
                          onChange={(e) => setDnsttNameserver(e.target.value)}
                          placeholder="ns.isp.tz.domain.com"
                          style={{ fontFamily: 'monospace' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.71rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                          DNSTT Public Key (64-char Hex) *
                        </label>
                        <input
                          type="text"
                          value={dnsttPubkey}
                          onChange={(e) => setDnsttPubkey(e.target.value)}
                          placeholder="64-character hex public key"
                          style={{ fontFamily: 'monospace' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.71rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                          DNS Resolver (UDP / DoH)
                        </label>
                        <input
                          type="text"
                          value={dnsResolver}
                          onChange={(e) => setDnsResolver(e.target.value)}
                          placeholder="8.8.8.8:53 or 1.1.1.1:53"
                          style={{ fontFamily: 'monospace' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.71rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                          Booster Segments (1-8)
                        </label>
                        <input
                          type="number"
                          value={dnsttBoosterSegments}
                          onChange={(e) => setDnsttBoosterSegments(e.target.value)}
                          placeholder="4"
                          style={{ fontFamily: 'monospace' }}
                        />
                      </div>
                    </>
                  )}

                  {needsV2rayFields && (
                    <>
                      <div>
                        <label style={{ fontSize: '0.71rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                          V2Ray Sub-Protocol
                        </label>
                        <select value={v2rayProtocol} onChange={(e) => setV2rayProtocol(e.target.value)}>
                          <option value="vless">VLESS</option>
                          <option value="vmess">VMess</option>
                          <option value="trojan">Trojan</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.71rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                          UUID / Trojan Password *
                        </label>
                        <input
                          type="text"
                          value={v2rayUuid}
                          onChange={(e) => setV2rayUuid(e.target.value)}
                          placeholder="e.g. 93a61219-c703-4f9e-a0e2-..."
                          style={{ fontFamily: 'monospace' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.71rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                          V2Ray Port
                        </label>
                        <input
                          type="number"
                          value={v2rayPort}
                          onChange={(e) => setV2rayPort(e.target.value)}
                          placeholder="443"
                          style={{ fontFamily: 'monospace' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.71rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                          TLS / Reality SNI Bug Host
                        </label>
                        <input
                          type="text"
                          value={v2raySni}
                          onChange={(e) => setV2raySni(e.target.value)}
                          placeholder="e.g. www.microsoft.com"
                          style={{ fontFamily: 'monospace' }}
                        />
                      </div>
                    </>
                  )}

                  {formProtocol === 'v2ray_reality' && (
                    <>
                      <div>
                        <label style={{ fontSize: '0.71rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                          Reality Public Key (pbk) *
                        </label>
                        <input
                          type="text"
                          value={v2rayPublicKey}
                          onChange={(e) => setV2rayPublicKey(e.target.value)}
                          placeholder="Reality x25519 public key"
                          style={{ fontFamily: 'monospace' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.71rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                          Reality Short ID (sid)
                        </label>
                        <input
                          type="text"
                          value={v2rayShortId}
                          onChange={(e) => setV2rayShortId(e.target.value)}
                          placeholder="e.g. 6ba85179e30d4fc2"
                          style={{ fontFamily: 'monospace' }}
                        />
                      </div>
                    </>
                  )}

                  {formProtocol === 'v2ray_ws' && (
                    <>
                      <div>
                        <label style={{ fontSize: '0.71rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                          WebSocket Host / CDN Bug Host
                        </label>
                        <input
                          type="text"
                          value={v2rayWsHost}
                          onChange={(e) => setV2rayWsHost(e.target.value)}
                          placeholder="e.g. myvodacom.vodacom.co.tz"
                          style={{ fontFamily: 'monospace' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.71rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                          WebSocket Path
                        </label>
                        <input
                          type="text"
                          value={v2rayWsPath}
                          onChange={(e) => setV2rayWsPath(e.target.value)}
                          placeholder="e.g. /vless-ws"
                          style={{ fontFamily: 'monospace' }}
                        />
                      </div>
                    </>
                  )}

                  {needsSshCredentials && (
                    <>
                      <div>
                        <label style={{ fontSize: '0.71rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                          SSH Username
                        </label>
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="SSH username"
                          style={{ fontFamily: 'monospace' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.71rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                          SSH Password
                        </label>
                        <input
                          type="text"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="SSH password"
                          style={{ fontFamily: 'monospace' }}
                        />
                      </div>
                    </>
                  )}

                  {needsSniField && (
                    <div>
                      <label style={{ fontSize: '0.71rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                        SSL / TLS SNI Host *
                      </label>
                      <input
                        type="text"
                        value={sni}
                        onChange={(e) => setSni(e.target.value)}
                        placeholder="e.g. zero.facebook.com"
                        style={{ fontFamily: 'monospace' }}
                      />
                    </div>
                  )}

                  {needsProxyFields && (
                    <>
                      <div>
                        <label style={{ fontSize: '0.71rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                          HTTP Proxy Host
                        </label>
                        <input
                          type="text"
                          value={proxyHost}
                          onChange={(e) => setProxyHost(e.target.value)}
                          placeholder="Defaults to Server Host"
                          style={{ fontFamily: 'monospace' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.71rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                          HTTP Proxy Port
                        </label>
                        <input
                          type="number"
                          value={proxyPort}
                          onChange={(e) => setProxyPort(e.target.value)}
                          placeholder="8080 or 80"
                          style={{ fontFamily: 'monospace' }}
                        />
                      </div>
                    </>
                  )}

                  {formProtocol === 'hysteria2' && (
                    <>
                      <div>
                        <label style={{ fontSize: '0.71rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                          Hysteria2 Auth Password *
                        </label>
                        <input
                          type="text"
                          value={hysteriaAuth}
                          onChange={(e) => setHysteriaAuth(e.target.value)}
                          placeholder="Hysteria 2 auth password"
                          style={{ fontFamily: 'monospace' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.71rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                          Hysteria2 Port
                        </label>
                        <input
                          type="number"
                          value={hysteriaPort}
                          onChange={(e) => setHysteriaPort(e.target.value)}
                          placeholder="443"
                          style={{ fontFamily: 'monospace' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.71rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                          Port Hopping Range (mport)
                        </label>
                        <input
                          type="text"
                          value={hysteriaPorts}
                          onChange={(e) => setHysteriaPorts(e.target.value)}
                          placeholder="20000-50000"
                          style={{ fontFamily: 'monospace' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.71rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                          SNI / Bug Host
                        </label>
                        <input
                          type="text"
                          value={hysteriaSni}
                          onChange={(e) => setHysteriaSni(e.target.value)}
                          placeholder="e.g. www.bing.com"
                          style={{ fontFamily: 'monospace' }}
                        />
                      </div>
                    </>
                  )}

                  {formProtocol === 'stealth_turbo' && (
                    <>
                      <div>
                        <label style={{ fontSize: '0.71rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                          Slipstream Domain *
                        </label>
                        <input
                          type="text"
                          value={slipstreamDomain}
                          onChange={(e) => setSlipstreamDomain(e.target.value)}
                          placeholder="e.g. s.domain.com"
                          style={{ fontFamily: 'monospace' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.71rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                          Slipstream Certificate
                        </label>
                        <input
                          type="text"
                          value={slipstreamCert}
                          onChange={(e) => setSlipstreamCert(e.target.value)}
                          placeholder="Optional certificate pin"
                          style={{ fontFamily: 'monospace' }}
                        />
                      </div>
                    </>
                  )}

                  {needsPayloadField && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ fontSize: '0.71rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                        HTTP Injector Payload *
                      </label>
                      <textarea
                        value={payload}
                        onChange={(e) => setPayload(e.target.value)}
                        rows={2}
                        placeholder="GET / HTTP/1.1[crlf]Host: [host][crlf]Upgrade: websocket[crlf][crlf]"
                        style={{ fontFamily: 'monospace', color: '#fbbf24', minHeight: '64px' }}
                      />
                    </div>
                  )}

                  {formProtocol === 'wireguard' && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ fontSize: '0.71rem', color: '#94a3b8', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
                        WireGuard Configuration ([Interface] & [Peer]) *
                      </label>
                      <textarea
                        value={wireguardConfig}
                        onChange={(e) => setWireguardConfig(e.target.value)}
                        rows={5}
                        placeholder={`[Interface]\nPrivateKey = ...\nAddress = 10.0.0.2/32\nDNS = 1.1.1.1\n\n[Peer]\nPublicKey = ...\nEndpoint = 1.2.3.4:51820\nAllowedIPs = 0.0.0.0/0`}
                        style={{ fontFamily: 'monospace', color: '#34d399', minHeight: '120px' }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Action Button Bar */}
              <div
                style={{
                  marginTop: '1.15rem',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.85rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid rgba(56, 189, 248, 0.16)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.72rem', color: '#94a3b8' }}>
                  <Shield style={{ width: '0.95rem', height: '0.95rem', color: '#34d399', flexShrink: 0 }} />
                  <span>
                    {isLocked
                      ? 'Anti-Tamper Locked: Credentials hidden inside VPN client.'
                      : 'Unlocked: Parameters visible for testing.'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handlePushServer}
                  disabled={pushing}
                  className="btn-fleet-primary"
                >
                  {pushing ? (
                    <RefreshCw style={{ width: '1rem', height: '1rem' }} className="animate-spin" />
                  ) : (
                    <Send style={{ width: '1rem', height: '1rem' }} />
                  )}
                  <span>
                    {editingServerId ? 'Save & Sync Updated Server' : 'Push Server Live to App & Cloud'}
                  </span>
                </button>
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN: Active Fleet Servers + Broadcast Announcement */}
          <div
            style={{
              display:
                mobileViewTab === 'all' || mobileViewTab === 'fleet' || mobileViewTab === 'broadcast'
                  ? 'flex'
                  : 'none',
              flexDirection: 'column',
              gap: '1.15rem',
              minWidth: 0,
            }}
          >
            {/* Active Fleet Servers Card */}
            {(mobileViewTab === 'all' || mobileViewTab === 'fleet') && (
              <section className="fleet-card fleet-section-pad">
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    paddingBottom: '0.9rem',
                    borderBottom: '1px solid rgba(56, 189, 248, 0.18)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div
                      style={{
                        padding: '0.4rem',
                        borderRadius: '0.7rem',
                        background: 'rgba(56, 189, 248, 0.15)',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        color: '#38bdf8',
                      }}
                    >
                      <Radio style={{ width: '1.1rem', height: '1.1rem' }} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff' }}>
                        Active Fleet ({servers.length})
                      </h3>
                      <p style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                        Live servers synced to APK & Firebase
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={fetchServers}
                    disabled={loading}
                    className="btn-fleet-secondary"
                    style={{ padding: '0.4rem 0.75rem' }}
                  >
                    <RefreshCw
                      style={{ width: '0.8rem', height: '0.8rem' }}
                      className={loading ? 'animate-spin' : ''}
                    />
                    <span>Refresh</span>
                  </button>
                </div>

                {/* Search Filter */}
                {servers.length > 0 && (
                  <div style={{ marginTop: '0.85rem', position: 'relative' }}>
                    <Search
                      style={{
                        width: '0.9rem',
                        height: '0.9rem',
                        color: '#64748b',
                        position: 'absolute',
                        left: '0.85rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                      }}
                    />
                    <input
                      type="text"
                      value={fleetSearch}
                      onChange={(e) => setFleetSearch(e.target.value)}
                      placeholder="Filter servers by name, host, or protocol..."
                      style={{ paddingLeft: '2.35rem', fontSize: '0.76rem' }}
                    />
                  </div>
                )}

                <div style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {filteredServers.length === 0 ? (
                    <div
                      style={{
                        textAlign: 'center',
                        padding: '2.25rem 1rem',
                        color: '#64748b',
                        fontSize: '0.8rem',
                      }}
                    >
                      <Server style={{ width: '1.85rem', height: '1.85rem', margin: '0 auto 0.5rem', opacity: 0.4 }} />
                      <div style={{ fontWeight: 700, color: '#94a3b8' }}>No matching servers in fleet</div>
                    </div>
                  ) : (
                    filteredServers.map((s) => {
                      const detailsVisible = showConfigDetails[s.id] || false;
                      const countryObj = COUNTRIES.find((c) => c.code === s.country);
                      return (
                        <div
                          key={s.id}
                          className="server-fleet-row"
                          style={{
                            opacity: s.isActive ? 1 : 0.6,
                            borderColor:
                              editingServerId === s.id ? '#10b981' : undefined,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '0.75rem',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', minWidth: 0 }}>
                              <div
                                style={{
                                  width: '2.35rem',
                                  height: '2.35rem',
                                  borderRadius: '0.65rem',
                                  backgroundColor: '#030712',
                                  border: '1px solid rgba(56, 189, 248, 0.2)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '1.15rem',
                                  flexShrink: 0,
                                }}
                              >
                                {countryObj ? countryObj.flag : '🌐'}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#ffffff' }}>
                                    {s.name}
                                  </span>
                                  <span
                                    style={{
                                      padding: '0.1rem 0.45rem',
                                      borderRadius: '0.35rem',
                                      fontSize: '0.62rem',
                                      fontWeight: 800,
                                      textTransform: 'uppercase',
                                      background: 'rgba(56, 189, 248, 0.15)',
                                      color: '#38bdf8',
                                      border: '1px solid rgba(56, 189, 248, 0.3)',
                                    }}
                                  >
                                    {s.protocol.replace(/_/g, ' ')}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: '0.62rem',
                                      fontWeight: 800,
                                      color: '#34d399',
                                    }}
                                  >
                                    {s.tier}
                                  </span>
                                </div>
                                <div
                                  style={{
                                    fontSize: '0.72rem',
                                    color: '#94a3b8',
                                    marginTop: '0.18rem',
                                    fontFamily: 'monospace',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {s.host}
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                onClick={() => handleLoadServerIntoForm(s)}
                                className="btn-fleet-secondary"
                                style={{ padding: '0.35rem 0.6rem', fontSize: '0.7rem' }}
                                title="Edit server in form"
                              >
                                <Edit3 style={{ width: '0.75rem', height: '0.75rem', color: '#38bdf8' }} />
                                <span>Edit</span>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setShowConfigDetails((prev) => ({
                                    ...prev,
                                    [s.id]: !prev[s.id],
                                  }))
                                }
                                className="btn-fleet-secondary"
                                style={{ padding: '0.35rem 0.6rem', fontSize: '0.7rem' }}
                              >
                                {detailsVisible ? (
                                  <EyeOff style={{ width: '0.75rem', height: '0.75rem' }} />
                                ) : (
                                  <Eye style={{ width: '0.75rem', height: '0.75rem' }} />
                                )}
                                <span>{detailsVisible ? 'Hide' : 'View'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleStatus(s)}
                                style={{
                                  padding: '0.35rem 0.65rem',
                                  borderRadius: '0.6rem',
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  border: s.isActive
                                    ? '1px solid rgba(16, 185, 129, 0.4)'
                                    : '1px solid rgba(148, 163, 184, 0.3)',
                                  background: s.isActive
                                    ? 'rgba(16, 185, 129, 0.15)'
                                    : 'rgba(148, 163, 184, 0.1)',
                                  color: s.isActive ? '#34d399' : '#94a3b8',
                                  cursor: 'pointer',
                                }}
                              >
                                {s.isActive ? 'Online' : 'Paused'}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteServer(s.id, s.name)}
                                style={{
                                  padding: '0.4rem',
                                  borderRadius: '0.6rem',
                                  background: 'rgba(244, 63, 94, 0.15)',
                                  border: '1px solid rgba(244, 63, 94, 0.3)',
                                  color: '#fb7185',
                                  cursor: 'pointer',
                                }}
                                title="Delete server"
                              >
                                <Trash2 style={{ width: '0.82rem', height: '0.82rem' }} />
                              </button>
                            </div>
                          </div>

                          {detailsVisible && (
                            <div
                              style={{
                                marginTop: '0.75rem',
                                fontSize: '0.72rem',
                                fontFamily: 'monospace',
                                backgroundColor: '#030712',
                                padding: '0.75rem',
                                borderRadius: '0.65rem',
                                border: '1px solid rgba(56, 189, 248, 0.16)',
                                color: '#cbd5e1',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.3rem',
                                wordBreak: 'break-all',
                              }}
                            >
                              <div>
                                Host: <span style={{ color: '#38bdf8' }}>{s.host}</span> (Port:{' '}
                                {s.portDirect || s.v2rayPort || 443})
                              </div>
                              {s.username && (
                                <div>
                                  SSH User: <span style={{ color: '#34d399' }}>{s.username}</span>
                                </div>
                              )}
                              {s.dnsttNameserver && (
                                <div>
                                  NS: <span style={{ color: '#34d399' }}>{s.dnsttNameserver}</span>
                                </div>
                              )}
                              {s.dnsttPubkey && (
                                <div>
                                  Pubkey: <span style={{ color: '#c084fc' }}>{s.dnsttPubkey}</span>
                                </div>
                              )}
                              {s.v2rayUuid && (
                                <div>
                                  UUID: <span style={{ color: '#c084fc' }}>{s.v2rayUuid}</span>
                                </div>
                              )}
                              {s.v2raySni && (
                                <div>
                                  SNI: <span style={{ color: '#34d399' }}>{s.v2raySni}</span>
                                </div>
                              )}
                              {s.payload && (
                                <div>
                                  Payload: <span style={{ color: '#fbbf24' }}>{s.payload}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            )}

            {/* Global App Broadcast / Rich HTML Announcement Card */}
            {(mobileViewTab === 'all' || mobileViewTab === 'broadcast') && (
              <section className="fleet-card fleet-section-pad">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.6rem',
                    paddingBottom: '0.85rem',
                    borderBottom: '1px solid rgba(56, 189, 248, 0.18)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                    <div
                      style={{
                        padding: '0.4rem',
                        borderRadius: '0.7rem',
                        background: 'rgba(192, 132, 252, 0.15)',
                        border: '1px solid rgba(192, 132, 252, 0.3)',
                        color: '#c084fc',
                      }}
                    >
                      <Megaphone style={{ width: '1.05rem', height: '1.05rem' }} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ffffff' }}>
                        App Broadcast & Styled HTML Message
                      </h3>
                      <p style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                        Supports plain text or styled HTML with clickable WhatsApp / phone links
                      </p>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <textarea
                    value={announcement}
                    onChange={(e) => setAnnouncement(e.target.value)}
                    rows={4}
                    placeholder="Enter server announcement or styled HTML (<div style='...'>...</div>)..."
                    style={{ fontFamily: 'monospace', fontSize: '0.76rem' }}
                  />
                  <button
                    type="button"
                    onClick={handleSaveAnnouncement}
                    className="btn-fleet-primary"
                    style={{ width: '100%' }}
                  >
                    <Send style={{ width: '0.9rem', height: '0.9rem' }} />
                    <span>Publish Broadcast to VPN App</span>
                  </button>
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
