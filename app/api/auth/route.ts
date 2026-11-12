import { NextRequest, NextResponse } from 'next/server';
import {
  createSessionToken,
  verifyAdminCredentials,
  verifyAdminRequest,
  SESSION_COOKIE_NAME,
} from '../../lib/auth';

export const dynamic = 'force-dynamic';

// Simple in-memory brute-force rate limiter per IP (max 6 failed attempts per 10 minutes)
const failedLoginMap = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}

export async function GET(req: NextRequest) {
  const auth = await verifyAdminRequest(req);
  if (!auth.valid) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    email: auth.email,
  });
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const now = Date.now();
    const record = failedLoginMap.get(ip);

    if (record && now < record.resetAt && record.count >= 6) {
      return NextResponse.json(
        {
          authenticated: false,
          error: 'Too many failed login attempts. Please wait 10 minutes before trying again.',
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '').trim();

    // Silent reCAPTCHA v3 check
    const recaptchaSecret =
      process.env.RECAPTCHA_SECRET_KEY || '6LdfShwuAAAAAMM2ze3fH-Ml-T9fZ9_X5k6DmTG8';
    const tokenStr = String(body.recaptchaToken || '').trim();
    if (recaptchaSecret && tokenStr) {
      let human = false;
      try {
        const rcRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            secret: recaptchaSecret,
            response: tokenStr,
            remoteip: ip,
          }),
          cache: 'no-store',
        });
        const rc = await rcRes.json();
        human = Boolean(rc.success) && (rc.score === undefined || rc.score >= 0.3);
      } catch {
        human = true;
      }
      if (!human) {
        return NextResponse.json(
          { authenticated: false, error: 'Sign in could not be verified. Please try again.' },
          { status: 403 }
        );
      }
    }

    const verifyRes = await verifyAdminCredentials(email, password);
    if (!verifyRes.valid || !verifyRes.email) {
      const prev = failedLoginMap.get(ip);
      const count = prev && now < prev.resetAt ? prev.count + 1 : 1;
      failedLoginMap.set(ip, { count, resetAt: now + 10 * 60 * 1000 });
      return NextResponse.json(
        {
          authenticated: false,
          error: verifyRes.error || 'Invalid email or password.',
        },
        { status: 403 }
      );
    }

    failedLoginMap.delete(ip);
    const token = createSessionToken(verifyRes.email);

    const res = NextResponse.json({
      authenticated: true,
      email: verifyRes.email,
      token,
    });

    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Authentication error' }, { status: 500 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ authenticated: false });
  res.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return res;
}
