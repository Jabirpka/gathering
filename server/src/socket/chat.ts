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
      kind: true,
      deletedAt: true,
      user: { select: { name: true } },
    },
  },
  reactions: { select: { userId: true, emoji: true } },
} as const;

// Voice notes arrive as audio data URLs; cap size (~60s of opus) and length.
const MAX_TEXT_LEN = 2000;
const MAX_VOICE_LEN = 1_500_000;
const MAX_VOICE_SECONDS = 120;

function validateMessage(kind: string | undefined, content: string, duration?: number):
  { kind: 'TEXT' | 'VOICE'; duration: number | null } | null {
  if (kind === 'VOICE') {
    if (!content.startsWith('data:audio/') || content.length > MAX_VOICE_LEN) return null;
    if (!duration || duration < 1 || duration > MAX_VOICE_SECONDS) return null;
    return { kind: 'VOICE', duration: Math.round(duration) };
  }
  if (content.length > MAX_TEXT_LEN) return null;
  return { kind: 'TEXT', duration: null };
}

/** Text shown in chat-list previews instead of a giant data URL. */
export function previewText(kind: string, content: string) {
  return kind === 'VOICE' ? '🎤 Voice message' : content;
}

export function setupChatHandlers(io: Server, socket: Socket) {
  socket.on(
    'chat:send',
    async ({
      roomId,
      groupId,
      content,
      replyToId,
      kind,
      duration,
    }: {
      roomId?: string;
      groupId: string;
      content: string;
      replyToId?: string;
      kind?: string;
      duration?: number;
    }) => {
      if (!content?.trim()) return;
      const valid = validateMessage(kind, content, duration);
      if (!valid) return;

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
            content: valid.kind === 'VOICE' ? content : content.trim(),
            kind: valid.kind,
            duration: valid.duration,
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
            content: previewText(message.kind, message.content),
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

  socket.on('dm:send', async ({ threadId, content, replyToId, kind, duration }: { threadId: string; content: string; replyToId?: string; kind?: string; duration?: number }) => {
    if (!content?.trim()) return;
    const valid = validateMessage(kind, content, duration);
    if (!valid) return;
    try {
      const thread = await loadMyThread(threadId);
      if (!thread) return;

      let validReplyId: string | null = null;
      if (replyToId) {
        const target = await prisma.message.findUnique({ where: { id: replyToId } });
        if (target && target.threadId === threadId) validReplyId = target.id;
      }

      const message = await prisma.message.create({
        data: {
          content: valid.kind === 'VOICE' ? content : content.trim(),
          kind: valid.kind,
          duration: valid.duration,
          userId: socket.user.id,
          threadId,
          replyToId: validReplyId,
        },
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
      // Respect "delete chat": hide everything before my side's clearedAt.
      const myClearedAt = thread.userAId === socket.user.id ? thread.clearedAtA : thread.clearedAtB;
      const messages = await prisma.message.findMany({
        where: {
          threadId,
          ...(myClearedAt ? { createdAt: { gt: myClearedAt } } : {}),
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

  // Toggle an emoji reaction (one per user per message). Everyone viewing the
  // conversation gets the message's fresh reaction list.
  socket.on('chat:react', async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
    if (!emoji || emoji.length > 8) return;
    try {
      const msg = await prisma.message.findUnique({ where: { id: messageId } });
      if (!msg || msg.deletedAt) return;

      // Must be a participant of the conversation the message lives in.
      if (msg.threadId) {
        const thread = await prisma.dmThread.findUnique({ where: { id: msg.threadId } });
        if (!thread || (thread.userAId !== socket.user.id && thread.userBId !== socket.user.id)) return;
      } else if (msg.groupId) {
        const member = await prisma.groupMember.findUnique({
          where: { userId_groupId: { userId: socket.user.id, groupId: msg.groupId } },
        });
        if (!member || member.status !== 'APPROVED') return;
      } else {
        return;
      }

      const existing = await prisma.messageReaction.findUnique({
        where: { messageId_userId: { messageId, userId: socket.user.id } },
      });
      if (existing && existing.emoji === emoji) {
        await prisma.messageReaction.delete({ where: { id: existing.id } });
      } else {
        await prisma.messageReaction.upsert({
          where: { messageId_userId: { messageId, userId: socket.user.id } },
          update: { emoji },
          create: { messageId, userId: socket.user.id, emoji },
        });
      }

      const reactions = await prisma.messageReaction.findMany({
        where: { messageId },
        select: { userId: true, emoji: true },
      });
      const payload = { messageId, reactions };

      if (msg.threadId) {
        const thread = await prisma.dmThread.findUnique({ where: { id: msg.threadId } });
        if (thread) {
          io.to(`user:${thread.userAId}`).emit('chat:reacted', payload);
          io.to(`user:${thread.userBId}`).emit('chat:reacted', payload);
        }
      } else if (msg.roomId) {
        io.to(`room:${msg.roomId}`).emit('chat:reacted', payload);
      } else if (msg.groupId) {
        io.to(`group:${msg.groupId}`).emit('chat:reacted', payload);
      }
    } catch {}
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
