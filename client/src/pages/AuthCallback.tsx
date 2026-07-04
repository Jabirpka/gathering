import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

/**
 * Set a short-lived cookie so the iOS PWA can pick up the token.
 *
 * On iOS, Google OAuth runs in regular Safari (the PWA can't stay in-context
 * when navigating to an external domain). Safari and the PWA share cookie
 * storage for the same origin, so a cookie is the only reliable bridge.
 * The authStore startup code reads and consumes this cookie immediately.
 */
function setAuthCookie(token: string) {
  const expires = new Date(Date.now() + 10 * 60 * 1000).toUTCString(); // 10 min TTL
  document.cookie = `gathering_auth=${encodeURIComponent(token)}; path=/; expires=${expires}; SameSite=Lax`;
}

export default function AuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setToken, fetchUser } = useAuthStore();

  useEffect(() => {
    const token = params.get('token');
    if (token) {
      setAuthCookie(token);   // bridge for iOS PWA
      setToken(token);
      fetchUser().then(() => navigate('/dashboard', { replace: true }));
    } else {
      navigate('/', { replace: true });
    }
  }, []);

  return (
    <div className="h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-brand border-t-transparent animate-spin" />
        <p className="text-slate-400 text-sm">Signing you in…</p>
      </div>
    </div>
  );
}
