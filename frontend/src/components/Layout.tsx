import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuthStore } from '../store/authStore';
import { useSubscriptionStore } from '../store/subscriptionStore';

export default function Layout() {
  const { isAuthenticated, selectedCompanyId } = useAuthStore();
  const refresh = useSubscriptionStore((state) => state.refresh);

  useEffect(() => {
    if (!isAuthenticated || !selectedCompanyId) return;
    refresh();
  }, [isAuthenticated, selectedCompanyId, refresh]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="ml-64">
        <Header />
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
