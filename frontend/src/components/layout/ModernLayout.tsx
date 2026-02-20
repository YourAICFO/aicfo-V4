import React, { useState } from 'react';
import { Menu, X, Bell, Settings, LogOut, ChevronDown, Building2, PlusCircle } from 'lucide-react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import DarkModeToggle from '../ui/DarkModeToggle';
import { Button } from '../ui/Button';
import { useAuthStore } from '../../store/authStore';
import { companyApi } from '../../services/api';

interface Company {
  id: string;
  name: string;
}

const ModernLayout: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, selectedCompanyId, setSelectedCompany } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const location = useLocation();
  const isAdmin = user?.isAdmin === true;
  const userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'User';
  const userEmail = user?.email || '';
  const companyName = companies.find((item) => item.id === selectedCompanyId)?.name || 'AI CFO';

  React.useEffect(() => {
    let mounted = true;
    const loadCompanies = async () => {
      try {
        setLoadingCompanies(true);
        const response = await companyApi.getAll();
        const items = response?.data?.data || [];
        if (!mounted) return;
        setCompanies(items);
        if (items.length === 0) {
          if (selectedCompanyId) {
            setSelectedCompany(null);
          }
          if (location.pathname !== '/create-company') {
            navigate('/create-company', { replace: true });
          }
          return;
        }

        const hasSelectedCompany = selectedCompanyId && items.some((item: Company) => item.id === selectedCompanyId);
        if (!hasSelectedCompany) {
          setSelectedCompany(items[0].id);
        }
      } catch (error) {
        console.error('Failed to load companies for layout', error);
      } finally {
        if (mounted) {
          setLoadingCompanies(false);
        }
      }
    };
    loadCompanies();
    return () => {
      mounted = false;
    };
  }, [location.pathname, navigate, selectedCompanyId, setSelectedCompany]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: '📊' },
    { name: 'Revenue', href: '/revenue', icon: '💰' },
    { name: 'Expenses', href: '/expenses', icon: '💸' },
    { name: 'Cashflow', href: '/cashflow', icon: '💳' },
    { name: 'Debtors', href: '/debtors', icon: '👥' },
    { name: 'Creditors', href: '/creditors', icon: '🏢' },
    { name: 'Working Capital', href: '/working-capital', icon: '🏦' },
    { name: 'P&L Pack', href: '/pl-pack', icon: '📋' },
    { name: 'AI Insights', href: '/ai-insights', icon: '🤖' },
    { name: 'AI Chat', href: '/ai-chat', icon: '💬' },
    { name: 'Integrations', href: '/integrations', icon: '🔗' },
    { name: 'Data Health', href: '/data-health', icon: '📊' },
    ...(isAdmin
      ? [
          { name: 'Admin Control Tower', href: '/admin/control-tower', icon: '🛡️' },
          { name: 'Admin Dashboard', href: '/admin', icon: '🧭' }
        ]
      : []),
  ];

  const isActive = (path: string) => location.pathname === path;
  const hasCompanies = companies.length > 0;
  const isCreateCompanyRoute = location.pathname === '/create-company';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 transform bg-white shadow-lg transition-transform duration-300 ease-in-out dark:bg-gray-800',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0 lg:shadow-none'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Sidebar header */}
          <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4 dark:border-gray-700">
            <Link to="/dashboard" className="flex items-center space-x-2">
              <div className="text-xl font-bold text-primary-600 dark:text-primary-400">
                AI CFO
              </div>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden rounded-md p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 overflow-y-auto p-4">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive(item.href)
                    ? 'bg-primary-100 text-primary-900 dark:bg-primary-900/20 dark:text-primary-300'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                )}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="mr-3 text-lg">{item.icon}</span>
                {item.name}
              </Link>
            ))}
          </nav>

          {/* Sidebar footer */}
          <div className="border-t border-gray-200 p-4 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/20">
                <span className="text-sm font-medium text-primary-900 dark:text-primary-300">
                  {userName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                  {userName}
                </p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {userEmail}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="text-gray-900 dark:text-slate-100 lg:pl-64">
        {/* Top navigation */}
        <div className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-md p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="ml-4 lg:ml-0">
              <div className="relative">
                <button
                  onClick={() => setCompanyDropdownOpen(!companyDropdownOpen)}
                  className="flex items-center gap-2 rounded-lg border border-transparent px-2 py-1 text-left hover:border-gray-200 hover:bg-gray-100 dark:hover:border-gray-700 dark:hover:bg-gray-700"
                >
                  <Building2 className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  <div>
                    <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {hasCompanies ? companyName : 'No company selected'}
                    </h1>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {hasCompanies ? 'Switch company' : 'Create your first company'}
                    </p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </button>

                {companyDropdownOpen && (
                  <div className="absolute left-0 mt-2 w-72 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                    <div className="max-h-80 overflow-y-auto p-2">
                      {companies.length === 0 ? (
                        <div className="p-3 text-sm text-gray-500 dark:text-gray-400">No companies yet</div>
                      ) : (
                        companies.map((company) => (
                          <button
                            key={company.id}
                            onClick={() => {
                              setSelectedCompany(company.id);
                              setCompanyDropdownOpen(false);
                            }}
                            className={cn(
                              'w-full rounded-md px-3 py-2 text-left text-sm',
                              company.id === selectedCompanyId
                                ? 'bg-primary-100 text-primary-900 dark:bg-primary-900/20 dark:text-primary-300'
                                : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                            )}
                          >
                            {company.name}
                          </button>
                        ))
                      )}
                    </div>
                    <div className="border-t border-gray-200 p-2 dark:border-gray-700">
                      <button
                        onClick={() => {
                          setCompanyDropdownOpen(false);
                          navigate('/create-company');
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-primary-700 hover:bg-primary-50 dark:text-primary-300 dark:hover:bg-primary-900/20"
                      >
                        <PlusCircle className="h-4 w-4" />
                        Create New Company
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Dark mode toggle */}
            <DarkModeToggle size="sm" />
            
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative rounded-full p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-error-500 text-xs text-white">
                  3
                </span>
              </button>
              
              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-lg bg-white shadow-lg dark:bg-gray-800">
                  <div className="p-4">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Notifications
                    </h3>
                    <div className="mt-2 space-y-2">
                      <div className="rounded-md bg-gray-50 p-3 dark:bg-gray-700">
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          Monthly sync completed successfully
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">2 minutes ago</p>
                      </div>
                      <div className="rounded-md bg-gray-50 p-3 dark:bg-gray-700">
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          New AI insights available
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">1 hour ago</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* User menu */}
            <div className="relative">
              <button className="flex items-center space-x-2 rounded-full p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/20">
                  <span className="text-sm font-medium text-primary-900 dark:text-primary-300">
                    {userName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="hidden text-sm font-medium text-gray-700 dark:text-gray-300 md:block">
                  {userName}
                </span>
              </button>
            </div>

            {/* Settings dropdown */}
            <div className="relative">
              <Link to="/settings" className="rounded-full p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 block">
                <Settings className="h-5 w-5" />
              </Link>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/create-company')}
              className="hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 md:inline-flex"
            >
              <PlusCircle className="h-4 w-4" />
            </Button>

            {/* Logout */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Main content area */}
        <main className="flex-1 bg-gray-50 p-4 text-gray-900 dark:bg-slate-900 dark:text-slate-100 lg:p-6">
          <div className="mx-auto max-w-7xl">
            {loadingCompanies ? (
              <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-600" />
              </div>
            ) : !hasCompanies && !isCreateCompanyRoute ? (
              <div className="card py-12 text-center">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Create a company to get started</h2>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                  Your dashboard and insights will appear after you add your first company.
                </p>
                <button className="btn-primary mt-6" onClick={() => navigate('/create-company')}>
                  Create Company
                </button>
              </div>
            ) : (
              <Outlet />
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default ModernLayout;
