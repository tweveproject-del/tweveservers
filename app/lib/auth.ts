import crypto from 'crypto';
import { NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = 'tweve_admin_session';
const SESSION_SECRET = process.env.TWEVE_ADMIN_SECRET || 'TweveFleet-HMAC-MasterSecret-2026-v1-ObsidianKey';

const FIREBASE_RTDB_URL = 'https://tunnel-7a4c7-default-rtdb.firebaseio.com';
const FIREBASE_PROJECT_ID = 'tunnel-7a4c7';

// Firebase Web API keys across user's Firebase projects so Email/Password users added manually in Firebase Console -> Authentication work automatically
const FIREBASE_AUTH_API_KEYS = [
  'AIzaSyDnXO7VUNGqIkuS3sy3geYtLfe8w95oHOE', // tunnel-7a4c7 (Tunnel)
  'AIzaSyAsphLedQBbuBmD2rWlhGfkQGLostyU3hw', // twevetech
  'AIzaSyDTPyOA-yjAycPQgRfBdCuMRQliYXaHuXQ', // tweve-play
  'AIzaSyAwPeois-p2ldPgmyqDPT2kU6gHDJWD1y0', // tweve-stream
  'AIzaSyBGriR29Q8ANkuhzEbtaF6x-wAO94o1tqc', // elimika-6e8d9
];

const SA_XOR_KEY = 'TweveFirebaseFleetKey2026';
const SA_XOR_B64 =
  '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';

export interface AdminAccount {
  id: string;
  email: string;
  password?: string;
  role?: string;
  source?: string;
}

let cachedFirebaseToken: { token: string; expiresAt: number } | null = null;

function getServiceAccount(): { client_email: string; private_key: string } | null {
  try {
    const raw = Buffer.from(SA_XOR_B64, 'base64');
    const out = Buffer.alloc(raw.length);
    for (let i = 0; i < raw.length; i++) {
      out[i] = raw[i] ^ SA_XOR_KEY.charCodeAt(i % SA_XOR_KEY.length);
    }
    return JSON.parse(out.toString('utf8'));
  } catch {
    return null;
  }
}

export async function getFirebaseAccessToken(): Promise<string | null> {
  if (cachedFirebaseToken && Date.now() < cachedFirebaseToken.expiresAt) {
    return cachedFirebaseToken.token;
  }
  const sa = getServiceAccount();
  if (!sa) return null;

  try {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        iss: sa.client_email,
        sub: sa.client_email,
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
        scope:
          'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/userinfo.email',
      })
    ).toString('base64url');

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(`${header}.${payload}`);
    const signature = sign.sign(sa.private_key, 'base64url');
    const jwt = `${header}.${payload}.${signature}`;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.access_token) {
      cachedFirebaseToken = {
        token: data.access_token,
        expiresAt: Date.now() + 50 * 60 * 1000,
      };
      return data.access_token;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Reads admin accounts strictly from live Firebase (zero local or hardcoded admins):
 * 1. Firebase Realtime Database (`tunnel-7a4c7-default-rtdb.firebaseio.com/admins.json`)
 * 2. Firebase Cloud Firestore (`projects/tunnel-7a4c7/databases/(default)/documents/admins`)
 */
export async function readFirebaseAdmins(): Promise<AdminAccount[]> {
  const byEmail = new Map<string, AdminAccount>();

  const mergeEntry = (raw: any, fallbackId: string, source: string) => {
    if (!raw || typeof raw !== 'object') return;
    const email = String(raw.email || raw.Email || raw.username || '').trim().toLowerCase();
    if (!email || !email.includes('@')) return;
    const password = String(raw.password ?? raw.Password ?? raw.pass ?? '').trim();
    const existing = byEmail.get(email);
    byEmail.set(email, {
      id: String(raw.id || fallbackId),
      email,
      password: password || existing?.password || '',
      role: String(raw.role || existing?.role || 'admin'),
      source,
    });
  };

  const fbToken = await getFirebaseAccessToken();
  if (fbToken) {
    try {
      const rtdbRes = await fetch(`${FIREBASE_RTDB_URL}/admins.json?access_token=${fbToken}`, {
        cache: 'no-store',
      });
      if (rtdbRes.ok) {
        const rtdbData = await rtdbRes.json();
        if (Array.isArray(rtdbData)) {
          rtdbData.forEach((item, idx) => mergeEntry(item, `admin_${idx + 1}`, 'firebase_rtdb'));
        } else if (rtdbData && typeof rtdbData === 'object') {
          Object.entries(rtdbData).forEach(([key, val]) => mergeEntry(val, key, 'firebase_rtdb'));
        }
      }
    } catch {
      // ignore
    }

    try {
      const fsRes = await fetch(
        `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/admins`,
        {
          headers: { Authorization: `Bearer ${fbToken}` },
          cache: 'no-store',
        }
      );
      if (fsRes.ok) {
        const fsData = await fsRes.json();
        if (Array.isArray(fsData.documents)) {
          fsData.documents.forEach((doc: any, idx: number) => {
            const fields = doc.fields || {};
            const docId = String(doc.name || '').split('/').pop() || `fs_${idx + 1}`;
            mergeEntry(
              {
                id: docId,
                email: fields.email?.stringValue || fields.Email?.stringValue || '',
                password: fields.password?.stringValue || fields.Password?.stringValue || '',
                role: fields.role?.stringValue || 'admin',
              },
              docId,
              'firebase_firestore'
            );
          });
        }
      }
    } catch {
      // ignore
    }
  }

  return Array.from(byEmail.values());
}

/**
 * Verifies admin login (email + password) strictly against live Firebase:
 * 1. Firebase Authentication (`identitytoolkit.googleapis.com/v1/accounts:signInWithPassword`)
 * 2. Firebase Realtime Database (`tunnel-7a4c7-default-rtdb.firebaseio.com/admins`) & Firestore (`admins`)
 */
export async function verifyAdminCredentials(
  emailInput: string,
  passwordInput: string
): Promise<{ valid: boolean; email?: string; role?: string; authSource?: string; error?: string }> {
  const email = String(emailInput || '').trim().toLowerCase();
  const password = String(passwordInput || '').trim();

  if (!email || !email.includes('@')) {
    return { valid: false, error: 'Please enter a valid email address.' };
  }
  if (!password) {
    return { valid: false, error: 'Please enter your password.' };
  }

  // 1. Check Firebase Authentication (Email/Password users added manually in Firebase Console -> Authentication)
  for (const apiKey of FIREBASE_AUTH_API_KEYS) {
    try {
      const res = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            returnSecureToken: true,
          }),
          cache: 'no-store',
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.idToken) {
          return {
            valid: true,
            email: String(data.email || email).toLowerCase(),
            role: 'admin',
            authSource: 'firebase_auth',
          };
        }
      }
    } catch {
      // continue checking next project
    }
  }

  // 2. Check Firebase Realtime Database & Firestore /admins records added manually in Firebase Console
  const admins = await readFirebaseAdmins();
  const matchedDbAdmin = admins.find((a) => a.email.toLowerCase() === email);
  if (matchedDbAdmin && matchedDbAdmin.password && matchedDbAdmin.password === password) {
    return {
      valid: true,
      email: matchedDbAdmin.email,
      role: matchedDbAdmin.role || 'admin',
      authSource: matchedDbAdmin.source || 'firebase_rtdb',
    };
  }

  return {
    valid: false,
    error: 'Invalid email or password.',
  };
}

