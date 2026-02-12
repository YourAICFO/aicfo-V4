import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  Wallet,
  Brain,
  MessageSquare,
  List,
  Plug,
  Settings,
  Users,
} from 'lucide-react';

const menuItems = [
  { path: '/dashboard', label: 'CFO Overview', icon: LayoutDashboard },
  { path: '/revenue', label: 'Revenue', icon: TrendingUp },
  { path: '/expenses', label: 'Expenses', icon: TrendingDown },
  { path: '/cashflow', label: 'Cashflow', icon: Wallet },
  { path: '/debtors', label: 'Debtors', icon: Users },
  { path: '/creditors', label: 'Creditors', icon: Users },
  { path: '/ai-insights', label: 'AI Insights', icon: Brain },
  { path: '/ai-chat', label: 'AI Chat', icon: MessageSquare },
  { path: '/transactions', label: 'Transactions', icon: List },
  { path: '/integrations', label: 'Integrations', icon: Plug },
  { path: '/admin/control-tower', label: 'Admin Control', icon: LayoutDashboard },
  { path: '/settings', label: 'Settings', icon: Settings },
];

type SidebarProps = {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

export default function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  useEffect(() => {
    if (!mobileOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onMobileClose?.();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [mobileOpen, onMobileClose]);

  const sidebarContent = (
    <>
      <div className="p-6">
        <h1 className="text-2xl font-bold text-primary-700">AI CFO</h1>
        <p className="text-sm text-gray-500 mt-1">Financial Intelligence</p>
      </div>

      <nav className="px-4 pb-6">
        <ul className="space-y-1">
          {menuItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );

  return (
    <>
      <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 z-50 hidden md:block">
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-30 md:hidden"
            onClick={onMobileClose}
            aria-hidden="true"
          />
          <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 z-40 md:hidden">
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}
