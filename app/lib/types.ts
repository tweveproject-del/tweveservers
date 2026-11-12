export type VpnProtocolType =
  | 'slowdns'
  | 'v2ray_reality'
  | 'v2ray_ws'
  | 'dnstt_v2ray'
  | 'ssh_direct'
  | 'ssh_payload'
  | 'ssh_ssl'
  | 'ssh_ssl_payload'
  | 'http_proxy'
  | 'http_proxy_payload'
  | 'http_proxy_ssl_payload'
  | 'stealth_link'
  | 'hysteria2'
  | 'wireguard'
  | 'stealth_turbo';

export interface VpnServerItem {
  id: string;
  name: string; // Remark (e.g. "Vodacom Tanzania")
  country: string; // ISO 2-letter (e.g. "TZ")
  tier: 'FREE' | 'VIP' | 'PREMIUM';
  protocol: VpnProtocolType;
  host: string;
  portDirect?: number;
  portHTTP?: number;
  portSSL?: number;
  portDNSTT?: number;
  username?: string;
  password?: string;
  payload?: string;
  sni?: string;
  proxyHost?: string;
  proxyPort?: number;
  cdnDomain?: string;
  cdnPayload?: string;
  // SlowDNS / DNSTT
  dnsttNameserver?: string;
  dnsttPubkey?: string;
  dnsResolver?: string;
  dnsttBase62?: boolean;
  dnsttBooster?: boolean;
  dnsttBoosterSegments?: number;
  dnsttTurbo?: boolean;
  // V2Ray (VLESS / VMess / Trojan)
  v2rayAddress?: string;
  v2rayPort?: number;
  v2rayProtocol?: string;
  v2rayUuid?: string;
  v2raySecurity?: string;
  v2raySni?: string;
  v2rayPublicKey?: string;
  v2rayShortId?: string;
  v2rayFingerprint?: string;
  v2rayNetwork?: string;
  v2rayWsHost?: string;
  v2rayWsPath?: string;
  v2rayAllowInsecure?: boolean;
  // Hysteria2
  hysteriaPort?: number;
  hysteriaPorts?: string;
  hysteriaHopInterval?: number;
  hysteriaAuth?: string;
  hysteriaObfs?: string;
  hysteriaSni?: string;
  hysteriaInsecure?: boolean;
  hysteriaUp?: number;
  hysteriaDown?: number;
  // Stealth Turbo (Slipstream)
  slipstreamDomain?: string;
  slipstreamCert?: string;
  slipstreamDirect?: boolean;
  // WireGuard
  wireguardConfig?: string;
  // Protection, Expiration, Packages & Telemetry
  isLocked: boolean; // Protect configuration from user inspection
  isActive: boolean;
  expiresAt?: number | null; // Unix timestamp in ms (null or 0 = never expires)
  expireDurationValue?: number;
  expireDurationUnit?: 'never' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'custom';
  expireAction?: 'delete' | 'hide'; // 'delete' = auto-remove from DB on expiry, 'hide' = hide from users & keep in admin
  isExpired?: boolean;
  // Paid Package / PressoPay Pricing Configuration
  requiresPackage?: boolean; // true if server requires a paid package (default true for PREMIUM / VIP)
  packagePricingMode?: 'none' | 'default' | 'custom_both' | 'only_7d' | 'only_30d';
  price7DaysTzs?: number | null; // e.g. 2700 TZS
  price30DaysTzs?: number | null; // e.g. 8500 TZS
  connectedUsersCount?: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface ServerPackageOption {
  id?: '7d' | '30d';
  planId: '7d' | '30d';
  label: string;
  days?: 7 | 30;
  durationDays: 7 | 30;
  priceTzs: number;
}

export interface PaymentOrderRecord {
  orderId: string;
  pressoReference: string;
  serverId: string;
  serverName: string;
  serverCountry?: string;
  serverProtocol?: string;
  planId: '7d' | '30d';
  durationDays: 7 | 30;
  amountTzs: number;
  currency: 'TZS';
  buyerName: string;
  buyerPhone: string;
  buyerEmail: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  checkoutUrl?: string;
  pushFailed?: boolean;
  accessKey?: string;
  subscriptionExpiresAt?: number;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

export interface SubscriptionRecord {
  accessKey: string;
  orderId: string;
  pressoReference: string;
  serverId: string;
  serverName: string;
  planId: '7d' | '30d';
  durationDays: 7 | 30;
  amountTzs: number;
  buyerName: string;
  buyerPhone: string;
  buyerEmail: string;
  status: 'active' | 'expired' | 'revoked';
  tier: 'PREMIUM' | 'VIP';
  createdAt: number;
  expiresAt: number;
  maxDevices: number;
  devices?: Record<
    string,
    {
      hwid: string;
      label: string;
      details: string;
      updatedAt: number;
    }
  >;
}
