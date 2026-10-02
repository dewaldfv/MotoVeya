import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { LEGAL_DOCUMENTS } from '@/lib/legal-content';

const ROUTE_MAP = { privacy: 'PRIVACY_POLICY', terms: 'TERMS_OF_SERVICE', eula: 'EULA', refund: 'REFUND_POLICY', cookies: 'COOKIE_POLICY', legal: 'LEGAL_NOTICE' };

export default function Legal() {
  const { doc } = useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const routeDoc = doc || ({ '/privacy-policy': 'privacy', '/terms-of-service': 'terms', '/refund-policy': 'refund', '/cookie-policy': 'cookies', '/legal': 'legal' }[pathname]);
  const key = ROUTE_MAP[routeDoc] || 'EULA';
  const item = LEGAL_DOCUMENTS[key];
  return (
    <div className="min-h-screen bg-background pb-24" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-lg">
        <button onClick={() => navigate(-1)} className="glove-target flex items-center justify-center rounded-full" aria-label="Back"><ChevronLeft size={26} /></button>
        <h1 className="text-lg font-bold">{item.title}</h1>
      </div>
      <div className="mx-auto max-w-2xl p-4"><p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{item.body}</p></div>
    </div>
  );
}
