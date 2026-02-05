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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
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

      {/* Header + Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CFO Overview</h1>
          <p className="text-gray-600">Your financial health at a glance</p>
        </div>

        <Link
          to="/create-company"
          className="btn-primary px-4 py-2"
        >
          + Create Company
        </Link>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Wallet className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Current Cash</p>
              <p className="text-2xl font-bold">
                {formatCurrency(data?.cashPosition.currentBalance || 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-3 rounded-lg ${getRiskColor(data?.runway.status || '')}`}>
              {getRiskIcon(data?.runway.status || '')}
            </div>
            <div>
              <p className="text-sm text-gray-600">Cash Runway</p>
              <p className="text-2xl font-bold">{data?.runway.months} months</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Avg Monthly Inflow</p>
              <p className="text-2xl font-bold">
                {formatCurrency(data?.runway.avgMonthlyInflow || 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-red-100 rounded-lg">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Avg Monthly Outflow</p>
              <p className="text-2xl font-bold">
                {formatCurrency(data?.runway.avgMonthlyOutflow || 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* AI Insights */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">AI Insights</h2>
          {data?.insights.unreadCount > 0 && (
            <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
              {data.insights.unreadCount} new
            </span>
          )}
        </div>

        {data?.insights.recent.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No insights available. Add more financial data to get AI-powered insights.
          </p>
        ) : (
          <div className="space-y-4">
            {data?.insights.recent.map((insight) => (
              <div
                key={insight.id}
                className={`p-4 rounded-lg border-l-4 ${
                  insight.riskLevel === 'GREEN'
                    ? 'border-green-500 bg-green-50'
                    : insight.riskLevel === 'AMBER'
                    ? 'border-amber-500 bg-amber-50'
                    : 'border-red-500 bg-red-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  {getRiskIcon(insight.riskLevel)}
                  <div>
                    <h3 className="font-medium">{insight.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{insight.content}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
