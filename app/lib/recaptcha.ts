// Invisible Google reCAPTCHA v3 (client side). No widget, no text. The badge is hidden in CSS.
const SITE_KEY =
  process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '6LdfShwuAAAAABwSHiD54knomdgdEh2l0DOpNR6Q';

let loader: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (!SITE_KEY || typeof window === 'undefined') return Promise.resolve();
  if (loader) return loader;
  loader = new Promise<void>((resolve) => {
    const s = document.createElement('script');
    s.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => resolve();
    document.head.appendChild(s);
  });
  return loader;
}

export function preloadRecaptcha(): void {
  void loadScript();
}

export async function getRecaptchaToken(action: string): Promise<string> {
  if (!SITE_KEY) return '';
  await loadScript();
  const g = (window as any).grecaptcha;
  if (!g || !g.ready) return '';
  return new Promise<string>((resolve) => {
    g.ready(() => {
      g.execute(SITE_KEY, { action }).then(resolve, () => resolve(''));
    });
  });
}

