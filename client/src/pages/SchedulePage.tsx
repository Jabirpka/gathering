import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useGroupStore } from '../store/groupStore';
import { eventsApi } from '../services/api';
import { ScheduledEvent } from '../types';
import { Calendar, Plus, Trash2, ArrowLeft, Clock, Loader2 } from 'lucide-react';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

function EventCard({ event, onDelete }: { event: ScheduledEvent; onDelete: () => void }) {
  const past = isPast(new Date(event.scheduledAt));

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`card p-4 transition-colors ${past ? 'opacity-50' : 'hover:border-brand/20'}`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${past ? 'bg-surface-3' : 'bg-brand-dim'}`}>
          <Calendar size={17} className={past ? 'text-slate-400' : 'text-brand'} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-slate-900 text-sm">{event.title}</h3>
            {past && <span className="badge bg-surface-3 text-slate-500 text-[10px]">Past</span>}
          </div>
          {event.description && <p className="text-xs text-slate-500 mb-2">{event.description}</p>}
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><Clock size={11} />{format(new Date(event.scheduledAt), 'MMM d, yyyy · h:mm a')}</span>
            {!past && <span className="text-brand">{formatDistanceToNow(new Date(event.scheduledAt), { addSuffix: true })}</span>}
          </div>
        </div>
        <button onClick={onDelete} className="text-slate-400 hover:text-red-500 transition-colors p-2 -mr-1">
          <Trash2 size={14} />
        </button>
      </div>
    </motion.div>
  );
}

function CreateEventModal({ groupId, onCreated, onClose }: { groupId: string; onCreated: (e: ScheduledEvent) => void; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dateTime) return;
    setLoading(true);
    try {
      const res = await eventsApi.create(groupId, {
        title: title.trim(),
        description: description.trim() || undefined,
        scheduledAt: new Date(dateTime).toISOString(),
      });
      onCreated(res.data);
      toast.success('Event scheduled!');
      onClose();
    } catch {
      toast.error('Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative card w-full sm:max-w-lg p-5 sm:p-6 shadow-2xl rounded-b-none sm:rounded-2xl"
      >
        <h2 className="font-semibold text-slate-900 text-lg mb-5 flex items-center gap-2">
          <Calendar size={18} className="text-brand" />
          Schedule an Event
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1.5 block">Title *</label>
            <input className="input" placeholder="Movie Night 🎬" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1.5 block">Description</label>
            <textarea className="input resize-none" rows={2} placeholder="Details…" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1.5 block">Date & Time *</label>
            <input type="datetime-local" className="input" value={dateTime} onChange={(e) => setDateTime(e.target.value)} required min={new Date().toISOString().slice(0, 16)} />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={loading || !title.trim() || !dateTime} className="btn-primary flex-1 justify-center">
              {loading ? <Loader2 size={15} className="animate-spin" /> : 'Schedule'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default function SchedulePage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { activeGroup, fetchGroup } = useGroupStore();
  const [events, setEvents] = useState<ScheduledEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (groupId) {
      fetchGroup(groupId);
      eventsApi.list(groupId).then((res) => setEvents(res.data)).finally(() => setLoading(false));
    }
  }, [groupId]);

  const deleteEvent = async (id: string) => {
    try {
      await eventsApi.delete(id);
      setEvents((e) => e.filter((ev) => ev.id !== id));
      toast.success('Event removed');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const upcoming = events.filter((e) => !isPast(new Date(e.scheduledAt)));
  const past = events.filter((e) => isPast(new Date(e.scheduledAt)));

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/groups/${groupId}`} className="btn-ghost p-1.5"><ArrowLeft size={15} /></Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-900">Schedule</h1>
          {activeGroup && <p className="text-sm text-slate-500">{activeGroup.name}</p>}
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus size={15} />
          <span className="hidden sm:inline">New Event</span>
          <span className="sm:hidden">New</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-brand" /></div>
      ) : events.length === 0 ? (
        <div className="card p-12 text-center">
          <Calendar size={40} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium mb-1">No events yet</p>
          <p className="text-slate-400 text-sm mb-4">Schedule watch parties or group calls.</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary mx-auto"><Plus size={15} />Schedule event</button>
        </div>
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Calendar size={12} /> Upcoming ({upcoming.length})
              </h2>
              <AnimatePresence>
                <div className="space-y-3">
                  {upcoming.map((e) => <EventCard key={e.id} event={e} onDelete={() => deleteEvent(e.id)} />)}
                </div>
              </AnimatePresence>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Clock size={12} /> Past
              </h2>
              <div className="space-y-3">
                {past.map((e) => <EventCard key={e.id} event={e} onDelete={() => deleteEvent(e.id)} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {showCreate && groupId && (
        <CreateEventModal groupId={groupId} onCreated={(e) => setEvents((prev) => [e, ...prev])} onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}
