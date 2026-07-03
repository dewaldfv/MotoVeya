import { Bike } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

export default function LoginPrompt({ message = 'Please log in to access this feature' }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 p-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
        <Bike size={40} className="text-primary" />
      </div>
      <p className="max-w-xs text-lg text-muted-foreground">{message}</p>
      <Button size="lg" className="min-h-[56px] px-8 text-base" onClick={() => base44.auth.redirectToLogin()}>
        Log In to MotoGo
      </Button>
    </div>
  );
}