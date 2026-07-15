import { useEffect, useState } from 'react';
import { X, Trophy, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { quizzesApi } from '../../services/api';
import { LeaderboardEntry } from '../../types';

const MEDAL = ['🥇', '🥈', '🥉'];

/** The group's quiz points table (competition scoreboard). */
export default function Leaderboard({ groupId, onClose }: { groupId: string; onClose: () => void }) {
  const [rows, setRows] = useState<LeaderboardEntry[] | null>(null);

  useEffect(() => {
    quizzesApi.leaderboard(groupId).then((r) => setRows(r.data)).catch(() => setRows([]));
  }, [groupId]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
        transition={{ type: 'spring', damping: 26, stiffness: 340 }}
        className="relative w-full max-w-sm glass-panel border border-white/10 rounded-2xl shadow-2xl max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/10 shrink-0">
          <Trophy size={16} className="text-amber-300" />
          <h2 className="text-base font-bold text-white flex-1">Quiz leaderboard</h2>
          <button onClick={onClose} className="btn-ghost p-1"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {!rows ? (
            <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-brand" /></div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No quiz scores yet.<br />Answer a quiz to get on the board!</p>
          ) : (
            <div className="space-y-1">
              {rows.map((r, i) => (
                <div key={r.userId} className={`flex items-center gap-3 p-2 rounded-xl ${i < 3 ? 'bg-white/[0.06]' : ''}`}>
                  <span className="w-7 text-center text-sm font-bold text-slate-300 shrink-0">{MEDAL[i] ?? i + 1}</span>
                  {r.avatar ? (
                    <img src={r.avatar} className="w-9 h-9 rounded-xl object-cover shrink-0" alt="" />
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-brand flex items-center justify-center text-sm font-bold text-white shrink-0">
                      {r.name[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{r.name}</p>
                    <p className="text-[11px] text-slate-400">{r.correct}/{r.answered} correct</p>
                  </div>
                  <span className="text-sm font-bold text-brand shrink-0">{r.points} pts</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
