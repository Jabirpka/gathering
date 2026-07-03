import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, LogIn, X } from 'lucide-react';
import { useGroupStore } from '../../store/groupStore';
import { Group } from '../../types';
import CreateGroupModal from '../groups/CreateGroupModal';
import JoinGroupModal from '../groups/JoinGroupModal';
import clsx from 'clsx';

// WhatsApp-style: a group IS its chat — one flat row, no room sub-links.
// Calls are started from the buttons inside the group screen.
function GroupItem({ group, onNavigate }: { group: Group; onNavigate: () => void }) {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const unread = useGroupStore((s) => s.unreadByGroup[group.id] ?? 0);

  return (
    <button
      onClick={() => {
        navigate(`/groups/${group.id}`);
        onNavigate();
      }}
      className={clsx(
        'w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-colors text-left mb-1',
        groupId === group.id
          ? 'bg-brand-dim text-brand'
          : 'text-slate-500 hover:text-slate-900 hover:bg-black/5'
      )}
    >
      <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0">
        {group.avatar ? (
          <img src={group.avatar} className="w-full h-full object-cover" alt={group.name} />
        ) : (
          <div className="w-full h-full bg-brand-dim flex items-center justify-center text-[11px] font-bold text-brand">
            {group.name[0].toUpperCase()}
          </div>
        )}
      </div>
      <span className="flex-1 truncate font-medium">{group.name}</span>
      {unread > 0 && (
        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center shrink-0">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  );
}

interface Props {
  onClose?: () => void;
}

export default function Sidebar({ onClose }: Props) {
  const { groups, fetchGroups } = useGroupStore();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  useEffect(() => { fetchGroups(); }, []);

  const handleNavigate = () => {
    onClose?.();
  };

  return (
    <>
      <aside className="w-64 h-full border-r border-white/50 glass-panel flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-3 border-b border-black/5 flex items-center gap-1">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex-1 px-2">
            Groups
          </span>
          <button
            onClick={() => setShowJoin(true)}
            title="Join group"
            className="p-2 rounded-lg hover:bg-black/5 text-slate-500 hover:text-slate-900 transition-colors"
          >
            <LogIn size={14} />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            title="Create group"
            className="p-2 rounded-lg hover:bg-black/5 text-slate-500 hover:text-slate-900 transition-colors"
          >
            <Plus size={14} />
          </button>
          {/* Close button — mobile only */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-black/5 text-slate-500 hover:text-slate-900 transition-colors lg:hidden"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Group list */}
        <div className="flex-1 overflow-y-auto p-2">
          {groups.length === 0 ? (
            <div className="px-3 py-10 text-center">
              <p className="text-xs text-slate-500">No groups yet.<br />Create or join one.</p>
            </div>
          ) : (
            groups.map((g) => (
              <GroupItem key={g.id} group={g} onNavigate={handleNavigate} />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-black/5">
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary w-full justify-center text-sm py-2.5"
          >
            <Plus size={15} />
            New Group
          </button>
        </div>
      </aside>

      <CreateGroupModal open={showCreate} onClose={() => setShowCreate(false)} />
      <JoinGroupModal open={showJoin} onClose={() => setShowJoin(false)} />
    </>
  );
}
