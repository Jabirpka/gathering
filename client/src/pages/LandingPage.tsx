import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Video, Users, MessageSquare, Zap, Calendar, Loader2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

const BASE = import.meta.env.VITE_API_URL ?? '';

const FEATURES = [
  { icon: Video, title: 'Synchronized Watching', desc: 'Watch any video in perfect sync — every play, pause, and seek shared instantly.' },
  { icon: Users, title: 'Group Video Calls', desc: 'Crystal-clear video and audio for up to 1,000 participants.' },
  { icon: MessageSquare, title: 'Live Chat & Comments', desc: 'Real-time chat and timestamped video comments that appear on the player.' },
  { icon: Zap, title: 'Poke & Reactions', desc: 'Send emoji reactions, poke friends, and talk walky-talky style.' },
  { icon: Calendar, title: 'Scheduled Events', desc: 'Book watch parties or calls in advance so your group knows what\'s next.' },
  { icon: Users, title: 'Group Management', desc: 'Private or public groups with invite codes, approval system, and roles.' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { setToken, fetchUser } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (Capacitor.isNativePlatform()) {
      // Native app: use poll-based OAuth via Chrome Custom Tab
      setLoading(true);
      const pollId = Math.random().toString(36).slice(2) + Date.now().toString(36);

      try {
        // Open OAuth in Chrome Custom Tab (not WebView — Google allows this)
        await Browser.open({
          url: `${BASE}/api/auth/google?pollId=${pollId}`,
          windowName: '_self',
        });

        // Poll every 1.5s for up to 3 minutes
        let attempts = 0;
        const maxAttempts = 120;
        const poll = async (): Promise<void> => {
          if (attempts++ > maxAttempts) {
            setLoading(false);
            toast.error('Sign-in timed out. Please try again.');
            return;
          }
          try {
            const res = await fetch(`${BASE}/api/auth/token-poll?pollId=${pollId}`);
            const data = await res.json();
            if (data.ready && data.token) {
              await Browser.close();
              await setToken(data.token);
              await fetchUser();
              navigate('/dashboard', { replace: true });
              setLoading(false);
              return;
            }
          } catch {}
          await new Promise((r) => setTimeout(r, 1500));
          return poll();
        };

        poll();
      } catch {
        setLoading(false);
        toast.error('Failed to open sign-in. Please try again.');
      }
    } else {
      // Web: normal redirect
      window.location.href = `${BASE}/api/auth/google`;
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col overflow-x-hidden">
      {/* Nav */}
      <nav className="px-5 py-4 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand to-accent flex items-center justify-center">
            <Video size={16} className="text-white" />
          </div>
          <span className="font-semibold text-lg text-white">Gathering</span>
        </div>
        <button onClick={handleLogin} disabled={loading} className="btn-primary text-sm">
          {loading ? <Loader2 size={14} className="animate-spin" /> : 'Sign in'}
        </button>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-5 pt-12 pb-20 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-brand/10 blur-[120px] pointer-events-none" />

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="relative">
          <span className="inline-flex items-center gap-2 text-xs font-medium bg-brand/15 text-brand-light border border-brand/20 rounded-full px-3 py-1 mb-6">
            <Zap size={12} />Up to 1,000 simultaneous participants
          </span>

          <h1 className="text-4xl sm:text-6xl font-bold text-white leading-tight tracking-tight mb-5">
            Watch together.{' '}
            <span className="bg-gradient-to-r from-brand-light via-purple-400 to-accent bg-clip-text text-transparent">Anywhere.</span>
          </h1>

          <p className="text-lg text-slate-400 max-w-xl mx-auto mb-8 leading-relaxed">
            Synchronized video watching, group calls, live chat — hang out with your people no matter where they are.
          </p>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleLogin}
            disabled={loading}
            className="inline-flex items-center gap-3 bg-white text-slate-900 font-semibold px-7 py-4 rounded-2xl text-base shadow-xl hover:shadow-2xl transition-all disabled:opacity-70"
          >
            {loading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Waiting for sign-in…
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </>
            )}
          </motion.button>

          {loading && (
            <p className="mt-4 text-xs text-slate-500">
              Complete sign-in in the browser window that opened
            </p>
          )}
        </motion.div>
      </section>

      {/* Features */}
      <section className="px-5 pb-20 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07 }}
              className="card p-5 hover:border-brand/30 transition-colors">
              <div className="w-9 h-9 rounded-xl bg-brand/15 flex items-center justify-center mb-3">
                <f.icon size={18} className="text-brand-light" />
              </div>
              <h3 className="font-semibold text-white mb-1 text-sm">{f.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/5 py-6 text-center text-slate-500 text-sm">
        <p>© {new Date().getFullYear()} Gathering · Watch together, anywhere</p>
      </footer>
    </div>
  );
}
