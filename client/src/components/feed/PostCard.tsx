import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, Trash2, MapPin, Calendar, Send, X, Check, Loader2, MessageSquare, Share2, HelpCircle, UserCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { feedApi } from '../../services/api';
import { useDmStore } from '../../store/dmStore';
import { FeedPost, FeedComment } from '../../types';
import { kindDef, postAge } from '../../utils/feed';
import ShareSheet from './ShareSheet';

const RSVP = [
  { i: 0, label: 'Going', icon: Check },
  { i: 1, label: 'Maybe', icon: HelpCircle },
  { i: 2, label: "Can't", icon: X },
] as const;

function CommentsSheet({ post, onClose, onCount }: { post: FeedPost; onClose: () => void; onCount: (n: number) => void }) {
  const [comments, setComments] = useState<FeedComment[] | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    feedApi.comments(post.id).then((r) => setComments(r.data)).catch(() => setComments([]));
  }, [post.id]);

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      const res = await feedApi.addComment(post.id, t);
      setComments((c) => [...(c ?? []), res.data]);
      onCount((comments?.length ?? 0) + 1);
      setText('');
    } catch {
      toast.error('Could not comment');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
        className="relative w-full sm:max-w-md glass-panel border-t sm:border border-white/10 rounded-t-[24px] sm:rounded-2xl max-h-[75vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <span className="text-sm font-semibold text-white">
            {post.kind === 'QUESTION' ? 'Answers' : 'Comments'}
          </span>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={15} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[160px]">
          {!comments ? (
            <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-brand" /></div>
          ) : comments.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">
              {post.kind === 'QUESTION' ? 'No answers yet — be the first!' : 'No comments yet.'}
            </p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex items-start gap-2.5">
                {c.user.avatar ? (
                  <img src={c.user.avatar} className="w-7 h-7 rounded-lg object-cover shrink-0" alt="" />
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-brand-dim flex items-center justify-center text-[10px] font-bold text-brand shrink-0">
                    {(c.user.nickname || c.user.name)[0]}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-200">{c.user.nickname || c.user.name}</span> · {postAge(c.createdAt)}
                  </p>
                  <p className="text-sm text-slate-200 whitespace-pre-wrap break-words">{c.content}</p>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="p-3 border-t border-white/10 shrink-0 flex gap-2 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
          <input className="input flex-1 text-sm" placeholder={post.kind === 'QUESTION' ? 'Write an answer…' : 'Write a comment…'}
            value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }} maxLength={500} />
          <button onClick={send} disabled={sending || !text.trim()}
            className="w-10 h-10 rounded-xl bg-brand disabled:opacity-50 flex items-center justify-center text-white shrink-0">
            <Send size={15} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/** One feed post — layout varies by kind; likes/comments/votes inline. */
export default function PostCard({ post, myId, onDeleted }: { post: FeedPost; myId?: string; onDeleted: (id: string) => void }) {
  const navigate = useNavigate();
  const openThread = useDmStore((s) => s.openThread);
  const [p, setP] = useState(post);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [applying, setApplying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const def = kindDef(p.kind);
  const isOwn = p.user.id === myId;
  const authorName = p.user.nickname || p.user.name;

  const like = () => {
    // Optimistic toggle; reconcile with the server's count.
    setP((c) => ({ ...c, likedByMe: !c.likedByMe, likeCount: c.likeCount + (c.likedByMe ? -1 : 1) }));
    feedApi.like(p.id).then((r) => setP((c) => ({ ...c, likedByMe: r.data.liked, likeCount: r.data.likeCount }))).catch(() => {});
  };

  const vote = (i: number) => {
    feedApi.vote(p.id, i).then((r) => setP((c) => ({ ...c, pollCounts: r.data.pollCounts, myVote: r.data.myVote }))).catch(() => {});
  };

  const remove = async () => {
    if (!window.confirm('Delete this post?')) return;
    try {
      await feedApi.remove(p.id);
      onDeleted(p.id);
    } catch {
      toast.error('Could not delete');
    }
  };

  const message = async () => {
    try {
      const thread = await openThread(p.user.id);
      navigate(`/dm/${thread.id}`);
    } catch {
      toast.error('Could not open chat');
    }
  };

  // Apply to a hiring post — auto-sends my profile to the poster's DM.
  const apply = async () => {
    if (applying) return;
    setApplying(true);
    try {
      const res = await feedApi.apply(p.id);
      toast.success('Application sent — your profile was shared');
      navigate(`/dm/${res.data.threadId}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Could not apply');
    } finally {
      setApplying(false);
    }
  };

  const options: string[] = (p.extra?.options ?? []) as string[];
  const counts = p.pollCounts ?? {};
  const totalVotes = Object.values(counts).reduce((a, b) => a + b, 0);
  const longText = p.content.length > 300;
  const isJob = p.kind === 'JOB_FIND' || p.kind === 'JOB_HUNT';

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3.5 pt-3">
        <button onClick={() => navigate(`/u/${p.user.id}`)} className="shrink-0">
          {p.user.avatar ? (
            <img src={p.user.avatar} className="w-9 h-9 rounded-xl object-cover" alt={authorName} />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-brand flex items-center justify-center text-sm font-bold text-white">
              {authorName[0]?.toUpperCase()}
            </div>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{authorName}</p>
          <p className="text-[11px] text-slate-500">{def.emoji} {def.label} · {postAge(p.createdAt)}</p>
        </div>
        <span className="text-[10px] font-semibold text-brand bg-brand-dim px-2 py-1 rounded-lg shrink-0">{p.category}</span>
        {isOwn && (
          <button onClick={remove} className="btn-ghost p-1.5 text-slate-500 hover:text-red-400 shrink-0" title="Delete">
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="px-3.5 pt-2.5 pb-1 space-y-2">
        {isJob && (
          <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
            p.kind === 'JOB_FIND' ? 'text-emerald-400 bg-emerald-500/10' : 'text-sky-400 bg-sky-500/10'
          }`}>
            {p.kind === 'JOB_FIND' ? '💼 Hiring' : '🔍 Looking for work'}
          </span>
        )}
        {p.title && <p className="text-[15px] font-bold text-white leading-snug">{p.title}</p>}
        {p.content && (
          <p className={`text-sm text-slate-200 whitespace-pre-wrap break-words ${!expanded && longText ? 'line-clamp-5' : ''}`}>
            {p.content}
          </p>
        )}
        {longText && (
          <button onClick={() => setExpanded((v) => !v)} className="text-xs text-brand font-semibold">
            {expanded ? 'Show less' : 'Read more'}
          </button>
        )}

        {/* Event details */}
        {p.kind === 'EVENT' && (p.extra?.when || p.extra?.location) && (
          <div className="space-y-1 text-xs text-slate-300">
            {p.extra?.when && (
              <p className="flex items-center gap-1.5"><Calendar size={12} className="text-brand" />
                {new Date(p.extra.when).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            {p.extra?.location && <p className="flex items-center gap-1.5"><MapPin size={12} className="text-brand" /> {p.extra.location}</p>}
          </div>
        )}

        {/* Event RSVP — attending / maybe / can't */}
        {p.kind === 'EVENT' && (
          <div className="pt-1">
            <div className="grid grid-cols-3 gap-1.5">
              {RSVP.map(({ i, label, icon: Icon }) => {
                const active = p.myVote === i;
                const n = counts[i] ?? 0;
                return (
                  <button key={i} onClick={() => vote(i)}
                    className={`flex flex-col items-center gap-0.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                      active ? 'bg-gradient-to-br from-brand to-accent text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}>
                    <span className="flex items-center gap-1"><Icon size={13} /> {label}</span>
                    {n > 0 && <span className={`text-[10px] ${active ? 'text-white/80' : 'text-slate-500'}`}>{n}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Job details */}
        {isJob && p.extra && (
          <div className="flex flex-wrap gap-1.5">
            {['company', 'location', 'salary', 'experience'].map((k) =>
              p.extra?.[k] ? (
                <span key={k} className="text-[11px] text-slate-300 bg-white/5 border border-white/10 rounded-lg px-2 py-0.5">{p.extra[k]}</span>
              ) : null
            )}
          </div>
        )}

        {/* Poll options */}
        {p.kind === 'POLL' && options.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {options.map((opt, i) => {
              const n = counts[i] ?? 0;
              const pct = totalVotes > 0 ? Math.round((n / totalVotes) * 100) : 0;
              const mine = p.myVote === i;
              return (
                <button key={i} onClick={() => vote(i)}
                  className="relative w-full text-left rounded-xl overflow-hidden border border-white/10">
                  <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-brand/30 to-accent/20 transition-all duration-300" style={{ width: `${pct}%` }} />
                  <div className="relative flex items-center gap-2 px-3 py-2">
                    <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${mine ? 'bg-brand border-brand' : 'border-white/30'}`}>
                      {mine && <Check size={11} className="text-white" />}
                    </span>
                    <span className="flex-1 text-sm text-white truncate">{opt}</span>
                    <span className="text-xs text-slate-400 tabular-nums shrink-0">{n}</span>
                  </div>
                </button>
              );
            })}
            <p className="text-[11px] text-slate-500">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</p>
          </div>
        )}
      </div>

      {/* Image */}
      {p.image && (
        <img src={p.image} className="w-full max-h-[420px] object-cover mt-1" alt="" loading="lazy" />
      )}

      {/* Footer */}
      <div className="flex items-center gap-1 px-2 py-1.5">
        <button onClick={like}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm transition-colors ${p.likedByMe ? 'text-brand' : 'text-slate-400 hover:text-white'}`}>
          <Heart size={17} fill={p.likedByMe ? 'currentColor' : 'none'} />
          <span className="tabular-nums">{p.likeCount > 0 ? p.likeCount : ''}</span>
        </button>
        <button onClick={() => setShowComments(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-slate-400 hover:text-white transition-colors">
          <MessageCircle size={17} />
          <span className="tabular-nums">{p.commentCount > 0 ? p.commentCount : ''}</span>
        </button>
        <button onClick={() => setShowShare(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-slate-400 hover:text-white transition-colors" title="Share">
          <Share2 size={17} />
        </button>
        <div className="flex-1" />
        {!isOwn && p.kind === 'JOB_FIND' && (
          <button onClick={apply} disabled={applying}
            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-gradient-to-br from-brand to-accent rounded-lg px-3 py-1.5 active:scale-95 transition-transform disabled:opacity-60">
            {applying ? <Loader2 size={13} className="animate-spin" /> : <UserCheck size={13} />} Apply
          </button>
        )}
        {!isOwn && p.kind === 'JOB_HUNT' && (
          <button onClick={message}
            className="flex items-center gap-1.5 text-xs font-semibold text-brand bg-brand-dim border border-brand/30 rounded-lg px-3 py-1.5 active:scale-95 transition-transform">
            <MessageSquare size={13} /> Message
          </button>
        )}
      </div>

      <AnimatePresence>
        {showComments && (
          <CommentsSheet post={p} onClose={() => setShowComments(false)}
            onCount={(n) => setP((c) => ({ ...c, commentCount: n }))} />
        )}
        {showShare && <ShareSheet postId={p.id} onClose={() => setShowShare(false)} />}
      </AnimatePresence>
    </div>
  );
}
