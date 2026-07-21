import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Newspaper, ChevronRight, UserCircle, Heart, MessageCircle } from 'lucide-react';
import { Message, FeedPost } from '../../types';
import { feedApi } from '../../services/api';
import { kindDef } from '../../utils/feed';

/** Renders a shared feed post (kind POST) or a shared/applied profile (kind
 *  PROFILE) inside a chat. A shared post shows the FULL post; tapping opens it
 *  in the feed. A profile card opens that user's profile. */
export default function SharedMessageCard({ message, isOwn }: { message: Message; isOwn: boolean }) {
  const navigate = useNavigate();
  let data: any = {};
  try { data = JSON.parse(message.content); } catch { /* ignore */ }

  const [full, setFull] = useState<FeedPost | null>(null);
  useEffect(() => {
    if (message.kind !== 'POST' || !data.postId) return;
    let live = true;
    feedApi.get(data.postId).then((r) => { if (live) setFull(r.data); }).catch(() => {});
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.id]);

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

  // kind POST — show the full post, fall back to the stored preview if the
  // post can't be fetched (deleted, or server not yet updated).
  const kind = full?.kind ?? data.kind;
  const label = kind ? kindDef(kind).label : 'Post';
  const category = full?.category ?? data.category;
  const title = full?.title ?? data.title;
  const content = full?.content ?? data.snippet ?? '';
  const image = full?.image ?? data.image;
  const authorName = full ? (full.user.nickname || full.user.name) : data.authorName;
  const authorAvatar = full?.user.avatar;

  const open = () => data.postId && navigate(`/feed?post=${data.postId}`);

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className="w-full max-w-[85%] rounded-2xl border border-brand/25 bg-surface-2 overflow-hidden">
        {/* author + kind */}
        <div className="flex items-center gap-2 px-3 pt-3">
          {authorAvatar ? (
            <img src={authorAvatar} className="w-7 h-7 rounded-lg object-cover shrink-0" alt="" />
          ) : (
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-brand flex items-center justify-center text-[11px] font-bold text-white shrink-0">
              {(authorName || '?')[0]?.toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{authorName}</p>
            <p className="text-[10px] text-slate-500 flex items-center gap-1"><Newspaper size={10} /> {label}</p>
          </div>
          {category && <span className="text-[10px] font-semibold text-brand bg-brand-dim px-1.5 py-0.5 rounded shrink-0">{category}</span>}
        </div>

        <button onClick={open} className="w-full text-left active:opacity-90 transition-opacity">
          <div className="px-3 pt-2 pb-1">
            {title && <p className="text-sm font-bold text-white leading-snug mb-1">{title}</p>}
            {content && <p className="text-sm text-slate-200 whitespace-pre-wrap break-words">{content}</p>}
          </div>
          {image && <img src={image} className="w-full max-h-72 object-cover mt-1" alt="" loading="lazy" />}
          <div className="flex items-center gap-3 px-3 py-2 text-[11px] text-slate-500">
            {full && <><span className="flex items-center gap-1"><Heart size={12} /> {full.likeCount}</span>
              <span className="flex items-center gap-1"><MessageCircle size={12} /> {full.commentCount}</span></>}
            <span className="ml-auto flex items-center gap-1 text-brand font-semibold">Open in feed <ChevronRight size={11} /></span>
          </div>
        </button>
      </div>
    </div>
  );
}
