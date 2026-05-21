import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Plus, Hash, Video, Headphones, Users, Calendar, ChevronDown, ChevronRight, LogIn } from 'lucide-react';
import { useGroupStore } from '../../store/groupStore';
import { useEffect } from 'react';
import { Group, Room } from '../../types';
import CreateGroupModal from '../groups/CreateGroupModal';
import JoinGroupModal from '../groups/JoinGroupModal';
import clsx from 'clsx';

function RoomIcon({ type }: { type: string }) {
  if (type === 'VIDEO_CALL') return <Video size={14} className="shrink-0" />;
  if (type === 'VIDEO_WATCH') return <Hash size={14} className="shrink-0" />;
  return <Headphones size={14} className="shrink-0" />;
}

function GroupItem({ group }: { group: Group }) {
  const { groupId, roomId } = useParams();
  const [open, setOpen] = useState(groupId === group.id);
  const navigate = useNavigate();

  return (
    <div className="mb-1">
      <button
        onClick={() => { setOpen((o) => !o); navigate(`/groups/${group.id}`); }}
        className={clsx(
          'w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors text-left',
          groupId === group.id ? 'bg-brand/10 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
        )}
      >
        <div className="w-6 h-6 rounded-lg bg-brand/20 flex items-center justify-center text-[10px] font-bold text-brand-light shrink-0">
          {group.name[0].toUpperCase()}
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
              className={clsx(
                'flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors',
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
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
          >
            <Calendar size={14} className="shrink-0" />
            <span>Schedule</span>
          </Link>
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const { groups, fetchGroups } = useGroupStore();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  useEffect(() => { fetchGroups(); }, []);

  return (
    <>
      <aside className="w-56 shrink-0 border-r border-white/5 bg-surface-1 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-white/5">
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex-1 px-2">Groups</span>
            <button onClick={() => setShowJoin(true)} title="Join group" className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors">
              <LogIn size={14} />
            </button>
            <button onClick={() => setShowCreate(true)} title="Create group" className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors">
              <Plus size={14} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {groups.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <Users size={28} className="text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500">No groups yet.<br />Create or join one.</p>
            </div>
          ) : (
            groups.map((g) => <GroupItem key={g.id} group={g} />)
          )}
        </div>

        <div className="p-3 border-t border-white/5">
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary w-full justify-center text-sm py-2"
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
