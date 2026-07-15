import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL ?? '';

const api = axios.create({
  baseURL: `${BASE}/api`,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  firebaseLogin: (idToken: string) => api.post('/auth/firebase', { idToken }),
};

export const usersApi = {
  me: () => api.get('/users/me'),
  myStrikes: () => api.get('/users/me/strikes'),
  updateMe: (data: {
    name?: string; nickname?: string; avatar?: string;
    username?: string; dateOfBirth?: string; bio?: string; interests?: string[];
    favoriteSong?: string; favoriteMovie?: string; city?: string;
    whoAreYou?: string; whatCanYouDo?: string; trust?: string; lookingFor?: string; wantToMeet?: string;
    onboarded?: boolean;
  }) => api.patch('/users/me', data),
  getUser: (id: string) => api.get(`/users/${id}`),
  poke: (id: string) => api.post(`/users/${id}/poke`),
  matchContacts: (phones: string[]) => api.post('/users/contacts', { phones }),
};

export const groupsApi = {
  list: () => api.get('/groups'),
  get: (id: string) => api.get(`/groups/${id}`),
  create: (data: { name: string; description?: string; category?: string; isPublic?: boolean; requireApproval?: boolean }) =>
    api.post('/groups', data),
  update: (id: string, data: Partial<{ name: string; description: string; category: string; isPublic: boolean; requireApproval: boolean; avatar: string }>) =>
    api.patch(`/groups/${id}`, data),
  join: (code: string) => api.post('/groups/join', { code }),
  discover: (q?: string, category?: string) => api.get('/groups/discover', { params: { q: q || '', category: category || '' } }),
  joinById: (id: string) => api.post(`/groups/${id}/join`, {}),
  leave: (id: string) => api.delete(`/groups/${id}/leave`),
  remove: (id: string) => api.delete(`/groups/${id}`),
  transferOwnership: (id: string, userId: string) => api.post(`/groups/${id}/transfer`, { userId }),
  markRead: (id: string) => api.post(`/groups/${id}/read`, {}),
  startCall: (id: string, type: 'video' | 'audio') => api.post(`/groups/${id}/call/${type}`, {}),
  searchMessages: (id: string, q: string) => api.get(`/groups/${id}/messages/search`, { params: { q } }),
  pending: (id: string) => api.get(`/groups/${id}/pending`),
  approveMember: (groupId: string, userId: string, action: 'approve' | 'ban') =>
    api.patch(`/groups/${groupId}/members/${userId}`, { action }),
};

export const statusApi = {
  list: () => api.get('/status'),
  create: (data: { kind: 'TEXT' | 'IMAGE'; content: string; bg?: string }) => api.post('/status', data),
  remove: (id: string) => api.delete(`/status/${id}`),
};

export const dmsApi = {
  list: () => api.get('/dms'),
  open: (userId: string) => api.post('/dms/open', { userId }),
  markRead: (threadId: string) => api.post(`/dms/${threadId}/read`, {}),
  remove: (threadId: string) => api.delete(`/dms/${threadId}`),
  searchMessages: (threadId: string, q: string) => api.get(`/dms/${threadId}/search`, { params: { q } }),
};

export const livekitApi = {
  getToken: (roomName: string, groupId: string) =>
    api.post('/livekit/token', { roomName, groupId }),
  getDmToken: (threadId: string) =>
    api.post('/livekit/dm-token', { threadId }),
};

export const pushApi = {
  register: (token: string, platform: string) =>
    api.post('/push/register', { token, platform }),
  unregister: (token: string) =>
    api.post('/push/unregister', { token }),
};

export const pollsApi = {
  create: (data: { groupId: string; question: string; options: string[]; multiple: boolean; hideVoters: boolean; endsAt?: string | null }) =>
    api.post('/polls', data),
  get: (messageId: string) => api.get(`/polls/${messageId}`),
  vote: (messageId: string, optionIndex: number) => api.post(`/polls/${messageId}/vote`, { optionIndex }),
};

export const eventsApi = {
  create: (data: { groupId: string; name: string; description?: string; startsAt: string; endsAt?: string | null; location?: string; allowGuests: boolean; reminderMinutes?: number | null }) =>
    api.post('/events', data),
  get: (messageId: string) => api.get(`/events/${messageId}`),
  rsvp: (messageId: string, status: 'GOING' | 'MAYBE' | 'NO', plusGuest?: boolean) =>
    api.post(`/events/${messageId}/rsvp`, { status, plusGuest }),
};

export const quizzesApi = {
  create: (data: { groupId: string; question: string; options: string[]; correctIndex: number; points: number; endsAt?: string | null }) =>
    api.post('/quizzes', data),
  get: (messageId: string) => api.get(`/quizzes/${messageId}`),
  answer: (messageId: string, optionIndex: number) => api.post(`/quizzes/${messageId}/answer`, { optionIndex }),
  leaderboard: (groupId: string) => api.get(`/quizzes/leaderboard/${groupId}`),
};

export default api;
