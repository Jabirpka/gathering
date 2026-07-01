import { Server, Socket } from 'socket.io';
import { prisma } from '../index';

export function setupChatHandlers(io: Server, socket: Socket) {
  socket.on(
    'chat:send',
    async ({
      roomId,
      groupId,
      content,
    }: {
      roomId?: string;
      groupId: string;
      content: string;
    }) => {
      if (!content?.trim()) return;
      if (content.length > 2000) return;

      try {
        const member = await prisma.groupMember.findUnique({
          where: { userId_groupId: { userId: socket.user.id, groupId } },
        });
        if (!member || member.status !== 'APPROVED') return;

        const message = await prisma.message.create({
          data: {
            content: content.trim(),
            userId: socket.user.id,
            groupId,
            roomId: roomId || null,
          },
          include: {
            user: { select: { id: true, name: true, avatar: true } },
          },
        });

        const channel = roomId ? `room:${roomId}` : `group:${groupId}`;
        io.to(channel).emit('chat:message', message);

        // For group chat, push a lightweight unread signal to every other
        // member's personal room so their sidebar badge updates even when they
        // aren't viewing this group. Room (in-call) chat is excluded.
        if (!roomId) {
          const others = await prisma.groupMember.findMany({
            where: { groupId, status: 'APPROVED', userId: { not: socket.user.id } },
            select: { userId: true },
          });
          others.forEach((m) => io.to(`user:${m.userId}`).emit('chat:unread', { groupId }));
        }
      } catch (err) {
        socket.emit('chat:error', { error: 'Failed to send message' });
      }
    }
  );

  socket.on('chat:history', async ({ roomId, groupId, cursor }: { roomId?: string; groupId: string; cursor?: string }) => {
    try {
      const messages = await prisma.message.findMany({
        where: {
          groupId,
          roomId: roomId || null,
          ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
        },
        include: { user: { select: { id: true, name: true, avatar: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      socket.emit('chat:history', messages.reverse());
    } catch {
      socket.emit('chat:error', { error: 'Failed to load messages' });
    }
  });

  // Typing indicators
  socket.on('chat:typing', ({ roomId, groupId }: { roomId?: string; groupId: string }) => {
    const channel = roomId ? `room:${roomId}` : `group:${groupId}`;
    socket.to(channel).emit('chat:typing', {
      userId: socket.user.id,
      name: socket.user.name,
    });
  });
}
