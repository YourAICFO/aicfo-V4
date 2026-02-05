import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Wallet, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';
import { dashboardApi } from '../services/api';
import { Link } from 'react-router-dom';

interface OverviewData {
  cashPosition: {
    currentBalance: number;
    currency: string;
  };
  runway: {
    months: number;
    status: 'GREEN' | 'AMBER' | 'RED';
    avgMonthlyInflow: number;
    avgMonthlyOutflow: number;
    netCashFlow: number;
  };
  insights: {
    unreadCount: number;
    recent: Array<{
      id: string;
      type: string;
      riskLevel: string;
      title: string;
      content: string;
    }>;
  };
}

export default function Dashboard() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  // reload when company changes
  useEffect(() => {
    loadData();

    const interval = setInterval(() => {
      loadData();
    }, 3000); // optional auto refresh

    return () => clearInterval(interval);
  }, [localStorage.getItem("companyId")]);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await dashboardApi.getOverview();
      setData(response.data.data);
    } catch (error) {
      console.error('Failed to load overview:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getRiskColor = (status: string) => {
    switch (status) {
      case 'GREEN':
        return 'text-green-600 bg-green-50';
      case 'AMBER':
        return 'text-amber-600 bg-amber-50';
      case 'RED':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getRiskIcon = (status: string) => {
    switch (status) {
      case 'GREEN':
        return <CheckCircle className="w-5 h-5" />;
      case 'AMBER':
        return <AlertCircle className="w-5 h-5" />;
      case 'RED':
        return <AlertTriangle className="w-5 h-5" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CFO Overview</h1>
          <p className="text-gray-600">Your financial health at a glance</p>
        </div>

        <Link to="/create-company" className="btn-primary px-4 py-2">
          + Create Company
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <p className="text-sm text-gray-600">Current Cash</p>
          <p className="text-2xl font-bold">
            {formatCurrency(data?.cashPosition.currentBalance || 0)}
          </p>
        </div>

        <div className="card">
          <p className="text-sm text-gray-600">Cash Runway</p>
          <p className="text-2xl font-bold">
            {data?.runway.months || 0} months
          </p>
        </div>

        <div className="card">
          <p className="text-sm text-gray-600">Avg Monthly Inflow</p>
          <p className="text-2xl font-bold">
            {formatCurrency(data?.runway.avgMonthlyInflow || 0)}
          </p>
        </div>

        <div className="card">
          <p className="text-sm text-gray-600">Avg Monthly Outflow</p>
          <p className="text-2xl font-bold">
            {formatCurrency(data?.runway.avgMonthlyOutflow || 0)}
          </p>
        </div>
      </div>
    </div>
  );
}
