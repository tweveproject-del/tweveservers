import { NextRequest, NextResponse } from 'next/server';
import { getSubscriptionByKey, saveSubscription } from '../../../lib/pressopay';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = (req.headers.get('x-api-key') || '').trim().toUpperCase();
    if (!apiKey) {
      return NextResponse.json({ allowed: false, error: 'Missing x-api-key' }, { status: 401, headers: CORS_HEADERS });
    }

    const sub = await getSubscriptionByKey(apiKey);
    if (!sub || sub.status !== 'active' || Date.now() >= Number(sub.expiresAt || 0)) {
      return NextResponse.json({ allowed: false, error: 'Subscription inactive or expired' }, { status: 403, headers: CORS_HEADERS });
    }

    const body = await req.json().catch(() => ({}));
    const hwid = String(body.hwid || '').trim();
    const label = String(body.label || 'Android Device').trim().slice(0, 60);
    const details = String(body.details || '').trim().slice(0, 60);

    if (!hwid) {
      return NextResponse.json({ allowed: true }, { headers: CORS_HEADERS });
    }

    const devices = sub.devices && typeof sub.devices === 'object' ? { ...sub.devices } : {};
    const maxDevices = Number(sub.maxDevices || 2);

    if (!devices[hwid] && Object.keys(devices).length >= maxDevices) {
      return NextResponse.json(
        {
          allowed: false,
          maxDevices,
          activeDevices: Object.values(devices),
        },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    devices[hwid] = {
      hwid,
      label,
      details,
      updatedAt: Date.now(),
    };
    sub.devices = devices;
    await saveSubscription(sub);

    return NextResponse.json(
      {
        allowed: true,
        maxDevices,
        activeDevices: Object.values(devices),
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json({ allowed: true, error: err.message }, { status: 200, headers: CORS_HEADERS });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const apiKey = (req.headers.get('x-api-key') || '').trim().toUpperCase();
    if (!apiKey) {
      return NextResponse.json({ success: false }, { status: 401, headers: CORS_HEADERS });
    }

    const sub = await getSubscriptionByKey(apiKey);
    if (!sub) {
      return NextResponse.json({ success: false }, { status: 404, headers: CORS_HEADERS });
    }

    const body = await req.json().catch(() => ({}));
    const hwid = String(body.hwid || '').trim();
    if (hwid && sub.devices && sub.devices[hwid]) {
      delete sub.devices[hwid];
      await saveSubscription(sub);
    }

    return NextResponse.json({ success: true }, { status: 200, headers: CORS_HEADERS });
  } catch {
    return NextResponse.json({ success: true }, { status: 200, headers: CORS_HEADERS });
  }
}
