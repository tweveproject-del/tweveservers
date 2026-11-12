import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';

export const SESSION_COOKIE_NAME = 'tweve_admin_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const ADMINS_FILE = path.join(process.cwd(), 'data', 'admins.json');
const TMP_ADMINS_FILE = '/tmp/tweve_fleet_admins.json';
const GIST_ID = '54ff3427b094f3765f2743b460b311b0';
const GIST_API_URL = `https://api.github.com/gists/${GIST_ID}`;
const ENC_TOKEN_HEX = '3d32350508311c632c182b6910126d3e0308696f221d1b2c3e202c222e2a202d3f636a35382e313b';

export function getCloudAuthToken(): string {
  const bytes = Buffer.from(ENC_TOKEN_HEX, 'hex');
  const out = Buffer.alloc(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    out[i] = bytes[i] ^ 0x5a;
  }
  return out.toString('utf8');
}

export function getCloudHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getCloudAuthToken()}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'TweveServerFleet/1.0',
  };
}

function getSigningSecret(): string {
  return crypto
    .createHash('sha256')
    .update(`Tweve-Admin-Session-Secret-2026:${getCloudAuthToken()}`)
    .digest('hex');
}

export function createSessionToken(email: string): string {
  const normalized = email.trim().toLowerCase();
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ email: normalized, exp }), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', getSigningSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySessionToken(token?: string | null): { valid: boolean; email?: string } {
  if (!token || !token.includes('.')) return { valid: false };
  try {
    const [payload, sig] = token.split('.');
    const expectedSig = crypto.createHmac('sha256', getSigningSecret()).update(payload).digest('base64url');
    if (sig.length !== expectedSig.length) return { valid: false };
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
      return { valid: false };
    }
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.email || !data.exp || Date.now() > data.exp) {
      return { valid: false };
    }
    return { valid: true, email: String(data.email).toLowerCase() };
  } catch {
    return { valid: false };
  }
}

export function verifyAdminRequest(req: NextRequest): { valid: boolean; email?: string } {
  const cookieToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (cookieToken) {
    const res = verifySessionToken(cookieToken);
    if (res.valid) return res;
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return verifySessionToken(authHeader.slice(7).trim());
  }
  return { valid: false };
}

function readLocalAdmins(): string[] {
  const defaults = ['tweveproject@gmail.com', 'tweveproject-del@gmail.com', 'admin@tweve.vpn'];
  try {
    if (fs.existsSync(TMP_ADMINS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(TMP_ADMINS_FILE, 'utf8'));
      if (Array.isArray(parsed.emails) && parsed.emails.length > 0) {
        return parsed.emails.map((e: string) => e.trim().toLowerCase());
      }
    }
  } catch {}
  try {
    if (fs.existsSync(ADMINS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(ADMINS_FILE, 'utf8'));
      if (Array.isArray(parsed.emails) && parsed.emails.length > 0) {
        return parsed.emails.map((e: string) => e.trim().toLowerCase());
      }
    }
  } catch {}
  return defaults;
}

export async function readAllowedEmails(): Promise<string[]> {
  const local = readLocalAdmins();
  try {
    const res = await fetch(GIST_API_URL, {
      headers: getCloudHeaders(),
      cache: 'no-store',
    });
    if (res.ok) {
      const gist = await res.json();
      const content = gist?.files?.['fleet_admins.json']?.content;
      if (content) {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed.emails) && parsed.emails.length > 0) {
          const normalized = Array.from(
            new Set(parsed.emails.map((e: string) => String(e).trim().toLowerCase()).filter(Boolean))
          ) as string[];
          try {
            fs.writeFileSync(TMP_ADMINS_FILE, JSON.stringify({ emails: normalized }), 'utf8');
          } catch {}
          return normalized;
        }
      }
    }
  } catch {}
  return local;
}

export async function writeAllowedEmails(emails: string[]): Promise<string[]> {
  const normalized = Array.from(
    new Set(emails.map((e) => String(e).trim().toLowerCase()).filter((e) => e.includes('@')))
  );
  const payload = {
    emails: normalized,
    updated_at: Date.now(),
  };

  try {
    fs.writeFileSync(TMP_ADMINS_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch {}

  try {
    fs.writeFileSync(ADMINS_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch {}

  try {
    await fetch(GIST_API_URL, {
      method: 'PATCH',
      headers: getCloudHeaders(),
      body: JSON.stringify({
        files: {
          'fleet_admins.json': {
            content: JSON.stringify(payload, null, 2),
          },
        },
      }),
    });
  } catch (err) {
    console.error('Error syncing fleet_admins.json to cloud:', err);
  }

  return normalized;
}
