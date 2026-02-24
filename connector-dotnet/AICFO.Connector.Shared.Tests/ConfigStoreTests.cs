using AICFO.Connector.Shared.Models;
using AICFO.Connector.Shared.Services;
using Xunit;

namespace AICFO.Connector.Shared.Tests;

public class ConfigStoreTests
{
    [Fact]
    public void LoadFromPath_MissingFile_ReturnsDefault()
    {
        var path = Path.Combine(Path.GetTempPath(), "aicfo-test-missing-" + Guid.NewGuid().ToString("N") + ".json");
        try
        {
            if (File.Exists(path)) File.Delete(path);
            var config = ConfigStore.LoadFromPath(path);
            Assert.NotNull(config);
            Assert.Equal("http://localhost:5000", config.ApiUrl);
            Assert.Equal("auto", config.ApiUrlMode);
        }
        finally
        {
            if (File.Exists(path)) File.Delete(path);
        }
    }

    [Fact]
    public void LoadFromPath_InvalidJson_RenamesToCorruptAndReturnsDefault()
    {
        var dir = Path.Combine(Path.GetTempPath(), "aicfo-test-" + Guid.NewGuid().ToString("N"));
        var path = Path.Combine(dir, "config.json");
        Directory.CreateDirectory(dir);
        try
        {
            File.WriteAllText(path, "{ invalid json");
            var corruptMessages = new List<string>();
            var config = ConfigStore.LoadFromPath(path, msg => corruptMessages.Add(msg));
            Assert.NotNull(config);
            Assert.Equal("http://localhost:5000", config.ApiUrl);
            Assert.Single(corruptMessages);
            Assert.Contains("corrupt", corruptMessages[0], StringComparison.OrdinalIgnoreCase);
            Assert.False(File.Exists(path), "Original file should be renamed");
            var corruptFiles = Directory.GetFiles(dir, "*.corrupt-*.json");
            Assert.Single(corruptFiles);
        }
        finally
        {
            if (Directory.Exists(dir)) Directory.Delete(dir, true);
        }
    }

    [Fact]
    public void LoadFromPath_NullBytesInFile_RenamesToCorruptAndReturnsDefault()
    {
        var dir = Path.Combine(Path.GetTempPath(), "aicfo-test-null-" + Guid.NewGuid().ToString("N"));
        var path = Path.Combine(dir, "config.json");
        Directory.CreateDirectory(dir);
        try
        {
            using (var fs = File.Create(path))
            {
                fs.Write(System.Text.Encoding.UTF8.GetBytes("{\"api_url\":\"x\""));
                fs.WriteByte(0x00);
                fs.Write(System.Text.Encoding.UTF8.GetBytes("}"));
            }
            var corruptMessages = new List<string>();
            var config = ConfigStore.LoadFromPath(path, msg => corruptMessages.Add(msg));
            Assert.NotNull(config);
            Assert.Equal("http://localhost:5000", config.ApiUrl);
            Assert.Single(corruptMessages);
            Assert.False(File.Exists(path), "Original file should be renamed");
            var corruptFiles = Directory.GetFiles(dir, "*.corrupt-*.json");
            Assert.Single(corruptFiles);
        }
        finally
        {
            if (Directory.Exists(dir)) Directory.Delete(dir, true);
        }
    }
}
