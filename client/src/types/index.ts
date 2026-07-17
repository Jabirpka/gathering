export interface User {
  id: string;
  googleId?: string;
  email: string;
  name: string;
  nickname?: string | null;
  avatar?: string | null;
  banner?: string | null;
  phone?: string | null;
  username?: string | null;
  dateOfBirth?: string | null;
  bio?: string | null;
  interests?: string[];
  favoriteSong?: string | null;
  favoriteMovie?: string | null;
  city?: string | null;
  whoAreYou?: string | null;
  whatCanYouDo?: string | null;
  trust?: string | null;
  lookingFor?: string | null;
  wantToMeet?: string | null;
  /** Extended profile blob (education, career, skills, lifestyle, socials,
   *  favorites, emergency…) — shaped by utils/profileSchema.ts. */
  profileExtra?: Record<string, any> | null;
  /** Derived on the public profile endpoint (values stay private). */
  emailVerified?: boolean;
  phoneVerified?: boolean;
  onboarded?: boolean;
  strikePoints?: number;
  createdAt?: string;
}

export interface AppNotification {
  id: string;
  type: 'poke' | 'approved' | 'pending' | 'visit';
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
  /** Group call. */
  groupId?: string;
  /** DM call — set instead of groupId. */
  threadId?: string;
  roomName: string;
  groupName: string;
  caller: Pick<User, 'id' | 'name' | 'avatar'>;
  type: 'VIDEO_CALL' | 'AUDIO_CALL';
}

export interface DiscoverGroup {
  id: string;
  name: string;
  description?: string | null;
  avatar?: string | null;
  category?: string | null;
  isPublic: boolean;
  requireApproval: boolean;
  creator: Pick<User, 'id' | 'name' | 'avatar'>;
  memberCount: number;
  myStatus: MemberStatus | null;
}

export interface Group {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  avatar?: string | null;
  category?: string | null;
  isPublic: boolean;
  requireApproval: boolean;
  creatorId: string;
  creator: Pick<User, 'id' | 'name' | 'avatar'>;
  members: GroupMember[];
  rooms: Room[];
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
  kind?: 'TEXT' | 'VOICE' | 'POLL' | 'EVENT' | 'QUIZ';
  duration?: number | null;
  userId: string;
  groupId?: string | null;
  roomId?: string | null;
  threadId?: string | null;
  replyToId?: string | null;
  replyTo?: { id: string; content: string; kind?: 'TEXT' | 'VOICE'; deletedAt?: string | null; user: { name: string } } | null;
  deletedAt?: string | null;
  reactions?: { userId: string; emoji: string }[];
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

export interface PollState {
  messageId: string;
  question: string;
  options: string[];
  multiple: boolean;
  hideVoters: boolean;
  endsAt?: string | null;
  counts: number[];
  voters: Record<number, Pick<User, 'id' | 'name' | 'avatar'>[]>;
  myVotes: number[];
  totalVoters: number;
}

export interface EventState {
  messageId: string;
  name: string;
  description: string;
  startsAt: string;
  endsAt?: string | null;
  location: string;
  allowGuests: boolean;
  reminderMinutes?: number | null;
  rsvps: Record<'GOING' | 'MAYBE' | 'NO', { id: string; name: string; avatar: string | null; plusGuest: boolean }[]>;
  myRsvp: { status: 'GOING' | 'MAYBE' | 'NO'; plusGuest: boolean } | null;
  goingCount: number;
}

export interface QuizState {
  messageId: string;
  question: string;
  options: string[];
  points: number;
  endsAt?: string | null;
  counts: number[];
  totalAnswers: number;
  myAnswer: { optionIndex: number; correct: boolean; points: number } | null;
  correctIndex: number | null;
  ended: boolean;
}

export interface LeaderboardEntry {
  userId: string;
  name: string;
  avatar: string | null;
  points: number;
  answered: number;
  correct: number;
}

/** Compact person row returned by people search / hire directory. */
export interface PersonCard {
  id: string;
  name: string;
  nickname?: string | null;
  avatar?: string | null;
  username?: string | null;
  city?: string | null;
  currentJob?: string | null;
  industry?: string | null;
  availableForHire?: boolean;
}

export interface ProfileVisitor {
  user: Pick<User, 'id' | 'name' | 'nickname' | 'avatar' | 'username'>;
  at: string;
}

export interface FeedPost {
  id: string;
  kind: 'PHOTO' | 'NEWS' | 'POLL' | 'QUESTION' | 'WRITEUP' | 'EVENT' | 'JOB_HUNT' | 'JOB_FIND' | 'INFO';
  category: string;
  title?: string | null;
  content: string;
  image?: string | null;
  extra?: Record<string, any> | null;
  user: Pick<User, 'id' | 'name' | 'nickname' | 'avatar' | 'username'>;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  pollCounts?: Record<number, number>;
  myVote?: number | null;
  createdAt: string;
}

export interface FeedComment {
  id: string;
  postId: string;
  content: string;
  user: Pick<User, 'id' | 'name' | 'nickname' | 'avatar' | 'username'>;
  createdAt: string;
}

export interface PresenceEvent {
  userId: string;
  name?: string;
  avatar?: string | null;
  online: boolean;
}

