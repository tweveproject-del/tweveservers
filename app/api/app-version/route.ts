import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, getFirebaseAccessToken, FIREBASE_RTDB_URL } from '../../lib/auth';
import { recordSecurityAuditLog } from '../../lib/audit';

export const dynamic = 'force-dynamic';

export interface AppVersionConfig {
  enabled: boolean;
  force_update: boolean;
  show_dialog: boolean;
  latest_version_code: number;
  min_version_code: number;
  latest_version_name: string;
  title: string;
  message: string;
  button_text: string;
  update_url: string;
  updated_at: string;
}

const DEFAULT_VERSION_CONFIG: AppVersionConfig = {
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
  updated_at: new Date().toISOString(),
};

export async function GET(req: NextRequest) {
  const auth = await verifyAdminRequest(req);
  if (!auth.valid) {
    await recordSecurityAuditLog({
      req,
      category: 'SECURITY_ALERT',
      severity: 'critical',
      action: 'UNAUTHORIZED_ACCESS',
      actor: 'anonymous',
      details: 'Unauthorized GET attempt to /api/app-version.',
      metadata: { method: 'GET', path: '/api/app-version' },
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const fbToken = await getFirebaseAccessToken();
    const url = fbToken
      ? `${FIREBASE_RTDB_URL}/app_version.json?access_token=${fbToken}`
      : `${FIREBASE_RTDB_URL}/app_version.json`;
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        return NextResponse.json({
          ok: true,
          version: { ...DEFAULT_VERSION_CONFIG, ...data },
        });
      }
    }
  } catch {
    // fallback to default
  }

  return NextResponse.json({ ok: true, version: DEFAULT_VERSION_CONFIG });
}

export async function PUT(req: NextRequest) {
  const auth = await verifyAdminRequest(req);
  if (!auth.valid) {
    await recordSecurityAuditLog({
      req,
      category: 'SECURITY_ALERT',
      severity: 'critical',
      action: 'UNAUTHORIZED_ACCESS',
      actor: 'anonymous',
      details: 'Unauthorized PUT attempt to /api/app-version.',
      metadata: { method: 'PUT', path: '/api/app-version' },
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const latestCode = Math.max(1, Number(body.latest_version_code || 54));
    const minCode = Math.max(1, Number(body.min_version_code || latestCode));

    const payload: AppVersionConfig = {
      enabled: body.enabled !== false,
      force_update: Boolean(body.force_update),
      show_dialog: Boolean(body.show_dialog),
      latest_version_code: latestCode,
      min_version_code: minCode,
      latest_version_name: String(body.latest_version_name || '6.2.4').trim(),
      title: String(body.title || 'New Version Available').trim(),
      message: String(body.message || DEFAULT_VERSION_CONFIG.message).trim(),
      button_text: String(body.button_text || 'Update Now').trim(),
      update_url: String(
        body.update_url || 'https://twevetunnel.deployzy.com/twevetunnel.bin'
      ).trim(),
      updated_at: new Date().toISOString(),
    };

    const fbToken = await getFirebaseAccessToken();
    if (!fbToken) {
      return NextResponse.json(
        { error: 'Firebase service account token unavailable' },
        { status: 500 }
      );
    }

    const res = await fetch(
      `${FIREBASE_RTDB_URL}/app_version.json?access_token=${fbToken}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store',
      }
    );

    if (!res.ok) {
      const errTxt = await res.text();
      return NextResponse.json(
        { error: `Failed to save app version to Firebase: ${errTxt}` },
        { status: 500 }
      );
    }

    // Also mirror to Firebase Remote Config so older app builds (v6.2.3 and earlier) receive the update dialog immediately
    try {
      const rcGet = await fetch(
        'https://firebaseremoteconfig.googleapis.com/v1/projects/361708938703/remoteConfig',
        {
          headers: { Authorization: `Bearer ${fbToken}` },
          cache: 'no-store',
        }
      );
      if (rcGet.ok) {
        const etag = rcGet.headers.get('etag') || '*';
        const template = await rcGet.json();
        template.parameters = template.parameters || {};
        template.parameters.app_version = {
          ...(template.parameters.app_version || {}),
          defaultValue: { value: JSON.stringify(payload) },
          valueType: 'JSON',
        };
        await fetch(
          'https://firebaseremoteconfig.googleapis.com/v1/projects/361708938703/remoteConfig',
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${fbToken}`,
              'Content-Type': 'application/json; charset=UTF-8',
              'If-Match': etag,
            },
            body: JSON.stringify(template),
            cache: 'no-store',
          }
        );
      }
    } catch {
      // Non-fatal: RTDB already updated
    }

    await recordSecurityAuditLog({
      req,
      category: 'ADMIN_ACTION',
      severity: 'info',
      action: 'APP_VERSION_UPDATE',
      actor: auth.email || 'admin',
      details: `Published app version v${payload.latest_version_name} (code ${payload.latest_version_code}, min ${payload.min_version_code}, force=${payload.force_update}).`,
      metadata: {
        latest_version_code: payload.latest_version_code,
        min_version_code: payload.min_version_code,
        latest_version_name: payload.latest_version_name,
        force_update: payload.force_update,
        update_url: payload.update_url,
      },
    });

    return NextResponse.json({ ok: true, version: payload });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update app version' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return PUT(req);
}

