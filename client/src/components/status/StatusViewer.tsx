import { useEffect, useState } from 'react';
import { X, Trash2, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { statusApi } from '../../services/api';
import { StatusGroup } from '../../types';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

interface Props {
  group: StatusGroup;
  isMine: boolean;
  onClose: () => void;
  onAddMore: () => void;
  onDeleted: () => void;
}

const STEP_MS = 5000;

/** Full-screen story viewer: progress bars per item, tap right/left to move. */
export default function StatusViewer({ group, isMine, onClose, onAddMore, onDeleted }: Props) {
  const [index, setIndex] = useState(0);
  const status = group.statuses[index];

  // Auto-advance every 5s; close after the last one.
  useEffect(() => {
    const t = setTimeout(() => {
      if (index < group.statuses.length - 1) setIndex(index + 1);
      else onClose();
    }, STEP_MS);
    return () => clearTimeout(t);
  }, [index, group.statuses.length]);

  const handleDelete = async () => {
    try {
      await statusApi.remove(status.id);
      toast.success('Status removed');
      onDeleted();
    } catch {
      toast.error('Failed to remove status');
    }
  };

  const tap = (e: React.MouseEvent) => {
    const x = e.clientX / window.innerWidth;
    if (x < 0.3) setIndex((i) => Math.max(0, i - 1));
    else if (index < group.statuses.length - 1) setIndex(index + 1);
    else onClose();
  };

  const name = group.user.nickname || group.user.name;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] bg-black flex flex-col" onClick={tap}>
      {/* Progress bars */}
      <div className="flex gap-1 p-2 pt-[max(env(safe-area-inset-top),0.5rem)]">
        {group.statuses.map((_, i) => (
          <div key={i} className="flex-1 h-1 rounded-full bg-white/25 overflow-hidden">
            <div
              className={`h-full bg-white ${i < index ? 'w-full' : i === index ? 'animate-status-progress' : 'w-0'}`}
              style={i === index ? { animationDuration: `${STEP_MS}ms` } : undefined}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 py-2" onClick={(e) => e.stopPropagation()}>
        {group.user.avatar ? (
          <img src={group.user.avatar} className="w-9 h-9 rounded-full object-cover" alt={name} />
        ) : (
          <div className="w-9 h-9 rounded-full bg-brand flex items-center justify-center text-sm font-bold text-white">
            {name[0]}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{isMine ? 'My status' : name}</p>
          <p className="text-[11px] text-white/60">
            {formatDistanceToNow(new Date(status.createdAt), { addSuffix: true })}
          </p>
        </div>
        {isMine && (
          <>
            <button onClick={onAddMore} className="p-2 text-white/80 hover:text-white" title="Add status">
              <Plus size={18} />
            </button>
            <button onClick={handleDelete} className="p-2 text-white/80 hover:text-red-400" title="Delete">
              <Trash2 size={16} />
            </button>
          </>
        )}
        <button onClick={onClose} className="p-2 text-white/80 hover:text-white">
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center overflow-hidden pb-[max(env(safe-area-inset-bottom),1rem)]">
        {status.kind === 'IMAGE' ? (
          <img src={status.content} className="max-h-full max-w-full object-contain" alt="Status" />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-8" style={{ background: status.bg || '#7c3aed' }}>
            <p className="text-white text-2xl font-semibold text-center leading-relaxed break-words max-w-lg">
              {status.content}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
