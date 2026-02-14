import { useState, useEffect } from 'react';
import { getVersionInfo, logVersion } from '../utils/version';

export default function VersionDisplay() {
  const [versionInfo, setVersionInfo] = useState<ReturnType<typeof getVersionInfo> | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Log version to console for debugging
    logVersion();
    
    // Set version info for display
    setVersionInfo(getVersionInfo());
  }, []);

  if (!versionInfo) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        title="Click for version details"
      >
        v{versionInfo.version} • {versionInfo.environment}
      </button>
      
      {showDetails && (
        <div className="absolute bottom-full right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[200px] z-10">
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-600">Version:</span>
              <span className="font-mono text-gray-900">{versionInfo.version}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Environment:</span>
              <span className="text-gray-900 capitalize">{versionInfo.environment}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Built:</span>
              <span className="text-gray-900">{versionInfo.buildDate}</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              This helps verify you're using the latest deployment.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}