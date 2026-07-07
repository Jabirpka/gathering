import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { Contacts } from '@capacitor-community/contacts';
import { MessageSquare, UserPlus, Loader2, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { usersApi } from '../../services/api';
import { useDmStore } from '../../store/dmStore';
import { User } from '../../types';

interface DeviceContact { name: string; phone: string; }

const INVITE_TEXT = 'Join me on Gathering! https://gathering-client-six.vercel.app';
const norm = (p: string) => p.replace(/\D/g, '').slice(-10);

/**
 * People/Contacts screen: reads phone contacts (native), shows those already on
 * Gathering (tap to DM) on top, and the rest below with an Invite button.
 * Opened from the bottom-nav People button via the 'open-contacts' event.
 */
export default function ContactsSheet() {
  const navigate = useNavigate();
  const openThread = useDmStore((s) => s.openThread);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [registered, setRegistered] = useState<User[]>([]);
  const [invitees, setInvitees] = useState<DeviceContact[]>([]);

  const load = async () => {
    setRegistered([]); setInvitees([]); setMessage(null);
    if (!Capacitor.isNativePlatform()) {
      setMessage('Contact sync is available in the Gathering mobile app.');
      return;
    }
    setLoading(true);
    try {
      let perm = await Contacts.checkPermissions();
      if (perm.contacts !== 'granted') perm = await Contacts.requestPermissions();
      if (perm.contacts !== 'granted') {
        setMessage('Allow contacts access to find friends on Gathering.');
        return;
      }
      const { contacts } = await Contacts.getContacts({ projection: { name: true, phones: true } });
      const list: DeviceContact[] = [];
      for (const c of contacts as any[]) {
        const name = c?.name?.display || c?.name?.given || 'Unknown';
        for (const p of (c?.phones ?? [])) {
          if (p?.number) list.push({ name, phone: p.number });
        }
      }
      if (list.length === 0) { setMessage('No contacts with phone numbers found.'); return; }

      // Match against registered users, but don't lose the contact list if the
      // match endpoint is unavailable — still show everyone under "Invite".
      let matches: User[] = [];
      try {
        const res = await usersApi.matchContacts(list.map((c) => c.phone));
        matches = res.data.matches ?? [];
      } catch { /* matching unavailable */ }
      setRegistered(matches);

      const registeredNums = new Set(matches.map((m) => norm(m.phone ?? '')));
      const seen = new Set<string>();
      const invite: DeviceContact[] = [];
      for (const c of list) {
        const key = norm(c.phone);
        if (key.length < 7 || registeredNums.has(key) || seen.has(key)) continue;
        seen.add(key);
        invite.push(c);
      }
      setInvitees(invite);
      if (matches.length === 0 && invite.length === 0) setMessage('No contacts found.');
    } catch (err: any) {
      console.error('Contacts load failed', err);
      const detail = err?.message || err?.errorMessage || (typeof err === 'string' ? err : JSON.stringify(err));
      setMessage('Contacts error: ' + detail);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const onOpen = () => { setOpen(true); load(); };
    window.addEventListener('open-contacts', onOpen);
    return () => window.removeEventListener('open-contacts', onOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startDm = async (userId: string) => {
    try {
      const thread = await openThread(userId);
      setOpen(false);
      navigate(`/dm/${thread.id}`);
    } catch {
      toast.error('Could not open chat');
    }
  };

  const invite = async (phone?: string) => {
    try {
      if ((navigator as any).share) { await (navigator as any).share({ text: INVITE_TEXT }); return; }
    } catch { return; }
    if (phone && Capacitor.isNativePlatform()) {
      window.location.href = `sms:${phone}?body=${encodeURIComponent(INVITE_TEXT)}`;
      return;
    }
    try { await navigator.clipboard.writeText(INVITE_TEXT); toast.success('Invite copied'); } catch {}
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
            transition={{ type: 'spring', damping: 26, stiffness: 340 }}
            className="relative w-full max-w-sm glass-panel border border-white/10 rounded-2xl p-5 shadow-2xl max-h-[80vh] overflow-y-auto">
            <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2"><Users size={16} className="text-brand" /> People</h2>

            {loading ? (
              <div className="flex items-center justify-center py-8"><Loader2 size={22} className="animate-spin text-brand" /></div>
            ) : message ? (
              <p className="text-sm text-slate-400 text-center py-6">{message}</p>
            ) : (
              <>
                {registered.length > 0 && (
                  <>
                    <p className="text-[10px] font-bold tracking-[0.18em] text-slate-500 mb-2">ON GATHERING</p>
                    <div className="space-y-1 mb-4">
                      {registered.map((u) => (
                        <div key={u.id} className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-white/5 transition-colors">
                          {u.avatar ? (
                            <img src={u.avatar} className="w-10 h-10 rounded-xl object-cover shrink-0" alt="" />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-brand flex items-center justify-center text-sm font-bold text-white shrink-0">
                              {(u.nickname || u.name)[0]?.toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{u.nickname || u.name}</p>
                            {u.username && <p className="text-xs text-slate-400 truncate">@{u.username}</p>}
                          </div>
                          <button onClick={() => startDm(u.id)} title="Message"
                            className="w-9 h-9 rounded-full bg-brand-dim text-brand hover:bg-brand hover:text-white flex items-center justify-center transition-colors">
                            <MessageSquare size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {invitees.length > 0 && (
                  <>
                    <p className="text-[10px] font-bold tracking-[0.18em] text-slate-500 mb-2">INVITE TO GATHERING</p>
                    <div className="space-y-1">
                      {invitees.slice(0, 50).map((c, i) => (
                        <div key={c.phone + i} className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-white/5 transition-colors">
                          <div className="w-10 h-10 rounded-xl bg-surface-2 flex items-center justify-center text-sm font-bold text-slate-400 shrink-0">
                            {c.name[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-200 truncate">{c.name}</p>
                            <p className="text-xs text-slate-500 truncate">{c.phone}</p>
                          </div>
                          <button onClick={() => invite(c.phone)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-brand bg-brand-dim border border-brand/30 rounded-lg px-3 py-1.5 active:scale-95 transition-transform">
                            <UserPlus size={13} /> Invite
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
