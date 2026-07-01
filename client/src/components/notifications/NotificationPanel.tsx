import { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotificationStore } from '../../store/notificationStore';
import { Bell, Zap, CheckCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { AppNotification } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
}

function NotifIcon({ type }: { type: AppNotification['type'] }) {
  if (type === 'poke') return <Zap size={14} className="text-amber-600" />;
  if (type === 'approved') return <CheckCircle size={14} className="text-emerald-600" />;
  return <Bell size={14} className="text-brand" />;
}

export default function NotificationPanel({ open, onClose }: Props) {
  const { notifications, markAllRead, clear } = useNotificationStore();
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) markAllRead();
  }, [open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, scale: 0.95, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -8 }}
          transition={{ duration: 0.15 }}
          className="absolute top-12 right-0 w-80 card shadow-2xl z-50 overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-black/5">
            <span className="text-sm font-semibold text-slate-900">Notifications</span>
            <div className="flex items-center gap-1">
              {notifications.length > 0 && (
                <button onClick={clear} className="text-xs text-slate-500 hover:text-slate-900 px-2 py-1 rounded">
                  Clear all
                </button>
              )}
              <button onClick={onClose} className="btn-ghost p-1">
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell size={28} className="text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => {
                    if (n.groupId) { navigate(`/groups/${n.groupId}`); onClose(); }
                  }}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-black/5 last:border-0 transition-colors ${n.groupId ? 'cursor-pointer hover:bg-black/5' : ''} ${!n.read ? 'bg-brand/5' : ''}`}
                >
                  <div className="w-8 h-8 rounded-full bg-surface-3 flex items-center justify-center shrink-0 mt-0.5">
                    {n.from?.avatar ? (
                      <img src={n.from.avatar} className="w-8 h-8 rounded-full object-cover" alt="" />
                    ) : (
                      <NotifIcon type={n.type} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700">{n.message}</p>
                    {n.type === 'poke' && n.strikePoints !== undefined && (
                      <p className="text-xs text-amber-600 mt-0.5">
                        You now have {n.strikePoints} strike point{n.strikePoints !== 1 ? 's' : ''}
                      </p>
                    )}
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
