import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { dashboardApi } from '../services/api';

interface CashflowData {
  monthlyCashflow: Array<{
    month: string;
    inflow: number;
    outflow: number;
    net: number;
  }>;
  cashHistory: Array<{
    date: string;
    amount: number;
  }>;
}

export default function Cashflow() {
  const [data, setData] = useState<CashflowData | null>(null);
  const [period, setPeriod] = useState('6m');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [period]);

  const loadData = async () => {
    try {
      const response = await dashboardApi.getCashflow(period);
      setData(response.data.data);
    } catch (error) {
      console.error('Failed to load cashflow data:', error);
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

  const formatMonth = (monthStr: string) => {
    const date = new Date(monthStr);
    return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
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
          <h1 className="text-2xl font-bold text-gray-900">Cashflow Dashboard</h1>
          <p className="text-gray-600">Track your cash inflows and outflows</p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="input w-32"
        >
          <option value="1m">Last Month</option>
          <option value="3m">Last 3 Months</option>
          <option value="6m">Last 6 Months</option>
          <option value="12m">Last Year</option>
        </select>
      </div>

      {/* Monthly Cashflow */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Monthly Cashflow</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.monthlyCashflow || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="month"
                tickFormatter={formatMonth}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                labelFormatter={(label) => formatMonth(label)}
              />
              <Legend />
              <Bar dataKey="inflow" name="Inflow" fill="#10b981" />
              <Bar dataKey="outflow" name="Outflow" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Net Cashflow */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Net Cashflow</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.monthlyCashflow || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="month"
                tickFormatter={formatMonth}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                labelFormatter={(label) => formatMonth(label)}
              />
              <Area
                type="monotone"
                dataKey="net"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cash Balance History */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Cash Balance History</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.cashHistory || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(date) => new Date(date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                labelFormatter={(label) => new Date(label).toLocaleDateString('en-IN')}
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="#8b5cf6"
                fill="#8b5cf6"
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
