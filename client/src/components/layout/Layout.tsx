import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import BottomNav from './BottomNav';
import StatusSheet from '../status/StatusSheet';
import ContactsSheet from '../contacts/ContactsSheet';

export default function Layout() {
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Navbar />
      <main className="flex-1 overflow-y-auto w-full">
        <Outlet />
      </main>
      <BottomNav />
      <StatusSheet />
      <ContactsSheet />
    </div>
  );
}
