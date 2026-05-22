import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useSocket } from './hooks/useSocket';
import { getSocket } from './hooks/useSocket';
import { useNotificationStore } from './store/notificationStore';
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';
import GroupPage from './pages/GroupPage';
import RoomPage from './pages/RoomPage';
import SchedulePage from './pages/SchedulePage';
import ProfilePage from './pages/ProfilePage';
import AuthCallback from './pages/AuthCallback';
import Layout from './components/layout/Layout';
import toast from 'react-hot-toast';

function AppRoutes() {
  useSocket();
  const { user, loading } = useAuth();
  const addNotification = useNotificationStore((s) => s.addNotification);

  // Wire up global socket notification listener
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !user) return;

    const handler = (data: any) => {
      addNotification(data);
      // Also show a toast
      if (data.type === 'poke') {
        toast(data.message, { icon: '⚡', duration: 4000 });
      } else if (data.type === 'approved') {
        toast.success(data.message, { duration: 5000 });
      }
    };

    socket.on('notification', handler);
    return () => { socket.off('notification', handler); };
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
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppRoutes />
    </BrowserRouter>
  );
}
