import { useEffect, useState } from 'react';
import { BarChart3, Check } from 'lucide-react';
import { getSocket } from '../../hooks/useSocket';
import { pollsApi } from '../../services/api';
import { Message, PollState } from '../../types';

/** A POLL message rendered inline in the chat: tap an option to vote, results
 *  update live for everyone via the `poll:update` socket event. */
export default function PollCard({ message, isOwn }: { message: Message; isOwn: boolean }) {
  const [poll, setPoll] = useState<PollState | null>(null);
  const socket = getSocket();

  useEffect(() => {
    let live = true;
    // Seed instantly from the message's JSON so it renders before the fetch.
    try {
      const def = JSON.parse(message.content);
      setPoll({
        messageId: message.id, question: def.question, options: def.options,
        multiple: !!def.multiple, hideVoters: !!def.hideVoters, endsAt: def.endsAt ?? null,
        counts: new Array(def.options.length).fill(0), voters: {}, myVotes: [], totalVoters: 0,
      });
    } catch { /* not a valid poll payload */ }
    pollsApi.get(message.id).then((r) => { if (live) setPoll(r.data); }).catch(() => {});
    return () => { live = false; };
  }, [message.id, message.content]);

  useEffect(() => {
    if (!socket) return;
    const onUpdate = (d: { messageId: string; poll: PollState }) => {
      if (d.messageId === message.id) setPoll(d.poll);
    };
    socket.on('poll:update', onUpdate);
    return () => { socket.off('poll:update', onUpdate); };
  }, [socket, message.id]);

  if (!poll) return null;
  const ended = !!poll.endsAt && new Date(poll.endsAt) < new Date();
  const total = poll.totalVoters || 0;

  const vote = (i: number) => {
    if (ended) return;
    pollsApi.vote(message.id, i).then((r) => setPoll(r.data)).catch(() => {});
  };

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className="w-full max-w-[85%] rounded-2xl border border-brand/25 bg-surface-2 p-3.5">
        <div className="flex items-center gap-1.5 mb-2 text-brand">
          <BarChart3 size={14} />
          <span className="text-[10px] font-bold tracking-[0.15em] uppercase">Poll{poll.multiple ? ' · multi' : ''}</span>
        </div>
        <p className="text-sm font-semibold text-white mb-3">{poll.question}</p>

        <div className="space-y-1.5">
          {poll.options.map((opt, i) => {
            const count = poll.counts[i] ?? 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            const chosen = poll.myVotes.includes(i);
            return (
              <button key={i} onClick={() => vote(i)} disabled={ended}
                className="relative w-full text-left rounded-xl overflow-hidden border border-white/10 disabled:cursor-default">
                <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-brand/30 to-accent/20 transition-all duration-300"
                  style={{ width: `${pct}%` }} />
                <div className="relative flex items-center gap-2 px-3 py-2">
                  <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${chosen ? 'bg-brand border-brand' : 'border-white/30'}`}>
                    {chosen && <Check size={11} className="text-white" />}
                  </span>
                  <span className="flex-1 text-sm text-white truncate">{opt}</span>
                  <span className="text-xs text-slate-300 tabular-nums shrink-0">{count}</span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between mt-2.5 text-[11px] text-slate-400">
          <span>{total} vote{total !== 1 ? 's' : ''}{poll.hideVoters ? ' · anonymous' : ''}</span>
          {poll.endsAt && (
            <span>{ended ? 'Ended' : `Ends ${new Date(poll.endsAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`}</span>
          )}
        </div>
      </div>
    </div>
  );
}
