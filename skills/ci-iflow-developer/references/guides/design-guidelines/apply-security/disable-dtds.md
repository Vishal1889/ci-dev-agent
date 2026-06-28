# Disable DTDs (XXE Prevention)

XML External Entity (XXE) attacks exploit DTD processing in XML parsers to read local files or trigger server-side request forgery. CPI's standard XML processing steps are generally safe, but if you use `DocumentBuilderFactory` in a Groovy script to parse XML, you must explicitly disable DTD processing. This is a defense-in-depth measure for any iFlow that parses untrusted XML input via custom scripts.

## Groovy Script Pattern

```groovy
import javax.xml.parsers.DocumentBuilderFactory
import javax.xml.parsers.DocumentBuilder
import org.xml.sax.InputSource

def Message processData(Message message) {
    def dbf = DocumentBuilderFactory.newInstance()
    dbf.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true)

    def db = dbf.newDocumentBuilder()
    def is = new InputSource(message.getBody())
    def doc = db.parse(is)

    message.setBody(doc)
    return message
}
```

The critical line is `dbf.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true)` which causes the parser to throw an exception if the XML contains any DOCTYPE declaration, preventing all XXE variants.

## Known Gotchas
- This only applies to custom Groovy script XML parsing; standard CPI XML-to-JSON, XSLT, and XPath steps handle XXE protection internally
- If legitimate DTDs are needed (rare in integration scenarios), use a more granular feature set instead of blanket disallow, but prefer disabling entirely
- The feature string is Apache Xerces-specific; it works on CPI's runtime but may differ in other JVM XML parser implementations
