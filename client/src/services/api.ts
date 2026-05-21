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
};

export const groupsApi = {
  list: () => api.get('/groups'),
  get: (id: string) => api.get(`/groups/${id}`),
  create: (data: { name: string; description?: string; isPublic?: boolean; requireApproval?: boolean }) =>
    api.post('/groups', data),
  update: (id: string, data: Partial<{ name: string; description: string; isPublic: boolean; requireApproval: boolean }>) =>
    api.patch(`/groups/${id}`, data),
  join: (code: string) => api.post('/groups/join', { code }),
  leave: (id: string) => api.delete(`/groups/${id}/leave`),
  pending: (id: string) => api.get(`/groups/${id}/pending`),
  approveMember: (groupId: string, userId: string, action: 'approve' | 'ban') =>
    api.patch(`/groups/${groupId}/members/${userId}`, { action }),
};

export const eventsApi = {
  list: (groupId: string) => api.get(`/events/group/${groupId}`),
  create: (groupId: string, data: { title: string; description?: string; scheduledAt: string; meetupData?: any }) =>
    api.post(`/events/group/${groupId}`, data),
  delete: (id: string) => api.delete(`/events/${id}`),
};

export const livekitApi = {
  getToken: (roomName: string, groupId: string) =>
    api.post('/livekit/token', { roomName, groupId }),
};

export default api;
