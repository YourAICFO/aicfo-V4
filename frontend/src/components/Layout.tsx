import { useEffect, useState } from 'react';
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
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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
      <Sidebar
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />
      <div className="ml-0 md:ml-64">
        <div className="flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-3 md:hidden">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"
            aria-label="Open menu"
            onClick={() => setMobileSidebarOpen(true)}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-gray-700">Menu</span>
        </div>
        <Header />
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
