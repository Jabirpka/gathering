import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Plus, Hash, Video, Headphones, Calendar, ChevronDown, ChevronRight, LogIn, X } from 'lucide-react';
import { useGroupStore } from '../../store/groupStore';
import { Group, Room } from '../../types';
import CreateGroupModal from '../groups/CreateGroupModal';
import JoinGroupModal from '../groups/JoinGroupModal';
import clsx from 'clsx';

function RoomIcon({ type }: { type: string }) {
  if (type === 'VIDEO_CALL') return <Video size={14} className="shrink-0" />;
  if (type === 'VIDEO_WATCH') return <Hash size={14} className="shrink-0" />;
  return <Headphones size={14} className="shrink-0" />;
}

function GroupItem({ group, onNavigate }: { group: Group; onNavigate: () => void }) {
  const { groupId, roomId } = useParams();
  const [open, setOpen] = useState(groupId === group.id);
  const navigate = useNavigate();

  return (
    <div className="mb-1">
      <button
        onClick={() => {
          setOpen((o) => !o);
          navigate(`/groups/${group.id}`);
          onNavigate();
        }}
        className={clsx(
          'w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-colors text-left',
          groupId === group.id
            ? 'bg-brand/10 text-white'
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
        )}
      >
        <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0">
          {group.avatar ? (
            <img src={group.avatar} className="w-full h-full object-cover" alt={group.name} />
          ) : (
            <div className="w-full h-full bg-brand/20 flex items-center justify-center text-[11px] font-bold text-brand-light">
              {group.name[0].toUpperCase()}
            </div>
          )}
        </div>
        <span className="flex-1 truncate font-medium">{group.name}</span>
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
      </button>

      {open && (
        <div className="mt-0.5 ml-3 pl-3 border-l border-white/5 space-y-0.5">
          {group.rooms?.map((room: Room) => (
            <Link
              key={room.id}
              to={`/groups/${group.id}/rooms/${room.id}`}
              onClick={onNavigate}
              className={clsx(
                'flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-colors',
                roomId === room.id
                  ? 'bg-brand/15 text-white'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
              )}
            >
              <RoomIcon type={room.type} />
              <span className="truncate">{room.name}</span>
            </Link>
          ))}
          <Link
            to={`/groups/${group.id}/schedule`}
            onClick={onNavigate}
            className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
          >
            <Calendar size={14} className="shrink-0" />
            <span>Schedule</span>
          </Link>
        </div>
      )}
    </div>
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
      <aside className="w-64 h-full border-r border-white/5 bg-surface-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-3 border-b border-white/5 flex items-center gap-1">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex-1 px-2">
            Groups
          </span>
          <button
            onClick={() => setShowJoin(true)}
            title="Join group"
            className="p-2 rounded-lg hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <LogIn size={14} />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            title="Create group"
            className="p-2 rounded-lg hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <Plus size={14} />
          </button>
          {/* Close button — mobile only */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors lg:hidden"
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
        <div className="p-3 border-t border-white/5">
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
