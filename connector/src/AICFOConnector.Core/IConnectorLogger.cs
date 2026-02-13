using System;

namespace AICFOConnector.Core
{
    /// <summary>
    /// Interface for connector logging
    /// </summary>
    public interface IConnectorLogger
    {
        void LogInfo(string message);
        void LogWarning(string message);
        void LogError(string message, Exception exception = null);
        void LogDebug(string message);
    }

    /// <summary>
    /// File-based logger implementation
    /// </summary>
    public class FileLogger : IConnectorLogger
    {
        private readonly string _logFilePath;
        private readonly object _lockObject = new object();

        public FileLogger(string logFilePath = null)
        {
            _logFilePath = logFilePath ?? GetDefaultLogPath();
            EnsureLogDirectoryExists();
        }

        public void LogInfo(string message)
        {
            WriteLog("INFO", message);
        }

        public void LogWarning(string message)
        {
            WriteLog("WARN", message);
        }

        public void LogError(string message, Exception exception = null)
        {
            var errorMessage = message;
            if (exception != null)
            {
                errorMessage += $"\nException: {exception.GetType().Name}\nMessage: {exception.Message}\nStackTrace: {exception.StackTrace}";
            }
            WriteLog("ERROR", errorMessage);
        }

        public void LogDebug(string message)
        {
#if DEBUG
            WriteLog("DEBUG", message);
#endif
        }

        private void WriteLog(string level, string message)
        {
            lock (_lockObject)
            {
                try
                {
                    var timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff");
                    var logEntry = $"[{timestamp}] [{level}] {message}{Environment.NewLine}";
                    
                    System.IO.File.AppendAllText(_logFilePath, logEntry);
                }
                catch (Exception ex)
                {
                    // If we can't write to file, try to write to Windows Event Log as fallback
                    try
                    {
                        System.Diagnostics.EventLog.WriteEntry("AICFO Connector", 
                            $"Failed to write to log file: {ex.Message}\nOriginal message: {message}", 
                            System.Diagnostics.EventLogEntryType.Error);
                    }
                    catch
                    {
                        // Last resort - ignore logging error
                    }
                }
            }
        }

        private string GetDefaultLogPath()
        {
            var appDataPath = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            var logDirectory = System.IO.Path.Combine(appDataPath, "AICFO", "Connector", "logs");
            
            if (!System.IO.Directory.Exists(logDirectory))
            {
                System.IO.Directory.CreateDirectory(logDirectory);
            }

            var dateStamp = DateTime.Now.ToString("yyyy-MM-dd");
            return System.IO.Path.Combine(logDirectory, $"connector-{dateStamp}.log");
        }

        private void EnsureLogDirectoryExists()
        {
            var directory = System.IO.Path.GetDirectoryName(_logFilePath);
            if (!System.IO.Directory.Exists(directory))
            {
                System.IO.Directory.CreateDirectory(directory);
            }
        }
    }

    /// <summary>
    /// Windows Event Log logger implementation
    /// </summary>
    public class EventLogger : IConnectorLogger
    {
        private readonly string _sourceName;

        public EventLogger(string sourceName = "AICFO Connector")
        {
            _sourceName = sourceName;
            
            // Create event source if it doesn't exist (requires admin privileges)
            try
            {
                if (!System.Diagnostics.EventLog.SourceExists(_sourceName))
                {
                    System.Diagnostics.EventLog.CreateEventSource(_sourceName, "Application");
                }
            }
            catch
            {
                // Ignore if we can't create the source (might not have admin rights)
            }
        }

        public void LogInfo(string message)
        {
            WriteEventLog(message, System.Diagnostics.EventLogEntryType.Information);
        }

        public void LogWarning(string message)
        {
            WriteEventLog(message, System.Diagnostics.EventLogEntryType.Warning);
        }

        public void LogError(string message, Exception exception = null)
        {
            var errorMessage = message;
            if (exception != null)
            {
                errorMessage += $"\nException: {exception.GetType().Name}\nMessage: {exception.Message}";
            }
            WriteEventLog(errorMessage, System.Diagnostics.EventLogEntryType.Error);
        }

        public void LogDebug(string message)
        {
#if DEBUG
            WriteEventLog(message, System.Diagnostics.EventLogEntryType.Information);
#endif
        }

        private void WriteEventLog(string message, System.Diagnostics.EventLogEntryType entryType)
        {
            try
            {
                System.Diagnostics.EventLog.WriteEntry(_sourceName, message, entryType);
            }
            catch
            {
                // Ignore if we can't write to event log
            }
        }
    }

    /// <summary>
    /// Composite logger that writes to multiple destinations
    /// </summary>
    public class CompositeLogger : IConnectorLogger
    {
        private readonly List<IConnectorLogger> _loggers;

        public CompositeLogger(params IConnectorLogger[] loggers)
        {
            _loggers = new List<IConnectorLogger>(loggers);
        }

        public void LogInfo(string message)
        {
            foreach (var logger in _loggers)
            {
                logger.LogInfo(message);
            }
        }

        public void LogWarning(string message)
        {
            foreach (var logger in _loggers)
            {
                logger.LogWarning(message);
            }
        }

        public void LogError(string message, Exception exception = null)
        {
            foreach (var logger in _loggers)
            {
                logger.LogError(message, exception);
            }
        }

        public void LogDebug(string message)
        {
            foreach (var logger in _loggers)
            {
                logger.LogDebug(message);
            }
        }
    }
}