import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

export function useAuth() {
  const { user, token, loading, fetchUser, logout, setToken } = useAuthStore();

  useEffect(() => {
    // Always try fetchUser on mount — reads from native Preferences too
    if (!user) {
      fetchUser();
    } else {
      useAuthStore.setState({ loading: false });
    }
  }, []);

  return { user, token, loading, logout, setToken };
}
