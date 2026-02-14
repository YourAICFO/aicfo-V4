import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  Download as DownloadIcon,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Settings,
  Shield,
  Zap,
  Monitor,
} from 'lucide-react';
import api from '../services/api';

interface DownloadInfo {
  filename: string;
  version: string;
  supportedPlatforms: string[];
  systemRequirements: {
    os: string;
    framework: string;
    tally: string;
    ram: string;
    disk: string;
  };
  downloadUrl: string;
  isWindows: boolean;
  canDownload: boolean;
  fileSize: number | null;
  lastUpdated: string | null;
  features: string[];
  installationSteps: string[];
}

export default function Download() {
  const [downloadInfo, setDownloadInfo] = useState<DownloadInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDownloadInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDownloadInfo = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/download/info');
      setDownloadInfo(response.data.data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch download info:', err);
      setError('Failed to load download information. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!downloadInfo?.canDownload) return;

    try {
      setIsDownloading(true);
      setError(null);

      // Use direct browser download by creating a direct link to the backend
      // This bypasses any SPA routing and lets the browser handle the download
      const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
      const downloadUrl = `${backendUrl}/download/connector`;
      
      // Create a direct download link
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = downloadInfo.filename;
      link.target = '_blank'; // Open in new tab to avoid SPA interference
      link.rel = 'noopener noreferrer';
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Reset download state after a delay
      setTimeout(() => {
        setIsDownloading(false);
      }, 2000);

      // Optional analytics
      const w = window as unknown as { gtag?: (...args: any[]) => void };
      if (w.gtag) {
        w.gtag('event', 'download', {
          event_category: 'connector',
          event_label: downloadInfo.version,
          value: 1,
        });
      }
    } catch (err) {
      console.error('Download failed:', err);
      setError('Download failed. Please try again or contact support.');
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto mb-4" />
            <p className="text-slate-300">Loading download information...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Download AI CFO Tally Connector for Windows | Free Integration Tool</title>
        <meta
          name="description"
          content="Download the free AI CFO Tally Connector for Windows. Connect your Tally ERP 9 or TallyPrime to AI CFO's cloud platform for automated financial insights and reporting."
        />
        <meta
          name="keywords"
          content="Tally connector, Tally ERP 9 integration, TallyPrime connector, Windows download, AI CFO, financial software, accounting integration"
        />

        {/* Open Graph / Social Media */}
        <meta property="og:title" content="Download AI CFO Tally Connector for Windows" />
        <meta
          property="og:description"
          content="Free Windows application to connect Tally ERP 9/TallyPrime to AI CFO's AI-powered financial analytics platform."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://aicfo.com/download" />
        <meta property="og:image" content="https://aicfo.com/og-download.jpg" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="AI CFO Tally Connector - Free Download" />
        <meta
          name="twitter:description"
          content="Connect Tally to AI CFO's cloud platform for automated financial insights."
        />
        <meta name="twitter:image" content="https://aicfo.com/twitter-download.jpg" />

        {/* Canonical URL */}
        <link rel="canonical" href="https://aicfo.com/download" />

        {/* Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'AI CFO Tally Connector',
            description: "Windows application to connect Tally ERP 9 and TallyPrime to AI CFO's cloud platform",
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Windows 7 or later',
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'INR',
            },
            publisher: {
              '@type': 'Organization',
              name: 'AI CFO Platform',
              url: 'https://aicfo.com',
            },
            downloadUrl: 'https://aicfo.com/download/connector',
          })}
        </script>
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        {/* Header */}
        <header className="border-b border-white/10">
          <div className="max-w-6xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 ring-1 ring-emerald-400/40">
                  <Settings className="h-5 w-5 text-emerald-300" />
                </div>
                <div>
                  <p className="text-sm text-emerald-200/80">AI CFO</p>
                  <p className="text-lg font-semibold text-white">Tally Connector</p>
                </div>
              </div>
              <a href="/" className="text-sm text-slate-300 hover:text-white transition-colors">
                ← Back to Home
              </a>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-12">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Download AI CFO Tally Connector
            </h1>
            <p className="text-xl text-slate-300 max-w-3xl mx-auto mb-8">
              Connect your Tally ERP 9 or TallyPrime to AI CFO&apos;s cloud platform. Get automated financial
              insights, AI-powered analytics, and real-time reporting.
            </p>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-8 max-w-2xl mx-auto">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  <p className="text-red-300">{error}</p>
                </div>
              </div>
            )}

            {/* Download Button */}
            <div className="bg-white/5 backdrop-blur rounded-2xl p-8 ring-1 ring-white/10 max-w-2xl mx-auto">
              {downloadInfo?.canDownload ? (
                <>
                  <div className="flex items-center justify-center gap-3 mb-6">
                    <Monitor className="w-8 h-8 text-blue-400" />
                    <div className="text-left">
                      <h3 className="text-lg font-semibold text-white">Windows Download</h3>
                      <p className="text-sm text-slate-400">Version {downloadInfo.version} • Free</p>
                    </div>
                  </div>

                  <button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-200 flex items-center justify-center gap-3 mb-4"
                  >
                    {isDownloading ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Preparing Download...
                      </>
                    ) : (
                      <>
                        <DownloadIcon className="w-5 h-5" />
                        Download Connector
                      </>
                    )}
                  </button>

                  <p className="text-sm text-slate-400">
                    File size:{' '}
                    {downloadInfo.fileSize
                      ? `${(downloadInfo.fileSize / 1024 / 1024).toFixed(1)} MB`
                      : 'Calculating...'}
                  </p>
                </>
              ) : (
                <div className="text-center">
                  <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">Windows Required</h3>
                  <p className="text-slate-300 mb-4">
                    The AI CFO Tally Connector is designed specifically for Windows systems running Tally ERP 9
                    or TallyPrime.
                  </p>
                  <p className="text-sm text-slate-400">
                    Please use a Windows computer to download and install the connector.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {downloadInfo?.features.map((feature, index) => (
              <div key={index} className="bg-white/5 backdrop-blur rounded-xl p-6 ring-1 ring-white/10">
                <div className="flex items-center gap-3 mb-3">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <h4 className="font-semibold text-white">{feature}</h4>
                </div>
              </div>
            ))}
          </div>

          {/* System Requirements */}
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <div className="bg-white/5 backdrop-blur rounded-xl p-6 ring-1 ring-white/10">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                <Settings className="w-5 h-5 text-blue-400" />
                System Requirements
              </h3>
              <ul className="space-y-3 text-slate-300">
                <li className="flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>{downloadInfo?.systemRequirements.os}</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>{downloadInfo?.systemRequirements.framework}</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>{downloadInfo?.systemRequirements.tally}</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>{downloadInfo?.systemRequirements.ram}</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>{downloadInfo?.systemRequirements.disk}</span>
                </li>
              </ul>
            </div>

            <div className="bg-white/5 backdrop-blur rounded-xl p-6 ring-1 ring-white/10">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                <Zap className="w-5 h-5 text-yellow-400" />
                Installation Steps
              </h3>
              <ol className="space-y-3 text-slate-300">
                {downloadInfo?.installationSteps.map((step, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="bg-emerald-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* Security Notice */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <Shield className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-white mb-2">Security &amp; Privacy</h3>
                <p className="text-slate-300 mb-3">The AI CFO Tally Connector uses enterprise-grade security:</p>
                <ul className="space-y-2 text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span>Short-lived authentication tokens</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span>HTTPS encrypted communication</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span>No permanent local data storage</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span>Read-only access to Tally data</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-white/10 py-8">
          <div className="max-w-6xl mx-auto px-6 text-center">
            <p className="text-slate-400 text-sm">
              Need help? Contact our support team at{' '}
              <a href="mailto:support@aicfo.com" className="text-emerald-400 hover:text-emerald-300">
                support@aicfo.com
              </a>
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
