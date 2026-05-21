import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

export function useAuth() {
  const { user, token, loading, fetchUser, logout, setToken } = useAuthStore();

  useEffect(() => {
    if (token && !user) {
      fetchUser();
    } else if (!token) {
      useAuthStore.setState({ loading: false });
    }
  }, [token]);

  return { user, token, loading, logout, setToken };
}
