import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useGroupStore } from '../store/groupStore';
import { eventsApi } from '../services/api';
import { ScheduledEvent } from '../types';
import { Calendar, Plus, Trash2, ArrowLeft, Clock, MapPin, Loader2 } from 'lucide-react';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import MidpointMap from '../components/maps/MidpointMap';
import toast from 'react-hot-toast';

function EventCard({ event, onDelete }: { event: ScheduledEvent; onDelete: () => void }) {
  const past = isPast(new Date(event.scheduledAt));
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`card p-4 transition-colors ${past ? 'opacity-50' : 'hover:border-brand/20'}`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${past ? 'bg-slate-700' : 'bg-brand/15'}`}>
          <Calendar size={17} className={past ? 'text-slate-500' : 'text-brand-light'} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-white text-sm">{event.title}</h3>
            {past && <span className="badge bg-slate-700 text-slate-500 text-[10px]">Past</span>}
          </div>
          {event.description && <p className="text-xs text-slate-500 mb-2">{event.description}</p>}
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><Clock size={11} />{format(new Date(event.scheduledAt), 'MMM d, yyyy · h:mm a')}</span>
            {!past && <span className="text-brand-light">{formatDistanceToNow(new Date(event.scheduledAt), { addSuffix: true })}</span>}
          </div>

          {event.meetupData && (
            <button onClick={() => setExpanded(!expanded)} className="mt-2 text-xs text-brand-light hover:underline flex items-center gap-1">
              <MapPin size={11} />
              {expanded ? 'Hide' : 'View'} meetup details
            </button>
          )}
        </div>
        <button onClick={onDelete} className="text-slate-600 hover:text-red-400 transition-colors p-1">
          <Trash2 size={14} />
        </button>
      </div>

      <AnimatePresence>
        {expanded && event.meetupData && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="mt-4 pt-4 border-t border-white/5 overflow-hidden">
            <MidpointMap value={event.meetupData as any} readonly />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function CreateEventModal({ groupId, onCreated, onClose }: { groupId: string; onCreated: (e: ScheduledEvent) => void; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [meetupData, setMeetupData] = useState<any>(null);
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
        meetupData: meetupData || undefined,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative card w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="font-semibold text-white text-lg mb-5 flex items-center gap-2">
          <Calendar size={18} className="text-brand-light" />
          Schedule an Event
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">Title *</label>
            <input className="input" placeholder="Movie Night 🎬" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">Description</label>
            <textarea className="input resize-none" rows={2} placeholder="Details about this event…" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">Date & Time *</label>
            <input type="datetime-local" className="input" value={dateTime} onChange={(e) => setDateTime(e.target.value)} required min={new Date().toISOString().slice(0, 16)} />
          </div>

          <div className="card p-4">
            <MidpointMap onChange={setMeetupData} />
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
    <div className="p-6 max-w-3xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/groups/${groupId}`} className="btn-ghost p-1.5"><ArrowLeft size={15} /></Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">Schedule</h1>
          {activeGroup && <p className="text-sm text-slate-500">{activeGroup.name}</p>}
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus size={15} />
          New Event
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-brand" /></div>
      ) : events.length === 0 ? (
        <div className="card p-12 text-center">
          <Calendar size={40} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium mb-1">No events yet</p>
          <p className="text-slate-500 text-sm mb-4">Schedule watch parties, calls, or meetups.</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary mx-auto"><Plus size={15} />Schedule an event</button>
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
        <CreateEventModal
          groupId={groupId}
          onCreated={(e) => setEvents((prev) => [e, ...prev])}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
