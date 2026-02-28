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
            var corruptFiles = Directory.GetFiles(dir, "*.bad-*");
            Assert.Single(corruptFiles);
        }
        finally
        {
            if (Directory.Exists(dir)) Directory.Delete(dir, true);
        }
    }

    [Fact]
    public void LoadFromPath_FileBeginsWithNull_RenamesToCorruptAndReturnsDefault()
    {
        var dir = Path.Combine(Path.GetTempPath(), "aicfo-test-leadnull-" + Guid.NewGuid().ToString("N"));
        var path = Path.Combine(dir, "config.json");
        Directory.CreateDirectory(dir);
        try
        {
            using (var fs = File.Create(path))
            {
                fs.WriteByte(0x00);
                fs.Write(System.Text.Encoding.UTF8.GetBytes("{\"api_url\":\"x\"}"));
            }
            var corruptMessages = new List<string>();
            var config = ConfigStore.LoadFromPath(path, msg => corruptMessages.Add(msg));
            Assert.NotNull(config);
            Assert.Equal("http://localhost:5000", config.ApiUrl);
            Assert.Single(corruptMessages);
            Assert.False(File.Exists(path), "Original file should be renamed");
            var corruptFiles = Directory.GetFiles(dir, "*.bad-*");
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
            var corruptFiles = Directory.GetFiles(dir, "*.bad-*");
            Assert.Single(corruptFiles);
        }
        finally
        {
            if (Directory.Exists(dir)) Directory.Delete(dir, true);
        }
    }

    [Fact]
    public void Save_FirstRun_WhenConfigMissing_WritesValidJson()
    {
        var dir = Path.Combine(Path.GetTempPath(), "aicfo-test-save1-" + Guid.NewGuid().ToString("N"));
        var path = Path.Combine(dir, "config.json");
        Directory.CreateDirectory(dir);
        try
        {
            Assert.False(File.Exists(path));
            var store = new ConfigStore(path);
            var config = ConnectorConfig.Default();
            store.Save(config);
            Assert.True(File.Exists(path));
            var content = File.ReadAllText(path, new System.Text.UTF8Encoding(false));
            Assert.Contains("\"api_url\"", content);
            Assert.DoesNotContain("\0", content);
            var reloaded = ConfigStore.LoadFromPath(path);
            Assert.NotNull(reloaded);
            Assert.Equal(config.ApiUrl, reloaded.ApiUrl);
        }
        finally
        {
            if (Directory.Exists(dir)) Directory.Delete(dir, true);
        }
    }

    [Fact]
    public void Save_WhenFileExists_ReplacesWithValidJson()
    {
        var dir = Path.Combine(Path.GetTempPath(), "aicfo-test-save2-" + Guid.NewGuid().ToString("N"));
        var path = Path.Combine(dir, "config.json");
        Directory.CreateDirectory(dir);
        try
        {
            File.WriteAllText(path, "{\"api_url\":\"old\"}");
            var store = new ConfigStore(path);
            var config = ConnectorConfig.Default();
            config.ApiUrl = "https://example.com";
            store.Save(config);
            Assert.True(File.Exists(path));
            var content = File.ReadAllText(path, new System.Text.UTF8Encoding(false));
            Assert.Contains("https://example.com", content);
            Assert.DoesNotContain("\0", content);
            var reloaded = ConfigStore.LoadFromPath(path);
            Assert.NotNull(reloaded);
            Assert.Equal("https://example.com", reloaded.ApiUrl);
        }
        finally
        {
            if (Directory.Exists(dir)) Directory.Delete(dir, true);
        }
    }
}
