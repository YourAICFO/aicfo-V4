import { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, AlertCircle, X, Check, Sparkles } from 'lucide-react';
import { aiApi } from '../services/api';
import { useAuthStore } from '../store/authStore';

interface Insight {
  id: string;
  type: string;
  riskLevel: 'GREEN' | 'AMBER' | 'RED';
  title: string;
  content: string;
  explanation: string;
  recommendations: string[];
  isRead: boolean;
  createdAt: string;
}

export default function AIInsights() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const selectedCompanyId = useAuthStore((state) => state.selectedCompanyId);

  const unreadCount = insights.filter(i => !i.isRead).length;
  const highRiskCount = insights.filter(i => i.riskLevel === 'RED').length;

  useEffect(() => {
    if (!selectedCompanyId) return;
    loadInsights();
  }, [selectedCompanyId]);

  const loadInsights = async () => {
    try {
      const response = await aiApi.getInsights();
      setInsights(response.data.data);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError('AI Insights require a paid plan. Please upgrade to access this feature.');
      } else {
        setError('Failed to load insights. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await aiApi.markRead(id);
      setInsights(insights.map(i => i.id === id ? { ...i, isRead: true } : i));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const dismissInsight = async (id: string) => {
    try {
      await aiApi.dismiss(id);
      setInsights(insights.filter(i => i.id !== id));
    } catch (error) {
      console.error('Failed to dismiss:', error);
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'GREEN':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'AMBER':
        return <AlertCircle className="w-6 h-6 text-amber-600" />;
      case 'RED':
        return <AlertTriangle className="w-6 h-6 text-red-600" />;
      default:
        return null;
    }
  };

  const getRiskBorder = (level: string) => {
    switch (level) {
      case 'GREEN':
        return 'border-l-green-500';
      case 'AMBER':
        return 'border-l-amber-500';
      case 'RED':
        return 'border-l-red-500';
      default:
        return 'border-l-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Insights</h1>
          <p className="text-gray-600">AI-powered financial intelligence</p>
        </div>
        <div className="card text-center py-12">
          <div className="text-amber-600 mb-4">
            <AlertCircle className="w-16 h-16 mx-auto" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Upgrade Required</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button className="btn-primary">Upgrade to Paid Plan</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Insights</h1>
          <p className="text-gray-600">AI-powered financial intelligence for your business</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
            <Sparkles className="h-4 w-4" />
            {unreadCount} unread
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
            <AlertTriangle className="h-4 w-4" />
            {highRiskCount} high risk
          </span>
        </div>
      </div>

      {insights.length === 0 ? (
        <div className="card text-center py-12">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">All Clear!</h2>
          <p className="text-gray-600">No insights available at the moment. Your finances look healthy.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {insights.map((insight) => (
            <div
              key={insight.id}
              className={`card border-l-4 ${getRiskBorder(insight.riskLevel)} ${
                insight.isRead ? 'opacity-75' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  {getRiskIcon(insight.riskLevel)}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">{insight.title}</h3>
                      {!insight.isRead && (
                        <span className="px-2 py-0.5 bg-primary-100 text-primary-700 rounded text-xs font-medium">
                          New
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 mt-1">{insight.content}</p>
                    
                    {insight.explanation && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600">{insight.explanation}</p>
                      </div>
                    )}
                    
                    {insight.recommendations && insight.recommendations.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-gray-700 mb-2">Recommendations:</p>
                        <ul className="space-y-1">
                          {insight.recommendations.map((rec, idx) => (
                            <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                              <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {!insight.isRead && (
                    <button
                      onClick={() => markAsRead(insight.id)}
                      className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                      title="Mark as read"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    onClick={() => dismissInsight(insight.id)}
                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                    title="Dismiss"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
