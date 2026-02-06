import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, AlertCircle, Wallet, TrendingUp, TrendingDown } from 'lucide-react';
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
  const [companyId, setCompanyId] = useState(localStorage.getItem("companyId"));

  // reload only when company changes
  useEffect(() => {
    loadData();
  }, [companyId]);

  // detect company switch from dropdown
  useEffect(() => {
    const interval = setInterval(() => {
      const currentCompany = localStorage.getItem("companyId");
      if (currentCompany !== companyId) {
        setCompanyId(currentCompany);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [companyId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await dashboardApi.getOverview();

      if (response?.data?.data) {
        setData(response.data.data);
      }
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

  const getInsightIcon = (level: string) => {
    switch (level) {
      case 'GREEN':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'AMBER':
        return <AlertCircle className="w-5 h-5 text-amber-600" />;
      case 'RED':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      default:
        return null;
    }
  };

  const getInsightBorder = (level: string) => {
    switch (level) {
      case 'GREEN':
        return 'border-l-green-500';
      case 'AMBER':
        return 'border-l-amber-500';
      case 'RED':
        return 'border-l-red-500';
      default:
        return 'border-l-gray-300';
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

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CFO Overview</h1>
          <p className="text-gray-600">Your financial health at a glance</p>
        </div>

        <Link to="/create-company" className="btn-primary px-4 py-2">
          + Create Company
        </Link>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

        {/* Cash */}
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

        {/* Runway */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-3 rounded-lg ${getRiskColor(data?.runway.status || '')}`}>
              {getRiskIcon(data?.runway.status || '')}
            </div>
            <div>
              <p className="text-sm text-gray-600">Cash Runway</p>
              <p className="text-2xl font-bold">
                {data?.runway.months ?? 0} months
              </p>
            </div>
          </div>
        </div>

        {/* Inflow */}
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

        {/* Outflow */}
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
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">AI Insights</h2>
            <p className="text-sm text-gray-600">Latest recommendations and risk alerts</p>
          </div>
          <Link to="/ai-insights" className="text-sm font-medium text-primary-700 hover:text-primary-800">
            View all
            {data?.insights.unreadCount ? (
              <span className="ml-2 inline-flex items-center justify-center text-xs font-semibold bg-primary-100 text-primary-700 rounded-full px-2 py-0.5">
                {data.insights.unreadCount} new
              </span>
            ) : null}
          </Link>
        </div>

        {(data?.insights.recent || []).length === 0 ? (
          <div className="text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-6 text-center">
            No insights yet. Add transactions to unlock AI recommendations.
          </div>
        ) : (
          <div className="space-y-3">
            {data?.insights.recent.map((insight) => (
              <div
                key={insight.id}
                className={`border-l-4 ${getInsightBorder(insight.riskLevel)} bg-white rounded-lg px-4 py-3 shadow-sm`}
              >
                <div className="flex items-start gap-3">
                  {getInsightIcon(insight.riskLevel)}
                  <div>
                    <h3 className="font-medium text-gray-900">{insight.title}</h3>
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
