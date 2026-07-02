import { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { useAuth } from './hooks/useAuth';
import { useAuthStore } from './store/authStore';
import { useCallStore } from './store/callStore';
import { useSocket } from './hooks/useSocket';
import { getSocket } from './hooks/useSocket';
import { usePushNotifications } from './hooks/usePushNotifications';
import { useNotificationStore } from './store/notificationStore';
import { CallRing } from './types';
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';
import GroupPage from './pages/GroupPage';
import RoomPage from './pages/RoomPage';
import SchedulePage from './pages/SchedulePage';
import DmPage from './pages/DmPage';
import ProfilePage from './pages/ProfilePage';
import AuthCallback from './pages/AuthCallback';
import Layout from './components/layout/Layout';
import CallRingNotification from './components/call/CallRingNotification';
import CallManager from './components/call/CallManager';
import toast from 'react-hot-toast';

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

  // Clear any active call when the user logs out
  useEffect(() => {
    if (!user) leaveCall();
  }, [user, leaveCall]);

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
          if (groupId && roomId) {
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
    };

    const handleCallRing = (data: CallRing) => {
      if (data.caller.id === user.id) return; // Don't ring yourself
      setIncomingCall(data);
    };

    // Caller hung up / call ended before we answered — stop the in-app ring.
    const handleCallCancel = (data: { roomId: string }) => {
      setIncomingCall((cur) => (cur && cur.roomId === data.roomId ? null : cur));
    };

    socket.on('notification', handleNotification);
    socket.on('call:ring', handleCallRing);
    socket.on('call:cancel', handleCallCancel);
    return () => {
      socket.off('notification', handleNotification);
      socket.off('call:ring', handleCallRing);
      socket.off('call:cancel', handleCallCancel);
    };
  }, [user]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-brand border-t-transparent animate-spin" />
          <p className="text-slate-500 text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <CallRingNotification ring={incomingCall} onDismiss={() => setIncomingCall(null)} />
      {user && <CallManager />}
      <Routes>
        <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        {user ? (
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/groups/:groupId" element={<GroupPage />} />
            <Route path="/groups/:groupId/rooms/:roomId" element={<RoomPage />} />
            <Route path="/groups/:groupId/schedule" element={<SchedulePage />} />
            <Route path="/dm/:threadId" element={<DmPage />} />
          </Route>
        ) : (
          <Route path="*" element={<Navigate to="/" replace />} />
        )}
      </Routes>
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
