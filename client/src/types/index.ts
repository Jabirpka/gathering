export interface User {
  id: string;
  googleId?: string;
  email: string;
  name: string;
  nickname?: string | null;
  avatar?: string | null;
  strikePoints?: number;
  createdAt?: string;
}

export interface AppNotification {
  id: string;
  type: 'poke' | 'approved' | 'pending';
  message: string;
  from?: Pick<User, 'id' | 'name' | 'nickname' | 'avatar'>;
  groupId?: string;
  strikePoints?: number;
  createdAt: string;
  read: boolean;
}

export type RoomType = 'VIDEO_CALL' | 'AUDIO_CALL';
export type Role = 'OWNER' | 'ADMIN' | 'MEMBER';
export type MemberStatus = 'PENDING' | 'APPROVED' | 'BANNED';

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  groupId: string;
  isActive: boolean;
  createdAt: string;
}

export interface GroupMember {
  id: string;
  userId: string;
  groupId: string;
  role: Role;
  status: MemberStatus;
  joinedAt: string;
  lastReadAt?: string | null;
  user: Pick<User, 'id' | 'name' | 'avatar'>;
}

export interface CallRing {
  roomId: string;
  groupId: string;
  roomName: string;
  groupName: string;
  caller: Pick<User, 'id' | 'name' | 'avatar'>;
  type: 'VIDEO_CALL' | 'AUDIO_CALL';
}

export interface Group {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  avatar?: string | null;
  isPublic: boolean;
  requireApproval: boolean;
  creatorId: string;
  creator: Pick<User, 'id' | 'name' | 'avatar'>;
  members: GroupMember[];
  rooms: Room[];
  scheduledEvents?: ScheduledEvent[];
  createdAt: string;
  updatedAt: string;
  _count?: { members: number };
  unreadCount?: number;
  lastMessage?: {
    content: string;
    createdAt: string;
    userId: string;
    user: { name: string; nickname?: string | null };
  } | null;
}

export interface Message {
  id: string;
  content: string;
  kind?: 'TEXT' | 'VOICE';
  duration?: number | null;
  userId: string;
  groupId?: string | null;
  roomId?: string | null;
  threadId?: string | null;
  replyToId?: string | null;
  replyTo?: { id: string; content: string; kind?: 'TEXT' | 'VOICE'; deletedAt?: string | null; user: { name: string } } | null;
  deletedAt?: string | null;
  user: Pick<User, 'id' | 'name' | 'avatar'>;
  createdAt: string;
}

export interface StatusItem {
  id: string;
  kind: 'TEXT' | 'IMAGE';
  content: string;
  bg?: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface StatusGroup {
  user: Pick<User, 'id' | 'name' | 'nickname' | 'avatar'>;
  statuses: StatusItem[];
}

export interface DmThread {
  id: string;
  partner: Pick<User, 'id' | 'name' | 'nickname' | 'avatar'>;
  partnerLastReadAt?: string | null;
  unreadCount?: number;
  lastMessage?: { content: string; createdAt: string; userId: string } | null;
  updatedAt: string;
  createdAt: string;
}

export interface ScheduledEvent {
  id: string;
  title: string;
  description?: string | null;
  groupId: string;
  scheduledAt: string;
  meetupData?: MeetupData | null;
  createdAt: string;
}

export interface MeetupData {
  locations: LocationEntry[];
  midpoint?: { lat: number; lng: number };
  address?: string;
}

export interface LocationEntry {
  userId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface PresenceEvent {
  userId: string;
  name?: string;
  avatar?: string | null;
  online: boolean;
}

