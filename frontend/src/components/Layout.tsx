import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuthStore } from '../store/authStore';
import { useSubscriptionStore } from '../store/subscriptionStore';

export default function Layout() {
  const { isAuthenticated, selectedCompanyId } = useAuthStore();
  const refresh = useSubscriptionStore((state) => state.refresh);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isAuthenticated || !selectedCompanyId) return;
    refresh();
  }, [isAuthenticated, selectedCompanyId, refresh]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (selectedCompanyId) return;
    const path = location.pathname;
    if (path === '/create-company' || path === '/admin') return;
    navigate('/create-company', { replace: true, state: { message: 'Please create or select a company first.' } });
  }, [isAuthenticated, selectedCompanyId, location.pathname, navigate]);

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
