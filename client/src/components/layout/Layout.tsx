import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import BottomNav from './BottomNav';
import StatusSheet from '../status/StatusSheet';
import ContactsSheet from '../contacts/ContactsSheet';
import GroupSheet from '../groups/GroupSheet';

export default function Layout() {
  // The Join/Create group sheet lives here so the top-bar "+" can open it from
  // any screen. Fire `open-group-sheet` (optionally with detail.tab) to show it.
  const [sheet, setSheet] = useState<{ open: boolean; tab: 'join' | 'create' }>({ open: false, tab: 'join' });
  useEffect(() => {
    const onOpen = (e: Event) => {
      const tab = (e as CustomEvent).detail?.tab === 'create' ? 'create' : 'join';
      setSheet({ open: true, tab });
    };
    window.addEventListener('open-group-sheet', onOpen);
    return () => window.removeEventListener('open-group-sheet', onOpen);
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Navbar />
      <main className="flex-1 overflow-y-auto w-full">
        <Outlet />
      </main>
      <BottomNav />
      <StatusSheet />
      <ContactsSheet />
      <GroupSheet open={sheet.open} initialTab={sheet.tab} onClose={() => setSheet((s) => ({ ...s, open: false }))} />
    </div>
  );
}
