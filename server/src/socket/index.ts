import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';
import { config } from '../config';
import { setupChatHandlers } from './chat';
import { sendCallPush, sendCallCancelPush, sendDmCallPush } from '../services/push';

export interface SocketUser {
  id: string;
  name: string;
  avatar?: string | null;
}

declare module 'socket.io' {
  interface Socket {
    user: SocketUser;
  }
}

let _io: Server;

export function getIO(): Server {
  if (!_io) throw new Error('Socket.io not initialized');
  return _io;
}

// Tracks live call rooms (roomId → groupId) so we can stop the ring on every
// callee's device the moment the call empties out — i.e. the caller hung up
// before anyone answered, or the last participant left.
const activeCallRooms = new Map<string, string>();

// Same idea for 1:1 DM calls, but keyed by roomId → [userAId, userBId] so we can
// cancel the ring on both people's devices the moment the DM call empties out.
const dmCallRooms = new Map<string, [string, string]>();

function socketsInRoom(io: Server, roomId: string): number {
  return io.sockets.adapter.rooms.get(`room:${roomId}`)?.size ?? 0;
}

/** Stop both DM participants' rings (in-app + push) once the DM call empties. */
async function cancelDmCallIfEmpty(io: Server, roomId: string) {
  const pair = dmCallRooms.get(roomId);
  if (!pair) return;
  if (socketsInRoom(io, roomId) > 0) return;

  dmCallRooms.delete(roomId);
  io.to(`user:${pair[0]}`).emit('call:cancel', { roomId });
  io.to(`user:${pair[1]}`).emit('call:cancel', { roomId });
  sendCallCancelPush(pair, roomId).catch(() => {});
}

/**
 * If a call room has no one left in it, tell everyone to stop ringing
 * (in-app via socket + on devices via a cancel push) and forget the room.
 */
async function cancelCallIfEmpty(io: Server, roomId: string) {
  const groupId = activeCallRooms.get(roomId);
  if (!groupId) return;
  if (socketsInRoom(io, roomId) > 0) return;

  activeCallRooms.delete(roomId);
  io.to(`group:${groupId}`).emit('call:cancel', { roomId, groupId });

  try {
    const members = await prisma.groupMember.findMany({
      where: { groupId, status: 'APPROVED' },
      select: { userId: true },
    });
    if (members.length > 0) {
      sendCallCancelPush(members.map((m) => m.userId), roomId).catch(() => {});
    }
  } catch {}
}

