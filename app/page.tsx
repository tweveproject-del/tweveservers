'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Server,
  Shield,
  Rocket,
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
  Menu,
  DollarSign,
  Wallet,
  CreditCard,
  TrendingUp,
  Filter,
  Check,
  ExternalLink,
  Clock,
  Phone,
  ChevronRight,
} from 'lucide-react';
import { VpnServerItem, VpnProtocolType } from './lib/types';
import { getRecaptchaToken, preloadRecaptcha } from './lib/recaptcha';

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

interface ServerTelemetryEntry {
  serverId: string;
  serverName: string;
  activeUsers: number;
  totalUsers: number;
  bytesUp: number;
  bytesDown: number;
  totalBytes: number;
  totalMB: string;
  totalGB: string;
  formattedTotal: string;
  formattedDown: string;
  formattedUp: string;
}

interface FleetAnalytics {
  activeUsersCount: number;
  totalConfiguredUsersCount: number;
  activeServersCount?: number;
  totalServersCount?: number;
  protocolBreakdown: Record<string, number>;
  topServers?: Record<string, number>;
  serverTelemetry?: Record<string, ServerTelemetryEntry>;
  bandwidth: {
    totalUpBytes?: number;
    totalDownBytes?: number;
    totalBytes?: number;
    liveUpBytes?: number;
    liveDownBytes?: number;
    liveTotalBytes?: number;
    totalUpMB: number;
    totalDownMB: number;
    totalMB?: number;
    totalGB?: number;
    formattedTotal?: string;
    formattedDown?: string;
    formattedUp?: string;
    formattedLiveTotal?: string;
  };
  liveSampledSessions: Array<{
    deviceId: string;
    serverId: string;
    serverName: string;
    protocol: string;
    country: string;
    ip: string;
    status?: string;
    connectedSince: number;
    lastPing: number;
    bytesUp: number;
    bytesDown: number;
    totalBytesUp?: number;
    totalBytesDown?: number;
    formattedSessionTotal?: string;
    formattedAllTimeTotal?: string;
    formattedDown?: string;
    formattedUp?: string;
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
  const [loginLockedUntil, setLoginLockedUntil] = useState<number>(0);

  // Mobile/Tablet Responsive Tab Switcher ('all' | 'deploy' | 'fleet' | 'payments' | 'broadcast' | 'telemetry' | 'security' | 'version')
  const [mobileViewTab, setMobileViewTab] = useState<'fleet' | 'deploy' | 'payments' | 'broadcast' | 'telemetry' | 'security' | 'version'>('fleet');

  // Security & Admin Activity Audit Logs State
  const [securityLogs, setSecurityLogs] = useState<any[]>([]);
  const [securityBans, setSecurityBans] = useState<any[]>([]);
  const [securityStats, setSecurityStats] = useState<{
    totalLogs: number;
    criticalCount: number;
    warningCount: number;
    activeBansCount: number;
    adminActionsCount: number;
  }>({ totalLogs: 0, criticalCount: 0, warningCount: 0, activeBansCount: 0, adminActionsCount: 0 });
  const [securityFilter, setSecurityFilter] = useState<string>('ALL');
  const [securitySearch, setSecuritySearch] = useState<string>('');
  const [securityLoading, setSecurityLoading] = useState<boolean>(false);
  const [unbanningKey, setUnbanningKey] = useState<string | null>(null);

  // App Version Control State
  const [appVersionConfig, setAppVersionConfig] = useState({
    enabled: true,
    force_update: true,
    show_dialog: false,
    latest_version_code: 54,
    min_version_code: 54,
    latest_version_name: '6.2.4',
    title: 'New Version Available (v6.2.4)',
    message:
      'Tweve Tunnel v6.2.4 is now available with improved cloud config sync, faster connections, and stability fixes. Tap Update Now to download the latest version.',
    button_text: 'Update Now',
    update_url: 'https://twevetunnel.deployzy.com/twevetunnel.bin',
    updated_at: '',
  });
  const [savingVersion, setSavingVersion] = useState<boolean>(false);
  const [versionSaveMsg, setVersionSaveMsg] = useState<string>('');
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

  // Server Expiration & Auto-Lifecycle State
  const [expireDurationUnit, setExpireDurationUnit] = useState<
    'never' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'custom'
  >('never');
  const [expireDurationValue, setExpireDurationValue] = useState('24');
  const [expireCustomDate, setExpireCustomDate] = useState('');
  const [expireAction, setExpireAction] = useState<'delete' | 'hide'>('delete');
  const [nowTs, setNowTs] = useState<number>(() => Date.now());

  // Premium Package & PressoPay Pricing State (Admin Form)
  const [requiresPackage, setRequiresPackage] = useState(false);
  const [packagePricingMode, setPackagePricingMode] = useState<
    'none' | 'default' | 'custom_both' | 'only_7d' | 'only_30d'
  >('default');
  const [price7DaysTzs, setPrice7DaysTzs] = useState('2700');
  const [price30DaysTzs, setPrice30DaysTzs] = useState('8500');

  // Admin PressoPay Gateway & Orders State
  const [gatewayInfo, setGatewayInfo] = useState<{
    apiKeyMasked: string;
    hasSecret: boolean;
    baseUrl: string;
    defaultPrice7Days: number;
    defaultPrice30Days: number;
    currency: string;
  } | null>(null);
  const [default7dInput, setDefault7dInput] = useState('2700');
  const [default30dInput, setDefault30dInput] = useState('8500');
  const [paymentOrders, setPaymentOrders] = useState<any[]>([]);
  const [subscriptionsList, setSubscriptionsList] = useState<any[]>([]);
  const [savingGateway, setSavingGateway] = useState(false);

  // Slide Menu & Navigation Drawer State
  const [isSlideMenuOpen, setIsSlideMenuOpen] = useState(false);

  // Payments & Profit Filter / Search State
  const [paymentFilterStatus, setPaymentFilterStatus] = useState<'ALL' | 'COMPLETED' | 'PENDING' | 'FAILED'>('ALL');
  const [paymentFilterPlan, setPaymentFilterPlan] = useState<'ALL' | '7d' | '30d'>('ALL');
  const [paymentSearchQuery, setPaymentSearchQuery] = useState('');
  const [verifyingOrderId, setVerifyingOrderId] = useState<string | null>(null);

  // Public User Store View State ('store' | 'admin')
  const [publicMode, setPublicMode] = useState<'store' | 'admin'>('admin');
  const [storeServers, setStoreServers] = useState<any[]>([]);
  const [storeLoading, setStoreLoading] = useState(false);
  const [selectedStoreServerId, setSelectedStoreServerId] = useState<string>('');
  const [selectedPackageId, setSelectedPackageId] = useState<'7d' | '30d'>('7d');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [activeOrder, setActiveOrder] = useState<any | null>(null);
  const [lookupInput, setLookupInput] = useState('');
  const [lookupResults, setLookupResults] = useState<any[] | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

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

  const fetchPaymentsAdmin = useCallback(async () => {
    try {
      const res = await fetch('/api/payments?format=admin', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.gateway) {
          setGatewayInfo(data.gateway);
          setDefault7dInput(String(data.gateway.defaultPrice7Days || 2700));
          setDefault30dInput(String(data.gateway.defaultPrice30Days || 8500));
        }
        setPaymentOrders(data.orders || []);
        setSubscriptionsList(data.subscriptions || []);
      }
    } catch {
      // silent
    }
  }, []);

  const fetchSecurityLogs = useCallback(async () => {
    setSecurityLoading(true);
    try {
      const res = await fetch('/api/security-logs?limit=250', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setSecurityLogs(data.logs || []);
        setSecurityBans(data.bans || []);
        if (data.stats) setSecurityStats(data.stats);
      }
    } catch {
      // silent
    } finally {
      setSecurityLoading(false);
    }
  }, []);

