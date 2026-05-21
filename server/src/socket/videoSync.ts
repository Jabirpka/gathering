import { Server, Socket } from 'socket.io';
import { prisma } from '../index';

export function setupVideoSyncHandlers(io: Server, socket: Socket) {
  // Host starts or updates a video session
  socket.on(
    'video:start',
    async ({
      roomId,
      groupId,
      videoUrl,
      title,
    }: {
      roomId: string;
      groupId: string;
      videoUrl: string;
      title: string;
    }) => {
      try {
        const member = await prisma.groupMember.findUnique({
          where: { userId_groupId: { userId: socket.user.id, groupId } },
        });
        if (!member || member.status !== 'APPROVED') return;

        // Deactivate any existing active sessions in this room
        await prisma.videoSession.updateMany({
          where: { roomId, isActive: true },
          data: { isActive: false },
        });

        const session = await prisma.videoSession.create({
          data: {
            groupId,
            roomId,
            videoUrl,
            title,
            hostId: socket.user.id,
            isActive: true,
            isPlaying: false,
            currentTime: 0,
          },
        });

        io.to(`room:${roomId}`).emit('video:started', {
          session,
          host: { id: socket.user.id, name: socket.user.name },
        });
      } catch {
        socket.emit('video:error', { error: 'Failed to start session' });
      }
    }
  );

  // Host sends play/pause/seek commands — broadcast to all room participants
  socket.on(
    'video:sync',
    async ({
      sessionId,
      roomId,
      action,
      currentTime,
    }: {
      sessionId: string;
      roomId: string;
      action: 'play' | 'pause' | 'seek';
      currentTime: number;
    }) => {
      try {
        const session = await prisma.videoSession.findUnique({ where: { id: sessionId } });
        if (!session || session.hostId !== socket.user.id) return;

        await prisma.videoSession.update({
          where: { id: sessionId },
          data: {
            isPlaying: action === 'play',
            currentTime,
          },
        });

        socket.to(`room:${roomId}`).emit('video:sync', {
          action,
          currentTime,
          timestamp: Date.now(),
          userId: socket.user.id,
        });
      } catch {
        socket.emit('video:error', { error: 'Sync failed' });
      }
    }
  );

  // Late joiner requests current state
  socket.on('video:request-state', async ({ sessionId, roomId }: { sessionId: string; roomId: string }) => {
    const session = await prisma.videoSession.findUnique({ where: { id: sessionId } });
    if (!session) return;
    socket.emit('video:state', {
      isPlaying: session.isPlaying,
      currentTime: session.currentTime,
      timestamp: Date.now(),
    });
  });

  // Video comments (timestamped)
  socket.on(
    'video:comment',
    async ({
      sessionId,
      roomId,
      content,
      timestamp,
    }: {
      sessionId: string;
      roomId: string;
      content: string;
      timestamp: number;
    }) => {
      if (!content?.trim()) return;

      try {
        const comment = await prisma.videoComment.create({
          data: {
            content: content.trim(),
            timestamp,
            userId: socket.user.id,
            sessionId,
          },
          include: { user: { select: { id: true, name: true, avatar: true } } },
        });

        io.to(`room:${roomId}`).emit('video:comment', comment);
      } catch {
        socket.emit('video:error', { error: 'Comment failed' });
      }
    }
  );

  socket.on('video:stop', async ({ sessionId, roomId }: { sessionId: string; roomId: string }) => {
    const session = await prisma.videoSession.findUnique({ where: { id: sessionId } });
    if (!session || session.hostId !== socket.user.id) return;

    await prisma.videoSession.update({ where: { id: sessionId }, data: { isActive: false } });
    io.to(`room:${roomId}`).emit('video:stopped', { sessionId });
  });
}
