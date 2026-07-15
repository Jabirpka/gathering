import { useEffect, useState } from 'react';
import { Calendar, MapPin, Check, HelpCircle, X as XIcon } from 'lucide-react';
import { getSocket } from '../../hooks/useSocket';
import { eventsApi } from '../../services/api';
import { Message, EventState } from '../../types';

const STATUSES = [
  { key: 'GOING', label: 'Going', icon: Check },
  { key: 'MAYBE', label: 'Maybe', icon: HelpCircle },
  { key: 'NO', label: "Can't", icon: XIcon },
] as const;

export default function EventCard({ message, isOwn }: { message: Message; isOwn: boolean }) {
  const [ev, setEv] = useState<EventState | null>(null);
  const socket = getSocket();

  useEffect(() => {
    let live = true;
    try {
      const def = JSON.parse(message.content);
      setEv({
        messageId: message.id, name: def.name, description: def.description || '', startsAt: def.startsAt,
        endsAt: def.endsAt ?? null, location: def.location || '', allowGuests: !!def.allowGuests,
        reminderMinutes: def.reminderMinutes ?? null,
        rsvps: { GOING: [], MAYBE: [], NO: [] }, myRsvp: null, goingCount: 0,
      });
    } catch { /* ignore */ }
    eventsApi.get(message.id).then((r) => { if (live) setEv(r.data); }).catch(() => {});
    return () => { live = false; };
  }, [message.id, message.content]);

  useEffect(() => {
    if (!socket) return;
    const onUpdate = (d: { messageId: string; event: EventState }) => { if (d.messageId === message.id) setEv(d.event); };
    socket.on('event:update', onUpdate);
    return () => { socket.off('event:update', onUpdate); };
  }, [socket, message.id]);

  if (!ev) return null;
  const when = new Date(ev.startsAt);
  const rsvp = (status: 'GOING' | 'MAYBE' | 'NO') => {
    const plusGuest = status === 'GOING' ? !!ev.myRsvp?.plusGuest : false;
    eventsApi.rsvp(message.id, status, plusGuest).then((r) => setEv(r.data)).catch(() => {});
  };
  const toggleGuest = () => {
    if (!ev.allowGuests || ev.myRsvp?.status !== 'GOING') return;
    eventsApi.rsvp(message.id, 'GOING', !ev.myRsvp.plusGuest).then((r) => setEv(r.data)).catch(() => {});
  };

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className="w-full max-w-[85%] rounded-2xl border border-brand/25 bg-surface-2 overflow-hidden">
        {/* date chip header */}
        <div className="flex items-center gap-3 p-3.5 border-b border-white/10">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand to-accent flex flex-col items-center justify-center text-white shrink-0 leading-none">
            <span className="text-[9px] font-bold uppercase">{when.toLocaleString([], { month: 'short' })}</span>
            <span className="text-base font-bold">{when.getDate()}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">{ev.name}</p>
            <p className="text-xs text-slate-400">
              {when.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
              {ev.endsAt && ` – ${new Date(ev.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
            </p>
          </div>
        </div>

        <div className="p-3.5 space-y-2.5">
          {ev.description && <p className="text-sm text-slate-300">{ev.description}</p>}
          {ev.location && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <MapPin size={13} className="text-brand shrink-0" /> {ev.location}
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Calendar size={13} className="text-brand shrink-0" />
            {ev.goingCount} going{ev.rsvps.MAYBE.length > 0 ? ` · ${ev.rsvps.MAYBE.length} maybe` : ''}
          </div>

          {/* RSVP buttons */}
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            {STATUSES.map(({ key, label, icon: Icon }) => {
              const active = ev.myRsvp?.status === key;
              return (
                <button key={key} onClick={() => rsvp(key)}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    active ? 'bg-gradient-to-br from-brand to-accent text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}>
                  <Icon size={13} /> {label}
                </button>
              );
            })}
          </div>

          {ev.allowGuests && ev.myRsvp?.status === 'GOING' && (
            <button onClick={toggleGuest} className="flex items-center gap-2 text-xs text-slate-300 pt-1">
              <span className={`w-4 h-4 rounded border flex items-center justify-center ${ev.myRsvp.plusGuest ? 'bg-brand border-brand' : 'border-white/30'}`}>
                {ev.myRsvp.plusGuest && <Check size={11} className="text-white" />}
              </span>
              Bringing a guest
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
