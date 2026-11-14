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

function blankForbidden(): NextResponse {
  return new NextResponse(null, { status: 403, headers: SILENT_BLOCK_HEADERS });
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
    return blankForbidden();
  }

  // Always block known AI crawlers, headless automation browsers, and vulnerability scanners
  if (AI_OR_SCANNER_UA_RE.test(ua)) {
    return blankForbidden();
  }

  const isPublicApkApi =
    pathname.startsWith('/api/servers') ||
    pathname.startsWith('/api/analytics') ||
    pathname.startsWith('/api/payments') ||
    pathname.startsWith('/api/subscription');

  const isAndroidClient = /okhttp|dalvik|tweve/i.test(ua);

  // On non-public routes (page HTML, /api/auth, /api/security-logs, /api/app-version),
  // block raw CLI/script user agents and empty user agents (allow browser navigations & Next static chunks).
  if (!isPublicApkApi && (!ua.trim() || SCRIPT_UA_RE.test(ua))) {
    return blankForbidden();
  }

  // Even on public API routes, block raw scraping scripts unless identifying as standard browser or Android APK
  if (isPublicApkApi && !isAndroidClient && SCRIPT_UA_RE.test(ua)) {
    return blankForbidden();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt).*)',
  ],
};
