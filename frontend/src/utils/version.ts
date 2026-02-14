// Version utility for deployment verification
// This file is automatically updated during build process

export const VERSION = {
  // This will be replaced during build with actual git commit hash
  hash: '__GIT_COMMIT_HASH__',
  
  // Build timestamp
  buildTime: '__BUILD_TIME__',
  
  // Environment
  environment: import.meta.env.MODE || 'development',
  
  // API URL for verification
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:8080',
};

// Get human readable version info
export const getVersionInfo = () => {
  const isProduction = VERSION.environment === 'production';
  const buildDate = VERSION.buildTime !== '__BUILD_TIME__' ? new Date(VERSION.buildTime) : new Date();
  
  return {
    version: VERSION.hash !== '__GIT_COMMIT_HASH__' ? VERSION.hash.substring(0, 8) : 'dev',
    buildDate: buildDate.toLocaleString(),
    environment: VERSION.environment,
    isProduction,
  };
};

// Display version in console for debugging
export const logVersion = () => {
  const versionInfo = getVersionInfo();
  console.log('🚀 AI CFO Platform Version:', versionInfo);
  
  if (versionInfo.isProduction) {
    console.log('📦 Production Build:', versionInfo.version);
    console.log('🏗️  Built at:', versionInfo.buildDate);
  } else {
    console.log('🔧 Development Mode');
  }
};

// Check if version is valid (not placeholder)
export const isValidVersion = () => {
  return VERSION.hash !== '__GIT_COMMIT_HASH__' && VERSION.buildTime !== '__BUILD_TIME__';
};