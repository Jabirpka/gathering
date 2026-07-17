import { useEffect, useState } from 'react';
import { Loader2, Newspaper, Plus, RefreshCw } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { feedApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { FeedPost } from '../types';
import { FEED_CATEGORIES } from '../utils/feed';
import PostCard from '../components/feed/PostCard';
import CreatePostModal from '../components/feed/CreatePostModal';
import clsx from 'clsx';

const CATS = ['All', ...FEED_CATEGORIES];

/** The social feed: every post type in one stream, filterable by category. */
export default function FeedPage() {
  const myId = useAuthStore((s) => s.user?.id);
  const [cat, setCat] = useState('All');
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const load = (category: string) => {
    setLoading(true);
    feedApi.list({ category })
      .then((res) => { setPosts(res.data); setHasMore(res.data.length >= 20); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(cat); }, [cat]);

  const loadMore = () => {
    const last = posts[posts.length - 1];
    if (!last || loadingMore) return;
    setLoadingMore(true);
    feedApi.list({ category: cat, cursor: last.createdAt })
      .then((res) => {
        setPosts((cur) => [...cur, ...res.data]);
        setHasMore(res.data.length >= 20);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Category filter */}
      <div className="shrink-0 px-3 py-2.5 border-b border-white/10 flex items-center gap-2">
        <div className="flex-1 flex gap-2 overflow-x-auto -mx-1 px-1">
          {CATS.map((c) => (
            <button key={c} onClick={() => setCat(c)}
              className={clsx('shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
                cat === c ? 'bg-gradient-to-br from-brand to-accent text-white' : 'bg-surface-2 border border-white/10 text-slate-400')}>
              {c}
            </button>
          ))}
        </div>
        <button onClick={() => load(cat)} className="btn-ghost p-2 shrink-0" title="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Posts */}
      <div className="flex-1 overflow-y-auto p-3 pb-32">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin text-brand" /></div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16">
            <Newspaper size={36} className="text-slate-600 mx-auto mb-3" />
            <p className="text-slate-300 font-medium">Nothing here yet</p>
            <p className="text-slate-500 text-sm mb-4">Be the first to post something{cat !== 'All' ? ` in ${cat}` : ''}.</p>
            <button onClick={() => setShowCreate(true)} className="btn-primary mx-auto"><Plus size={15} /> Create post</button>
          </div>
        ) : (
          <div className="space-y-3 max-w-lg mx-auto">
            {posts.map((p) => (
              <PostCard key={p.id} post={p} myId={myId}
                onDeleted={(id) => setPosts((cur) => cur.filter((x) => x.id !== id))} />
            ))}
            {hasMore && (
              <button onClick={loadMore} disabled={loadingMore}
                className="w-full py-3 rounded-2xl bg-surface-2 border border-white/10 text-sm font-semibold text-slate-300 flex items-center justify-center gap-2">
                {loadingMore ? <Loader2 size={15} className="animate-spin" /> : 'Load more'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Compose FAB — sits above the bottom nav */}
      <button onClick={() => setShowCreate(true)}
        className="fixed right-4 z-40 w-14 h-14 rounded-2xl flex items-center justify-center text-white"
        style={{
          bottom: 'calc(max(env(safe-area-inset-bottom), 0.5rem) + 4.5rem)',
          background: 'linear-gradient(135deg,#e879f9,#a855f7)',
          boxShadow: '0 8px 24px rgba(232,121,249,0.5)',
        }}
        title="Create post">
        <Plus size={26} />
      </button>

      <AnimatePresence>
        {showCreate && (
          <CreatePostModal onClose={() => setShowCreate(false)}
            onPosted={(post) => setPosts((cur) => [post, ...cur])} />
        )}
      </AnimatePresence>
    </div>
  );
}
