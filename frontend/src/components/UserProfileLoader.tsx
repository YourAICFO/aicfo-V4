import { useEffect } from 'react';
import { authApi } from '../services/api';
import { useAuthStore } from '../store/authStore';

export default function UserProfileLoader() {
  const { user, updateUser } = useAuthStore();

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;
      
      try {
        const response = await authApi.getMe();
        if (response.data.success && response.data.data) {
          updateUser(response.data.data);
        }
      } catch (error) {
        console.error('Failed to fetch user profile:', error);
      }
    };

    fetchUserProfile();
  }, [user, updateUser]);

  return null; // This component doesn't render anything
}