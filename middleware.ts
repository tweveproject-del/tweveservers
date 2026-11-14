import { NextRequest, NextResponse } from 'next/server';

const AI_OR_SCANNER_UA_RE =
  /gptbot|chatgpt-user|oai-searchbot|claudebot|claude-web|anthropic-ai|perplexitybot|ccbot|bytespider|google-extended|amazonbot|meta-externalagent|applebot-extended|diffbot|cohere-ai|youbot|headlesschrome|phantomjs|playwright|puppeteer|selenium|webdriver|nightmare|scrapy|sqlmap|nikto|nuclei|nmap|masscan|zgrab|wpscan|dirbuster|gobuster|ffuf|acunetix|nessus|openvas|burpsuite|hydra|medusa/i;

const SCRIPT_UA_RE =
  /python-requests|python-urllib|aiohttp|httpx|curl\/|wget\/|libwww-perl|go-http-client|ruby|php\//i;

const URL_ATTACK_RE =
  /<script|<\/script|javascript:|onerror=|onload=|union\s+select|select\s+.*\s+from|drop\s+table|\.\.\/|\.\.\\|%00|\x00|\$\{jndi:/i;

const SILENT_BLOCK_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  'Pragma': 'no-cache',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
};

function blankStatus(status = 403): NextResponse {
  return new NextResponse(null, { status, headers: SILENT_BLOCK_HEADERS });
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const ua = req.headers.get('user-agent') || '';
  const decodedUrl = (() => {
    try {
      return decodeURIComponent(`${pathname}${search}`);
    } catch {
      return `${pathname}${search}`;
    }
  })();

  if (URL_ATTACK_RE.test(decodedUrl)) {
    return blankStatus(403);
  }

  // Always block known AI crawlers, headless automation browsers, and vulnerability scanners
  if (AI_OR_SCANNER_UA_RE.test(ua)) {
    return blankStatus(403);
  }

  // Block direct unauthenticated access to internal admin portal route with blank 404
  if (pathname.startsWith('/portal')) {
    const hasSession = Boolean(req.cookies.get('tweve_admin_session')?.value);
    if (!hasSession) {
      return blankStatus(404);
    }
  }

  // Block direct browser address-bar navigation onto ANY /api/* route (plain blank white response)
  if (pathname.startsWith('/api/')) {
    const secFetchMode = (req.headers.get('sec-fetch-mode') || '').toLowerCase();
    const secFetchDest = (req.headers.get('sec-fetch-dest') || '').toLowerCase();
    if (secFetchMode === 'navigate' || secFetchDest === 'document') {
      return blankStatus(404);
    }
  }

  const isPaymentWebhook = pathname.startsWith('/api/payments') && req.method === 'POST';
  const isPublicApkApi =
    pathname.startsWith('/api/servers') ||
    pathname.startsWith('/api/analytics') ||
    pathname.startsWith('/api/payments') ||
    pathname.startsWith('/api/subscription');

  const isAndroidClient = /okhttp|dalvik|tweve/i.test(ua);

  // On admin/HTML routes, block raw CLI/script UAs and empty UAs
  if (!isPublicApkApi && (!ua.trim() || SCRIPT_UA_RE.test(ua))) {
    return blankStatus(403);
  }

  // On public API routes (except PressoPay server webhooks), block generic scrapers unless native APK
  if (isPublicApkApi && !isPaymentWebhook && !isAndroidClient && SCRIPT_UA_RE.test(ua)) {
    return blankStatus(403);
  }

  // Block cross-site browser JS calls trying to scrape /api/servers from external websites
  if (pathname.startsWith('/api/servers')) {
    const secFetchSite = (req.headers.get('sec-fetch-site') || '').toLowerCase();
    if (secFetchSite === 'cross-site' && !isAndroidClient) {
      return blankStatus(403);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt).*)',
  ],
};
