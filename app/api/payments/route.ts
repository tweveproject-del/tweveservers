import { NextRequest, NextResponse } from 'next/server';
import {
  getPaymentGatewayConfig,
  savePaymentGatewayConfig,
  getServerPackages,
  normalizeTzPhone,
  callPressoPayApi,
  getPaymentOrder,
  savePaymentOrder,
  listPaymentOrders,
  listSubscriptions,
  getSubscriptionByKey,
  reconcileOrderWithPressoPay,
} from '../../lib/pressopay';
import {
  verifyAdminRequest,
  getFirebaseAccessToken,
  FIREBASE_RTDB_URL,
} from '../../lib/auth';
import { recordSecurityAuditLog } from '../../lib/audit';
import {
  enforceApiSecurity,
  handleUnauthorizedAdminProbe,
  SILENT_SECURITY_HEADERS,
} from '../../lib/security';
import { VpnServerItem, PaymentOrderRecord } from '../../lib/types';

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
};

// Simple in-memory rate limit per IP to prevent payment initiation spam
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkPaymentRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60 * 1000 });
    return true;
  }
  if (entry.count >= 8) {
    return false;
  }
  entry.count += 1;
  return true;
}

async function readServersFromDb(): Promise<VpnServerItem[]> {
  const fbToken = await getFirebaseAccessToken();
  if (!fbToken) return [];
  try {
    const res = await fetch(`${FIREBASE_RTDB_URL}/tweve_fleet.json?access_token=${fbToken}`, {
      cache: 'no-store',
    });
    if (res.ok) {
      const parsed = await res.json();
      if (parsed && typeof parsed === 'object') {
        const list = Array.isArray(parsed.servers)
          ? parsed.servers
          : parsed.servers && typeof parsed.servers === 'object'
            ? Object.values(parsed.servers)
            : [];
        return list as VpnServerItem[];
      }
    }
  } catch {
    // ignore read failure
  }
  return [];
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * GET /api/payments
 * - ?mode=admin: Returns masked gateway config, recent payment orders, and active subscriptions (Admin only)
 * - ?orderId=ORD-...: Authoritatively reconciles and returns payment status (and Access Key if COMPLETED)
 * - ?lookup=<phone_or_key>: Looks up active subscriptions or recent completed orders by phone or access key
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('mode') || searchParams.get('format');
  const orderId = searchParams.get('orderId') || searchParams.get('reference');
  const lookup =
    searchParams.get('lookup') || searchParams.get('phone') || searchParams.get('key');

  const blocked = await enforceApiSecurity(req, {
    scope: mode === 'admin' ? 'browser_only' : 'public_api',
  });
  if (blocked) return blocked;

  if (mode === 'admin') {
    const auth = await verifyAdminRequest(req);
    if (!auth.valid) {
      return await handleUnauthorizedAdminProbe(req, 'GET /api/payments?mode=admin');
    }

    const [gateway, rawOrders] = await Promise.all([
      getPaymentGatewayConfig(),
      listPaymentOrders(100),
    ]);

    // Auto-reconcile recent PENDING orders with PressoPay so Admin always sees live status
    const pendingToReconcile = rawOrders
      .filter((o) => o.status === 'PENDING' && Boolean(o.pressoReference))
      .slice(0, 15);
    if (pendingToReconcile.length > 0) {
      await Promise.all(
        pendingToReconcile.map(async (o) => {
          try {
            const updated = await reconcileOrderWithPressoPay(o);
            Object.assign(o, updated);
          } catch {
            // keep existing order record if gateway check fails transiently
          }
        })
      );
    }

    const orders = rawOrders;
    const subscriptions = await listSubscriptions(100);

    const maskedKey = gateway.apiKey
      ? `${gateway.apiKey.slice(0, 7)}...${gateway.apiKey.slice(-4)}`
      : 'Not Configured';

    const enrichedOrders = orders.map((o) => ({
      ...o,
      subscriptionKey: o.accessKey,
      packageLabel: o.durationDays === 30 ? '30 Days (1 Month)' : '7 Days Access',
    }));

    const enrichedSubs = subscriptions.map((s) => ({
      ...s,
      key: s.accessKey,
      packageLabel: s.durationDays === 30 ? '30 Days (1 Month)' : '7 Days Access',
    }));

    return NextResponse.json(
      {
        gateway: {
          provider: gateway.provider,
          baseUrl: gateway.baseUrl,
          apiKeyMasked: maskedKey,
          hasSecret: Boolean(gateway.apiSecret && gateway.apiSecret.startsWith('sk_')),
          hasSecretInDb: Boolean(gateway.apiSecret && gateway.apiSecret.startsWith('sk_')),
          currency: gateway.currency,
          defaultPrice7Days: gateway.defaultPrice7Days,
          defaultPrice30Days: gateway.defaultPrice30Days,
          updatedAt: gateway.updatedAt,
        },
        orders: enrichedOrders,
        subscriptions: enrichedSubs,
      },
      { headers: CORS_HEADERS }
    );
  }

  if (orderId) {
    let order = await getPaymentOrder(orderId);
    if (!order) {
      const all = await listPaymentOrders(150);
      order =
        all.find((o) => o.pressoReference === orderId || o.orderId === orderId) || null;
    }
    if (!order) {
      return NextResponse.json(
        { error: 'Payment order not found' },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const updatedOrder = await reconcileOrderWithPressoPay(order);
    const orderPayload = {
      orderId: updatedOrder.orderId,
      pressoReference: updatedOrder.pressoReference,
      serverId: updatedOrder.serverId,
      serverName: updatedOrder.serverName,
      planId: updatedOrder.planId,
      durationDays: updatedOrder.durationDays,
      packageLabel: updatedOrder.durationDays === 30 ? '30 Days (1 Month)' : '7 Days Access',
      amountTzs: updatedOrder.amountTzs,
      currency: updatedOrder.currency,
      status: updatedOrder.status,
      checkoutUrl: updatedOrder.checkoutUrl,
      accessKey: updatedOrder.status === 'COMPLETED' ? updatedOrder.accessKey : undefined,
      subscriptionKey: updatedOrder.status === 'COMPLETED' ? updatedOrder.accessKey : undefined,
      subscriptionExpiresAt:
        updatedOrder.status === 'COMPLETED' ? updatedOrder.subscriptionExpiresAt : undefined,
      completedAt: updatedOrder.completedAt,
    };

    return NextResponse.json(
      {
        ...orderPayload,
        order: orderPayload,
      },
      { headers: CORS_HEADERS }
    );
  }

  if (lookup) {
    const q = lookup.trim();
    if (!q || q.length < 4) {
      return NextResponse.json(
        { error: 'Please enter a valid phone number, order ID, or access key.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 1. Check if it is an Access Key (`TWV-...`)
    if (q.toUpperCase().startsWith('TWV-')) {
      const sub = await getSubscriptionByKey(q.toUpperCase());
      if (!sub) {
        return NextResponse.json(
          { found: false, subscriptions: [], error: 'No subscription found for that Access Key.' },
          { status: 404, headers: CORS_HEADERS }
        );
      }
      const subObj = {
        key: sub.accessKey,
        accessKey: sub.accessKey,
        serverId: sub.serverId,
        serverName: sub.serverName,
        planId: sub.planId,
        durationDays: sub.durationDays,
        packageLabel: sub.durationDays === 30 ? '30 Days (1 Month)' : '7 Days Access',
        amountTzs: sub.amountTzs,
        status: sub.status,
        expiresAt: sub.expiresAt,
        createdAt: sub.createdAt,
      };
      return NextResponse.json(
        {
          found: true,
          subscription: subObj,
          subscriptions: [subObj],
        },
        { headers: CORS_HEADERS }
      );
    }

    // 2. Check if it is an Order ID (`ORD-...`)
    if (q.toUpperCase().startsWith('ORD-')) {
      const ord = await getPaymentOrder(q.toUpperCase());
      if (ord) {
        const reconciled = await reconcileOrderWithPressoPay(ord);
        return NextResponse.json(
          {
            found: true,
            order: {
              orderId: reconciled.orderId,
              serverName: reconciled.serverName,
              planId: reconciled.planId,
              durationDays: reconciled.durationDays,
              packageLabel: reconciled.durationDays === 30 ? '30 Days (1 Month)' : '7 Days Access',
              amountTzs: reconciled.amountTzs,
              status: reconciled.status,
              accessKey: reconciled.status === 'COMPLETED' ? reconciled.accessKey : undefined,
              subscriptionKey: reconciled.status === 'COMPLETED' ? reconciled.accessKey : undefined,
              subscriptionExpiresAt: reconciled.subscriptionExpiresAt,
            },
          },
          { headers: CORS_HEADERS }
        );
      }
    }

    // 3. Lookup by phone number
    const norm = normalizeTzPhone(q);
    const allOrders = await listPaymentOrders(200);
    const matchingOrders = allOrders.filter(
      (o) =>
        o.buyerPhone === norm.localPhone ||
        o.buyerPhone === norm.intlPhone ||
        o.buyerPhone === q
    );

    const reconciledResults = [];
    for (const ord of matchingOrders.slice(0, 5)) {
      const rec =
        ord.status === 'PENDING' ? await reconcileOrderWithPressoPay(ord) : ord;
      reconciledResults.push({
        orderId: rec.orderId,
        serverId: rec.serverId,
        serverName: rec.serverName,
        planId: rec.planId,
        durationDays: rec.durationDays,
        packageLabel: rec.durationDays === 30 ? '30 Days (1 Month)' : '7 Days Access',
        amountTzs: rec.amountTzs,
        status: rec.status,
        key: rec.status === 'COMPLETED' ? rec.accessKey : undefined,
        accessKey: rec.status === 'COMPLETED' ? rec.accessKey : undefined,
        subscriptionKey: rec.status === 'COMPLETED' ? rec.accessKey : undefined,
        expiresAt: rec.subscriptionExpiresAt,
        subscriptionExpiresAt: rec.subscriptionExpiresAt,
        createdAt: rec.createdAt,
      });
    }

    if (reconciledResults.length === 0) {
      return NextResponse.json(
        { found: false, subscriptions: [], orders: [], error: 'No payments or subscriptions found for that phone number.' },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      {
        found: true,
        orders: reconciledResults,
        subscriptions: reconciledResults.filter((r) => r.accessKey),
      },
      { headers: CORS_HEADERS }
    );
  }

  return NextResponse.json(
    { error: 'Missing query parameter (orderId, lookup, or mode=admin)' },
    { status: 400, headers: CORS_HEADERS }
  );
}

/**
 * POST /api/payments
 * Initiates a server-authorized PressoPay checkout (`POST https://pressopay.com/api/v1/checkouts`).
 * - Price is strictly computed server-side from the database configuration of the selected server & duration.
 * - Secret key (`sk_...`) is loaded strictly from the private Firebase server database.
 */
export async function POST(req: NextRequest) {
  const blocked = await enforceApiSecurity(req, { scope: 'public_api' });
  if (blocked) return blocked;

  try {
    const ip = getClientIp(req);
    if (!checkPaymentRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many payment requests. Please wait 1 minute and try again.' },
        { status: 429, headers: CORS_HEADERS }
      );
    }

    const body = await req.json();

    // Check if this is an incoming PressoPay webhook notification
    if (body && body.reference && body.status && !body.serverId && !body.planId) {
      const allOrders = await listPaymentOrders(150);
      const targetOrder = allOrders.find(
        (o) =>
          o.pressoReference === body.reference ||
          o.orderId === body.merchantReference ||
          o.orderId === body.reference
      );
      if (targetOrder) {
        const updated = await reconcileOrderWithPressoPay(targetOrder);
        return NextResponse.json({ received: true, status: updated.status }, { headers: CORS_HEADERS });
      }
      return NextResponse.json({ received: true }, { headers: CORS_HEADERS });
    }

    const serverId = String(body.serverId || '').trim();
    const planId = String(body.planId || body.packageId || '').trim() as '7d' | '30d';
    const rawPhone = String(body.buyerPhone || '').trim();
    const rawName = String(body.buyerName || 'Tweve Customer').trim().slice(0, 80);
    const rawEmail = String(body.buyerEmail || '').trim().toLowerCase();

    if (!serverId) {
      return NextResponse.json(
        { error: 'Please select a server to purchase.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (planId !== '7d' && planId !== '30d') {
      return NextResponse.json(
        { error: 'Invalid duration package selected. Choose 7 Days or 30 Days.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const phoneInfo = normalizeTzPhone(rawPhone);
    if (!phoneInfo.valid) {
      return NextResponse.json(
        {
          error:
            'Please enter a valid Tanzanian mobile money phone number (e.g. 0712345678 or 0655123456).',
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const [gateway, servers] = await Promise.all([
      getPaymentGatewayConfig(),
      readServersFromDb(),
    ]);

    const targetServer = servers.find((s) => s.id === serverId && s.isActive !== false && !s.isExpired);
    if (!targetServer) {
      return NextResponse.json(
        { error: 'Selected server is currently unavailable or expired.' },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const packages = getServerPackages(
      targetServer,
      gateway.defaultPrice7Days,
      gateway.defaultPrice30Days
    );
    const selectedPkg = packages.find((p) => p.planId === planId);

    if (!selectedPkg) {
      return NextResponse.json(
        { error: 'The selected duration package is not available for this server.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const amountTzs = Math.round(selectedPkg.priceTzs);
    if (!amountTzs || amountTzs < 100) {
      return NextResponse.json(
        { error: 'Invalid package price configuration.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const buyerEmail =
      rawEmail && rawEmail.includes('@')
        ? rawEmail
        : `${phoneInfo.localPhone}@twevetunnel.app`;
    const buyerName = rawName.length >= 2 ? rawName : `Tweve User ${phoneInfo.localPhone.slice(-4)}`;
    const description = `Tweve VPN - ${targetServer.name} (${selectedPkg.label})`;

    // Call PressoPay POST /api/v1/checkouts signed with server-side HMAC-SHA256
    const pressoRes = await callPressoPayApi(
      'POST',
      '/api/v1/checkouts',
      {
        merchantReference: orderId,
        amountMinor: amountTzs,
        buyerName,
        buyerEmail,
        buyerPhone: phoneInfo.localPhone,
        description,
      },
      orderId
    );

    if (!pressoRes.ok || !pressoRes.data?.reference) {
      const errMsg =
        pressoRes.data?.message ||
        pressoRes.data?.error ||
        `Payment gateway error (HTTP ${pressoRes.status})`;
      return NextResponse.json(
        { error: errMsg },
        { status: 502, headers: CORS_HEADERS }
      );
    }

    const now = Date.now();
    const orderRecord: PaymentOrderRecord = {
      orderId,
      pressoReference: String(pressoRes.data.reference),
      serverId: targetServer.id,
      serverName: targetServer.name,
      serverCountry: targetServer.country,
      serverProtocol: targetServer.protocol,
      planId: selectedPkg.planId,
      durationDays: selectedPkg.durationDays,
      amountTzs,
      currency: 'TZS',
      buyerName,
      buyerPhone: phoneInfo.localPhone,
      buyerEmail,
      status: 'PENDING',
      checkoutUrl: pressoRes.data.checkoutUrl ? String(pressoRes.data.checkoutUrl) : undefined,
      pushFailed: Boolean(pressoRes.data.pushFailed),
      createdAt: now,
      updatedAt: now,
    };

    await savePaymentOrder(orderRecord);

    const orderSummary = {
      orderId: orderRecord.orderId,
      pressoReference: orderRecord.pressoReference,
      serverId: orderRecord.serverId,
      serverName: orderRecord.serverName,
      planId: orderRecord.planId,
      durationDays: orderRecord.durationDays,
      packageLabel: selectedPkg.label,
      amountTzs: orderRecord.amountTzs,
      currency: 'TZS' as const,
      status: orderRecord.status,
      checkoutUrl: orderRecord.checkoutUrl,
      pushFailed: orderRecord.pushFailed,
    };

    return NextResponse.json(
      {
        success: true,
        ...orderSummary,
        order: orderSummary,
        message: orderRecord.pushFailed
          ? 'Mobile prompt could not be pushed directly. Use the payment link below to complete payment.'
          : `A mobile money payment prompt for ${amountTzs.toLocaleString()} TZS has been sent to ${phoneInfo.localPhone}. Enter your PIN on your phone to approve.`,
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error processing payment' },
      { status: 500, headers: { ...CORS_HEADERS, ...SILENT_SECURITY_HEADERS } }
    );
  }
}

/**
 * PUT /api/payments
 * Authenticated Admin endpoint to update default 7-day / 30-day prices or rotate PressoPay keys in the server database.
 */
export async function PUT(req: NextRequest) {
  const blocked = await enforceApiSecurity(req, { scope: 'browser_only' });
  if (blocked) return blocked;

  const auth = await verifyAdminRequest(req);
  if (!auth.valid) {
    return await handleUnauthorizedAdminProbe(req, 'PUT /api/payments');
  }

  try {
    const body = await req.json();
    const updated = await savePaymentGatewayConfig({
      defaultPrice7Days: body.defaultPrice7Days,
      defaultPrice30Days: body.defaultPrice30Days,
      apiKey: body.apiKey,
      apiSecret: body.apiSecret,
      baseUrl: body.baseUrl,
    });

    const maskedKey = updated.apiKey
      ? `${updated.apiKey.slice(0, 7)}...${updated.apiKey.slice(-4)}`
      : 'Not Configured';

    await recordSecurityAuditLog({
      req,
      category: 'PAYMENT',
      severity: 'warning',
      action: 'PAYMENT_GATEWAY_UPDATE',
      actor: auth.email || 'admin',
      details: `Updated payment gateway/pricing (7d=${updated.defaultPrice7Days} TZS, 30d=${updated.defaultPrice30Days} TZS).`,
      metadata: {
        defaultPrice7Days: updated.defaultPrice7Days,
        defaultPrice30Days: updated.defaultPrice30Days,
        rotatedApiKey: Boolean(body.apiKey),
        rotatedApiSecret: Boolean(body.apiSecret),
      },
    });

    return NextResponse.json(
      {
        success: true,
        gateway: {
          provider: updated.provider,
          baseUrl: updated.baseUrl,
          apiKeyMasked: maskedKey,
          hasSecretInDb: Boolean(updated.apiSecret && updated.apiSecret.startsWith('sk_')),
          currency: updated.currency,
          defaultPrice7Days: updated.defaultPrice7Days,
          defaultPrice30Days: updated.defaultPrice30Days,
          updatedAt: updated.updatedAt,
        },
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to update payment gateway settings' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
