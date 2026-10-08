import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { useAuth } from './hooks/useAuth';
import { useAuthStore } from './store/authStore';
import { useCallStore } from './store/callStore';
import { usePresenceStore } from './store/presenceStore';
import { useSocket } from './hooks/useSocket';
import { getSocket } from './hooks/useSocket';
import { usePushNotifications } from './hooks/usePushNotifications';
import { useNotificationStore } from './store/notificationStore';
import { CallRing } from './types';
import Layout from './components/layout/Layout';
import CallRingNotification from './components/call/CallRingNotification';
import toast from 'react-hot-toast';

// Route pages are code-split so each loads on demand instead of bloating the
// first paint. CallManager pulls in the heavy LiveKit SDK, so it is split too
// and only mounted while a call is active (see below).
const LandingPage = lazy(() => import('./pages/LandingPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const FeedPage = lazy(() => import('./pages/FeedPage'));
const GroupPage = lazy(() => import('./pages/GroupPage'));
const RoomPage = lazy(() => import('./pages/RoomPage'));
const DmPage = lazy(() => import('./pages/DmPage'));
const DmCallPage = lazy(() => import('./pages/DmCallPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const UserProfilePage = lazy(() => import('./pages/UserProfilePage'));
const DiscoverPage = lazy(() => import('./pages/DiscoverPage'));
const PeoplePage = lazy(() => import('./pages/PeoplePage'));
const ProfileSetup = lazy(() => import('./pages/ProfileSetup'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const CallManager = lazy(() => import('./components/call/CallManager'));

/** Full-screen fallback while a lazily-loaded page chunk is fetched. */
function PageLoader() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-2 border-brand border-t-transparent animate-spin" />
    </div>
  );
}

function AppRoutes() {
  useSocket();
  const { user, loading } = useAuth();
  usePushNotifications(!!user);
  const { setToken, fetchUser } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const addNotification = useNotificationStore((s) => s.addNotification);
  const [incomingCall, setIncomingCall] = useState<CallRing | null>(null);
  const leaveCall = useCallStore((s) => s.leaveCall);
  // Only mount CallManager (and pull in the LiveKit chunk) while a call is live.
  const activeCall = useCallStore((s) => s.call);

  // Clear any active call when the user logs out
  useEffect(() => {
    if (!user) leaveCall();
  }, [user, leaveCall]);

  // Keep the Android status bar in sync with the active theme: cream bar +
  // dark icons in Warm Dawn (light), warm-charcoal bar + light icons in Dusk
  // (dark). Re-runs whenever the theme is toggled (themechange event).
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const sync = () => {
      const dark = (document.documentElement.getAttribute('data-theme') || 'light') === 'dark';
      StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
      StatusBar.setBackgroundColor({ color: dark ? '#1b1714' : '#FBF7F2' }).catch(() => {});
      // Style.Dark = light icons (for a dark bar); Style.Light = dark icons.
      StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
    };
    sync();
    window.addEventListener('themechange', sync);
    return () => window.removeEventListener('themechange', sync);
  }, []);

  // Track the current path in a ref so the back-button handler below can be
  // registered exactly once. Re-registering it on every navigation used to
  // stack duplicate listeners, so a single back press fired navigate(-1)
  // multiple times and jumped back several screens at once.
  const pathRef = useRef(location.pathname);
  useEffect(() => { pathRef.current = location.pathname; }, [location.pathname]);

  // Handle Android hardware/gesture back button (registered once)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const ROOT_PATHS = ['/', '/dashboard'];
    let handle: { remove: () => void } | undefined;
    CapApp.addListener('backButton', () => {
      if (ROOT_PATHS.includes(pathRef.current)) {
        // At the root screen — move app to background (standard Android UX)
        CapApp.exitApp();
      } else {
        // Inside the app — go back one screen
        navigate(-1);
      }
    }).then((l) => { handle = l; });
    return () => { handle?.remove(); };
  }, []);

  // Handle deep links: gathering://auth?token=xxx (OAuth callback) and
  // gathering://call?groupId=x&roomId=y (Answer action on a call notification)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = CapApp.addListener('appUrlOpen', async (event) => {
      try {
        const url = new URL(event.url);
        if (url.hostname === 'auth') {
          const token = url.searchParams.get('token');
          if (token) {
            await setToken(token);
            try { await fetchUser(); } catch {}
            navigate('/dashboard', { replace: true });
          }
        } else if (url.hostname === 'call') {
          const groupId = url.searchParams.get('groupId');
          const roomId = url.searchParams.get('roomId');
          const threadId = url.searchParams.get('threadId');
          const type = url.searchParams.get('type') === 'audio' ? 'audio' : 'video';
          if (threadId) {
            navigate(`/dm/${threadId}/call?type=${type}`);
          } else if (groupId && roomId) {
            navigate(`/groups/${groupId}/rooms/${roomId}`);
          }
        }
      } catch (err) {
        console.error('Deep link parse error', err);
      }
    });
    return () => { listener.then((l) => l.remove()); };
  }, []);

  // Wire up global socket listeners
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !user) return;

    const handleNotification = (data: any) => {
      addNotification(data);
      if (data.type === 'poke') toast(data.message, { icon: '⚡', duration: 4000 });
      else if (data.type === 'approved') toast.success(data.message, { duration: 5000 });
      else if (data.type === 'apply') toast(data.message, { icon: '📋', duration: 5000 });
      else if (data.type === 'job') toast(data.message, { icon: '💼', duration: 4000 });
    };

    const handleCallRing = (data: CallRing) => {
      if (data.caller.id === user.id) return; // Don't ring yourself
      setIncomingCall(data);
    };

    // Caller hung up / call ended before we answered — stop the in-app ring.
    const handleCallCancel = (data: { roomId: string }) => {
      setIncomingCall((cur) => (cur && cur.roomId === data.roomId ? null : cur));
    };

    // "Available now" presence for my people.
    const handlePresence = (data: { userId: string; online: boolean }) => {
      usePresenceStore.getState().update(data.userId, data.online);
    };

    socket.on('notification', handleNotification);
    socket.on('call:ring', handleCallRing);
    socket.on('call:cancel', handleCallCancel);
    socket.on('presence:update', handlePresence);
    // Seed the current online set once connected.
    usePresenceStore.getState().fetch();
    return () => {
      socket.off('notification', handleNotification);
      socket.off('call:ring', handleCallRing);
      socket.off('call:cancel', handleCallCancel);
      socket.off('presence:update', handlePresence);
    };
  }, [user]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-brand border-t-transparent animate-spin" />
          <p className="text-muted text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <CallRingNotification ring={incomingCall} onDismiss={() => setIncomingCall(null)} />
      {user && activeCall && (
        <Suspense fallback={null}>
          <CallManager />
        </Suspense>
      )}
      <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={user ? <Navigate to={user.onboarded === false ? '/setup' : '/dashboard'} replace /> : <LandingPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        {user ? (
          user.onboarded === false ? (
            <>
              <Route path="/setup" element={<ProfileSetup />} />
              <Route path="*" element={<Navigate to="/setup" replace />} />
            </>
          ) : (
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/discover" element={<DiscoverPage />} />
              <Route path="/people" element={<PeoplePage />} />
              <Route path="/feed" element={<FeedPage />} />
              <Route path="/u/:userId" element={<UserProfilePage />} />
              <Route path="/groups/:groupId" element={<GroupPage />} />
              <Route path="/groups/:groupId/rooms/:roomId" element={<RoomPage />} />
              <Route path="/dm/:threadId" element={<DmPage />} />
              <Route path="/dm/:threadId/call" element={<DmCallPage />} />
            </Route>
          )
        ) : (
          <Route path="*" element={<Navigate to="/" replace />} />
        )}
      </Routes>
      </Suspense>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppRoutes />
    </BrowserRouter>
  );
}
