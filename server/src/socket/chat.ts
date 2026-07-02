import { Server, Socket } from 'socket.io';
import { prisma } from '../index';

// Shared payload shape so every message (live or history, group or DM)
// carries its sender and the quoted reply-to message.
const messageInclude = {
  user: { select: { id: true, name: true, avatar: true } },
  replyTo: {
    select: {
      id: true,
      content: true,
      deletedAt: true,
      user: { select: { name: true } },
    },
  },
} as const;

export function setupChatHandlers(io: Server, socket: Socket) {
  socket.on(
    'chat:send',
    async ({
      roomId,
      groupId,
      content,
      replyToId,
    }: {
      roomId?: string;
      groupId: string;
      content: string;
      replyToId?: string;
    }) => {
      if (!content?.trim()) return;
      if (content.length > 2000) return;

      try {
        const member = await prisma.groupMember.findUnique({
          where: { userId_groupId: { userId: socket.user.id, groupId } },
        });
        if (!member || member.status !== 'APPROVED') return;

        // A quote must point at a message in this same conversation.
        let validReplyId: string | null = null;
        if (replyToId) {
          const target = await prisma.message.findUnique({ where: { id: replyToId } });
          if (target && target.groupId === groupId && (target.roomId ?? null) === (roomId ?? null)) {
            validReplyId = target.id;
          }
        }

        const message = await prisma.message.create({
          data: {
            content: content.trim(),
            userId: socket.user.id,
            groupId,
            roomId: roomId || null,
            replyToId: validReplyId,
          },
          include: messageInclude,
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
          // Include a preview so chats lists can update their last-message
          // row live without refetching.
          const preview = {
            content: message.content,
            createdAt: message.createdAt,
            userId: message.userId,
            user: { name: message.user.name },
          };
          others.forEach((m) => io.to(`user:${m.userId}`).emit('chat:unread', { groupId, message: preview }));
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
        include: messageInclude,
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

  // ---- 1:1 direct messages ----
  // Delivered via each participant's personal room (user:<id>), so DMs work
  // no matter which page either person is on.

  const loadMyThread = async (threadId: string) => {
    const thread = await prisma.dmThread.findUnique({ where: { id: threadId } });
    if (!thread) return null;
    if (thread.userAId !== socket.user.id && thread.userBId !== socket.user.id) return null;
    return thread;
  };

  socket.on('dm:send', async ({ threadId, content, replyToId }: { threadId: string; content: string; replyToId?: string }) => {
    if (!content?.trim() || content.length > 2000) return;
    try {
      const thread = await loadMyThread(threadId);
      if (!thread) return;

      let validReplyId: string | null = null;
      if (replyToId) {
        const target = await prisma.message.findUnique({ where: { id: replyToId } });
        if (target && target.threadId === threadId) validReplyId = target.id;
      }

      const message = await prisma.message.create({
        data: { content: content.trim(), userId: socket.user.id, threadId, replyToId: validReplyId },
        include: messageInclude,
      });
      // Bump the thread so conversation lists re-sort by activity.
      await prisma.dmThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });

      io.to(`user:${thread.userAId}`).emit('dm:message', message);
      io.to(`user:${thread.userBId}`).emit('dm:message', message);
    } catch {
      socket.emit('chat:error', { error: 'Failed to send message' });
    }
  });

  socket.on('dm:history', async ({ threadId, cursor }: { threadId: string; cursor?: string }) => {
    try {
      const thread = await loadMyThread(threadId);
      if (!thread) return;
      const messages = await prisma.message.findMany({
        where: {
          threadId,
          ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
        },
        include: messageInclude,
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      socket.emit('dm:history', { threadId, messages: messages.reverse() });
    } catch {
      socket.emit('chat:error', { error: 'Failed to load messages' });
    }
  });

  socket.on('dm:typing', async ({ threadId }: { threadId: string }) => {
    const thread = await loadMyThread(threadId);
    if (!thread) return;
    const partnerId = thread.userAId === socket.user.id ? thread.userBId : thread.userAId;
    io.to(`user:${partnerId}`).emit('dm:typing', {
      threadId,
      userId: socket.user.id,
      name: socket.user.name,
    });
  });

  // Delete for everyone (WhatsApp-style): only the sender can delete; the
  // content is blanked and every viewer gets a live chat:deleted event so the
  // bubble flips to a "deleted" placeholder. Works for group, room, and DM.
  socket.on('chat:delete', async ({ messageId }: { messageId: string }) => {
    try {
      const msg = await prisma.message.findUnique({ where: { id: messageId } });
      if (!msg || msg.userId !== socket.user.id || msg.deletedAt) return;

      const updated = await prisma.message.update({
        where: { id: messageId },
        data: { content: '', deletedAt: new Date() },
      });

      const payload = {
        messageId,
        groupId: msg.groupId,
        roomId: msg.roomId,
        threadId: msg.threadId,
        deletedAt: updated.deletedAt,
      };

      if (msg.threadId) {
        const thread = await prisma.dmThread.findUnique({ where: { id: msg.threadId } });
        if (thread) {
          io.to(`user:${thread.userAId}`).emit('chat:deleted', payload);
          io.to(`user:${thread.userBId}`).emit('chat:deleted', payload);
        }
      } else if (msg.roomId) {
        io.to(`room:${msg.roomId}`).emit('chat:deleted', payload);
      } else if (msg.groupId) {
        io.to(`group:${msg.groupId}`).emit('chat:deleted', payload);
      }
    } catch {}
  });
}
