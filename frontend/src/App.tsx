import { Routes, Route } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Revenue from './pages/Revenue';
import Expenses from './pages/Expenses';
import Cashflow from './pages/Cashflow';
import AIInsights from './pages/AIInsights';
import AIChat from './pages/AIChat';
import Transactions from './pages/Transactions';
import Integrations from './pages/Integrations';
import Settings from './pages/Settings';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<ProtectedRoute isAuthenticated={isAuthenticated} />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/revenue" element={<Revenue />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/cashflow" element={<Cashflow />} />
          <Route path="/ai-insights" element={<AIInsights />} />
          <Route path="/ai-chat" element={<AIChat />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
