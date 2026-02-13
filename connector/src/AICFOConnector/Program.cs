using System;
using System.Threading;
using System.Windows.Forms;
using AICFOConnector.Core;
using AICFOConnector.UI;

namespace AICFOConnector
{
    static class Program
    {
        /// <summary>
        /// The main entry point for the application.
        /// </summary>
        [STAThread]
        static void Main()
        {
            try
            {
                // Enable visual styles
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);

                // Set up exception handling
                AppDomain.CurrentDomain.UnhandledException += CurrentDomain_UnhandledException;
                Application.ThreadException += Application_ThreadException;

                // Create logger
                var logger = new CompositeLogger(
                    new FileLogger(),
                    new EventLogger()
                );

                logger.LogInfo("AICFO Tally Connector starting...");

                // Create and run the application
                using (var mainForm = new MainForm(logger))
                {
                    Application.Run(mainForm);
                }

                logger.LogInfo("AICFO Tally Connector shutting down...");
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    $"Fatal error: {ex.Message}\n\nThe application will now close.",
                    "AICFO Connector - Fatal Error",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
            }
        }

        /// <summary>
        /// Handle unhandled exceptions in the main thread
        /// </summary>
        private static void Application_ThreadException(object sender, ThreadExceptionEventArgs e)
        {
            HandleUnhandledException(e.Exception, "Thread Exception");
        }

        /// <summary>
        /// Handle unhandled exceptions in the AppDomain
        /// </summary>
        private static void CurrentDomain_UnhandledException(object sender, UnhandledExceptionEventArgs e)
        {
            HandleUnhandledException(e.ExceptionObject as Exception, "AppDomain Exception");
        }

        /// <summary>
        /// Handle unhandled exceptions
        /// </summary>
        private static void HandleUnhandledException(Exception ex, string exceptionType)
        {
            if (ex == null) return;

            try
            {
                // Log to Windows Event Log as last resort
                System.Diagnostics.EventLog.WriteEntry("AICFO Connector",
                    $"Unhandled {exceptionType}: {ex.GetType().Name}\nMessage: {ex.Message}\nStackTrace: {ex.StackTrace}",
                    System.Diagnostics.EventLogEntryType.Error);
            }
            catch
            {
                // If even event log fails, there's nothing more we can do
            }

            // Show error to user
            MessageBox.Show(
                $"An unexpected error occurred ({exceptionType}):\n\n{ex.Message}\n\nThe application will now close.\n\nPlease check the Windows Event Log for more details.",
                "AICFO Connector - Unexpected Error",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
        }
    }
}