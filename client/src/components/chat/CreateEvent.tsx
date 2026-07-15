import { useState } from 'react';
import { X, Send, Loader2, Calendar, MapPin, Bell, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { eventsApi } from '../../services/api';

interface Props {
  groupId: string;
  onClose: () => void;
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)}
      className={clsx('w-11 h-6 rounded-full relative transition-colors shrink-0', on ? 'bg-brand' : 'bg-white/15')}>
      <span className={clsx('absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all', on ? 'left-[22px]' : 'left-0.5')} />
    </button>
  );
}

const REMINDERS = [
  { label: 'No reminder', val: null },
  { label: '15 minutes before', val: 15 },
  { label: '1 hour before', val: 60 },
  { label: '1 day before', val: 1440 },
];

/** Full-screen "Create event" composer (matches the reference screen). */
export default function CreateEvent({ groupId, onClose }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [useEnd, setUseEnd] = useState(false);
  const [endsAt, setEndsAt] = useState('');
  const [location, setLocation] = useState('');
  const [reminder, setReminder] = useState<number | null>(60);
  const [allowGuests, setAllowGuests] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) return toast.error('Add an event name');
    if (!startsAt) return toast.error('Pick a date & time');
    setSaving(true);
    try {
      await eventsApi.create({
        groupId,
        name: name.trim(),
        description: description.trim() || undefined,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: useEnd && endsAt ? new Date(endsAt).toISOString() : null,
        location: location.trim() || undefined,
        allowGuests,
        reminderMinutes: reminder,
      });
      toast.success('Event posted');
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create event');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] bg-surface flex flex-col">
      <div className="h-14 shrink-0 border-b border-white/10 glass-panel flex items-center px-3 gap-2"
        style={{ paddingTop: 'max(env(safe-area-inset-top),0px)', height: 'calc(3.5rem + env(safe-area-inset-top))' }}>
        <button onClick={onClose} className="btn-ghost p-1.5"><X size={18} /></button>
        <h1 className="text-base font-bold text-white">Create event</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-lg w-full mx-auto pb-28">
        <input className="w-full bg-transparent text-2xl font-bold text-white placeholder-slate-500 outline-none"
          placeholder="Event name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus />
        <textarea className="w-full bg-transparent text-sm text-slate-300 placeholder-slate-500 outline-none resize-none"
          placeholder="Description (optional)" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />

        <div className="border-t border-white/10 pt-4 space-y-3">
          <div className="flex items-center gap-3">
            <Calendar size={18} className="text-slate-400 shrink-0" />
            <input type="datetime-local" className="input flex-1" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </div>

          {useEnd ? (
            <div className="flex items-center gap-3">
              <span className="w-[18px] shrink-0" />
              <input type="datetime-local" className="input flex-1" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
              <button onClick={() => setUseEnd(false)} className="btn-ghost p-1.5 text-slate-500"><X size={14} /></button>
            </div>
          ) : (
            <button onClick={() => setUseEnd(true)} className="text-sm text-brand pl-[30px]">Add end time</button>
          )}

          <div className="flex items-center gap-3">
            <MapPin size={18} className="text-slate-400 shrink-0" />
            <input className="input flex-1" placeholder="Add location" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} />
          </div>
        </div>

        <div className="border-t border-white/10 pt-4 space-y-3">
          <div className="flex items-center gap-3">
            <Bell size={18} className="text-slate-400 shrink-0" />
            <select className="input flex-1" value={reminder ?? ''} onChange={(e) => setReminder(e.target.value === '' ? null : Number(e.target.value))}>
              {REMINDERS.map((r) => <option key={r.label} value={r.val ?? ''}>{r.label}</option>)}
            </select>
          </div>

          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <Users size={18} className="text-slate-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-white">Allow guests</p>
                <p className="text-xs text-slate-500">Let people bring one additional guest</p>
              </div>
            </div>
            <Toggle on={allowGuests} onChange={setAllowGuests} />
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 right-5">
        <button onClick={submit} disabled={saving}
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg,#e879f9,#a855f7)', boxShadow: '0 8px 24px rgba(232,121,249,0.5)' }}>
          {saving ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
        </button>
      </div>
    </motion.div>
  );
}
