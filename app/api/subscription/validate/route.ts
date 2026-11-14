import { NextRequest, NextResponse } from 'next/server';
import { getSubscriptionByKey } from '../../../lib/pressopay';
import { enforceApiSecurity } from '../../../lib/security';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key, x-app-version',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  const blocked = await enforceApiSecurity(req, { scope: 'public_api' });
  if (blocked) return blocked;

  const apiKey =
    req.headers.get('x-api-key') ||
    new URL(req.url).searchParams.get('key') ||
    '';
  const cleanKey = apiKey.trim().toUpperCase();

  if (!cleanKey) {
    return NextResponse.json(
      { status: 'none', tier: 'FREE', message: 'No API key provided' },
      { status: 401, headers: CORS_HEADERS }
    );
  }

  const sub = await getSubscriptionByKey(cleanKey);
  if (!sub) {
    return NextResponse.json(
      { status: 'invalid', tier: 'FREE', message: 'Invalid Access Key' },
      { status: 401, headers: CORS_HEADERS }
    );
  }

  if (sub.status === 'revoked') {
    return NextResponse.json(
      { status: 'banned', tier: 'FREE', message: 'Access Key revoked' },
      { status: 403, headers: CORS_HEADERS }
    );
  }

  const now = Date.now();
  if (sub.status === 'expired' || now >= Number(sub.expiresAt || 0)) {
    return NextResponse.json(
      {
        status: 'expired',
        tier: 'FREE',
        expiresAt: new Date(sub.expiresAt).toISOString(),
        message: 'Subscription expired',
      },
      { status: 200, headers: CORS_HEADERS }
    );
  }

  return NextResponse.json(
    {
      status: 'active',
      tier: sub.tier || 'PREMIUM',
      serverId: sub.serverId,
      serverName: sub.serverName,
      planId: sub.planId,
      durationDays: sub.durationDays,
      expiresAt: new Date(sub.expiresAt).toISOString(),
    },
    { status: 200, headers: CORS_HEADERS }
  );
}

