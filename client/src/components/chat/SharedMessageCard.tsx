import { useNavigate } from 'react-router-dom';
import { Newspaper, ChevronRight, UserCircle } from 'lucide-react';
import { Message } from '../../types';
import { kindDef } from '../../utils/feed';

/** Renders a shared feed post (kind POST) or a shared/applied profile (kind
 *  PROFILE) inside a chat. Tapping a post opens it in the feed; tapping a
 *  profile opens that user's profile. */
export default function SharedMessageCard({ message, isOwn }: { message: Message; isOwn: boolean }) {
  const navigate = useNavigate();
  let data: any = {};
  try { data = JSON.parse(message.content); } catch { /* ignore */ }

  if (message.kind === 'PROFILE') {
    return (
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
        <button onClick={() => data.userId && navigate(`/u/${data.userId}`)}
          className="w-full max-w-[80%] rounded-2xl border border-brand/25 bg-surface-2 p-3 flex items-center gap-3 text-left active:scale-[0.99] transition-transform">
          {data.avatar ? (
            <img src={data.avatar} className="w-11 h-11 rounded-xl object-cover shrink-0" alt="" />
          ) : (
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-accent to-brand flex items-center justify-center text-white shrink-0">
              <UserCircle size={22} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{data.name || 'Profile'}</p>
            {data.subtitle && <p className="text-xs text-brand truncate">{data.subtitle}</p>}
            {data.headline && <p className="text-[11px] text-slate-400 truncate">{data.headline}</p>}
          </div>
          <ChevronRight size={16} className="text-slate-500 shrink-0" />
        </button>
      </div>
    );
  }

  // kind POST
  const label = data.kind ? kindDef(data.kind).label : 'Post';
  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <button onClick={() => data.postId && navigate(`/feed?post=${data.postId}`)}
        className="w-full max-w-[80%] rounded-2xl border border-brand/25 bg-surface-2 overflow-hidden text-left active:scale-[0.99] transition-transform">
        {data.image && <img src={data.image} className="w-full h-32 object-cover" alt="" loading="lazy" />}
        <div className="p-3">
          <div className="flex items-center gap-1.5 mb-1 text-brand">
            <Newspaper size={12} />
            <span className="text-[10px] font-bold tracking-[0.15em] uppercase">{label}</span>
            {data.category && <span className="text-[10px] font-semibold text-slate-400 bg-white/5 px-1.5 py-0.5 rounded ml-auto">{data.category}</span>}
          </div>
          {data.title && <p className="text-sm font-bold text-white leading-snug">{data.title}</p>}
          {data.snippet && <p className="text-xs text-slate-300 line-clamp-2 mt-0.5">{data.snippet}</p>}
          <p className="text-[11px] text-brand mt-1.5 flex items-center gap-1">Open in feed <ChevronRight size={11} /></p>
        </div>
      </button>
    </div>
  );
}
