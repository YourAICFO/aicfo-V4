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
} from 'lucide-react';

const menuItems = [
  { path: '/dashboard', label: 'CFO Overview', icon: LayoutDashboard },
  { path: '/revenue', label: 'Revenue', icon: TrendingUp },
  { path: '/expenses', label: 'Expenses', icon: TrendingDown },
  { path: '/cashflow', label: 'Cashflow', icon: Wallet },
  { path: '/ai-insights', label: 'AI Insights', icon: Brain },
  { path: '/ai-chat', label: 'AI Chat', icon: MessageSquare },
  { path: '/transactions', label: 'Transactions', icon: List },
  { path: '/integrations', label: 'Integrations', icon: Plug },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 z-50">
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
    </aside>
  );
}
