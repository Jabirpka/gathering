import { useState } from 'react';
import { motion } from 'framer-motion';
import { Video, Loader2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import toast from 'react-hot-toast';
import { authApi } from '../services/api';
import { useAuthStore } from '../store/authStore';

const BASE = import.meta.env.VITE_API_URL ?? '';

export default function LandingPage() {
  const navigate = useNavigate();
  const { setToken, fetchUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const fullPhone = () => `+92${phone.replace(/\D/g, '')}`;

  const handleLogin = async () => {
    if (Capacitor.isNativePlatform()) {
      setLoading(true);
      const pollId = 'native_' + Date.now().toString(36);
      try {
        await Browser.open({ url: `${BASE}/api/auth/google?pollId=${pollId}`, windowName: '_self' });
      } catch {
        setLoading(false);
        toast.error('Failed to open sign-in. Please try again.');
      }
    } else {
      window.location.href = `${BASE}/api/auth/google`;
    }
  };

  const requestOtp = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 7) { toast.error('Enter a valid phone number'); return; }
    setSending(true);
    try {
      const res = await authApi.requestPhoneOtp(fullPhone());
      setPhase('otp');
      setCode('');
      if (res.data?.devCode) toast(`Dev code: ${res.data.devCode}`, { icon: '🔑', duration: 8000 });
      else toast.success('Code sent');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Could not send code');
    } finally {
      setSending(false);
    }
  };

  const verifyOtp = async () => {
    if (code.trim().length < 4) { toast.error('Enter the code'); return; }
    setVerifying(true);
    try {
      const res = await authApi.verifyPhoneOtp(fullPhone(), code.trim());
      await setToken(res.data.token);
      await fetchUser();
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-10 relative overflow-hidden">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[320px] rounded-full bg-brand/12 blur-[90px] pointer-events-none" />

      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-brand flex items-center justify-center">
            <Video size={18} className="text-white" />
          </div>
          <span className="font-bold text-xl text-white tracking-tight">Gathering</span>
        </div>

        {/* Hero */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-white">
            Stay close.<br />
            <span className="bg-gradient-to-r from-brand to-accent bg-clip-text text-transparent">Anywhere.</span>
          </h1>
          <p className="text-sm text-slate-400 mt-3">Your people. One place.</p>
        </div>

        {phase === 'phone' ? (
          /* Phone entry */
          <div className="space-y-2.5">
            <div className="flex items-stretch bg-surface-2 border border-white/10 rounded-2xl overflow-hidden focus-within:border-brand/60 transition-colors">
              <div className="flex items-center gap-1.5 px-3.5 text-sm font-semibold text-brand border-r border-white/10 whitespace-nowrap select-none">🇵🇰 +92</div>
              <input
                type="tel" inputMode="tel" placeholder="Phone number" value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, '').slice(0, 12))}
                onKeyDown={(e) => e.key === 'Enter' && requestOtp()}
                className="flex-1 bg-transparent outline-none px-3.5 py-3.5 text-sm text-white placeholder-slate-500"
              />
            </div>
            <button onClick={requestOtp} disabled={sending} className="btn-primary w-full justify-center py-3.5 text-[15px]">
              {sending ? <Loader2 size={18} className="animate-spin" /> : <>Continue <span aria-hidden>→</span></>}
            </button>
          </div>
        ) : (
          /* OTP entry */
          <div className="space-y-2.5">
            <button onClick={() => setPhase('phone')} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
              <ArrowLeft size={13} /> {fullPhone()}
            </button>
            <input
              type="tel" inputMode="numeric" placeholder="6-digit code" value={code} autoFocus
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => e.key === 'Enter' && verifyOtp()}
              className="w-full bg-surface-2 border border-white/10 rounded-2xl outline-none focus:border-brand/60 px-4 py-3.5 text-center text-lg font-semibold tracking-[0.4em] text-white placeholder-slate-600 placeholder:tracking-normal placeholder:text-sm placeholder:font-normal transition-colors"
            />
            <button onClick={verifyOtp} disabled={verifying} className="btn-primary w-full justify-center py-3.5 text-[15px]">
              {verifying ? <Loader2 size={18} className="animate-spin" /> : 'Verify & sign in'}
            </button>
            <button onClick={requestOtp} disabled={sending} className="w-full text-center text-xs text-brand hover:underline disabled:opacity-50">
              {sending ? 'Sending…' : 'Resend code'}
            </button>
          </div>
        )}

        {/* Divider */}
        <div className="flex items-center gap-2.5 my-5">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs text-slate-500">or</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Google */}
        <button onClick={handleLogin} disabled={loading}
          className="w-full flex items-center justify-center gap-2.5 bg-white text-slate-900 font-semibold px-6 py-3.5 rounded-2xl text-sm shadow-xl hover:shadow-2xl transition-all disabled:opacity-70">
          {loading ? (
            <><Loader2 size={18} className="animate-spin" /> Waiting for sign-in…</>
          ) : (
            <>
              <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </>
          )}
        </button>

        <p className="text-center text-xs text-slate-500 leading-relaxed mt-6">
          By continuing you agree to our <span className="text-brand">Terms</span> &amp; <span className="text-brand">Privacy</span>
        </p>
      </motion.div>
    </div>
  );
}
