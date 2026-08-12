import { useState } from 'react';
import { ChevronLeft, Mail, Instagram, Facebook, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function Contact() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      toast.error('Please fill in all fields');
      return;
    }
    setSending(true);
    try {
      const mailto = `mailto:hello@motogo.app?subject=${encodeURIComponent('MotoVeya Contact from ' + form.name)}&body=${encodeURIComponent(`Name: ${form.name}\nEmail: ${form.email}\n\n${form.message}`)}`;
      window.location.href = mailto;
      toast.success('Opening your email app…');
    } catch (err) {
      toast.error('Could not open email — please email hello@motogo.app');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 p-4 backdrop-blur-lg" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
        <button onClick={() => navigate(-1)} className="glove-target flex items-center justify-center rounded-full bg-card" aria-label="Back">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold">Contact Us</h1>
      </div>

      <div className="mx-auto max-w-2xl p-4 space-y-6">
        <div className="rounded-3xl bg-card p-6 space-y-3 border border-border">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Mail size={22} className="text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email us anytime</p>
              <a href="mailto:hello@motogo.app" className="font-bold text-primary">hello@motogo.app</a>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="rounded-3xl bg-card p-6 space-y-4 border border-border">
          <h2 className="font-bold">Send us a message</h2>
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="message">Message</Label>
            <Textarea id="message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="How can we help?" rows={4} />
          </div>
          <Button type="submit" disabled={sending} className="min-h-[52px] w-full">
            <Send size={18} className="mr-2" /> {sending ? 'Opening…' : 'Send Message'}
          </Button>
        </form>

        <div className="rounded-3xl bg-card p-6 space-y-3 border border-border">
          <h2 className="font-bold">Follow MotoVeya</h2>
          <div className="flex gap-3">
            <a href="https://instagram.com/motogo" target="_blank" rel="noopener noreferrer" className="flex h-12 w-12 items-center justify-center rounded-full bg-muted hover:bg-primary/10 transition-colors" aria-label="Instagram">
              <Instagram size={22} className="text-primary" />
            </a>
            <a href="https://facebook.com/motogo" target="_blank" rel="noopener noreferrer" className="flex h-12 w-12 items-center justify-center rounded-full bg-muted hover:bg-primary/10 transition-colors" aria-label="Facebook">
              <Facebook size={22} className="text-primary" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}