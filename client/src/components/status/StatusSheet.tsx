import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { statusApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { StatusGroup, StatusItem } from '../../types';
import AddStatusModal from './AddStatusModal';
import StatusViewer from './StatusViewer';

/** Per-person avatar/cover gradients (matches the imported design palette). */
const GRADS = [
  'linear-gradient(135deg,#f472b6,#a855f7)',
  'linear-gradient(135deg,#60a5fa,#7c3aed)',
  'linear-gradient(135deg,#34d399,#7c3aed)',
  'linear-gradient(135deg,#fbbf24,#a855f7)',
  'linear-gradient(135deg,#f87171,#a855f7)',
  'linear-gradient(135deg,#c084fc,#7c3aed)',
];
const TEXT_BG = 'linear-gradient(135deg,#1e1b3a,#3a1e5c)';

function hashCode(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
const gradFor = (id: string) => GRADS[hashCode(id) % GRADS.length];

/** Compact relative time, e.g. "2m ago", "1h ago". */
function shortAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface Card {
  key: string;
  group: StatusGroup | null; // null = my empty "Add status" card
  isMine: boolean;
  initial: string;
  avatarGrad: string;
  time: string;
  tilt: number;
  latest?: StatusItem;
}

/**
 * Status is reached from the bottom-nav Status button ('open-status'). Shows a
 * tappable stacked "polaroid deck": your card first, then everyone else's
 * updates. Tap the front card to view/add; ‹ › or swipe to cycle.
 */
export default function StatusSheet() {
  const user = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<StatusGroup[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [viewing, setViewing] = useState<StatusGroup | null>(null);
  const [spin, setSpin] = useState(0);

  const refresh = () => statusApi.list().then((res) => setGroups(res.data)).catch(() => {});

  useEffect(() => {
    const onOpen = () => { setOpen(true); setSpin(0); refresh(); };
    window.addEventListener('open-status', onOpen);
    return () => window.removeEventListener('open-status', onOpen);
  }, []);

  const mine = groups.find((g) => g.user.id === user?.id);
  const others = groups.filter((g) => g.user.id !== user?.id);
  const close = () => setOpen(false);

  const myInitial = (user?.nickname || user?.name || '?')[0]?.toUpperCase() ?? '?';
  const meLatest = mine?.statuses[mine.statuses.length - 1];
  const meCard: Card = {
    key: 'me',
    group: mine ?? null,
    isMine: true,
    initial: myInitial,
    avatarGrad: 'linear-gradient(135deg,#c084fc,#7c3aed)',
    time: mine && meLatest ? shortAgo(meLatest.createdAt) : 'Add status',
    tilt: 0,
    latest: meLatest,
  };
  const otherCards: Card[] = others.map((g) => {
    const latest = g.statuses[g.statuses.length - 1];
    return {
      key: g.user.id,
      group: g,
      isMine: false,
      initial: (g.user.nickname || g.user.name)[0]?.toUpperCase() ?? '?',
      avatarGrad: gradFor(g.user.id),
      time: latest ? shortAgo(latest.createdAt) : '',
      tilt: (hashCode(g.user.id) % 5) - 2 + 0.4,
      latest,
    };
  });
  const cards = [meCard, ...otherCards];
  const n = cards.length;

  const next = () => setSpin((s) => (s + 1) % n);
  const prev = () => setSpin((s) => (s - 1 + n) % n);
  const openCard = (c: Card) => {
    if (c.group) setViewing(c.group);
    else setShowAdd(true);
  };

  // Painted back-to-front so the front card wins z-order and gets the footer.
  const order: number[] = [];
  for (let i = 0; i < n; i++) order.push((spin + i) % n);
  const painted = order.slice().reverse().map((idx, depthFromBack) => {
    const depthFromFront = n - 1 - depthFromBack;
    return { card: cards[idx], depthFromFront };
  });

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
            onClick={close}
            style={{ background: 'radial-gradient(circle at 30% 0%, #2a1240 0%, #0d0616 55%, #06030c 100%)' }}
          >
            {/* soft glow blobs */}
            <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', background: '#7c3aed', opacity: 0.18, filter: 'blur(60px)', top: -60, left: -60 }} />
            <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', background: '#a855f7', opacity: 0.15, filter: 'blur(75px)', bottom: 120, right: -50 }} />

            {/* header */}
            <div className="absolute top-0 inset-x-0 flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),1rem)] pb-2 z-[110]"
              onClick={(e) => e.stopPropagation()}>
              <h2 className="text-white font-bold text-base">Status</h2>
              <button onClick={close} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white">
                <X size={18} />
              </button>
            </div>

            {/* deck */}
            <div className="absolute inset-0 flex items-center justify-center px-8" onClick={(e) => e.stopPropagation()}>
              <motion.div
                key={spin}
                className="relative w-full max-w-[400px]"
                style={{ height: '68vh' }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.15}
                onDragEnd={(_e, info) => { if (info.offset.x < -50) next(); else if (info.offset.x > 50) prev(); }}
              >
                {painted.map(({ card: c, depthFromFront }) => {
                  const offset = depthFromFront * 8;
                  const isFront = depthFromFront === 0;
                  const isImage = c.latest?.kind === 'IMAGE';
                  const isText = c.latest?.kind === 'TEXT';

                  const photoStyle: React.CSSProperties = {
                    flex: 1, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'rgba(255,255,255,0.9)', fontSize: 'clamp(84px,26vw,140px)', fontWeight: 800,
                    fontFamily: 'Georgia,serif', overflow: isText ? 'visible' : 'hidden', position: 'relative',
                  };
                  if (isImage) {
                    photoStyle.backgroundImage = `url(${c.latest!.content})`;
                    photoStyle.backgroundSize = 'cover';
                    photoStyle.backgroundPosition = 'center';
                  } else {
                    photoStyle.background = isText ? (c.latest?.bg || TEXT_BG) : c.avatarGrad;
                  }

                  return (
                    <div
                      key={c.key}
                      onClick={isFront ? (e) => { e.stopPropagation(); openCard(c); } : undefined}
                      style={{
                        position: 'absolute', left: 0, right: 0, top: offset, margin: 'auto',
                        width: '100%', height: '100%', background: '#fdfaf3', borderRadius: 8,
                        padding: '18px 18px 0', boxSizing: 'border-box',
                        boxShadow: `0 ${16 + offset}px ${40 + offset}px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)`,
                        transform: `rotate(${c.tilt}deg) scale(${1 - depthFromFront * 0.045})`,
                        opacity: depthFromFront > 3 ? 0 : 1 - depthFromFront * 0.14,
                        zIndex: 100 - depthFromFront,
                        transition: 'all 0.4s cubic-bezier(.22,1,.36,1)',
                        display: 'flex', flexDirection: 'column', overflow: isText ? 'visible' : 'hidden',
                        cursor: isFront ? 'pointer' : 'default',
                      }}
                    >
                      <div style={photoStyle}>
                        {isFront && isText && (
                          <div style={{
                            position: 'relative', transform: 'translateY(-14px) scale(1.06)',
                            textAlign: 'center', padding: '0 22px', color: '#fff', fontSize: 30, fontWeight: 800,
                            fontFamily: "'SF Pro Text',-apple-system,Inter,sans-serif", lineHeight: 1.3,
                            textShadow: '0 1px 0 #e9d5ff,0 2px 0 #d8b4fe,0 3px 0 #c084fc,0 4px 0 #a855f7,0 5px 0 #9333ea,0 6px 0 #7c1fd6,0 14px 24px rgba(0,0,0,0.55)',
                            filter: 'drop-shadow(0 10px 14px rgba(0,0,0,0.4))',
                          }}>{c.latest!.content}</div>
                        )}
                        {isFront && !isImage && !isText && c.initial}
                      </div>

                      {isFront && (
                        <div style={{ height: 70, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 6px' }}>
                          <div style={{ position: 'relative', width: 34, height: 34, borderRadius: '50%', background: c.avatarGrad, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13, boxShadow: '0 3px 8px rgba(0,0,0,0.3)' }}>
                            {c.initial}
                            {c.isMine && (
                              <div style={{ position: 'absolute', right: -3, bottom: -3, width: 16, height: 16, borderRadius: '50%', background: '#a855f7', border: '2px solid #fdfaf3', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, lineHeight: 1 }}>+</div>
                            )}
                          </div>
                          <div style={{ fontFamily: "'Segoe Print','Bradley Hand',cursive", color: '#3a2f28', fontSize: 14 }}>{c.time}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </motion.div>
            </div>

            {/* nav */}
            {n > 1 && (
              <div className="absolute inset-x-0 bottom-[max(env(safe-area-inset-bottom),1.25rem)] flex items-center justify-center gap-5 z-[110]"
                onClick={(e) => e.stopPropagation()}>
                <button onClick={prev} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white">
                  <ChevronLeft size={20} />
                </button>
                <span className="text-xs text-white/70 tabular-nums w-10 text-center">{spin + 1} / {n}</span>
                <button onClick={next} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white">
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AddStatusModal open={showAdd} onClose={() => setShowAdd(false)} onPosted={refresh} />
      {viewing && (
        <StatusViewer
          group={viewing}
          isMine={viewing.user.id === user?.id}
          onClose={() => setViewing(null)}
          onAddMore={() => { setViewing(null); setShowAdd(true); }}
          onDeleted={() => { setViewing(null); refresh(); }}
        />
      )}
    </>
  );
}
