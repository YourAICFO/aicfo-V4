import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, RefreshCw, Settings, Download, Plug } from 'lucide-react';
import { connectorApi } from '../services/api';
import { useAuthStore } from '../store/authStore';

interface ConnectorStatus {
  isConnected: boolean;
  lastSeen: string | null;
  lastSyncRun: any | null;
  clientId: string | null;
}

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  optional?: boolean;
}

export default function ConnectorOnboarding() {
  const [status, setStatus] = useState<ConnectorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const selectedCompanyId = useAuthStore((state) => state.selectedCompanyId);

  useEffect(() => {
    if (selectedCompanyId) {
      loadConnectorStatus();
    }
  }, [selectedCompanyId]);

  const loadConnectorStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await connectorApi.getStatus(selectedCompanyId!);
      setStatus(response.data.data);
    } catch (err: any) {
      console.error('Failed to load connector status:', err);
      setError(err.response?.data?.error || 'Failed to load connector status');
    } finally {
      setLoading(false);
    }
  };

  const checkConnection = async () => {
    try {
      setCheckingConnection(true);
      setError(null);
      await loadConnectorStatus();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Connection check failed');
    } finally {
      setCheckingConnection(false);
    }
  };

  const getOnboardingSteps = (): OnboardingStep[] => {
    const isConnected = status?.isConnected || false;
    const hasSynced = status?.lastSyncRun?.status === 'success';
    
    return [
      {
        id: 'download',
        title: 'Download Connector',
        description: 'Download and install the AI CFO Tally Connector on your Windows computer',
        completed: true, // User is already here, so they've downloaded it
      },
      {
        id: 'install',
        title: 'Install Connector',
        description: 'Run the installer as Administrator and complete installation',
        completed: isConnected,
      },
      {
        id: 'connect',
        title: 'Connect to Tally',
        description: 'Open the connector and connect to your Tally installation',
        completed: isConnected,
      },
      {
        id: 'sync',
        title: 'Sync Data',
        description: 'Perform your first data sync to verify everything works',
        completed: hasSynced,
        optional: true,
      },
    ];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Checking connector status...</p>
        </div>
      </div>
    );
  }

  const steps = getOnboardingSteps();
  const completedSteps = steps.filter(step => step.completed).length;
  const progress = (completedSteps / steps.length) * 100;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Connector Setup</h3>
          <p className="text-sm text-gray-600">Get your Tally connector up and running</p>
        </div>
        <button
          onClick={checkConnection}
          disabled={checkingConnection}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${checkingConnection ? 'animate-spin' : ''}`} />
          {checkingConnection ? 'Checking...' : 'Check Connection'}
        </button>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
          <span>Setup Progress</span>
          <span>{completedSteps} of {steps.length} steps completed</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Status Indicator */}
      {status?.isConnected && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <div>
              <p className="font-medium text-green-900">Connector Connected</p>
              <p className="text-sm text-green-700">
                Last seen: {status.lastSeen ? new Date(status.lastSeen).toLocaleString() : 'Just now'}
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Steps */}
      <div className="space-y-4">
        {steps.map((step, index) => (
          <div 
            key={step.id}
            className={`flex items-start gap-4 p-4 rounded-lg border ${
              step.completed 
                ? 'bg-green-50 border-green-200' 
                : 'bg-gray-50 border-gray-200'
            }`}
          >
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              step.completed ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-600'
            }`}>
              {step.completed ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <span className="text-sm font-medium">{index + 1}</span>
              )}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className={`font-medium ${
                  step.completed ? 'text-green-900' : 'text-gray-900'
                }`}>
                  {step.title}
                </h4>
                {step.optional && (
                  <span className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded-full">
                    Optional
                  </span>
                )}
              </div>
              <p className={`text-sm mt-1 ${
                step.completed ? 'text-green-700' : 'text-gray-600'
              }`}>
                {step.description}
              </p>
            </div>

            {step.id === 'download' && !step.completed && (
              <a
                href="/download"
                className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Download className="w-4 h-4" />
                Download
              </a>
            )}
          </div>
        ))}
      </div>

      {/* Connection Help */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <Settings className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Connection Requirements:</p>
            <ul className="space-y-1 text-blue-700">
              <li>• Windows 7 or later with .NET Framework 4.7.2+</li>
              <li>• Tally ERP 9 or TallyPrime with Tally API enabled</li>
              <li>• Active internet connection for cloud sync</li>
              <li>• Run connector as Administrator for first setup</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Sync Status */}
      {status?.lastSyncRun && (
        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Plug className="w-5 h-5 text-gray-600" />
              <div>
                <p className="font-medium text-gray-900">Last Sync</p>
                <p className="text-sm text-gray-600">
                  {status.lastSyncRun.status} • {new Date(status.lastSyncRun.finishedAt).toLocaleString()}
                </p>
              </div>
            </div>
            <span className={`px-2 py-1 text-xs rounded-full ${
              status.lastSyncRun.status === 'success' 
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {status.lastSyncRun.status}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}