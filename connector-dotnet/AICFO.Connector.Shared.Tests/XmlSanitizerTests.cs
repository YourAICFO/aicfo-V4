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

    [Fact]
    public void Sanitize_Removes_InvalidDecimalCharRef_ParsesSuccessfully()
    {
        var xml = "<ROOT><A>&#4; Primary</A></ROOT>";
        var (sanitized, removedCount) = XmlSanitizer.Sanitize(xml);

        Assert.True(removedCount > 0);
        Assert.DoesNotContain("&#4;", sanitized);
        var doc = XDocument.Parse(sanitized);
        Assert.NotNull(doc.Root);
        Assert.Equal("ROOT", doc.Root.Name.LocalName);
    }

    [Fact]
    public void Sanitize_Removes_InvalidHexCharRef_ParsesSuccessfully()
    {
        var xml = "<ROOT><A>&#x4; Primary</A></ROOT>";
        var (sanitized, removedCount) = XmlSanitizer.Sanitize(xml);

        Assert.True(removedCount > 0);
        var doc = XDocument.Parse(sanitized);
        Assert.NotNull(doc.Root);
        Assert.Equal("ROOT", doc.Root.Name.LocalName);
    }

    [Fact]
    public void Sanitize_Leaves_ValidCharRef_Intact()
    {
        var xml = "<ROOT><A>&#65; ABC</A></ROOT>";
        var (sanitized, removedCount) = XmlSanitizer.Sanitize(xml);

        Assert.Equal(0, removedCount);
        Assert.Equal(xml, sanitized);
    }
}
