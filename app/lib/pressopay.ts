import crypto from 'crypto';
import { getFirebaseAccessToken, FIREBASE_RTDB_URL, FIREBASE_PROJECT_ID } from './auth';
import {
  VpnServerItem,
  ServerPackageOption,
  PaymentOrderRecord,
  SubscriptionRecord,
} from './types';

export interface PressoPayGatewayConfig {
  provider: 'pressopay';
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
  currency: 'TZS';
  defaultPrice7Days: number;
  defaultPrice30Days: number;
  updatedAt: number;
}

const FIRESTORE_BASE_DOCS = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;
const FIRESTORE_GATEWAY_DOC = `${FIRESTORE_BASE_DOCS}/tweve_fleet/payment_gateway`;

let cachedGatewayConfig: { config: PressoPayGatewayConfig; expiresAt: number } | null = null;

/**
 * Reads the PressoPay gateway configuration (API Key, Secret Key, Default Prices)
 * strictly from the private server-side Firebase Database (`/tweve_payment_gateway.json`
 * and Firestore `tweve_fleet/payment_gateway`).
 * Never exposed to client browsers or public endpoints.
 */
export async function getPaymentGatewayConfig(forceRefresh = false): Promise<PressoPayGatewayConfig> {
  if (!forceRefresh && cachedGatewayConfig && Date.now() < cachedGatewayConfig.expiresAt) {
    return cachedGatewayConfig.config;
  }

  const fbToken = await getFirebaseAccessToken();
  if (fbToken) {
    try {
      const rtdbRes = await fetch(
        `${FIREBASE_RTDB_URL}/tweve_payment_gateway.json?access_token=${fbToken}`,
        { cache: 'no-store' }
      );
      if (rtdbRes.ok) {
        const parsed = await rtdbRes.json();
        if (parsed && typeof parsed === 'object' && parsed.apiKey && parsed.apiSecret) {
          const config: PressoPayGatewayConfig = {
            provider: 'pressopay',
            baseUrl: String(parsed.baseUrl || 'https://pressopay.com').replace(/\/+$/, ''),
            apiKey: String(parsed.apiKey).trim(),
            apiSecret: String(parsed.apiSecret).trim(),
            currency: 'TZS',
            defaultPrice7Days: Math.max(100, Number(parsed.defaultPrice7Days || 2700)),
            defaultPrice30Days: Math.max(100, Number(parsed.defaultPrice30Days || 8500)),
            updatedAt: Number(parsed.updatedAt || Date.now()),
          };
          cachedGatewayConfig = { config, expiresAt: Date.now() + 60 * 1000 };
          return config;
        }
      }
    } catch (err) {
      console.error('Error reading PressoPay gateway config from RTDB:', err);
    }

    try {
      const fsRes = await fetch(FIRESTORE_GATEWAY_DOC, {
        headers: { Authorization: `Bearer ${fbToken}` },
        cache: 'no-store',
      });
      if (fsRes.ok) {
        const doc = await fsRes.json();
        const jsonStr = doc?.fields?.payload?.stringValue;
        if (jsonStr) {
          const parsed = JSON.parse(jsonStr);
          if (parsed && parsed.apiKey && parsed.apiSecret) {
            const config: PressoPayGatewayConfig = {
              provider: 'pressopay',
              baseUrl: String(parsed.baseUrl || 'https://pressopay.com').replace(/\/+$/, ''),
              apiKey: String(parsed.apiKey).trim(),
              apiSecret: String(parsed.apiSecret).trim(),
              currency: 'TZS',
              defaultPrice7Days: Math.max(100, Number(parsed.defaultPrice7Days || 2700)),
              defaultPrice30Days: Math.max(100, Number(parsed.defaultPrice30Days || 8500)),
              updatedAt: Number(parsed.updatedAt || Date.now()),
            };
            cachedGatewayConfig = { config, expiresAt: Date.now() + 60 * 1000 };
            return config;
          }
        }
      }
    } catch (err) {
      console.error('Error reading PressoPay gateway config from Firestore:', err);
    }
  }

  // Fallback to environment variables if set on server host
  const envKey = process.env.PRESSSO_API_KEY || '';
  const envSecret = process.env.PRESSSO_API_SECRET || '';
  return {
    provider: 'pressopay',
    baseUrl: 'https://pressopay.com',
    apiKey: envKey,
    apiSecret: envSecret,
    currency: 'TZS',
    defaultPrice7Days: 2700,
    defaultPrice30Days: 8500,
    updatedAt: Date.now(),
  };
}

