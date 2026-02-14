import { useState, useEffect } from 'react';
import { Plug, Check, X, RefreshCw, AlertCircle } from 'lucide-react';
import { integrationApi } from '../services/api';
import { useSubscriptionStore } from '../store/subscriptionStore';
import ConnectorOnboarding from '../components/ConnectorOnboarding';

interface Integration {
  id: string;
  type: 'TALLY' | 'ZOHO' | 'QUICKBOOKS';
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'SYNCING';
  companyName: string;
  lastSyncedAt: string;
  lastSyncStatus: string;
}

const integrationInfo = {
  TALLY: {
    name: 'Tally ERP 9 / Prime',
    description: 'Sync data directly from your Tally installation',
    icon: '📊',
    plan: 'Included in trial',
  },
  ZOHO: {
    name: 'Zoho Books',
    description: 'Connect your Zoho Books account',
    icon: '📚',
    plan: 'Included in trial',
  },
  QUICKBOOKS: {
    name: 'QuickBooks Online',
    description: 'Connect your QuickBooks account',
    icon: '💼',
    plan: 'Included in trial',
  },
};

export default function Integrations() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showTallyModal, setShowTallyModal] = useState(false);
  const [tallyConfig, setTallyConfig] = useState({ serverUrl: '', companyName: '' });
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const { isExpired, refresh } = useSubscriptionStore();

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    try {
      const response = await integrationApi.getAll();
      setIntegrations(response.data.data);
    } catch (err: any) {
      if (err.response?.status === 403) {
        await refresh();
        setError(err.response?.data?.error || 'Your free trial has expired. Please upgrade.');
      } else {
        setError('Failed to load integrations.');
      }
    } finally {
      setLoading(false);
    }
  };

  const connectTally = async () => {
    try {
      await integrationApi.connectTally(tallyConfig);
      setShowTallyModal(false);
      setTallyConfig({ serverUrl: '', companyName: '' });
      loadIntegrations();
    } catch (error) {
      console.error('Failed to connect Tally:', error);
    }
  };

  const syncIntegration = async (id: string) => {
    setSyncingId(id);
    try {
      await integrationApi.sync(id);
      loadIntegrations();
    } catch (error) {
      console.error('Failed to sync:', error);
    } finally {
      setSyncingId(null);
    }
  };

  const disconnect = async (id: string) => {
    if (!confirm('Are you sure you want to disconnect this integration?')) return;
    try {
      await integrationApi.disconnect(id);
      loadIntegrations();
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  const isConnected = (type: string) => {
    return integrations.some((i) => i.type === type && i.status === 'CONNECTED');
  };

  const getIntegration = (type: string) => {
    return integrations.find((i) => i.type === type);
  };

  const hasTallyConnector = isConnected('TALLY');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error && isExpired) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
          <p className="text-gray-600">Connect your accounting software</p>
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

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
          <p className="text-gray-600">Connect your accounting software</p>
        </div>
        <div className="card text-center py-12">
          <div className="text-amber-600 mb-4">
            <AlertCircle className="w-16 h-16 mx-auto" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Unable to load integrations</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
        <p className="text-gray-600">Connect your accounting software for automatic data sync</p>
      </div>

      {/* Connector Onboarding - Show if no Tally connector is connected */}
      {!hasTallyConnector && (
        <ConnectorOnboarding />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(integrationInfo).map(([type, info]) => {
          const integration = getIntegration(type);
          const connected = isConnected(type);

          return (
            <div key={type} className="card">
              <div className="flex items-start justify-between mb-4">
                <div className="text-4xl">{info.icon}</div>
                {connected ? (
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium flex items-center gap-1">
                    <Check className="w-4 h-4" />
                    Connected
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm font-medium">
                    {info.plan}
                  </span>
                )}
              </div>

              <h3 className="text-lg font-semibold mb-1">{info.name}</h3>
              <p className="text-gray-600 text-sm mb-4">{info.description}</p>

              {connected && integration ? (
                <div className="space-y-3">
                  <div className="text-sm">
                    <span className="text-gray-500">Company:</span>{' '}
                    <span className="font-medium">{integration.companyName}</span>
                  </div>
                  {integration.lastSyncedAt && (
                    <div className="text-sm">
                      <span className="text-gray-500">Last synced:</span>{' '}
                      <span>{new Date(integration.lastSyncedAt).toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => syncIntegration(integration.id)}
                      disabled={syncingId === integration.id}
                      className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 ${syncingId === integration.id ? 'animate-spin' : ''}`} />
                      {syncingId === integration.id ? 'Syncing...' : 'Sync Now'}
                    </button>
                    <button
                      onClick={() => disconnect(integration.id)}
                      className="px-3 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {type === 'TALLY' ? (
                    <>
                      <a
                        href="/download"
                        className="w-full btn-primary flex items-center justify-center gap-2"
                      >
                        <Plug className="w-4 h-4" />
                        Download Connector
                      </a>
                      <button
                        onClick={() => setShowTallyModal(true)}
                        className="w-full text-sm text-gray-600 hover:text-gray-800 underline"
                      >
                        Or use manual setup (Advanced)
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => alert(`${info.name} integration coming soon!`)}
                      className="w-full btn-primary flex items-center justify-center gap-2"
                    >
                      <Plug className="w-4 h-4" />
                      Connect
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Tally Connection Modal */}
      {showTallyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Connect Tally</h2>
            <div className="space-y-4">
              <div>
                <label className="label">Tally Server URL</label>
                <input
                  type="text"
                  value={tallyConfig.serverUrl}
                  onChange={(e) => setTallyConfig({ ...tallyConfig, serverUrl: e.target.value })}
                  className="input"
                  placeholder="http://localhost:9000"
                />
                <p className="text-xs text-gray-500 mt-1">Default Tally port is 9000</p>
              </div>
              <div>
                <label className="label">Company Name</label>
                <input
                  type="text"
                  value={tallyConfig.companyName}
                  onChange={(e) => setTallyConfig({ ...tallyConfig, companyName: e.target.value })}
                  className="input"
                  placeholder="Your Tally company name"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowTallyModal(false)}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={connectTally}
                  disabled={!tallyConfig.serverUrl || !tallyConfig.companyName}
                  className="flex-1 btn-primary disabled:opacity-50"
                >
                  Connect
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
