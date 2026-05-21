import { motion } from 'framer-motion';
import { Video, Users, MessageSquare, Zap, Globe, Calendar } from 'lucide-react';

const FEATURES = [
  { icon: Video, title: 'Synchronized Watching', desc: 'Watch any video in perfect sync with your friends — every play, pause, and seek is shared instantly.' },
  { icon: Users, title: 'Group Video Calls', desc: 'Crystal-clear video and audio for up to 1,000 simultaneous participants powered by a modern SFU architecture.' },
  { icon: MessageSquare, title: 'Live Chat & Comments', desc: 'React in real-time with text chat and timestamped video comments that appear right on the player.' },
  { icon: Zap, title: 'Ultra-Low Latency', desc: 'Sub-100ms sync keeps every participant in the moment. No awkward delays, no spoilers.' },
  { icon: Globe, title: 'Smart Meetup Planner', desc: 'Planning an IRL gathering? The built-in midpoint calculator finds the fairest meeting place for everyone.' },
  { icon: Calendar, title: 'Scheduled Events', desc: 'Book watch parties, calls, or meetups in advance. Your group always knows what\'s next.' },
];

export default function LandingPage() {
  const handleLogin = () => {
    const base = import.meta.env.VITE_API_URL ?? '';
    window.location.href = `${base}/api/auth/google`;
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col overflow-x-hidden">
      {/* Nav */}
      <nav className="px-6 py-4 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand to-accent flex items-center justify-center">
            <Video size={16} className="text-white" />
          </div>
          <span className="font-semibold text-lg text-white">Gathering</span>
        </div>
        <button onClick={handleLogin} className="btn-primary text-sm">
          Sign in with Google
        </button>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-4 pt-16 pb-24 relative">
        {/* Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-brand/10 blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] rounded-full bg-accent/10 blur-[80px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative"
        >
          <span className="inline-flex items-center gap-2 text-xs font-medium bg-brand/15 text-brand-light border border-brand/20 rounded-full px-3 py-1 mb-6">
            <Zap size={12} />
            Up to 1,000 simultaneous participants
          </span>

          <h1 className="text-5xl sm:text-7xl font-bold text-white leading-tight tracking-tight mb-6">
            Watch together.{' '}
            <span className="bg-gradient-to-r from-brand-light via-purple-400 to-accent bg-clip-text text-transparent">
              Anywhere.
            </span>
          </h1>

          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            The modern platform for synchronized video watching, group video calls, and real-time interaction — no matter where your friends are.
          </p>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleLogin}
            className="inline-flex items-center gap-3 bg-white text-slate-900 font-semibold px-8 py-4 rounded-2xl text-lg shadow-xl hover:shadow-2xl transition-all"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </motion.button>
        </motion.div>
      </section>

      {/* Features grid */}
      <section className="px-6 pb-24 max-w-7xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-bold text-white mb-3">Everything your group needs</h2>
          <p className="text-slate-400">Built for the way friends actually hang out online.</p>
        </motion.div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07 }}
              className="card p-6 hover:border-brand/30 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-brand/15 flex items-center justify-center mb-4">
                <f.icon size={20} className="text-brand-light" />
              </div>
              <h3 className="font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 text-center text-slate-500 text-sm">
        <p>© {new Date().getFullYear()} Gathering · Watch together, anywhere</p>
      </footer>
    </div>
  );
}
