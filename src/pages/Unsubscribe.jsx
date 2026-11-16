import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, AlertTriangle, MailX, RefreshCw } from 'lucide-react';
import LogoMark from '@/components/LogoMark';

const ENDPOINT = '/api/app-emails/unsubscribe';

const isEditorPreview = () =>
  typeof window !== 'undefined' &&
  (window.self !== window.top || /^preview(-sandbox)?--/.test(window.location.hostname));

const readToken = () =>
  typeof window === 'undefined'
    ? null
    : new URLSearchParams(window.location.hash.slice(1)).get('token');

export default function Unsubscribe() {
  const [status, setStatus] = useState('loading');
  const [isPreview, setIsPreview] = useState(false);

  const send = useCallback(async (token) => {
    setStatus('loading');
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (res.ok) setStatus('done');
      else if (res.status === 400) setStatus('invalid');
      else setStatus('error');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    const token = readToken();
    if (!token) {
      if (isEditorPreview()) {
        setIsPreview(true);
        setStatus('done');
      } else {
        setStatus('invalid');
      }
      return;
    }
    send(token);
  }, [send]);

  const token = readToken();

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background px-5 pb-10 pt-[calc(2.5rem+env(safe-area-inset-top))]">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        <div className="mb-8 flex justify-center">
          <LogoMark size={72} />
        </div>

        <div className="rounded-[var(--radius)] border border-border bg-card p-6 shadow-sm">
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <Loader2 className="h-9 w-9 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Updating your email preferences…</p>
            </div>
          )}

          {status === 'done' && (
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              <h1 className="font-heading text-xl font-bold text-foreground">You&apos;re unsubscribed</h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                You won&apos;t receive any more marketing emails from MotoVeya.
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Transactional emails, such as receipts, payment confirmations and password resets, will still reach
                you.
              </p>
              {isPreview && (
                <span className="mt-1 rounded-full border border-border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Preview
                </span>
              )}
            </div>
          )}

          {status === 'invalid' && (
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
                <MailX className="h-8 w-8 text-destructive" />
              </div>
              <h1 className="font-heading text-xl font-bold text-foreground">This link is invalid</h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                The unsubscribe link is missing a valid token, or it has already been used. Please open the link from
                the email you received.
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <AlertTriangle className="h-8 w-8 text-primary" />
              </div>
              <h1 className="font-heading text-xl font-bold text-foreground">Something went wrong</h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                We couldn&apos;t update your preferences just now. Check your connection and try again.
              </p>
              <Button className="mt-2 min-h-[48px] w-full" onClick={() => send(token)}>
                <RefreshCw className="h-4 w-4" />
                Try again
              </Button>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          MotoVeya · Your bike. Anytime. Anywhere.
        </p>
      </div>
    </div>
  );
}