export function setupSocketHandlers(io: Server) {
  _io = io;
  // JWT auth middleware for sockets
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Unauthorized'));

    try {
      const payload = jwt.verify(token, config.jwtSecret) as { userId: string };
      const user = await prisma.user.findUnique({ where: { id: payload.userId } });
      if (!user) return next(new Error('User not found'));
      socket.user = { id: user.id, name: user.name, avatar: user.avatar };
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.user.name} (${socket.id})`);

    // Join personal room for direct events
    socket.join(`user:${socket.user.id}`);

    setupChatHandlers(io, socket);

    // Group room presence
    socket.on('group:join', async ({ groupId }: { groupId: string }) => {
      const member = await prisma.groupMember.findUnique({
        where: { userId_groupId: { userId: socket.user.id, groupId } },
      });
      if (!member || member.status !== 'APPROVED') return;

      socket.join(`group:${groupId}`);
      io.to(`group:${groupId}`).emit('group:presence', {
        userId: socket.user.id,
        name: socket.user.name,
        avatar: socket.user.avatar,
        online: true,
      });
    });

    socket.on('group:leave', ({ groupId }: { groupId: string }) => {
      socket.leave(`group:${groupId}`);
      io.to(`group:${groupId}`).emit('group:presence', {
        userId: socket.user.id,
        online: false,
      });
    });

    // Room presence (call rooms)
    socket.on('room:join', async ({ roomId, groupId }: { roomId: string; groupId?: string }) => {
      socket.join(`room:${roomId}`);
      socket.to(`room:${roomId}`).emit('room:user-joined', {
        userId: socket.user.id,
        name: socket.user.name,
        avatar: socket.user.avatar,
      });

      // Ring notification for call rooms
      if (groupId) {
        try {
          const room = await prisma.room.findUnique({ where: { id: roomId }, include: { group: { select: { name: true } } } });
          if (room && (room.type === 'VIDEO_CALL' || room.type === 'AUDIO_CALL')) {
            // Remember this is a live call so we can cancel the ring if it empties.
            activeCallRooms.set(roomId, groupId);
            io.to(`group:${groupId}`).emit('call:ring', {
              roomId,
              groupId,
              roomName: room.name,
              groupName: room.group.name,
              caller: { id: socket.user.id, name: socket.user.name, avatar: socket.user.avatar },
              type: room.type,
            });

            // Also push a ring notification to other members' devices so the
            // call rings even if they don't have the app open.
            const members = await prisma.groupMember.findMany({
              where: { groupId, status: 'APPROVED', userId: { not: socket.user.id } },
              select: { userId: true },
            });
            if (members.length > 0) {
              sendCallPush(members.map((m) => m.userId), {
                groupId,
                roomId,
                roomName: room.name,
                groupName: room.group.name,
                callerName: socket.user.name,
                callType: room.type,
              }).catch(() => {});
            }
          }
        } catch {}
      }
    });

    socket.on('room:leave', ({ roomId }: { roomId: string }) => {
      socket.leave(`room:${roomId}`);
      socket.to(`room:${roomId}`).emit('room:user-left', { userId: socket.user.id });
      // If that was the last person in the call, stop everyone else's ring.
      cancelCallIfEmpty(io, roomId).catch(() => {});
    });

    // DM (1:1) calls — a LiveKit room scoped to the thread. The first joiner is
    // the caller and rings the other participant; hanging up empties the room.
    socket.on('dmcall:join', async ({ threadId, type }: { threadId: string; type?: string }) => {
      const thread = await prisma.dmThread.findUnique({ where: { id: threadId } });
      if (!thread || (thread.userAId !== socket.user.id && thread.userBId !== socket.user.id)) return;
      const roomId = `dm-${threadId}`;
      const wasEmpty = socketsInRoom(io, roomId) === 0;
      socket.join(`room:${roomId}`);
      if (wasEmpty) {
        const otherId = thread.userAId === socket.user.id ? thread.userBId : thread.userAId;
        const callType = type === 'audio' ? 'AUDIO_CALL' : 'VIDEO_CALL';
        // Remember the pair so we can cancel the ring on both devices if it empties.
        dmCallRooms.set(roomId, [thread.userAId, thread.userBId]);
        io.to(`user:${otherId}`).emit('call:ring', {
          roomId,
          threadId,
          type: callType,
          roomName: type === 'audio' ? 'Voice call' : 'Video call',
          groupName: socket.user.name,
          caller: { id: socket.user.id, name: socket.user.name, avatar: socket.user.avatar },
        });
        // Ring the other person's device even if the app is closed/backgrounded.
        sendDmCallPush([otherId], {
          threadId,
          roomId,
          callerName: socket.user.name,
          callType,
        }).catch(() => {});
      }
    });

    socket.on('dmcall:leave', async ({ threadId }: { threadId: string }) => {
      const roomId = `dm-${threadId}`;
      socket.leave(`room:${roomId}`);
      socket.to(`room:${roomId}`).emit('room:user-left', { userId: socket.user.id });
      setImmediate(() => { cancelDmCallIfEmpty(io, roomId).catch(() => {}); });
    });

    // Emoji reactions
    socket.on('room:emoji', ({ roomId, emoji }: { roomId: string; emoji: string }) => {
      io.to(`room:${roomId}`).emit('room:emoji', {
        userId: socket.user.id,
        name: socket.user.name,
        avatar: socket.user.avatar,
        emoji,
      });
    });

    // PTT (Push to Talk / Walky-Talky)
    socket.on('room:ptt:chunk', ({ roomId, chunk }: { roomId: string; chunk: ArrayBuffer }) => {
      socket.to(`room:${roomId}`).emit('room:ptt:chunk', {
        userId: socket.user.id,
        name: socket.user.name,
        chunk,
      });
    });

    socket.on('room:ptt:start', ({ roomId }: { roomId: string }) => {
      socket.to(`room:${roomId}`).emit('room:ptt:start', {
        userId: socket.user.id,
        name: socket.user.name,
        avatar: socket.user.avatar,
      });
    });

    socket.on('room:ptt:end', ({ roomId }: { roomId: string }) => {
      socket.to(`room:${roomId}`).emit('room:ptt:end', { userId: socket.user.id });
    });

    // Captured while socket.rooms is still populated (it's cleared by the time
    // 'disconnect' fires), so we know which call rooms to re-check afterwards.
    socket.on('disconnecting', () => {
      const callRooms = [...socket.rooms]
        .filter((r) => r.startsWith('room:'))
        .map((r) => r.slice('room:'.length))
        .filter((roomId) => activeCallRooms.has(roomId) || dmCallRooms.has(roomId));
      if (callRooms.length === 0) return;
      // Defer until after socket.io has removed this socket from the rooms,
      // so the emptiness check reflects the disconnect.
      setImmediate(() => {
        callRooms.forEach((roomId) => {
          cancelCallIfEmpty(io, roomId).catch(() => {});
          cancelDmCallIfEmpty(io, roomId).catch(() => {});
        });
      });
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.user.name}`);
    });
  });
}
