# CSV to XML and XML to CSV Conversion

The CSV to XML Converter and XML to CSV Converter are built-in flow steps for transforming between flat-file CSV and XML representations. The CSV to XML Converter parses delimited text into structured XML elements. The XML to CSV Converter serializes XML data into delimited flat-file format. These are commonly used when integrating with systems that exchange flat-file data.

## Variant Matrix

| Variant | Step | Direction |
|---------|------|-----------|
| CSV to XML Converter | CSV to XML Converter step | CSV flat file -> XML |
| XML to CSV Converter | XML to CSV Converter step | XML -> CSV flat file |

## Flow Structure

**CSV to XML**: Sender (HTTPS) -> Start -> CSV to XML Converter -> Content Modifier ("Define context for monitoring purposes") -> End -> Receiver (ProcessDirect)

**XML to CSV**: Sender (HTTPS) -> Start -> Content Modifier ("Define Properties") -> Request Reply to WebShop (OData, fetches XML data) -> Content Modifier ("Define message body") -> XML to CSV Converter -> End -> Receiver (ProcessDirect)

## Known Gotchas
- The CSV to XML Converter step configuration includes field separator, record structure path, and whether the first row contains headers. These must match the actual CSV format exactly.
- The XML to CSV Converter requires the XML to have a regular, repeating structure. Irregular XML (mixed elements, varying depth) may produce unexpected CSV output.
- When converting XML to CSV, the Content Modifier step before the converter typically reshapes the XML to match the expected flat structure, removing nested elements or computed fields.
