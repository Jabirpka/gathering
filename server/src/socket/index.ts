import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';
import { config } from '../config';
import { setupChatHandlers } from './chat';
import { setupVideoSyncHandlers } from './videoSync';

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

export function setupSocketHandlers(io: Server) {
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
    setupVideoSyncHandlers(io, socket);

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

    // Room presence (video call / watch party rooms)
    socket.on('room:join', ({ roomId }: { roomId: string }) => {
      socket.join(`room:${roomId}`);
      socket.to(`room:${roomId}`).emit('room:user-joined', {
        userId: socket.user.id,
        name: socket.user.name,
        avatar: socket.user.avatar,
      });
    });

    socket.on('room:leave', ({ roomId }: { roomId: string }) => {
      socket.leave(`room:${roomId}`);
      socket.to(`room:${roomId}`).emit('room:user-left', {
        userId: socket.user.id,
      });
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.user.name}`);
    });
  });
}
