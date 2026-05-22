import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useSocket } from './hooks/useSocket';
import { getSocket } from './hooks/useSocket';
import { useNotificationStore } from './store/notificationStore';
import { CallRing } from './types';
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';
import GroupPage from './pages/GroupPage';
import RoomPage from './pages/RoomPage';
import SchedulePage from './pages/SchedulePage';
import ProfilePage from './pages/ProfilePage';
import AuthCallback from './pages/AuthCallback';
import Layout from './components/layout/Layout';
import CallRingNotification from './components/call/CallRingNotification';
import toast from 'react-hot-toast';

function AppRoutes() {
  useSocket();
  const { user, loading } = useAuth();
  const addNotification = useNotificationStore((s) => s.addNotification);
  const [incomingCall, setIncomingCall] = useState<CallRing | null>(null);

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

    socket.on('notification', handleNotification);
    socket.on('call:ring', handleCallRing);
    return () => {
      socket.off('notification', handleNotification);
      socket.off('call:ring', handleCallRing);
    };
  }, [user]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-brand border-t-transparent animate-spin" />
          <p className="text-slate-400 text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <CallRingNotification ring={incomingCall} onDismiss={() => setIncomingCall(null)} />
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
