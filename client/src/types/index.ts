export interface User {
  id: string;
  googleId?: string;
  email: string;
  name: string;
  avatar?: string | null;
  createdAt?: string;
}

export type RoomType = 'VIDEO_CALL' | 'VIDEO_WATCH' | 'AUDIO_CALL';
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
  user: Pick<User, 'id' | 'name' | 'avatar'>;
}

export interface Group {
  id: string;
  name: string;
  code: string;
  description?: string | null;
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
}

export interface Message {
  id: string;
  content: string;
  userId: string;
  groupId?: string | null;
  roomId?: string | null;
  user: Pick<User, 'id' | 'name' | 'avatar'>;
  createdAt: string;
}

export interface VideoSession {
  id: string;
  groupId: string;
  roomId?: string | null;
  videoUrl: string;
  title: string;
  isActive: boolean;
  currentTime: number;
  isPlaying: boolean;
  hostId: string;
  createdAt: string;
}

export interface VideoComment {
  id: string;
  content: string;
  timestamp: number;
  userId: string;
  sessionId: string;
  user: Pick<User, 'id' | 'name' | 'avatar'>;
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

export interface VideoSyncEvent {
  action: 'play' | 'pause' | 'seek';
  currentTime: number;
  timestamp: number;
  userId: string;
}