  const handleUnbanIp = async (banKey: string, ip: string) => {
    setUnbanningKey(banKey);
    try {
      const res = await fetch('/api/security-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unban', banKey, ip }),
      });
      if (res.ok) {
        await fetchSecurityLogs();
      }
    } catch {
      // ignore
    } finally {
      setUnbanningKey(null);
    }
  };

  const handlePruneOldLogs = async () => {
    try {
      const res = await fetch('/api/security-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_resolved' }),
      });
      if (res.ok) {
        await fetchSecurityLogs();
      }
    } catch {
      // ignore
    }
  };

  const fetchAppVersion = useCallback(async () => {
    try {
      const res = await fetch('/api/app-version', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.version) {
          setAppVersionConfig((prev) => ({ ...prev, ...data.version }));
        }
      }
    } catch {
      // silent
    }
  }, []);

  const handleSaveAppVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingVersion(true);
    setVersionSaveMsg('');
    try {
      const res = await fetch('/api/app-version', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appVersionConfig),
      });
      const data = await res.json();
      if (res.ok && data.version) {
        setAppVersionConfig((prev) => ({ ...prev, ...data.version }));
        setVersionSaveMsg('Published! Old app users will now receive the Update Dialog.');
        fetchSecurityLogs();
      } else {
        setVersionSaveMsg(`Error: ${data.error || 'Failed to save version config'}`);
      }
    } catch (err: any) {
      setVersionSaveMsg(`Error: ${err.message || 'Network error'}`);
    } finally {
      setSavingVersion(false);
    }
  };

  const fetchStoreCatalog = useCallback(async () => {
    setStoreLoading(true);
    try {
      const res = await fetch('/api/servers?format=store', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const list = (data.servers || []).filter(
          (s: any) => s.requiresPackage || s.tier === 'VIP' || s.tier === 'PREMIUM'
        );
        const finalList = list.length > 0 ? list : data.servers || [];
        setStoreServers(finalList);
        if (finalList.length > 0 && !selectedStoreServerId) {
          setSelectedStoreServerId(finalList[0].id);
          const pkgs = finalList[0].packages || [];
          if (pkgs.length > 0) setSelectedPackageId(pkgs[0].id);
        }
      }
    } catch {
      // ignore
    } finally {
      setStoreLoading(false);
    }
  }, [selectedStoreServerId]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('view') === 'store' || params.get('buy') === '1') {
        setPublicMode('store');
      }
    }
    fetchStoreCatalog();
  }, [fetchStoreCatalog]);

  useEffect(() => {
    preloadRecaptcha();
    let interval: ReturnType<typeof setInterval> | null = null;
    (async () => {
      try {
        const res = await fetch('/api/auth', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            setIsAuthenticated(true);
            setAdminEmail(data.email || '');
            fetchServers();
            fetchAnalytics();
            fetchPaymentsAdmin();
            fetchSecurityLogs();
            fetchAppVersion();
            interval = setInterval(() => {
              fetchAnalytics();
              fetchPaymentsAdmin();
              fetchSecurityLogs();
            }, 5000);
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
  }, [fetchServers, fetchAnalytics, fetchPaymentsAdmin, fetchSecurityLogs, fetchAppVersion]);

  // Poll PressoPay payment order verification while an order is PENDING
  useEffect(() => {
    if (!activeOrder || activeOrder.status !== 'PENDING' || !activeOrder.pressoReference) return;
    const poll = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/payments?reference=${encodeURIComponent(activeOrder.pressoReference)}`,
          { cache: 'no-store' }
        );
        if (res.ok) {
          const data = await res.json();
          if (data.order) {
            setActiveOrder(data.order);
            if (data.order.status === 'COMPLETED') {
              clearInterval(poll);
            }
          }
        }
      } catch {
        // retry next tick
      }
    }, 3500);
    return () => clearInterval(poll);
  }, [activeOrder]);

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError('');
    if (!selectedStoreServerId) {
      setCheckoutError('Please select a server to purchase.');
      return;
    }
    if (!buyerPhone.trim()) {
      setCheckoutError('Please enter your Mobile Money phone number (e.g. 07XXXXXXXX).');
      return;
    }
    setCheckoutLoading(true);
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'checkout',
          serverId: selectedStoreServerId,
          packageId: selectedPackageId,
          buyerPhone: buyerPhone.trim(),
          buyerName: buyerName.trim() || 'Tweve VPN Customer',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setCheckoutError(data.error || 'Could not initiate PressoPay checkout.');
      } else {
        setActiveOrder(data.order);
      }
    } catch (err: any) {
      setCheckoutError(err.message || 'Network error initiating payment.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleLookupSubscriptions = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = lookupInput.trim();
    if (!q) return;
    setLookupLoading(true);
    try {
      const isKey = q.toUpperCase().startsWith('TWV-');
      const url = isKey
        ? `/api/payments?key=${encodeURIComponent(q.toUpperCase())}`
        : `/api/payments?phone=${encodeURIComponent(q)}`;
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();
      if (isKey) {
        setLookupResults(data.subscription ? [data.subscription] : []);
      } else {
        setLookupResults(data.subscriptions || []);
      }
    } catch {
      setLookupResults([]);
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSaveGatewayDefaults = async () => {
    setSavingGateway(true);
    try {
      const res = await fetch('/api/payments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultPrice7Days: Number(default7dInput || 2700),
          defaultPrice30Days: Number(default30dInput || 8500),
        }),
      });
      const data = await res.json();
      if (data.success) {
        notify('success', 'Updated PressoPay default package prices in Firebase DB!');
        fetchPaymentsAdmin();
      } else {
        notify('error', data.error || 'Failed to update gateway defaults');
      }
    } catch {
      notify('error', 'Network error updating gateway settings');
    } finally {
      setSavingGateway(false);
    }
  };

  // Close slide menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSlideMenuOpen) {
        setIsSlideMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSlideMenuOpen]);

  // Financial & Profit Calculations
  const completedOrders = paymentOrders.filter(
    (o) => o.status === 'COMPLETED' || (o.subscriptionKey && o.status !== 'FAILED')
  );
  const totalProfitTzs = completedOrders.reduce((sum, o) => sum + (Number(o.amountTzs) || 0), 0);
  const pendingOrders = paymentOrders.filter((o) => o.status === 'PENDING');
  const failedOrders = paymentOrders.filter((o) => o.status === 'FAILED');

  const orders7d = completedOrders.filter((o) => o.durationDays === 7 || o.planId === '7d');
  const count7d = orders7d.length;
  const profit7d = orders7d.reduce((sum, o) => sum + (Number(o.amountTzs) || 0), 0);

  const orders30d = completedOrders.filter((o) => o.durationDays === 30 || o.planId === '30d');
  const count30d = orders30d.length;
  const profit30d = orders30d.reduce((sum, o) => sum + (Number(o.amountTzs) || 0), 0);

  const uniquePayingPhones = new Set(completedOrders.map((o) => o.buyerPhone).filter(Boolean)).size;

  // Tanzanian Mobile Money Operator detector
  const getOperatorBadge = (phone?: string) => {
    if (!phone) return { name: 'Mobile Money', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' };
    const digits = phone.replace(/\D/g, '');
    const local = digits.startsWith('255') ? digits.slice(3) : digits.startsWith('0') ? digits.slice(1) : digits;
    if (local.startsWith('74') || local.startsWith('75') || local.startsWith('76')) {
      return { name: 'M-Pesa (Vodacom)', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.18)' };
    }
    if (local.startsWith('71') || local.startsWith('65') || local.startsWith('67')) {
      return { name: 'Tigo Pesa', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.18)' };
    }
    if (local.startsWith('78') || local.startsWith('68') || local.startsWith('69')) {
      return { name: 'Airtel Money', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.18)' };
    }
    if (local.startsWith('62')) {
      return { name: 'HaloPesa', color: '#f97316', bg: 'rgba(249, 115, 22, 0.18)' };
    }
    return { name: 'TZ Mobile', color: '#10b981', bg: 'rgba(16, 185, 129, 0.18)' };
  };

  const handleVerifyOrder = async (orderId: string) => {
    setVerifyingOrderId(orderId);
    try {
      const res = await fetch(`/api/payments?orderId=${encodeURIComponent(orderId)}`);
      const data = await res.json();
      if (data.order) {
        setPaymentOrders((prev) =>
          prev.map((o) => (o.orderId === orderId ? { ...o, ...data.order } : o))
        );
        notify('success', `Order ${orderId} reconciled: ${data.order.status}`);
      } else {
        notify('error', data.error || 'Failed to reconcile order');
      }
    } catch {
      notify('error', 'Network error verifying payment status');
    } finally {
      setVerifyingOrderId(null);
    }
  };

  // Filtered orders list for payments tab
  const filteredPaymentOrders = paymentOrders.filter((ord: any) => {
    if (paymentFilterStatus !== 'ALL') {
      if (paymentFilterStatus === 'COMPLETED') {
        if (ord.status !== 'COMPLETED' && !(ord.subscriptionKey && ord.status !== 'FAILED')) return false;
      } else if (ord.status !== paymentFilterStatus) {
        return false;
      }
    }
    if (paymentFilterPlan !== 'ALL') {
      const is30 = ord.durationDays === 30 || ord.planId === '30d';
      if (paymentFilterPlan === '30d' && !is30) return false;
      if (paymentFilterPlan === '7d' && is30) return false;
    }
    if (paymentSearchQuery.trim()) {
      const q = paymentSearchQuery.toLowerCase().trim();
      const phone = (ord.buyerPhone || '').toLowerCase();
      const name = (ord.serverName || '').toLowerCase();
      const ref = (ord.pressoReference || '').toLowerCase();
      const ordId = (ord.orderId || '').toLowerCase();
      const key = (ord.subscriptionKey || ord.accessKey || '').toLowerCase();
      if (!phone.includes(q) && !name.includes(q) && !ref.includes(q) && !ordId.includes(q) && !key.includes(q)) {
        return false;
      }
    }
    return true;
  });

  // Live 1-second countdown ticker & automatic expiration sync trigger
  useEffect(() => {
    if (!isAuthenticated) return;
    const timer = setInterval(() => {
      const currentNow = Date.now();
      setNowTs(currentNow);
      const hasNewlyExpired = servers.some((s) => {
        const exp = s.expiresAt ? Number(s.expiresAt) : 0;
        if (exp <= 0 || currentNow < exp) return false;
        if ((s.expireAction || 'delete') === 'delete') return true;
        return !s.isExpired || s.isActive !== false;
      });
      if (hasNewlyExpired) {
        fetchServers();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isAuthenticated, servers, fetchServers]);

  const formatCountdown = (expiresAt?: number | null) => {
    if (!expiresAt || expiresAt <= 0) return null;
    const diff = expiresAt - nowTs;
    if (diff <= 0) return 'EXPIRED';
    const totalSec = Math.floor(diff / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginLockedUntil > Date.now()) {
      return;
    }
    setLoginError('');
    const trimmedEmail = loginEmailInput.trim().toLowerCase();
    const trimmedPassword = loginPasswordInput.trim();
    setLoginLoading(true);
    try {
      const recaptchaToken = await getRecaptchaToken('login');
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          email: trimmedEmail,
          password: trimmedPassword,
          recaptchaToken,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.authenticated) {
        if (data.blockedUntil && Number(data.blockedUntil) > Date.now()) {
          setLoginLockedUntil(Number(data.blockedUntil));
        }
        setLoginError(data.error || 'Invalid email or password.');
      } else {
        setLoginLockedUntil(0);
        setIsAuthenticated(true);
        setAdminEmail(data.email);
        setLoginEmailInput('');
        setLoginPasswordInput('');
        fetchServers();
        fetchAnalytics();
      }
    } catch {
      setLoginError('Network error signing in.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth', { method: 'DELETE' });
    } catch { }
    setIsAuthenticated(false);
    setAdminEmail('');
    setServers([]);
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
    setExpireDurationUnit(s.expireDurationUnit || (s.expiresAt ? 'custom' : 'never'));
    setExpireDurationValue(String(s.expireDurationValue || 24));
    setExpireAction(s.expireAction === 'hide' ? 'hide' : 'delete');
    if (s.expiresAt && s.expiresAt > 0) {
      const d = new Date(s.expiresAt - new Date().getTimezoneOffset() * 60000);
      setExpireCustomDate(d.toISOString().slice(0, 16));
    } else {
      setExpireCustomDate('');
    }
    const isPaid = Boolean(
      s.requiresPackage || s.tier === 'VIP' || s.tier === 'PREMIUM'
    );
    setRequiresPackage(isPaid);
    setPackagePricingMode(
      s.packagePricingMode && s.packagePricingMode !== 'none'
        ? s.packagePricingMode
        : isPaid
          ? 'default'
          : 'none'
    );
    setPrice7DaysTzs(String(s.price7DaysTzs ?? (gatewayInfo?.defaultPrice7Days || 2700)));
    setPrice30DaysTzs(String(s.price30DaysTzs ?? (gatewayInfo?.defaultPrice30Days || 8500)));
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
        expireDurationUnit,
        expireDurationValue:
          expireDurationUnit !== 'never' && expireDurationUnit !== 'custom'
            ? Number(expireDurationValue || 0)
            : undefined,
        expiresAt:
          expireDurationUnit === 'never'
            ? null
            : expireDurationUnit === 'custom' && expireCustomDate
              ? new Date(expireCustomDate).getTime()
              : undefined,
        expireAction,
        requiresPackage: Boolean(requiresPackage || tier === 'VIP' || tier === 'PREMIUM'),
        packagePricingMode:
          requiresPackage || tier === 'VIP' || tier === 'PREMIUM'
            ? packagePricingMode === 'none'
              ? 'default'
              : packagePricingMode
            : 'none',
        price7DaysTzs:
          packagePricingMode === 'default'
            ? Number(gatewayInfo?.defaultPrice7Days || 2700)
            : Number(price7DaysTzs || 2700),
        price30DaysTzs:
          packagePricingMode === 'default'
            ? Number(gatewayInfo?.defaultPrice30Days || 8500)
            : Number(price30DaysTzs || 8500),
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
          `${editingServerId ? 'Updated' : 'Deployed'} "${name.trim()}" (${formProtocol.toUpperCase()}) to the app!`
        );
        setName('');
        setEditingServerId(null);
        setExpireDurationUnit('never');
        setExpireCustomDate('');
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
        notify('success', 'Synced Fleet Announcement & Encrypted Manifest to the app!');
      }
    } catch {
      notify('error', 'Failed to save announcement');
    }
  };

  const handleDeleteAnnouncement = async () => {
    if (!confirm('Are you sure you want to delete and clear the active broadcast announcement? Client apps will no longer see any announcement.')) {
      return;
    }
    try {
      const res = await fetch('/api/servers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ announcement: '' }),
      });
      const data = await res.json();
      if (data.success) {
        setAnnouncement('');
        notify('success', 'Active announcement deleted and cleared from all client apps!');
      }
    } catch {
      notify('error', 'Failed to delete announcement');
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
          minHeight: '100dvh',
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
          <span>Checking session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          backgroundColor: '#020617',
          backgroundImage:
            'radial-gradient(circle at 50% 0%, rgba(16, 185, 129, 0.16), transparent 55%), radial-gradient(circle at 85% 90%, rgba(56, 189, 248, 0.12), transparent 45%)',
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.25rem 1rem',
        }}
      >
        <div
          className="fleet-card"
          style={{
            width: '100%',
            maxWidth: '430px',
            padding: '2rem 1.65rem',
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
              Admin Console Authentication
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
                placeholder="Email address"
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
                  placeholder="Enter your password"
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
                  aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
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
              disabled={loginLoading || loginLockedUntil > Date.now()}
              className="btn-fleet-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: '0.25rem' }}
            >
              <Shield style={{ width: '1rem', height: '1rem' }} />
              <span>
                {loginLockedUntil > Date.now()
                  ? 'Access Temporarily Blocked'
                  : loginLoading
                    ? 'Signing in...'
                    : 'Sign In to Fleet Console'}
              </span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: '#020617', color: '#f8fafc' }}>
      {/* Slide Menu Backdrop */}
      <div
        className={`slide-menu-backdrop ${isSlideMenuOpen ? 'open' : ''}`}
        onClick={() => setIsSlideMenuOpen(false)}
      />

      {/* Slide-in Navigation Drawer */}
      <aside className={`slide-menu-drawer ${isSlideMenuOpen ? 'open' : ''}`}>
        {/* Drawer Header */}
        <div
          style={{
            padding: '1.15rem 1.1rem',
            borderBottom: '1px solid rgba(56, 189, 248, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(3, 7, 18, 0.65)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '2.25rem',
                height: '2.25rem',
                borderRadius: '0.65rem',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(6, 182, 212, 0.25) 100%)',
                border: '1px solid rgba(16, 185, 129, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#34d399',
              }}
            >
              <Flame style={{ width: '1.25rem', height: '1.25rem' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
                TWEVE FLEET
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.1rem' }}>
                <span style={{ width: '0.45rem', height: '0.45rem', borderRadius: '9999px', backgroundColor: '#10b981', display: 'inline-block' }} />
                <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Admin Console</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsSlideMenuOpen(false)}
            style={{
              padding: '0.4rem',
              borderRadius: '0.5rem',
              color: '#94a3b8',
              cursor: 'pointer',
              background: 'rgba(255, 255, 255, 0.05)',
            }}
            title="Close menu"
          >
            <X style={{ width: '1.1rem', height: '1.1rem' }} />
          </button>
        </div>

        {/* Live Profits Card inside Drawer */}
        <div style={{ padding: '0.95rem 1rem' }}>
          <div
            onClick={() => {
              setMobileViewTab('payments');
              setIsSlideMenuOpen(false);
            }}
            style={{
              padding: '0.85rem 1rem',
              borderRadius: '0.85rem',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.18) 0%, rgba(6, 182, 212, 0.12) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.45)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Net Profits
              </span>
              <DollarSign style={{ width: '0.95rem', height: '0.95rem', color: '#34d399' }} />
            </div>
            <div style={{ marginTop: '0.25rem', display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
              <span style={{ fontSize: '1.35rem', fontWeight: 900, color: '#34d399', fontFamily: 'monospace' }}>
                {totalProfitTzs.toLocaleString()}
              </span>
              <span style={{ fontSize: '0.72rem', color: '#6ee7b7', fontWeight: 700 }}>TZS</span>
            </div>
            <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.15rem' }}>
              {completedOrders.length} completed transactions · Tap to view
            </div>
          </div>
        </div>

        {/* Slide Menu Navigation Items */}
        <div style={{ padding: '0 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1 }}>
          <div style={{ padding: '0.35rem 0.5rem', fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Navigation & Options
          </div>

          <button
            type="button"
            className={`slide-menu-item ${mobileViewTab === 'deploy' ? 'active' : ''}`}
            onClick={() => {
              setMobileViewTab('deploy');
              setIsSlideMenuOpen(false);
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <PlusCircle style={{ width: '1.05rem', height: '1.05rem', color: '#38bdf8' }} />
              <div>
                <div>{editingServerId ? 'Edit VPN Node' : 'Deploy / Add Server'}</div>
                <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 400 }}>
                  15 Protocols, Credentials, Expiration
                </div>
              </div>
            </div>
            <ChevronRight style={{ width: '0.85rem', height: '0.85rem', color: '#64748b' }} />
          </button>

          <button
            type="button"
            className={`slide-menu-item ${mobileViewTab === 'fleet' ? 'active' : ''}`}
            onClick={() => {
              setMobileViewTab('fleet');
              setIsSlideMenuOpen(false);
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Server style={{ width: '1.05rem', height: '1.05rem', color: '#34d399' }} />
              <div>
                <div>Server Fleet Nodes</div>
                <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 400 }}>
                  Manage, Lock, User counts, MB/GB used
                </div>
              </div>
            </div>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 800,
                padding: '0.1rem 0.45rem',
                borderRadius: '0.35rem',
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                color: '#34d399',
              }}
            >
              {servers.length}
            </span>
          </button>

          <button
            type="button"
            className={`slide-menu-item ${mobileViewTab === 'payments' ? 'active' : ''}`}
            onClick={() => {
              setMobileViewTab('payments');
              setIsSlideMenuOpen(false);
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <DollarSign style={{ width: '1.05rem', height: '1.05rem', color: '#fcd34d' }} />
              <div>
                <div>Payments Done & Profits</div>
                <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 400 }}>
                  Revenue accounting, orders, access keys
                </div>
              </div>
            </div>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 800,
                padding: '0.1rem 0.45rem',
                borderRadius: '0.35rem',
                backgroundColor: 'rgba(251, 191, 36, 0.2)',
                color: '#fcd34d',
              }}
            >
              {completedOrders.length} Paid
            </span>
          </button>

          <button
            type="button"
            className={`slide-menu-item ${mobileViewTab === 'version' ? 'active' : ''}`}
            onClick={() => {
              setMobileViewTab('version');
              setIsSlideMenuOpen(false);
              fetchAppVersion();
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Rocket style={{ width: '1.05rem', height: '1.05rem', color: '#38bdf8' }} />
              <div>
                <div>App Version Control</div>
                <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 400 }}>
                  Push APK updates &amp; force update dialog
                </div>
              </div>
            </div>
            <ChevronRight style={{ width: '0.85rem', height: '0.85rem', color: '#64748b' }} />
          </button>

          <button
            type="button"
            className={`slide-menu-item ${mobileViewTab === 'broadcast' ? 'active' : ''}`}
            onClick={() => {
              setMobileViewTab('broadcast');
              setIsSlideMenuOpen(false);
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Megaphone style={{ width: '1.05rem', height: '1.05rem', color: '#ec4899' }} />
              <div>
                <div>Broadcast Announcement</div>
                <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 400 }}>
                  Instant popup alert to all client apps
                </div>
              </div>
            </div>
            <ChevronRight style={{ width: '0.85rem', height: '0.85rem', color: '#64748b' }} />
          </button>

          <button
            type="button"
            className={`slide-menu-item ${mobileViewTab === 'telemetry' ? 'active' : ''}`}
            onClick={() => {
              setMobileViewTab('telemetry');
              setIsSlideMenuOpen(false);
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Activity style={{ width: '1.05rem', height: '1.05rem', color: '#a78bfa' }} />
              <div>
                <div>Telemetry & Bandwidth</div>
                <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 400 }}>
                  Connected users, MB/GB used, active nodes
                </div>
              </div>
            </div>
            <ChevronRight style={{ width: '0.85rem', height: '0.85rem', color: '#64748b' }} />
          </button>

          <button
            type="button"
            className={`slide-menu-item ${mobileViewTab === 'security' ? 'active' : ''}`}
            onClick={() => {
              setMobileViewTab('security');
              setIsSlideMenuOpen(false);
              fetchSecurityLogs();
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Shield style={{ width: '1.05rem', height: '1.05rem', color: '#f87171' }} />
              <div>
                <div>Security & Audit Logs</div>
                <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 400 }}>
                  Admin activities, IP bans, security alerts
                </div>
              </div>
            </div>
            <ChevronRight style={{ width: '0.85rem', height: '0.85rem', color: '#64748b' }} />
          </button>

          <div style={{ padding: '0.75rem 0.5rem 0.25rem', fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Fleet Maintenance
          </div>

          <button
            type="button"
            className="slide-menu-item"
            onClick={() => {
              fetchServers();
              fetchAnalytics();
              fetchPaymentsAdmin();
              notify('success', 'Synchronized live servers, bandwidth & payment orders!');
              setIsSlideMenuOpen(false);
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <RefreshCw style={{ width: '1.05rem', height: '1.05rem', color: '#22d3ee' }} />
              <div>
                <div>Sync & Refresh All</div>
                <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 400 }}>
                  Reload servers, metrics & payments
                </div>
              </div>
            </div>
          </button>
        </div>

        {/* Drawer Footer with Admin Email & Logout */}
        <div
          style={{
            padding: '1rem 1.15rem',
            borderTop: '1px solid rgba(56, 189, 248, 0.16)',
            background: 'rgba(2, 6, 23, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.65rem', color: '#64748b' }}>Signed in as</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {adminEmail}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsSlideMenuOpen(false);
              handleLogout();
            }}
            className="btn-fleet-secondary"
            style={{ padding: '0.4rem 0.65rem', color: '#fb7185', borderColor: 'rgba(244, 63, 94, 0.3)' }}
          >
            <LogOut style={{ width: '0.85rem', height: '0.85rem' }} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
            {/* Hamburger Slide Menu Trigger Button */}
            <button
              type="button"
              onClick={() => setIsSlideMenuOpen(true)}
              className="btn-fleet-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.45rem 0.75rem',
                borderColor: 'rgba(56, 189, 248, 0.35)',
                background: 'rgba(15, 23, 42, 0.8)',
              }}
              title="Open Navigation Menu"
            >
              <Menu style={{ width: '1.15rem', height: '1.15rem', color: '#22d3ee' }} />
              <span style={{ fontWeight: 700, fontSize: '0.78rem' }}>Menu</span>
            </button>

            <div
              style={{
                width: '2.4rem',
                height: '2.4rem',
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
              <Flame style={{ width: '1.3rem', height: '1.3rem', color: '#34d399' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff' }}>
                  TWEVE SERVER FLEET
                </h1>
              </div>
              <p style={{ fontSize: '0.7rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Admin: <strong style={{ color: '#38bdf8' }}>{adminEmail}</strong>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
            {/* Quick Profit Pill in Header */}
            <div
              onClick={() => setMobileViewTab('payments')}
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.35rem 0.65rem',
                borderRadius: '0.65rem',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(6, 182, 212, 0.12) 100%)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                fontSize: '0.72rem',
                fontFamily: 'monospace',
              }}
              title="Click to view full Payments & Profits ledger"
            >
              <DollarSign style={{ width: '0.85rem', height: '0.85rem', color: '#34d399' }} />
              <span style={{ color: '#94a3b8' }}>Profits:</span>
              <strong style={{ color: '#34d399', fontWeight: 800 }}>
                {totalProfitTzs.toLocaleString()} TZS
              </strong>
            </div>


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
              border: `1px solid ${notification.type === 'success' ? 'rgba(16, 185, 129, 0.45)' : 'rgba(244, 63, 94, 0.45)'
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

        {/* Real-time Fleet Telemetry Bar (2x2 on Phone/Tablet, 3-col on PC) */}
        <div className="fleet-kpi-grid">
          <div className="kpi-stat-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '0.45rem', height: '0.45rem', borderRadius: '9999px', backgroundColor: analytics.activeUsersCount > 0 ? '#10b981' : '#64748b', display: 'inline-block', boxShadow: analytics.activeUsersCount > 0 ? '0 0 8px #10b981' : 'none' }}></span>
                Connected Users
              </span>
              <Users style={{ width: '0.95rem', height: '0.95rem', color: '#34d399' }} />
            </div>
            <div style={{ marginTop: '0.45rem', display: 'flex', alignItems: 'baseline', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', fontFamily: 'monospace' }}>
                {analytics.activeUsersCount}
              </span>
              <span style={{ fontSize: '0.68rem', color: '#34d399', fontWeight: 700 }}>Live Online</span>
            </div>
            <div style={{ marginTop: '0.25rem', fontSize: '0.68rem', color: '#94a3b8', fontFamily: 'monospace' }}>
              Total Users: <strong style={{ color: '#e2e8f0' }}>{analytics.totalConfiguredUsersCount || 0}</strong>
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
              <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>/ {servers.length} Servers</span>
            </div>
            <div style={{ marginTop: '0.25rem', fontSize: '0.68rem', color: '#94a3b8', fontFamily: 'monospace' }}>
              In Use Now: <strong style={{ color: '#38bdf8' }}>{Object.values(analytics.serverTelemetry || {}).filter((st) => st.activeUsers > 0).length > 0 ? new Set(Object.values(analytics.serverTelemetry || {}).filter((st) => st.activeUsers > 0).map((st) => st.serverId)).size : 0}</strong>
            </div>
          </div>

          <div className="kpi-stat-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Data (MB / GB)
              </span>
              <Activity style={{ width: '0.95rem', height: '0.95rem', color: '#fbbf24' }} />
            </div>
            <div style={{ marginTop: '0.45rem', display: 'flex', alignItems: 'baseline', gap: '0.45rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1.45rem', fontWeight: 800, color: '#fcd34d', fontFamily: 'monospace' }}>
                {analytics.bandwidth.formattedTotal ||
                  ((Number(analytics.bandwidth.totalMB ?? (Number(analytics.bandwidth.totalDownMB || 0) + Number(analytics.bandwidth.totalUpMB || 0))) >= 1024)
                    ? `${((Number(analytics.bandwidth.totalMB ?? (Number(analytics.bandwidth.totalDownMB || 0) + Number(analytics.bandwidth.totalUpMB || 0)))) / 1024).toFixed(2)} GB`
                    : `${Number(analytics.bandwidth.totalMB ?? (Number(analytics.bandwidth.totalDownMB || 0) + Number(analytics.bandwidth.totalUpMB || 0))).toFixed(2)} MB`)}
              </span>
              <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                ({Number(analytics.bandwidth.totalGB ?? ((Number(analytics.bandwidth.totalDownMB || 0) + Number(analytics.bandwidth.totalUpMB || 0)) / 1024)).toFixed(3)} GB)
              </span>
            </div>
            <div style={{ marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.68rem', fontFamily: 'monospace', flexWrap: 'wrap' }}>
              <span style={{ color: '#34d399' }}>
                ↓ {analytics.bandwidth.formattedDown || `${Number(analytics.bandwidth.totalDownMB || 0).toFixed(2)} MB`}
              </span>
              <span style={{ color: '#38bdf8' }}>
                ↑ {analytics.bandwidth.formattedUp || `${Number(analytics.bandwidth.totalUpMB || 0).toFixed(2)} MB`}
              </span>
            </div>
          </div>
        </div>

        {/* Sticky Mobile & Tablet View Switcher */}
        <nav className="fleet-mobile-tabs">
          {[
            { id: 'fleet', label: `🌐 Fleet (${servers.length})` },
            { id: 'deploy', label: editingServerId ? '✏️ Edit Node' : '➕ Deploy' },
            { id: 'payments', label: `💰 Profits (${totalProfitTzs > 0 ? (totalProfitTzs >= 1000 ? (totalProfitTzs / 1000).toFixed(0) + 'k' : totalProfitTzs) : '0'})` },
            { id: 'broadcast', label: '📢 Notice' },
            { id: 'version', label: `📲 v${appVersionConfig.latest_version_name || '6.2.4'}` },
            { id: 'telemetry', label: '📊 Telemetry' },
            { id: 'security', label: `🛡️ Security${securityStats.criticalCount + securityStats.activeBansCount > 0 ? ` (${securityStats.criticalCount + securityStats.activeBansCount})` : ''}` },
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
              display: mobileViewTab === 'deploy' ? 'flex' : 'none',
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
                      Pushed configurations encrypt with AES-256-GCM and sync to the app.
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
                    <select
                      value={tier}
                      onChange={(e) => {
                        const nextTier = e.target.value as 'FREE' | 'VIP' | 'PREMIUM';
                        setTier(nextTier);
                        if (nextTier === 'VIP' || nextTier === 'PREMIUM') {
                          setRequiresPackage(true);
                          if (packagePricingMode === 'none') {
                            setPackagePricingMode('default');
                          }
                        } else {
                          setRequiresPackage(false);
                        }
                      }}
                    >
                      <option value="FREE">FREE</option>
                      <option value="VIP">VIP (Paid Package)</option>
                      <option value="PREMIUM">PREMIUM (Paid Package)</option>
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

              {/* Server Expiration & Auto-Lifecycle Section */}
              <div
                style={{
                  marginTop: '1rem',
                  padding: '0.95rem 1.05rem',
                  borderRadius: '0.9rem',
                  backgroundColor: '#030712',
                  border: '1px solid rgba(251, 191, 36, 0.25)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.6rem',
                    marginBottom: '0.75rem',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: '0.73rem',
                        fontWeight: 800,
                        color: '#fbbf24',
                        textTransform: 'uppercase',
                        letterSpacing: '0.07em',
                      }}
                    >
                      ⏱ Server Expiration & Auto-Lifecycle
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                      Set expiration in minutes, hours, days, weeks, months, or custom date, and choose whether expired servers auto-delete from Firebase or hide from users.
                    </div>
                  </div>

                  {/* Quick Duration Presets */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.32rem' }}>
                    {[
                      { label: 'Unlimited', unit: 'never' as const, val: '0' },
                      { label: '15m', unit: 'minutes' as const, val: '15' },
                      { label: '30m', unit: 'minutes' as const, val: '30' },
                      { label: '1h', unit: 'hours' as const, val: '1' },
                      { label: '6h', unit: 'hours' as const, val: '6' },
                      { label: '12h', unit: 'hours' as const, val: '12' },
                      { label: '24h', unit: 'hours' as const, val: '24' },
                      { label: '3d', unit: 'days' as const, val: '3' },
                      { label: '7d', unit: 'days' as const, val: '7' },
                      { label: '30d', unit: 'days' as const, val: '30' },
                    ].map((preset) => {
                      const isSelected =
                        preset.unit === 'never'
                          ? expireDurationUnit === 'never'
                          : expireDurationUnit === preset.unit && expireDurationValue === preset.val;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setExpireDurationUnit(preset.unit);
                            if (preset.unit !== 'never') setExpireDurationValue(preset.val);
                          }}
                          style={{
                            padding: '0.22rem 0.5rem',
                            borderRadius: '0.45rem',
                            fontSize: '0.66rem',
                            fontWeight: 700,
                            border: isSelected
                              ? '1px solid #fbbf24'
                              : '1px solid rgba(148, 163, 184, 0.25)',
                            background: isSelected
                              ? 'rgba(251, 191, 36, 0.18)'
                              : 'rgba(15, 23, 42, 0.7)',
                            color: isSelected ? '#fcd34d' : '#94a3b8',
                            cursor: 'pointer',
                          }}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="fleet-form-grid-3">
                  <div>
                    <label
                      style={{
                        fontSize: '0.7rem',
                        color: '#94a3b8',
                        display: 'block',
                        marginBottom: '0.3rem',
                        fontWeight: 600,
                      }}
                    >
                      Expiration Mode / Time Unit
                    </label>
                    <select
                      value={expireDurationUnit}
                      onChange={(e) => setExpireDurationUnit(e.target.value as any)}
                    >
                      <option value="never">Unlimited (Never Expires)</option>
                      <option value="minutes">Minutes</option>
                      <option value="hours">Hours</option>
                      <option value="days">Days</option>
                      <option value="weeks">Weeks</option>
                      <option value="months">Months</option>
                      <option value="custom">Custom Date & Time</option>
                    </select>
                  </div>

                  {expireDurationUnit !== 'never' && expireDurationUnit !== 'custom' && (
                    <div>
                      <label
                        style={{
                          fontSize: '0.7rem',
                          color: '#94a3b8',
                          display: 'block',
                          marginBottom: '0.3rem',
                          fontWeight: 600,
                        }}
                      >
                        Duration ({expireDurationUnit}) *
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={expireDurationValue}
                        onChange={(e) => setExpireDurationValue(e.target.value)}
                        placeholder="e.g. 30"
                        style={{ fontFamily: 'monospace' }}
                      />
                    </div>
                  )}

                  {expireDurationUnit === 'custom' && (
                    <div>
                      <label
                        style={{
                          fontSize: '0.7rem',
                          color: '#94a3b8',
                          display: 'block',
                          marginBottom: '0.3rem',
                          fontWeight: 600,
                        }}
                      >
                        Expiration Date & Time *
                      </label>
                      <input
                        type="datetime-local"
                        value={expireCustomDate}
                        onChange={(e) => setExpireCustomDate(e.target.value)}
                        style={{ fontFamily: 'monospace' }}
                      />
                    </div>
                  )}

                  {expireDurationUnit !== 'never' && (
                    <div>
                      <label
                        style={{
                          fontSize: '0.7rem',
                          color: '#94a3b8',
                          display: 'block',
                          marginBottom: '0.3rem',
                          fontWeight: 600,
                        }}
                      >
                        When Expired Action
                      </label>
                      <select
                        value={expireAction}
                        onChange={(e) => setExpireAction(e.target.value as 'delete' | 'hide')}
                      >
                        <option value="delete">Auto-Delete from Database</option>
                        <option value="hide">Hide from Users (Keep in Admin)</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Premium Server Package & PressoPay Pricing Section */}
              <div
                style={{
                  marginTop: '1rem',
                  padding: '0.95rem 1.05rem',
                  borderRadius: '0.9rem',
                  backgroundColor: '#030712',
                  border: requiresPackage || tier === 'VIP' || tier === 'PREMIUM'
                    ? '1.5px solid rgba(16, 185, 129, 0.45)'
                    : '1px solid rgba(56, 189, 248, 0.2)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.6rem',
                    marginBottom: '0.75rem',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: '0.73rem',
                        fontWeight: 800,
                        color: '#34d399',
                        textTransform: 'uppercase',
                        letterSpacing: '0.07em',
                      }}
                    >
                      💳 Premium Server Package & PressoPay Pricing (TZS)
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                      Configure whether this server requires a paid package, apply default prices (7 Days = {Number(gatewayInfo?.defaultPrice7Days || 2700).toLocaleString()} TZS, 30 Days = {Number(gatewayInfo?.defaultPrice30Days || 8500).toLocaleString()} TZS), custom prices for both, or apply one duration only.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const next = !requiresPackage;
                      setRequiresPackage(next);
                      if (next && tier === 'FREE') setTier('PREMIUM');
                      if (next && packagePricingMode === 'none') setPackagePricingMode('default');
                      if (!next && (tier === 'VIP' || tier === 'PREMIUM')) setTier('FREE');
                    }}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '0.6rem',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      border:
                        requiresPackage || tier === 'VIP' || tier === 'PREMIUM'
                          ? '1px solid #10b981'
                          : '1px solid rgba(148, 163, 184, 0.3)',
                      background:
                        requiresPackage || tier === 'VIP' || tier === 'PREMIUM'
                          ? 'rgba(16, 185, 129, 0.18)'
                          : 'rgba(15, 23, 42, 0.7)',
                      color:
                        requiresPackage || tier === 'VIP' || tier === 'PREMIUM'
                          ? '#34d399'
                          : '#94a3b8',
                    }}
                  >
                    {requiresPackage || tier === 'VIP' || tier === 'PREMIUM'
                      ? '💎 Requires Paid Package (ON)'
                      : '🆓 Free Server (No Package Required)'}
                  </button>
                </div>

                {(requiresPackage || tier === 'VIP' || tier === 'PREMIUM') && (
                  <div className="fleet-form-grid-3">
                    <div>
                      <label
                        style={{
                          fontSize: '0.7rem',
                          color: '#94a3b8',
                          display: 'block',
                          marginBottom: '0.3rem',
                          fontWeight: 600,
                        }}
                      >
                        Package & Price Mode
                      </label>
                      <select
                        value={packagePricingMode === 'none' ? 'default' : packagePricingMode}
                        onChange={(e) => setPackagePricingMode(e.target.value as any)}
                      >
                        <option value="default">
                          Apply Self / Default ({Number(gatewayInfo?.defaultPrice7Days || 2700).toLocaleString()} & {Number(gatewayInfo?.defaultPrice30Days || 8500).toLocaleString()} TZS)
                        </option>
                        <option value="custom_both">
                          Write Custom Prices (Both 7 Days & 30 Days / Month)
                        </option>
                        <option value="only_7d">
                          Apply One Only: 7 Days Package Only
                        </option>
                        <option value="only_30d">
                          Apply One Only: 30 Days (1 Month) Package Only
                        </option>
                      </select>
                    </div>

                    {(packagePricingMode === 'default' ||
                      packagePricingMode === 'custom_both' ||
                      packagePricingMode === 'only_7d' ||
                      packagePricingMode === 'none') && (
                        <div>
                          <label
                            style={{
                              fontSize: '0.7rem',
                              color: '#94a3b8',
                              display: 'block',
                              marginBottom: '0.3rem',
                              fontWeight: 600,
                            }}
                          >
                            7 Days Price (TZS) {packagePricingMode === 'default' ? '(Default)' : '*'}
                          </label>
                          <input
                            type="number"
                            min="100"
                            disabled={packagePricingMode === 'default'}
                            value={
                              packagePricingMode === 'default'
                                ? String(gatewayInfo?.defaultPrice7Days || 2700)
                                : price7DaysTzs
                            }
                            onChange={(e) => setPrice7DaysTzs(e.target.value)}
                            placeholder="2700"
                            style={{
                              fontFamily: 'monospace',
                              opacity: packagePricingMode === 'default' ? 0.75 : 1,
                            }}
                          />
                        </div>
                      )}

                    {(packagePricingMode === 'default' ||
                      packagePricingMode === 'custom_both' ||
                      packagePricingMode === 'only_30d' ||
                      packagePricingMode === 'none') && (
                        <div>
                          <label
                            style={{
                              fontSize: '0.7rem',
                              color: '#94a3b8',
                              display: 'block',
                              marginBottom: '0.3rem',
                              fontWeight: 600,
                            }}
                          >
                            30 Days / Month Price (TZS) {packagePricingMode === 'default' ? '(Default)' : '*'}
                          </label>
                          <input
                            type="number"
                            min="100"
                            disabled={packagePricingMode === 'default'}
                            value={
                              packagePricingMode === 'default'
                                ? String(gatewayInfo?.defaultPrice30Days || 8500)
                                : price30DaysTzs
                            }
                            onChange={(e) => setPrice30DaysTzs(e.target.value)}
                            placeholder="8500"
                            style={{
                              fontFamily: 'monospace',
                              opacity: packagePricingMode === 'default' ? 0.75 : 1,
                            }}
                          />
                        </div>
                      )}
                  </div>
                )}
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
              display: mobileViewTab === 'fleet' ? 'flex' : 'none',
              flexDirection: 'column',
              gap: '1.15rem',
              minWidth: 0,
            }}
          >
            {/* Active Fleet Servers Card */}
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
                      Live servers synced to the app
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
                    const srvStats =
                      analytics.serverTelemetry?.[s.id] ||
                      analytics.serverTelemetry?.[s.name];
                    const activeUsersOnServer =
                      srvStats?.activeUsers ??
                      analytics.topServers?.[s.id] ??
                      analytics.topServers?.[s.name] ??
                      0;
                    const totalUsersOnServer = Math.max(
                      activeUsersOnServer,
                      srvStats?.totalUsers ?? (s.connectedUsersCount || 0)
                    );
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
                              {/* Per-Server Live Users & MB/GB Usage Badges */}
                              <div
                                style={{
                                  marginTop: '0.38rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.45rem',
                                  flexWrap: 'wrap',
                                  fontFamily: 'monospace',
                                  fontSize: '0.66rem',
                                }}
                              >
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                    padding: '0.12rem 0.48rem',
                                    borderRadius: '0.4rem',
                                    background:
                                      activeUsersOnServer > 0
                                        ? 'rgba(16, 185, 129, 0.16)'
                                        : 'rgba(30, 41, 59, 0.65)',
                                    border:
                                      activeUsersOnServer > 0
                                        ? '1px solid rgba(16, 185, 129, 0.4)'
                                        : '1px solid rgba(71, 85, 105, 0.35)',
                                    color: activeUsersOnServer > 0 ? '#34d399' : '#94a3b8',
                                    fontWeight: 700,
                                  }}
                                >
                                  <Users style={{ width: '0.68rem', height: '0.68rem' }} />
                                  {activeUsersOnServer} Online ({totalUsersOnServer} users)
                                </span>

                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    padding: '0.12rem 0.48rem',
                                    borderRadius: '0.4rem',
                                    background: 'rgba(251, 191, 36, 0.12)',
                                    border: '1px solid rgba(251, 191, 36, 0.3)',
                                    color: '#fcd34d',
                                    fontWeight: 700,
                                  }}
                                >
                                  <Activity style={{ width: '0.68rem', height: '0.68rem' }} />
                                  {srvStats?.formattedTotal || '0.00 MB'}
                                  <span style={{ color: '#34d399', fontWeight: 600 }}>
                                    ↓{srvStats?.formattedDown || '0.00 MB'}
                                  </span>
                                  <span style={{ color: '#38bdf8', fontWeight: 600 }}>
                                    ↑{srvStats?.formattedUp || '0.00 MB'}
                                  </span>
                                </span>

                                {/* Expiration Countdown / Status Badge */}
                                {s.expiresAt && s.expiresAt > 0 ? (
                                  (() => {
                                    const countdown = formatCountdown(s.expiresAt);
                                    const isExp = countdown === 'EXPIRED' || s.isExpired;
                                    const modeLabel =
                                      (s.expireAction || 'delete') === 'hide'
                                        ? 'Hide on Expiry'
                                        : 'Auto-Delete';
                                    return (
                                      <span
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '0.32rem',
                                          padding: '0.12rem 0.5rem',
                                          borderRadius: '0.4rem',
                                          background: isExp
                                            ? 'rgba(244, 63, 94, 0.18)'
                                            : 'rgba(168, 85, 247, 0.16)',
                                          border: isExp
                                            ? '1px solid rgba(244, 63, 94, 0.45)'
                                            : '1px solid rgba(168, 85, 247, 0.38)',
                                          color: isExp ? '#fda4af' : '#d8b4fe',
                                          fontWeight: 700,
                                        }}
                                      >
                                        ⏱{' '}
                                        {isExp
                                          ? 'EXPIRED · HIDDEN FROM USERS'
                                          : `${countdown} left · ${modeLabel}`}
                                      </span>
                                    );
                                  })()
                                ) : (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.28rem',
                                      padding: '0.12rem 0.46rem',
                                      borderRadius: '0.4rem',
                                      background: 'rgba(15, 23, 42, 0.7)',
                                      border: '1px solid rgba(71, 85, 105, 0.3)',
                                      color: '#64748b',
                                      fontWeight: 600,
                                    }}
                                  >
                                    ∞ No Expiry
                                  </span>
                                )}

                                {/* Package & Price Badge */}
                                {(s.requiresPackage || s.tier === 'VIP' || s.tier === 'PREMIUM') && (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.3rem',
                                      padding: '0.12rem 0.5rem',
                                      borderRadius: '0.4rem',
                                      background: 'rgba(16, 185, 129, 0.16)',
                                      border: '1px solid rgba(16, 185, 129, 0.42)',
                                      color: '#6ee7b7',
                                      fontWeight: 800,
                                    }}
                                  >
                                    💳{' '}
                                    {s.packagePricingMode === 'only_7d'
                                      ? `7D Only: ${Number(s.price7DaysTzs || 2700).toLocaleString()} TZS`
                                      : s.packagePricingMode === 'only_30d'
                                        ? `30D Only: ${Number(s.price30DaysTzs || 8500).toLocaleString()} TZS`
                                        : `7D: ${Number(s.price7DaysTzs || 2700).toLocaleString()} TZS • 30D: ${Number(s.price30DaysTzs || 8500).toLocaleString()} TZS`}
                                  </span>
                                )}
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
                              aria-label={`Delete server ${s.name}`}
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
          </div>
        </div>

        {/* DEDICATED PAYMENTS & PROFITS COMMAND CENTER VIEW */}
        {mobileViewTab === 'payments' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
            <section className="fleet-card fleet-section-pad">
              {/* Header with Title & Quick Sync */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.85rem',
                  paddingBottom: '1rem',
                  borderBottom: '1px solid rgba(56, 189, 248, 0.18)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    style={{
                      width: '2.5rem',
                      height: '2.5rem',
                      borderRadius: '0.75rem',
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(6, 182, 212, 0.2) 100%)',
                      border: '1px solid rgba(16, 185, 129, 0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#34d399',
                      boxShadow: '0 0 20px rgba(16, 185, 129, 0.25)',
                    }}
                  >
                    <DollarSign style={{ width: '1.4rem', height: '1.4rem' }} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
                      Payments Done & Profit Command Center
                    </h2>
                    <p style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                      Authoritative real-time Mobile Money transactions, revenue accounting & customer access keys
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={fetchPaymentsAdmin}
                    className="btn-fleet-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem' }}
                  >
                    <RefreshCw style={{ width: '0.85rem', height: '0.85rem' }} />
                    <span>Sync Payments</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPublicMode('store');
                      fetchStoreCatalog();
                    }}
                    className="btn-fleet-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem' }}
                  >
                    <Zap style={{ width: '0.85rem', height: '0.85rem' }} />
                    <span>User Store Catalog</span>
                  </button>
                </div>
              </div>

              {/* 4 Financial Profit KPI Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '0.85rem',
                  marginTop: '1.15rem',
                }}
              >
                {/* Total Profits Card */}
                <div className="profit-kpi-card" style={{ borderColor: 'rgba(16, 185, 129, 0.45)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Total Net Profits
                    </span>
                    <TrendingUp style={{ width: '1.1rem', height: '1.1rem', color: '#34d399' }} />
                  </div>
                  <div style={{ marginTop: '0.2rem', display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
                    <span style={{ fontSize: '1.65rem', fontWeight: 900, color: '#34d399', fontFamily: 'monospace' }}>
                      {totalProfitTzs.toLocaleString()}
                    </span>
                    <span style={{ fontSize: '0.85rem', color: '#6ee7b7', fontWeight: 700 }}>TZS</span>
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                    From <strong style={{ color: '#ffffff' }}>{completedOrders.length}</strong> completed transactions
                  </div>
                </div>

                {/* 7 Days Packages Card */}
                <div className="profit-kpi-card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      7 Days Passes
                    </span>
                    <Clock style={{ width: '1.05rem', height: '1.05rem', color: '#38bdf8' }} />
                  </div>
                  <div style={{ marginTop: '0.2rem', display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace' }}>
                      {profit7d.toLocaleString()}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>TZS</span>
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                    <strong style={{ color: '#e2e8f0' }}>{count7d}</strong> packages sold (@ 2,700 TZS default)
                  </div>
                </div>

                {/* 30 Days VIP Passes Card */}
                <div className="profit-kpi-card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      30 Days VIP Passes
                    </span>
                    <KeyRound style={{ width: '1.05rem', height: '1.05rem', color: '#fbbf24' }} />
                  </div>
                  <div style={{ marginTop: '0.2rem', display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fcd34d', fontFamily: 'monospace' }}>
                      {profit30d.toLocaleString()}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>TZS</span>
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                    <strong style={{ color: '#e2e8f0' }}>{count30d}</strong> monthly passes sold (@ 8,500 TZS default)
                  </div>
                </div>

                {/* Customers & Conversion Card */}
                <div className="profit-kpi-card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Paying Customers
                    </span>
                    <Users style={{ width: '1.05rem', height: '1.05rem', color: '#a78bfa' }} />
                  </div>
                  <div style={{ marginTop: '0.2rem', display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#c4b5fd', fontFamily: 'monospace' }}>
                      {uniquePayingPhones}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Unique Users</span>
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                    {pendingOrders.length > 0 ? (
                      <span style={{ color: '#fcd34d' }}>{pendingOrders.length} pending USSD prompt</span>
                    ) : (
                      <span style={{ color: '#34d399' }}>Zero pending backlog</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Search and Filtering Bar */}
              <div
                style={{
                  marginTop: '1.25rem',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  background: 'rgba(2, 6, 23, 0.65)',
                  padding: '0.75rem 0.95rem',
                  borderRadius: '0.85rem',
                  border: '1px solid rgba(56, 189, 248, 0.16)',
                }}
              >
                {/* Search Input */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '220px' }}>
                  <Search style={{ width: '0.95rem', height: '0.95rem', color: '#94a3b8' }} />
                  <input
                    type="text"
                    value={paymentSearchQuery}
                    onChange={(e) => setPaymentSearchQuery(e.target.value)}
                    placeholder="Search customer phone (07...), server, ref, or access key..."
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: '0.35rem 0.5rem',
                      fontSize: '0.8rem',
                      color: '#ffffff',
                      boxShadow: 'none',
                    }}
                  />
                  {paymentSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setPaymentSearchQuery('')}
                      style={{ color: '#94a3b8', cursor: 'pointer', padding: '0.2rem' }}
                    >
                      <X style={{ width: '0.85rem', height: '0.85rem' }} />
                    </button>
                  )}
                </div>

                {/* Status Filter Pills */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {(['ALL', 'COMPLETED', 'PENDING', 'FAILED'] as const).map((st) => {
                    const active = paymentFilterStatus === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setPaymentFilterStatus(st)}
                        style={{
                          padding: '0.35rem 0.65rem',
                          borderRadius: '0.55rem',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          background: active
                            ? st === 'COMPLETED'
                              ? 'rgba(16, 185, 129, 0.3)'
                              : st === 'PENDING'
                                ? 'rgba(251, 191, 36, 0.3)'
                                : st === 'FAILED'
                                  ? 'rgba(244, 63, 94, 0.3)'
                                  : 'rgba(56, 189, 248, 0.25)'
                            : 'rgba(15, 23, 42, 0.6)',
                          border: active
                            ? `1px solid ${st === 'COMPLETED'
                              ? '#10b981'
                              : st === 'PENDING'
                                ? '#fbbf24'
                                : st === 'FAILED'
                                  ? '#f43f5e'
                                  : '#38bdf8'
                            }`
                            : '1px solid rgba(56, 189, 248, 0.12)',
                          color: active ? '#ffffff' : '#94a3b8',
                        }}
                      >
                        {st === 'ALL'
                          ? `All (${paymentOrders.length})`
                          : st === 'COMPLETED'
                            ? `Completed (${completedOrders.length})`
                            : st === 'PENDING'
                              ? `Pending (${pendingOrders.length})`
                              : `Failed (${failedOrders.length})`}
                      </button>
                    );
                  })}
                </div>

                {/* Plan Filter Pills */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  {(['ALL', '7d', '30d'] as const).map((pl) => {
                    const active = paymentFilterPlan === pl;
                    return (
                      <button
                        key={pl}
                        type="button"
                        onClick={() => setPaymentFilterPlan(pl)}
                        style={{
                          padding: '0.35rem 0.55rem',
                          borderRadius: '0.55rem',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          background: active ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                          border: active ? '1px solid #10b981' : '1px solid rgba(56, 189, 248, 0.1)',
                          color: active ? '#34d399' : '#64748b',
                        }}
                      >
                        {pl === 'ALL' ? 'All Plans' : pl === '7d' ? '7 Days' : '30 Days'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Payments Done Detailed Ledger */}
              <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0.25rem' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Payments Transactions Ledger ({filteredPaymentOrders.length})
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace' }}>
                    Showing {filteredPaymentOrders.length} of {paymentOrders.length} records
                  </span>
                </div>

                {filteredPaymentOrders.length === 0 ? (
                  <div
                    style={{
                      padding: '2.5rem 1rem',
                      textAlign: 'center',
                      borderRadius: '0.85rem',
                      backgroundColor: 'rgba(3, 7, 18, 0.7)',
                      border: '1px dashed rgba(56, 189, 248, 0.25)',
                    }}
                  >
                    <Wallet style={{ width: '2rem', height: '2rem', color: '#64748b', margin: '0 auto 0.75rem' }} />
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#e2e8f0' }}>No matching payments found</h4>
                    <p style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem' }}>
                      {paymentSearchQuery || paymentFilterStatus !== 'ALL' || paymentFilterPlan !== 'ALL'
                        ? 'Try clearing your search or filter pills above.'
                        : 'When users purchase servers using the Android app or web store, payments and profit accounting will appear here automatically.'}
                    </p>
                  </div>
                ) : (
                  filteredPaymentOrders.map((ord: any) => {
                    const op = getOperatorBadge(ord.buyerPhone);
                    const isCompleted = ord.status === 'COMPLETED' || (ord.subscriptionKey && ord.status !== 'FAILED');
                    const isPending = ord.status === 'PENDING';
                    const dateFormatted = ord.createdAt
                      ? new Date(ord.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                      : 'Just now';

                    return (
                      <div
                        key={ord.orderId}
                        style={{
                          padding: '0.95rem 1.15rem',
                          borderRadius: '0.85rem',
                          backgroundColor: 'rgba(3, 7, 18, 0.85)',
                          border: isCompleted
                            ? '1px solid rgba(16, 185, 129, 0.35)'
                            : isPending
                              ? '1px solid rgba(251, 191, 36, 0.35)'
                              : '1px solid rgba(244, 63, 94, 0.35)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.65rem',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {/* Top row: Phone + Operator badge + Amount + Status */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.65rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                padding: '0.2rem 0.55rem',
                                borderRadius: '0.45rem',
                                background: op.bg,
                                color: op.color,
                                fontSize: '0.68rem',
                                fontWeight: 800,
                              }}
                            >
                              <Phone style={{ width: '0.75rem', height: '0.75rem' }} />
                              <span>{op.name}</span>
                            </div>
                            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ffffff', fontFamily: 'monospace' }}>
                              {ord.buyerPhone || 'Customer Phone'}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>•</span>
                            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{dateFormatted}</span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <span
                              style={{
                                fontSize: '1.15rem',
                                fontWeight: 900,
                                color: isCompleted ? '#34d399' : '#fcd34d',
                                fontFamily: 'monospace',
                              }}
                            >
                              +{Number(ord.amountTzs || 0).toLocaleString()} TZS
                            </span>
                            <span
                              style={{
                                padding: '0.2rem 0.6rem',
                                borderRadius: '0.45rem',
                                fontWeight: 800,
                                fontSize: '0.68rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                background: isCompleted
                                  ? 'rgba(16, 185, 129, 0.2)'
                                  : isPending
                                    ? 'rgba(251, 191, 36, 0.2)'
                                    : 'rgba(244, 63, 94, 0.2)',
                                color: isCompleted ? '#34d399' : isPending ? '#fcd34d' : '#fb7185',
                                border: `1px solid ${isCompleted
                                    ? 'rgba(16, 185, 129, 0.45)'
                                    : isPending
                                      ? 'rgba(251, 191, 36, 0.45)'
                                      : 'rgba(244, 63, 94, 0.45)'
                                  }`,
                              }}
                            >
                              {isCompleted && <Check style={{ width: '0.7rem', height: '0.7rem' }} />}
                              {isPending && <Clock style={{ width: '0.7rem', height: '0.7rem' }} />}
                              <span>{ord.status || 'PENDING'}</span>
                            </span>
                          </div>
                        </div>

                        {/* Middle row: Server Name + Package Duration + References */}
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.5rem',
                            fontSize: '0.75rem',
                            paddingTop: '0.45rem',
                            borderTop: '1px solid rgba(56, 189, 248, 0.1)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{ color: '#38bdf8', fontWeight: 800 }}>🌐 {ord.serverName || 'VPN Server'}</span>
                            <span style={{ color: '#64748b' }}>|</span>
                            <span
                              style={{
                                padding: '0.1rem 0.45rem',
                                borderRadius: '0.35rem',
                                background: ord.durationDays === 30 ? 'rgba(251, 191, 36, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                                color: ord.durationDays === 30 ? '#fcd34d' : '#38bdf8',
                                fontWeight: 700,
                                fontSize: '0.68rem',
                              }}
                            >
                              {ord.durationDays === 30 ? '30 Days Access (1 Month)' : '7 Days Access'}
                            </span>
                            <span style={{ color: '#64748b' }}>|</span>
                            <span style={{ color: '#94a3b8', fontSize: '0.68rem', fontFamily: 'monospace' }}>
                              Ref: <strong style={{ color: '#cbd5e1' }}>{ord.pressoReference || ord.orderId}</strong>
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            <button
                              type="button"
                              disabled={verifyingOrderId === ord.orderId}
                              onClick={() => handleVerifyOrder(ord.orderId)}
                              className="btn-fleet-secondary"
                              style={{ padding: '0.25rem 0.55rem', fontSize: '0.68rem' }}
                              title="Reconcile live status directly with PressoPay gateway"
                            >
                              <RefreshCw
                                style={{
                                  width: '0.7rem',
                                  height: '0.7rem',
                                  animation: verifyingOrderId === ord.orderId ? 'spin 1s linear infinite' : 'none',
                                }}
                              />
                              <span>{verifyingOrderId === ord.orderId ? 'Checking...' : 'Verify Gateway'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Bottom row: Issued Access Key (if completed) */}
                        {(ord.subscriptionKey || ord.accessKey) && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '0.5rem',
                              background: 'rgba(16, 185, 129, 0.08)',
                              border: '1px solid rgba(16, 185, 129, 0.25)',
                              padding: '0.45rem 0.75rem',
                              borderRadius: '0.55rem',
                              fontSize: '0.72rem',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                              <KeyRound style={{ width: '0.85rem', height: '0.85rem', color: '#34d399' }} />
                              <span style={{ color: '#94a3b8' }}>Issued VIP Access Key:</span>
                              <code style={{ color: '#34d399', fontWeight: 900, fontFamily: 'monospace' }}>
                                {ord.subscriptionKey || ord.accessKey}
                              </code>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(ord.subscriptionKey || ord.accessKey);
                                notify('success', 'Access key copied to clipboard!');
                              }}
                              className="btn-fleet-secondary"
                              style={{ padding: '0.15rem 0.45rem', fontSize: '0.65rem' }}
                            >
                              <Copy style={{ width: '0.65rem', height: '0.65rem' }} />
                              <span>Copy Key</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* PressoPay Gateway Settings Embedded in Payments Tab */}
              <div
                style={{
                  marginTop: '1.5rem',
                  paddingTop: '1.25rem',
                  borderTop: '1px solid rgba(56, 189, 248, 0.18)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                    <div
                      style={{
                        padding: '0.4rem',
                        borderRadius: '0.7rem',
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                        color: '#34d399',
                      }}
                    >
                      <KeyRound style={{ width: '1.05rem', height: '1.05rem' }} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ffffff' }}>
                        PressoPay Gateway Pricing Defaults & Secrets
                      </h3>
                      <p style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                        Public API Key ({gatewayInfo?.apiKeyMasked || 'pk_...'}) & Secret Key stored securely in private Firebase DB
                      </p>
                    </div>
                  </div>
                </div>

                <div className="fleet-form-grid-3" style={{ marginTop: '0.85rem', alignItems: 'end' }}>
                  <div>
                    <label style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem', fontWeight: 700 }}>
                      Default 7 Days Price (TZS)
                    </label>
                    <input
                      type="number"
                      value={default7dInput}
                      onChange={(e) => setDefault7dInput(e.target.value)}
                      style={{ fontFamily: 'monospace' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem', fontWeight: 700 }}>
                      Default 30 Days Price (TZS)
                    </label>
                    <input
                      type="number"
                      value={default30dInput}
                      onChange={(e) => setDefault30dInput(e.target.value)}
                      style={{ fontFamily: 'monospace' }}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={savingGateway}
                    onClick={handleSaveGatewayDefaults}
                    className="btn-fleet-primary"
                    style={{ justifyContent: 'center' }}
                  >
                    <span>{savingGateway ? 'Saving...' : 'Save Default Prices'}</span>
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* DEDICATED APP VERSION CONTROL PAGE */}
        {mobileViewTab === 'version' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
            {/* App Version Control & Update Dialog Push */}
            <section className="fleet-card fleet-section-pad">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', paddingBottom: '0.9rem', borderBottom: '1px solid rgba(56, 189, 248, 0.18)' }}>
                <div>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                    🚀 App Version Control &amp; Update Dialog
                  </h2>
                  <p style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                    Push a new APK version so older app installs automatically get the Update Dialog with one-tap download
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchAppVersion}
                  className="btn-fleet-secondary"
                  style={{ fontSize: '0.74rem' }}
                >
                  Reload Version
                </button>
              </div>

              <form onSubmit={handleSaveAppVersion} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem', fontWeight: 700 }}>
                      Latest Version Name
                    </label>
                    <input
                      type="text"
                      value={appVersionConfig.latest_version_name}
                      onChange={(e) => setAppVersionConfig((p) => ({ ...p, latest_version_name: e.target.value }))}
                      placeholder="6.2.4"
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem', fontWeight: 700 }}>
                      Latest Version Code
                    </label>
                    <input
                      type="number"
                      value={appVersionConfig.latest_version_code}
                      onChange={(e) => setAppVersionConfig((p) => ({ ...p, latest_version_code: Number(e.target.value || 1) }))}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem', fontWeight: 700 }}>
                      Minimum Supported Code
                    </label>
                    <input
                      type="number"
                      value={appVersionConfig.min_version_code}
                      onChange={(e) => setAppVersionConfig((p) => ({ ...p, min_version_code: Number(e.target.value || 1) }))}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem', fontWeight: 700 }}>
                      Update Button Label
                    </label>
                    <input
                      type="text"
                      value={appVersionConfig.button_text}
                      onChange={(e) => setAppVersionConfig((p) => ({ ...p, button_text: e.target.value }))}
                      placeholder="Update Now"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem', fontWeight: 700 }}>
                      Update Dialog Title
                    </label>
                    <input
                      type="text"
                      value={appVersionConfig.title}
                      onChange={(e) => setAppVersionConfig((p) => ({ ...p, title: e.target.value }))}
                      placeholder="New Version Available"
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem', fontWeight: 700 }}>
                      APK Download URL
                    </label>
                    <input
                      type="url"
                      value={appVersionConfig.update_url}
                      onChange={(e) => setAppVersionConfig((p) => ({ ...p, update_url: e.target.value }))}
                      placeholder="https://twevetunnel.deployzy.com/twevetunnel.bin"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem', fontWeight: 700 }}>
                    Release Message / Notification to Old Users
                  </label>
                  <textarea
                    rows={2}
                    value={appVersionConfig.message}
                    onChange={(e) => setAppVersionConfig((p) => ({ ...p, message: e.target.value }))}
                    style={{ width: '100%' }}
                    required
                  />
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1.25rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.78rem', color: '#e2e8f0', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={appVersionConfig.enabled}
                      onChange={(e) => setAppVersionConfig((p) => ({ ...p, enabled: e.target.checked }))}
                    />
                    <span>Enable Update Check</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.78rem', color: '#fbbf24', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={appVersionConfig.force_update}
                      onChange={(e) => setAppVersionConfig((p) => ({ ...p, force_update: e.target.checked }))}
                    />
                    <span>Force Mandatory Update (Non-dismissible)</span>
                  </label>
                  <button
                    type="submit"
                    disabled={savingVersion}
                    className="btn-fleet-primary"
                    style={{ marginLeft: 'auto' }}
                  >
                    <span>{savingVersion ? 'Publishing...' : 'Publish Version & Notify Old Users'}</span>
                  </button>
                </div>

                {versionSaveMsg && (
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: versionSaveMsg.startsWith('Error') ? '#f87171' : '#34d399' }}>
                    {versionSaveMsg}
                  </div>
                )}
              </form>
            </section>
          </div>
        )}

        {/* DEDICATED APP BROADCAST COMMAND CENTER */}
        {mobileViewTab === 'broadcast' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
            {/* Live Active Announcement Status Card */}
            <section className="fleet-card fleet-section-pad">
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.85rem',
                  paddingBottom: '1rem',
                  borderBottom: '1px solid rgba(56, 189, 248, 0.18)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    style={{
                      width: '2.5rem',
                      height: '2.5rem',
                      borderRadius: '0.75rem',
                      background: 'linear-gradient(135deg, rgba(192, 132, 252, 0.25) 0%, rgba(236, 72, 153, 0.2) 100%)',
                      border: '1px solid rgba(192, 132, 252, 0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#c084fc',
                      boxShadow: '0 0 20px rgba(192, 132, 252, 0.25)',
                    }}
                  >
                    <Megaphone style={{ width: '1.4rem', height: '1.4rem' }} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
                      App Broadcast & Push Notification
                    </h2>
                    <p style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                      Instantly alerts all client app users via interactive gesture bottom sheet
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={fetchServers}
                    className="btn-fleet-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem' }}
                  >
                    <RefreshCw style={{ width: '0.85rem', height: '0.85rem' }} />
                    <span>Sync Status</span>
                  </button>
                </div>
              </div>

              {/* Status Banner */}
              <div style={{ marginTop: '1.15rem' }}>
                {announcement && announcement.trim().length > 0 ? (
                  <div
                    style={{
                      padding: '1.15rem 1.25rem',
                      borderRadius: '0.95rem',
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(6, 182, 212, 0.08) 100%)',
                      border: '1px solid rgba(16, 185, 129, 0.45)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.85rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ width: '0.6rem', height: '0.6rem', borderRadius: '9999px', backgroundColor: '#10b981', display: 'inline-block', boxShadow: '0 0 10px #10b981' }} />
                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          🟢 Live Broadcast Active on All Client Apps
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => {
                            const ta = document.getElementById('broadcast-textarea');
                            if (ta) ta.focus();
                            notify('success', 'Loaded active message into composer for editing');
                          }}
                          className="btn-fleet-secondary"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.72rem', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.4)' }}
                        >
                          <Edit3 style={{ width: '0.8rem', height: '0.8rem' }} />
                          <span>Edit Message</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteAnnouncement}
                          className="btn-fleet-secondary"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.72rem', color: '#fb7185', borderColor: 'rgba(244, 63, 94, 0.4)' }}
                        >
                          <Trash2 style={{ width: '0.8rem', height: '0.8rem' }} />
                          <span>Delete / Clear Broadcast</span>
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '0.85rem 1rem',
                        borderRadius: '0.75rem',
                        backgroundColor: 'rgba(3, 7, 18, 0.85)',
                        border: '1px solid rgba(56, 189, 248, 0.2)',
                        color: '#f1f5f9',
                        fontSize: '0.82rem',
                        fontFamily: 'monospace',
                        lineHeight: 1.5,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {announcement}
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '1.25rem',
                      borderRadius: '0.95rem',
                      backgroundColor: 'rgba(15, 23, 42, 0.6)',
                      border: '1px dashed rgba(100, 116, 139, 0.35)',
                      textAlign: 'center',
                      color: '#94a3b8',
                      fontSize: '0.8rem',
                    }}
                  >
                    ⚪ No active broadcast announcement. Client apps run silently with zero popup alerts.
                  </div>
                )}
              </div>

              {/* Compose / Edit Announcement Box */}
              <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.45rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Compose or Edit Announcement
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.68rem', color: '#64748b' }}>Quick Templates:</span>
                    <button
                      type="button"
                      onClick={() => setAnnouncement('⚠️ Server Maintenance: Infrastructure updates in progress. Connections remain stable on backup nodes.')}
                      style={{ padding: '0.2rem 0.5rem', borderRadius: '0.45rem', fontSize: '0.65rem', background: 'rgba(251, 191, 36, 0.15)', border: '1px solid rgba(251, 191, 36, 0.3)', color: '#fcd34d', cursor: 'pointer' }}
                    >
                      ⚠️ Maintenance
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnnouncement('🚀 New High-Speed Servers Added! Check the server list for ultra-low latency VIP nodes.')}
                      style={{ padding: '0.2rem 0.5rem', borderRadius: '0.45rem', fontSize: '0.65rem', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8', cursor: 'pointer' }}
                    >
                      🚀 New Nodes
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnnouncement('💎 Special Offer: 30-Day VIP Pass now available for only 8,500 TZS! Tap Buy Server to activate.')}
                      style={{ padding: '0.2rem 0.5rem', borderRadius: '0.45rem', fontSize: '0.65rem', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399', cursor: 'pointer' }}
                    >
                      💎 VIP Promo
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnnouncement('⚡ SlowDNS Turbo Enabled: Enjoy faster DNS tunneling speeds with increased throughput!')}
                      style={{ padding: '0.2rem 0.5rem', borderRadius: '0.45rem', fontSize: '0.65rem', background: 'rgba(192, 132, 252, 0.15)', border: '1px solid rgba(192, 132, 252, 0.3)', color: '#c084fc', cursor: 'pointer' }}
                    >
                      ⚡ SlowDNS Boost
                    </button>
                  </div>
                </div>

                <textarea
                  id="broadcast-textarea"
                  value={announcement}
                  onChange={(e) => setAnnouncement(e.target.value)}
                  rows={5}
                  placeholder="Enter broadcast message for all VPN users (plain text or HTML with clickable links)..."
                  style={{ fontFamily: 'monospace', fontSize: '0.8rem', padding: '0.85rem' }}
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleSaveAnnouncement}
                    className="btn-fleet-primary"
                    style={{ flex: 1, minWidth: '220px', justifyContent: 'center' }}
                  >
                    <Send style={{ width: '0.95rem', height: '0.95rem' }} />
                    <span>Publish / Update Broadcast to All Apps</span>
                  </button>
                  {announcement && announcement.trim().length > 0 && (
                    <button
                      type="button"
                      onClick={handleDeleteAnnouncement}
                      className="btn-fleet-secondary"
                      style={{ padding: '0.75rem 1.15rem', color: '#fb7185', borderColor: 'rgba(244, 63, 94, 0.4)' }}
                    >
                      <Trash2 style={{ width: '0.95rem', height: '0.95rem' }} />
                      <span>Delete / Clear</span>
                    </button>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}

        {/* DEDICATED REAL-TIME TELEMETRY & BANDWIDTH VIEW */}
        {mobileViewTab === 'telemetry' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
            <section className="fleet-card fleet-section-pad">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.6rem',
                  paddingBottom: '0.85rem',
                  borderBottom: '1px solid rgba(56, 189, 248, 0.18)',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                  <div
                    style={{
                      padding: '0.45rem',
                      borderRadius: '0.75rem',
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      color: '#34d399',
                    }}
                  >
                    <Activity style={{ width: '1.15rem', height: '1.15rem' }} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff' }}>
                      Real-Time Telemetry & Bandwidth Accounting
                    </h3>
                    <p style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                      {analytics.activeUsersCount} Online Now · {analytics.totalConfiguredUsersCount || 0} Total Registered Devices
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={fetchAnalytics}
                  className="btn-fleet-secondary"
                  style={{ padding: '0.45rem 0.85rem', fontSize: '0.75rem' }}
                >
                  <RefreshCw style={{ width: '0.85rem', height: '0.85rem' }} />
                  <span>Refresh Telemetry</span>
                </button>
              </div>

              {/* Live Sampled Device Sessions */}
              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {(!analytics.liveSampledSessions || analytics.liveSampledSessions.length === 0) ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '2rem 1rem',
                      color: '#64748b',
                      fontSize: '0.8rem',
                    }}
                  >
                    No device telemetry sessions recorded yet. Devices appear here live as they connect.
                  </div>
                ) : (
                  analytics.liveSampledSessions.slice(0, 30).map((sess) => {
                    const isOnline = sess.status === 'connected' || (Date.now() - sess.lastPing <= 90000 && sess.status !== 'offline');
                    const sessTotalBytes = (Number(sess.totalBytesDown ?? sess.bytesDown) || 0) + (Number(sess.totalBytesUp ?? sess.bytesUp) || 0);
                    const sessTotalMB = sessTotalBytes / (1024 * 1024);
                    const sessTotalGB = sessTotalBytes / (1024 * 1024 * 1024);
                    const displayTotal = sess.formattedAllTimeTotal || (sessTotalGB >= 1 ? `${sessTotalGB.toFixed(2)} GB` : `${sessTotalMB.toFixed(2)} MB`);
                    return (
                      <div
                        key={sess.deviceId}
                        style={{
                          padding: '0.75rem 0.9rem',
                          borderRadius: '0.75rem',
                          backgroundColor: 'rgba(3, 7, 18, 0.75)',
                          border: isOnline
                            ? '1px solid rgba(16, 185, 129, 0.35)'
                            : '1px solid rgba(56, 189, 248, 0.14)',
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.6rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                          <span
                            style={{
                              width: '0.55rem',
                              height: '0.55rem',
                              borderRadius: '9999px',
                              backgroundColor: isOnline ? '#10b981' : '#64748b',
                              boxShadow: isOnline ? '0 0 8px #10b981' : 'none',
                              flexShrink: 0,
                            }}
                          />
                          <div>
                            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#f8fafc', fontFamily: 'monospace' }}>
                              {(sess as any).deviceModel || 'Client Device'} · <span style={{ color: '#94a3b8' }}>{sess.deviceId.substring(0, 10)}...</span>
                            </div>
                            <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '0.1rem' }}>
                              Server: <strong style={{ color: '#38bdf8' }}>{sess.serverName || sess.serverId}</strong> · Proto: {sess.protocol} · App: v{(sess as any).appVersion || '1.0'}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.72rem', fontFamily: 'monospace' }}>
                          <span style={{ color: '#fbbf24', fontWeight: 800 }}>
                            {displayTotal}
                          </span>
                          <span style={{ color: '#34d399' }}>
                            ↓{sess.formattedDown || `${((Number(sess.totalBytesDown ?? sess.bytesDown) || 0) / (1024 * 1024)).toFixed(2)} MB`}
                          </span>
                          <span style={{ color: '#38bdf8' }}>
                            ↑{sess.formattedUp || `${((Number(sess.totalBytesUp ?? sess.bytesUp) || 0) / (1024 * 1024)).toFixed(2)} MB`}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        )}

        {mobileViewTab === 'security' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Security KPI Strip */}
            <section className="glass-panel" style={{ padding: '1.15rem', borderRadius: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.9rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{ padding: '0.5rem', borderRadius: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.14)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                    <Shield style={{ width: '1.1rem', height: '1.1rem', color: '#f87171' }} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                      Security Issues &amp; Admin Activity Logs
                    </h2>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                      Full audit trail of admin actions, failed logins, unauthorized API probes, and IP bans
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={fetchSecurityLogs}
                    style={{
                      padding: '0.45rem 0.75rem',
                      borderRadius: '0.65rem',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      backgroundColor: 'rgba(56, 189, 248, 0.12)',
                      color: '#38bdf8',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                    }}
                  >
                    {securityLoading ? 'Refreshing...' : 'Refresh Logs'}
                  </button>
                  <button
                    type="button"
                    onClick={handlePruneOldLogs}
                    style={{
                      padding: '0.45rem 0.75rem',
                      borderRadius: '0.65rem',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      backgroundColor: 'rgba(100, 116, 139, 0.15)',
                      color: '#cbd5e1',
                      border: '1px solid rgba(148, 163, 184, 0.25)',
                    }}
                  >
                    Prune &gt;7d
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.65rem' }}>
                <div style={{ padding: '0.75rem', borderRadius: '0.75rem', backgroundColor: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(148, 163, 184, 0.15)' }}>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700 }}>TOTAL AUDIT EVENTS</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#f8fafc', marginTop: '0.15rem' }}>{securityStats.totalLogs}</div>
                </div>
                <div style={{ padding: '0.75rem', borderRadius: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                  <div style={{ fontSize: '0.68rem', color: '#fca5a5', fontWeight: 700 }}>CRITICAL ALERTS</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#f87171', marginTop: '0.15rem' }}>{securityStats.criticalCount}</div>
                </div>
                <div style={{ padding: '0.75rem', borderRadius: '0.75rem', backgroundColor: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                  <div style={{ fontSize: '0.68rem', color: '#fcd34d', fontWeight: 700 }}>WARNINGS</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#fbbf24', marginTop: '0.15rem' }}>{securityStats.warningCount}</div>
                </div>
                <div style={{ padding: '0.75rem', borderRadius: '0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                  <div style={{ fontSize: '0.68rem', color: '#6ee7b7', fontWeight: 700 }}>ADMIN ACTIONS</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#34d399', marginTop: '0.15rem' }}>{securityStats.adminActionsCount}</div>
                </div>
                <div style={{ padding: '0.75rem', borderRadius: '0.75rem', backgroundColor: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.25)' }}>
                  <div style={{ fontSize: '0.68rem', color: '#d8b4fe', fontWeight: 700 }}>ACTIVE IP BANS</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#c084fc', marginTop: '0.15rem' }}>{securityStats.activeBansCount}</div>
                </div>
              </div>
            </section>

            {/* Active & Historical IP Bans */}
            <section className="glass-panel" style={{ padding: '1.15rem', borderRadius: '1rem' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f8fafc', margin: '0 0 0.75rem 0' }}>
                Locked &amp; Flagged IPs ({securityBans.length})
              </h3>
              {securityBans.length === 0 ? (
                <div style={{ fontSize: '0.78rem', color: '#64748b', padding: '0.6rem 0' }}>
                  No IP lockouts or strike records found.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                  {securityBans.map((ban: any) => (
                    <div
                      key={ban.key}
                      style={{
                        padding: '0.7rem 0.9rem',
                        borderRadius: '0.75rem',
                        backgroundColor: 'rgba(3, 7, 18, 0.75)',
                        border: ban.isActive
                          ? '1px solid rgba(239, 68, 68, 0.4)'
                          : '1px solid rgba(148, 163, 184, 0.16)',
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.6rem',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              padding: '0.15rem 0.45rem',
                              borderRadius: '9999px',
                              fontSize: '0.62rem',
                              fontWeight: 800,
                              backgroundColor: ban.isActive ? 'rgba(239, 68, 68, 0.2)' : 'rgba(100, 116, 139, 0.2)',
                              color: ban.isActive ? '#f87171' : '#94a3b8',
                            }}
                          >
                            {ban.isActive ? 'ACTIVE BAN' : 'STRIKE RECORD'}
                          </span>
                          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#f8fafc', fontFamily: 'monospace' }}>
                            {ban.ip}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: '#fbbf24', fontWeight: 700 }}>
                            {ban.strikes} strikes
                          </span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                          Reason: <code style={{ color: '#cbd5e1' }}>{ban.lastReason || 'n/a'}</code>
                          {ban.isActive && ban.blockedUntil > 0 && (
                            <> · Unlocks: {new Date(ban.blockedUntil).toLocaleString()}</>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={unbanningKey === ban.key}
                        onClick={() => handleUnbanIp(ban.key, ban.ip)}
                        style={{
                          padding: '0.4rem 0.75rem',
                          borderRadius: '0.6rem',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          backgroundColor: 'rgba(16, 185, 129, 0.15)',
                          color: '#34d399',
                          border: '1px solid rgba(16, 185, 129, 0.35)',
                        }}
                      >
                        {unbanningKey === ban.key ? 'Unbanning...' : 'Unban / Clear'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Filterable Audit & Security Log Stream */}
            <section className="glass-panel" style={{ padding: '1.15rem', borderRadius: '1rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.65rem', marginBottom: '0.85rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {['ALL', 'SECURITY_ALERT', 'ADMIN_ACTION', 'AUTH', 'SERVER', 'PAYMENT'].map((cat) => {
                    const active = securityFilter === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSecurityFilter(cat)}
                        style={{
                          padding: '0.35rem 0.65rem',
                          borderRadius: '0.55rem',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          backgroundColor: active ? 'rgba(16, 185, 129, 0.22)' : 'rgba(15, 23, 42, 0.75)',
                          color: active ? '#34d399' : '#94a3b8',
                          border: active ? '1px solid rgba(16, 185, 129, 0.45)' : '1px solid rgba(148, 163, 184, 0.16)',
                        }}
                      >
                        {cat.replace('_', ' ')}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="text"
                  value={securitySearch}
                  onChange={(e) => setSecuritySearch(e.target.value)}
                  placeholder="Search email, IP, action, details..."
                  style={{
                    padding: '0.45rem 0.75rem',
                    borderRadius: '0.65rem',
                    fontSize: '0.75rem',
                    backgroundColor: 'rgba(3, 7, 18, 0.85)',
                    color: '#f8fafc',
                    border: '1px solid rgba(148, 163, 184, 0.22)',
                    minWidth: '220px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '620px', overflowY: 'auto' }}>
                {securityLogs
                  .filter((log: any) => {
                    if (securityFilter !== 'ALL') {
                      if (securityFilter === 'ADMIN_ACTION') {
                        if (log.category === 'SECURITY_ALERT') return false;
                      } else if (log.category !== securityFilter) {
                        return false;
                      }
                    }
                    if (securitySearch.trim()) {
                      const q = securitySearch.toLowerCase().trim();
                      const hay = `${log.action} ${log.actor} ${log.ip} ${log.details} ${log.category}`.toLowerCase();
                      if (!hay.includes(q)) return false;
                    }
                    return true;
                  })
                  .map((log: any) => {
                    const sevColor =
                      log.severity === 'critical'
                        ? { bg: 'rgba(239, 68, 68, 0.16)', fg: '#f87171', border: 'rgba(239, 68, 68, 0.35)' }
                        : log.severity === 'warning'
                          ? { bg: 'rgba(245, 158, 11, 0.16)', fg: '#fbbf24', border: 'rgba(245, 158, 11, 0.35)' }
                          : { bg: 'rgba(16, 185, 129, 0.14)', fg: '#34d399', border: 'rgba(16, 185, 129, 0.28)' };
                    return (
                      <div
                        key={log.id}
                        style={{
                          padding: '0.7rem 0.85rem',
                          borderRadius: '0.7rem',
                          backgroundColor: 'rgba(3, 7, 18, 0.78)',
                          border: `1px solid ${sevColor.border}`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.28rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.45rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                            <span
                              style={{
                                padding: '0.12rem 0.45rem',
                                borderRadius: '0.4rem',
                                fontSize: '0.62rem',
                                fontWeight: 900,
                                backgroundColor: sevColor.bg,
                                color: sevColor.fg,
                                textTransform: 'uppercase',
                              }}
                            >
                              {log.severity || 'info'}
                            </span>
                            <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#f8fafc', fontFamily: 'monospace' }}>
                              {log.action}
                            </span>
                            <span style={{ fontSize: '0.65rem', color: '#38bdf8', fontWeight: 700 }}>
                              [{log.category}]
                            </span>
                          </div>
                          <span style={{ fontSize: '0.68rem', color: '#64748b', fontFamily: 'monospace' }}>
                            {log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#e2e8f0' }}>{log.details}</div>
                        <div style={{ fontSize: '0.66rem', color: '#94a3b8', fontFamily: 'monospace', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                          <span>Actor: <strong style={{ color: '#cbd5e1' }}>{log.actor}</strong></span>
                          <span>IP: <strong style={{ color: '#cbd5e1' }}>{log.ip}</strong></span>
                          {log.userAgent && <span style={{ color: '#64748b' }}>UA: {log.userAgent.slice(0, 70)}</span>}
                        </div>
                      </div>
                    );
                  })}
                {securityLogs.length === 0 && (
                  <div style={{ fontSize: '0.78rem', color: '#64748b', padding: '1rem 0', textAlign: 'center' }}>
                    No security or admin activity logs recorded yet. Actions like logins, server edits, and failed probes will appear here automatically.
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}