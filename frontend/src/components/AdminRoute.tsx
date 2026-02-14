import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface AdminRouteProps {
  children?: React.ReactNode;
}

export default function AdminRoute({ children }: AdminRouteProps) {
  const { isAuthenticated, user } = useAuthStore();
  const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS || '').split(',').map((email: string) => email.trim().toLowerCase()).filter(Boolean);
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const userEmail = user?.email?.toLowerCase();
  const isAdmin = userEmail && adminEmails.includes(userEmail);

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}