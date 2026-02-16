import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle, AlertCircle, Clock, WifiOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { connectorApi, type ConnectorStatusV1Data } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

interface SyncStatusWidgetProps {
  className?: string;
  showRefresh?: boolean;
  compact?: boolean;
}

export const SyncStatusWidget: React.FC<SyncStatusWidgetProps> = ({
  className = '',
  showRefresh = true,
  compact = false,
}) => {
  const [syncStatus, setSyncStatus] = useState<ConnectorStatusV1Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const selectedCompanyId = useAuthStore((state) => state.selectedCompanyId);

  useEffect(() => {
    if (selectedCompanyId) {
      loadSyncStatus();
    }
  }, [selectedCompanyId]);

  const loadSyncStatus = async () => {
    if (!selectedCompanyId) {
      setSyncStatus(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await connectorApi.getStatusV1(selectedCompanyId);
      if (response?.data?.success) {
        setSyncStatus(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load sync status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSyncStatus();
    setRefreshing(false);
  };

  const getStatusIcon = () => {
    if (!syncStatus) return <Clock className="w-5 h-5 text-gray-400" />;

    if (!syncStatus.connector.isOnline) {
      return <WifiOff className="w-5 h-5 text-gray-400" />;
    }

    switch (syncStatus.sync.lastRunStatus) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'running':
        return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'failed':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'partial':
        return <AlertCircle className="w-5 h-5 text-amber-500" />;
      default:
        return <WifiOff className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    if (!syncStatus) return 'Loading...';
    if (!syncStatus.connector.isOnline) return 'Offline';
    if (!syncStatus.sync.lastRunStatus) return 'Connected';

    switch (syncStatus.sync.lastRunStatus) {
      case 'running':
        return 'Syncing...';
      case 'success':
        return syncStatus.dataReadiness.status === 'ready' ? 'Ready' : 'Connected';
      case 'failed':
        return 'Sync Failed';
      case 'partial':
        return 'Partial Sync';
      default:
        return 'Connected';
    }
  };

  const getStatusColor = () => {
    if (!syncStatus) return 'text-gray-400';
    if (!syncStatus.connector.isOnline) return 'text-gray-400';

    switch (syncStatus.sync.lastRunStatus) {
      case 'running':
        return 'text-blue-600';
      case 'success':
        return syncStatus.dataReadiness.status === 'ready' ? 'text-green-600' : 'text-amber-600';
      case 'failed':
        return 'text-red-600';
      case 'partial':
        return 'text-amber-600';
      default:
        return 'text-gray-400';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const getConnectorStatus = () => {
    if (!syncStatus?.connector.lastSeenAt) return 'Not connected';
    
    const lastSeen = new Date(syncStatus.connector.lastSeenAt);
    const now = new Date();
    const minutesAgo = Math.floor((now.getTime() - lastSeen.getTime()) / (1000 * 60));
    
    if (minutesAgo < 1) return 'Connected now';
    if (minutesAgo < 60) return `Connected ${minutesAgo}m ago`;
    if (minutesAgo < 1440) return `Connected ${Math.floor(minutesAgo / 60)}h ago`;
    return `Connected ${Math.floor(minutesAgo / 1440)}d ago`;
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-20">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        {getStatusIcon()}
        <span className={`text-sm font-medium ${getStatusColor()}`}>
          {getStatusText()}
        </span>
        {showRefresh && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="ml-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <CardTitle className="text-base">Sync Status</CardTitle>
          </div>
          {showRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className={`font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>

        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex justify-between">
            <span>Last sync:</span>
            <span>{formatDate(syncStatus?.sync.lastRunCompletedAt || null)}</span>
          </div>
          <div className="flex justify-between">
            <span>Connector:</span>
            <span>{getConnectorStatus()}</span>
          </div>
          <div className="flex justify-between">
            <span>Readiness:</span>
            <span>{syncStatus?.dataReadiness.status || 'never'}{syncStatus?.dataReadiness.latestMonthKey ? ` (${syncStatus.dataReadiness.latestMonthKey})` : ''}</span>
          </div>
        </div>

        {syncStatus?.sync.lastError && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">
              Error: {syncStatus.sync.lastError}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
