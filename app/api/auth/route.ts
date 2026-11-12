import { NextRequest, NextResponse } from 'next/server';
import {
  SESSION_COOKIE_NAME,
  createSessionToken,
  verifyAdminRequest,
  readAllowedEmails,
  writeAllowedEmails,
} from '../../lib/auth';

// Anti-brute-force rate limiter per IP (max 5 failed attempts within 10 minutes)
const failedAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000;

function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
}

export async function GET(req: NextRequest) {
  const session = verifyAdminRequest(req);
  if (!session.valid || !session.email) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const allowedEmails = await readAllowedEmails();
  if (!allowedEmails.includes(session.email.toLowerCase())) {
    const res = NextResponse.json({ authenticated: false, error: 'Email no longer authorized in DB' }, { status: 401 });
    res.cookies.delete(SESSION_COOKIE_NAME);
    return res;
  }

  return NextResponse.json({
    authenticated: true,
    email: session.email,
    allowedEmails,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action || 'login';

    if (action === 'login') {
      const ip = getClientIp(req);
      const now = Date.now();
      const record = failedAttempts.get(ip);

      if (record && now < record.resetAt && record.count >= MAX_ATTEMPTS) {
        const waitSec = Math.ceil((record.resetAt - now) / 1000);
        return NextResponse.json(
          { error: `Too many failed login attempts. Locked for ${waitSec}s.` },
          { status: 429 }
        );
      }

      const rawEmail = String(body.email || '').trim().toLowerCase();
      if (!rawEmail || !rawEmail.includes('@')) {
        return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
      }

      const allowedEmails = await readAllowedEmails();
      if (!allowedEmails.includes(rawEmail)) {
        const current = failedAttempts.get(ip);
        if (!current || now >= current.resetAt) {
          failedAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
        } else {
          current.count += 1;
        }
        return NextResponse.json(
          { error: 'Access denied: Email is not registered in the authorized admin database.' },
          { status: 403 }
        );
      }

      // Reset failed attempts on successful login
      failedAttempts.delete(ip);

      const token = createSessionToken(rawEmail);
      const res = NextResponse.json({
        authenticated: true,
        email: rawEmail,
        allowedEmails,
      });

      res.cookies.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
      });

      return res;
    }

    // Manage allowed emails in DB (requires authenticated admin session)
    const session = verifyAdminRequest(req);
    if (!session.valid || !session.email) {
      return NextResponse.json({ error: 'Unauthorized admin session' }, { status: 401 });
    }

    const currentEmails = await readAllowedEmails();
    if (!currentEmails.includes(session.email.toLowerCase())) {
      return NextResponse.json({ error: 'Unauthorized admin email' }, { status: 403 });
    }

    if (action === 'add_email') {
      const targetEmail = String(body.email || '').trim().toLowerCase();
      if (!targetEmail || !targetEmail.includes('@')) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
      }
      const updated = await writeAllowedEmails([...currentEmails, targetEmail]);
      return NextResponse.json({ success: true, allowedEmails: updated });
    }

    if (action === 'remove_email') {
      const targetEmail = String(body.email || '').trim().toLowerCase();
      if (currentEmails.length <= 1) {
        return NextResponse.json({ error: 'Cannot remove the last remaining admin email' }, { status: 400 });
      }
      const updated = await writeAllowedEmails(currentEmails.filter((e) => e !== targetEmail));
      return NextResponse.json({ success: true, allowedEmails: updated });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Authentication error' }, { status: 500 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ authenticated: false, loggedOut: true });
  res.cookies.delete(SESSION_COOKIE_NAME);
  return res;
}
