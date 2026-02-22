<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:wix="http://wixtoolset.org/schemas/v4/wxs">
  <xsl:output method="xml" indent="yes"/>
  <xsl:key name="svcCompIds" match="wix:Component[wix:File[contains(@Source,'AICFO.Connector.Service.exe')]]" use="@Id"/>
  <xsl:template match="@*|node()">
    <xsl:copy>
      <xsl:apply-templates select="@*|node()"/>
    </xsl:copy>
  </xsl:template>
  <xsl:template match="wix:Component[wix:File[contains(@Source,'AICFO.Connector.Service.exe')]]"/>
  <xsl:template match="wix:ComponentRef[key('svcCompIds', @Id)]"/>
</xsl:stylesheet>
