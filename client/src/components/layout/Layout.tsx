import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import BottomNav from './BottomNav';
import StatusSheet from '../status/StatusSheet';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Navbar onMenuClick={() => setSidebarOpen(true)} />
      <div className="flex flex-1 overflow-hidden relative">
        {/* Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-30"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        {/* Sidebar — drawer on all sizes (mobile-style layout everywhere) */}
        <div className={`
          fixed inset-y-0 left-0 z-40
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          flex-shrink-0
        `}>
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </div>
        <main className="flex-1 overflow-y-auto w-full">
          <Outlet />
        </main>
      </div>
      <BottomNav onOpenGroups={() => setSidebarOpen(true)} />
      <StatusSheet />
    </div>
  );
}
