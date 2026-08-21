import { useEffect } from 'react';

// OAuth callbacks for the canonical MotoVeya app cannot safely land directly
// on Web.motoveya because the canonical app validates its allowed callback
// domains. This page is deliberately tiny: the canonical OAuth callback lands
// here, then forwards the issued Base44 access token to Web.motoveya.
const WEB_ORIGIN = 'https://web-motoveya.base44.app';
const WEB_CALLBACK = `${WEB_ORIGIN}/auth/callback`;

function safeReturnTo(raw) {
  if (!raw) return '/';
  try {
    const url = new URL(raw, WEB_ORIGIN);
    if (url.origin !== WEB_ORIGIN) return '/';
    const path = `${url.pathname}${url.search}${url.hash}`;
    if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return '/';
    return path;
  } catch {
    return '/';
  }
}

export default function WebAuthBridge() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('access_token');
    const returnTo = safeReturnTo(params.get('web_return'));

    if (!token) {
      window.location.replace(`${WEB_ORIGIN}/login?error=oauth_callback_missing`);
      return;
    }

    const target = new URL(WEB_CALLBACK);
    target.searchParams.set('access_token', token);
    target.searchParams.set('returnTo', returnTo);
    window.location.replace(target.toString());
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
        <p className="text-sm text-muted-foreground">Completing MotoVeya sign in…</p>
      </div>
    </div>
  );
}