export async function savePaymentGatewayConfig(
  updates: Partial<PressoPayGatewayConfig>
): Promise<PressoPayGatewayConfig> {
  const existing = await getPaymentGatewayConfig(true);
  const nextConfig: PressoPayGatewayConfig = {
    provider: 'pressopay',
    baseUrl: String(updates.baseUrl || existing.baseUrl || 'https://pressopay.com').replace(/\/+$/, ''),
    apiKey: updates.apiKey ? String(updates.apiKey).trim() : existing.apiKey,
    apiSecret: updates.apiSecret ? String(updates.apiSecret).trim() : existing.apiSecret,
    currency: 'TZS',
    defaultPrice7Days: Math.max(
      100,
      Number(updates.defaultPrice7Days ?? existing.defaultPrice7Days ?? 2700)
    ),
    defaultPrice30Days: Math.max(
      100,
      Number(updates.defaultPrice30Days ?? existing.defaultPrice30Days ?? 8500)
    ),
    updatedAt: Date.now(),
  };

  const fbToken = await getFirebaseAccessToken();
  if (!fbToken) {
    throw new Error('Failed to authenticate with private Firebase Database');
  }

  await Promise.all([
    fetch(`${FIREBASE_RTDB_URL}/tweve_payment_gateway.json?access_token=${fbToken}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nextConfig),
      cache: 'no-store',
    }),
    fetch(FIRESTORE_GATEWAY_DOC, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${fbToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          payload: { stringValue: JSON.stringify(nextConfig) },
          updated_at: { integerValue: String(nextConfig.updatedAt) },
        },
      }),
      cache: 'no-store',
    }).catch(() => null),
  ]);

  cachedGatewayConfig = { config: nextConfig, expiresAt: Date.now() + 60 * 1000 };
  return nextConfig;
}

/**
 * Computes the available duration packages (7 Days / 30 Days) and exact TZS prices
 * for a given server based on the Admin's configuration:
 * - 'default': 7 Days (default 2,700 TZS) & 30 Days (default 8,500 TZS)
 * - 'custom_both': 7 Days (custom price) & 30 Days (custom price)
 * - 'only_7d': 7 Days only (custom or default price)
 * - 'only_30d': 30 Days / 1 Month only (custom or default price)
 */
export function getServerPackages(
  server: VpnServerItem,
  defaultPrice7Days = 2700,
  defaultPrice30Days = 8500
): ServerPackageOption[] {
  const isPaid =
    server.requiresPackage !== undefined
      ? Boolean(server.requiresPackage)
      : server.tier === 'PREMIUM' || server.tier === 'VIP';

  if (!isPaid) return [];

  const mode = server.packagePricingMode || 'default';
  const p7 =
    mode === 'default'
      ? defaultPrice7Days
      : Number(server.price7DaysTzs && server.price7DaysTzs > 0 ? server.price7DaysTzs : defaultPrice7Days);
  const p30 =
    mode === 'default'
      ? defaultPrice30Days
      : Number(
          server.price30DaysTzs && server.price30DaysTzs > 0 ? server.price30DaysTzs : defaultPrice30Days
        );

  const packages: ServerPackageOption[] = [];

  if (mode === 'default' || mode === 'custom_both' || mode === 'only_7d') {
    packages.push({
      id: '7d',
      planId: '7d',
      label: '7 Days Access',
      days: 7,
      durationDays: 7,
      priceTzs: Math.round(p7),
    });
  }

  if (mode === 'default' || mode === 'custom_both' || mode === 'only_30d') {
    packages.push({
      id: '30d',
      planId: '30d',
      label: '30 Days (1 Month)',
      days: 30,
      durationDays: 30,
      priceTzs: Math.round(p30),
    });
  }

  return packages;
}

/**
 * Normalizes Tanzanian phone numbers for PressoPay mobile money USSD push.
 * PressoPay accepts local format (07XXXXXXXX / 06XXXXXXXX) or 2557XXXXXXXX.
 */
export function normalizeTzPhone(input: string): { valid: boolean; localPhone: string; intlPhone: string } {
  const digits = String(input || '').replace(/\D+/g, '');
  if (digits.length === 10 && (digits.startsWith('07') || digits.startsWith('06'))) {
    return {
      valid: true,
      localPhone: digits,
      intlPhone: `255${digits.slice(1)}`,
    };
  }
  if (digits.length === 12 && digits.startsWith('255') && ['6', '7'].includes(digits[3])) {
    return {
      valid: true,
      localPhone: `0${digits.slice(3)}`,
      intlPhone: digits,
    };
  }
  if (digits.length === 9 && ['6', '7'].includes(digits[0])) {
    return {
      valid: true,
      localPhone: `0${digits}`,
      intlPhone: `255${digits}`,
    };
  }
  return { valid: false, localPhone: digits, intlPhone: digits };
}

/**
 * Signs and executes a request to PressoPay API (`https://pressopay.com/api/v1/...`)
 * following https://pressopay.com/docs HMAC-SHA256 specification:
 * canonical = [timestamp, nonce, METHOD, path, rawBody].join("\n")
 */
export async function callPressoPayApi(
  method: 'GET' | 'POST',
  path: string,
  bodyObj?: Record<string, any>,
  idempotencyKey?: string
): Promise<{ ok: boolean; status: number; data: any }> {
  const gateway = await getPaymentGatewayConfig();
  if (!gateway.apiKey || !gateway.apiSecret) {
    throw new Error('Payment gateway credentials are not configured in server database.');
  }

  const timestamp = new Date().toISOString();
  const nonce = crypto.randomUUID();
  const rawBody = method === 'POST' && bodyObj ? JSON.stringify(bodyObj) : '';
  const canonical = [timestamp, nonce, method, path, rawBody].join('\n');
  const signature = crypto
    .createHmac('sha256', gateway.apiSecret)
    .update(canonical)
    .digest('hex');

  const headers: Record<string, string> = {
    'X-Pressso-Key': gateway.apiKey,
    'X-Pressso-Timestamp': timestamp,
    'X-Pressso-Nonce': nonce,
    'X-Pressso-Signature': signature,
    Accept: 'application/json',
  };

  if (method === 'POST') {
    headers['content-type'] = 'application/json';
    headers['idempotency-key'] = idempotencyKey || crypto.randomUUID();
  }

  const res = await fetch(`${gateway.baseUrl}${path}`, {
    method,
    headers,
    body: method === 'POST' ? rawBody : undefined,
    cache: 'no-store',
  });

  let data: any = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }

  return { ok: res.ok, status: res.status, data };
}

/**
 * Generates a high-entropy cryptographic Premium Access Key (`TWV-XXXX-XXXX-XXXX`)
 */
export function generateAccessKey(): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = crypto.randomBytes(12);
  let chars = '';
  for (let i = 0; i < 12; i++) {
    chars += alphabet[bytes[i] % alphabet.length];
  }
  return `TWV-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

/**
 * Reads a payment order from private Firebase RTDB (`/tweve_payment_orders/<orderId>.json`)
 * with private Cloud Firestore fallback (`tweve_orders/<orderId>`).
 */
export async function getPaymentOrder(orderId: string): Promise<PaymentOrderRecord | null> {
  const safeId = String(orderId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeId) return null;
  const fbToken = await getFirebaseAccessToken();
  if (!fbToken) return null;

  try {
    const res = await fetch(
      `${FIREBASE_RTDB_URL}/tweve_payment_orders/${safeId}.json?access_token=${fbToken}`,
      { cache: 'no-store' }
    );
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object' && data.orderId) {
        return data as PaymentOrderRecord;
      }
    }
  } catch (err) {
    console.error('Error reading payment order from RTDB:', err);
  }

  try {
    const fsRes = await fetch(`${FIRESTORE_BASE_DOCS}/tweve_orders/${safeId}`, {
      headers: { Authorization: `Bearer ${fbToken}` },
      cache: 'no-store',
    });
    if (fsRes.ok) {
      const doc = await fsRes.json();
      const jsonStr = doc?.fields?.payload?.stringValue;
      if (jsonStr) {
        const parsed = JSON.parse(jsonStr);
        if (parsed && parsed.orderId) return parsed as PaymentOrderRecord;
      }
    }
  } catch (err) {
    console.error('Error reading payment order from Firestore:', err);
  }
  return null;
}

export async function savePaymentOrder(order: PaymentOrderRecord): Promise<void> {
  const safeId = String(order.orderId).replace(/[^a-zA-Z0-9_-]/g, '');
  const fbToken = await getFirebaseAccessToken();
  if (!fbToken) throw new Error('Database authentication failed');

  await Promise.all([
    fetch(`${FIREBASE_RTDB_URL}/tweve_payment_orders/${safeId}.json?access_token=${fbToken}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
      cache: 'no-store',
    }).catch(() => null),
    fetch(`${FIRESTORE_BASE_DOCS}/tweve_orders/${safeId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${fbToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          payload: { stringValue: JSON.stringify(order) },
          status: { stringValue: String(order.status) },
          buyerPhone: { stringValue: String(order.buyerPhone) },
          createdAt: { integerValue: String(order.createdAt || Date.now()) },
        },
      }),
      cache: 'no-store',
    }).catch(() => null),
  ]);
}

export async function listPaymentOrders(limit = 100): Promise<PaymentOrderRecord[]> {
  const fbToken = await getFirebaseAccessToken();
  if (!fbToken) return [];
  const byId = new Map<string, PaymentOrderRecord>();

  try {
    const res = await fetch(
      `${FIREBASE_RTDB_URL}/tweve_payment_orders.json?access_token=${fbToken}`,
      { cache: 'no-store' }
    );
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        for (const o of Object.values(data) as PaymentOrderRecord[]) {
          if (o && o.orderId) byId.set(o.orderId, o);
        }
      }
    }
  } catch {
    // fallback to firestore
  }

  try {
    const fsRes = await fetch(`${FIRESTORE_BASE_DOCS}/tweve_orders?pageSize=100`, {
      headers: { Authorization: `Bearer ${fbToken}` },
      cache: 'no-store',
    });
    if (fsRes.ok) {
      const fsData = await fsRes.json();
      if (Array.isArray(fsData.documents)) {
        for (const doc of fsData.documents) {
          const jsonStr = doc?.fields?.payload?.stringValue;
          if (jsonStr) {
            try {
              const o = JSON.parse(jsonStr) as PaymentOrderRecord;
              if (o && o.orderId && !byId.has(o.orderId)) {
                byId.set(o.orderId, o);
              }
            } catch {}
          }
        }
      }
    }
  } catch {}

  return Array.from(byId.values())
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, limit);
}

export async function getSubscriptionByKey(accessKey: string): Promise<SubscriptionRecord | null> {
  const cleanKey = String(accessKey || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '');
  if (!cleanKey) return null;

  const fbToken = await getFirebaseAccessToken();
  if (!fbToken) return null;

  let sub: SubscriptionRecord | null = null;

  try {
    const res = await fetch(
      `${FIREBASE_RTDB_URL}/tweve_subscriptions/${cleanKey}.json?access_token=${fbToken}`,
      { cache: 'no-store' }
    );
    if (res.ok) {
      const data = (await res.json()) as SubscriptionRecord | null;
      if (data && data.accessKey) {
        sub = data;
      }
    }
  } catch {}

  if (!sub) {
    try {
      const fsRes = await fetch(`${FIRESTORE_BASE_DOCS}/tweve_subscriptions/${cleanKey}`, {
        headers: { Authorization: `Bearer ${fbToken}` },
        cache: 'no-store',
      });
      if (fsRes.ok) {
        const doc = await fsRes.json();
        const jsonStr = doc?.fields?.payload?.stringValue;
        if (jsonStr) {
          const parsed = JSON.parse(jsonStr);
          if (parsed && parsed.accessKey) sub = parsed as SubscriptionRecord;
        }
      }
    } catch {}
  }

  if (sub && sub.accessKey) {
    if (sub.status === 'active' && Date.now() >= Number(sub.expiresAt || 0)) {
      sub.status = 'expired';
      await saveSubscription(sub).catch(() => null);
    }
    return sub;
  }
  return null;
}

export async function saveSubscription(sub: SubscriptionRecord): Promise<void> {
  const cleanKey = String(sub.accessKey)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '');
  const fbToken = await getFirebaseAccessToken();
  if (!fbToken) throw new Error('Database authentication failed');

  await Promise.all([
    fetch(`${FIREBASE_RTDB_URL}/tweve_subscriptions/${cleanKey}.json?access_token=${fbToken}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub),
      cache: 'no-store',
    }).catch(() => null),
    fetch(`${FIRESTORE_BASE_DOCS}/tweve_subscriptions/${cleanKey}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${fbToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          payload: { stringValue: JSON.stringify(sub) },
          status: { stringValue: String(sub.status) },
          expiresAt: { integerValue: String(sub.expiresAt || 0) },
        },
      }),
      cache: 'no-store',
    }).catch(() => null),
  ]);
}

export async function listSubscriptions(limit = 100): Promise<SubscriptionRecord[]> {
  const fbToken = await getFirebaseAccessToken();
  if (!fbToken) return [];
  const byKey = new Map<string, SubscriptionRecord>();

  try {
    const res = await fetch(
      `${FIREBASE_RTDB_URL}/tweve_subscriptions.json?access_token=${fbToken}`,
      { cache: 'no-store' }
    );
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        for (const s of Object.values(data) as SubscriptionRecord[]) {
          if (s && s.accessKey) byKey.set(s.accessKey, s);
        }
      }
    }
  } catch {}

  try {
    const fsRes = await fetch(`${FIRESTORE_BASE_DOCS}/tweve_subscriptions?pageSize=100`, {
      headers: { Authorization: `Bearer ${fbToken}` },
      cache: 'no-store',
    });
    if (fsRes.ok) {
      const fsData = await fsRes.json();
      if (Array.isArray(fsData.documents)) {
        for (const doc of fsData.documents) {
          const jsonStr = doc?.fields?.payload?.stringValue;
          if (jsonStr) {
            try {
              const s = JSON.parse(jsonStr) as SubscriptionRecord;
              if (s && s.accessKey && !byKey.has(s.accessKey)) {
                byKey.set(s.accessKey, s);
              }
            } catch {}
          }
        }
      }
    }
  } catch {}

  const now = Date.now();
  return Array.from(byKey.values())
    .map((s) => ({
      ...s,
      status: s.status === 'active' && now >= Number(s.expiresAt || 0) ? 'expired' : s.status,
    }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, limit);
}

/**
 * Authoritatively reconciles a PENDING payment order with PressoPay (`GET /api/v1/payments/:reference`).
 * Only if PressoPay confirms `status === "COMPLETED"` and the paid amount matches `order.amountTzs`,
 * mints a cryptographic `SubscriptionRecord` (`TWV-XXXX-XXXX-XXXX`) valid for `order.durationDays`.
 */
export async function reconcileOrderWithPressoPay(
  order: PaymentOrderRecord
): Promise<PaymentOrderRecord> {
  if (order.status === 'COMPLETED' && order.accessKey) {
    return order;
  }
  if (!order.pressoReference) {
    return order;
  }

  try {
    const path = `/api/v1/payments/${encodeURIComponent(order.pressoReference)}`;
    const res = await callPressoPayApi('GET', path);
    if (!res.ok || !res.data) {
      return order;
    }

    const remoteStatus = String(res.data.status || '').toUpperCase();
    const remoteAmount = Number(res.data.amountMinor ?? order.amountTzs);

    if (remoteStatus === 'COMPLETED' && remoteAmount >= order.amountTzs) {
      const now = Date.now();
      const expiresAt = now + order.durationDays * 24 * 60 * 60 * 1000;
      const accessKey = order.accessKey || generateAccessKey();

      const sub: SubscriptionRecord = {
        accessKey,
        orderId: order.orderId,
        pressoReference: order.pressoReference,
        serverId: order.serverId,
        serverName: order.serverName,
        planId: order.planId,
        durationDays: order.durationDays,
        amountTzs: order.amountTzs,
        buyerName: order.buyerName,
        buyerPhone: order.buyerPhone,
        buyerEmail: order.buyerEmail,
        status: 'active',
        tier: 'PREMIUM',
        createdAt: now,
        expiresAt,
        maxDevices: 2,
        devices: {},
      };

      order.status = 'COMPLETED';
      order.accessKey = accessKey;
      order.subscriptionExpiresAt = expiresAt;
      order.completedAt = now;
      order.updatedAt = now;

      await Promise.all([saveSubscription(sub), savePaymentOrder(order)]);
      return order;
    } else if (remoteStatus === 'FAILED' || remoteStatus === 'CANCELLED') {
      if (order.status !== remoteStatus) {
        order.status = remoteStatus as 'FAILED' | 'CANCELLED';
        order.updatedAt = Date.now();
        await savePaymentOrder(order);
      }
    }
  } catch (err) {
    console.error('Error reconciling PressoPay status:', err);
  }

  return order;
}