/**
 * Creates a signed HMAC-SHA256 session token for an authenticated admin email.
 */
export function createSessionToken(email: string): string {
  const normalized = email.trim().toLowerCase();
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  const payload = Buffer.from(JSON.stringify({ email: normalized, exp: expiresAt })).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/**
 * Verifies a signed HMAC-SHA256 session token and returns the authenticated email if valid.
 */
export function verifySessionToken(token?: string | null): { valid: boolean; email?: string } {
  if (!token || !token.includes('.')) return { valid: false };
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return { valid: false };

  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return { valid: false };
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (!decoded.email || typeof decoded.exp !== 'number' || Date.now() > decoded.exp) {
      return { valid: false };
    }
    return { valid: true, email: String(decoded.email).toLowerCase() };
  } catch {
    return { valid: false };
  }
}

/**
 * Verifies if an incoming NextRequest has a valid admin session cookie or Bearer token.
 */
export async function verifyAdminRequest(req: NextRequest): Promise<{ valid: boolean; email?: string }> {
  const cookieToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const authHeader = req.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const token = cookieToken || bearerToken;

  const verified = verifySessionToken(token);
  if (!verified.valid || !verified.email) {
    return { valid: false };
  }

  return { valid: true, email: verified.email };
}

export { SESSION_COOKIE_NAME, FIREBASE_RTDB_URL, FIREBASE_PROJECT_ID };
