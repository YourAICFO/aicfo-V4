using System.Xml.Linq;
using AICFO.Connector.Shared.Utils;
using Xunit;

namespace AICFO.Connector.Shared.Tests;

public class XmlSanitizerTests
{
    [Fact]
    public void Sanitize_RemovesInvalidChar0x03_ParsesSuccessfully()
    {
        var invalidChar = '\x03';
        var xml = $"<root><name>Test{invalidChar}Value</name></root>";
        var (sanitized, removedCount) = XmlSanitizer.Sanitize(xml);

        Assert.True(removedCount > 0, "Sanitizer should remove the 0x03 character");
        var doc = XDocument.Parse(sanitized);
        Assert.NotNull(doc.Root);
        Assert.Equal("root", doc.Root.Name.LocalName);
    }

    [Fact]
    public void Sanitize_ValidXml_RemovesNothing()
    {
        var xml = "<root><name>Valid</name></root>";
        var (sanitized, removedCount) = XmlSanitizer.Sanitize(xml);

        Assert.Equal(0, removedCount);
        Assert.Equal(xml, sanitized);
    }
}
