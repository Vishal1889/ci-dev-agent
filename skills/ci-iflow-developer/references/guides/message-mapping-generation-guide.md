# SAP CI Message Mapping (.mmap) Generation Guide

> **CRITICAL:** Many `fname` values differ from UI labels (e.g., `sub` not `subtract`, `mul` not `multiply`). ONLY use the exact `fname` from the tables below. All values verified from real deployed artifacts.

## 1. XML Skeleton

```xml
<xiObj xmlns="urn:sap-com:xi">
  <idInfo VID="01"><vc caption="LOCAL" sp="-1" swcGuid="00000000000000000000000000000000" vcType="S"><clCxt consider="A"/></vc><key typeID="XI_TRAFO" version=""/><version>1.0</version></idInfo>
  <documentation><description/></documentation>
  <generic>
    <admInf><modifBy/><modifAt/><modifAtLong>{timestamp_ms}</modifAtLong><owner/></admInf>
    <lnks>
      {lnkRole_elements}  <!-- See Section 2 -->
    </lnks>
    <textInfo loadedL="EN"><textObj id="{uuid_hex32}" masterL="EN" type="0"><texts lang="EN"><text label=""/></texts></textObj></textInfo>
  </generic>
  <content>
    <tr:XiTrafo xmlns:tr="urn:sap-com:xi:mapping:xitrafo">
      <tr:MetaData>
        <mappingtool version="XI7.1"><project version="XI7.1">
          <libstorage>
            <entry name="usernamespace"><functionstorage version="XI7.1"><key><key typeID=""><elem/><elem/></key></key><classname/><package/><imports/><globals><javaText/></globals><init><functionmodel><signature cacheType="0"/><name/><key/><tab/><title/><uiTitle/><implementation type="udf"><javaText/></implementation></functionmodel></init><cleanup><javaText/></cleanup><usedjars/></functionstorage></entry>
            {optional_libref_entries}  <!-- See Section 7 -->
          </libstorage>
          <transformation>
            {brick_elements}      <!-- See Sections 3-4 -->
            {optional_namespaces}  <!-- See Section 6 -->
          </transformation>
          <testData><instances/></testData><ViewState/><pcont/>
        </project></mappingtool>
      </tr:MetaData>
      <tr:ByteCodeJar/><tr:SourceStructure/><tr:TargetStructure/>
      <tr:Multiplicity>{1:1|n:1}</tr:Multiplicity>
      <tr:SourceParameters><tr:Parameter><tr:Position>1</tr:Position><tr:Minoccurs>1</tr:Minoccurs><tr:Maxoccurs>1</tr:Maxoccurs></tr:Parameter></tr:SourceParameters>
      <tr:TargetParameters><tr:Parameter><tr:Position>1</tr:Position><tr:Minoccurs>1</tr:Minoccurs><tr:Maxoccurs>1</tr:Maxoccurs></tr:Parameter></tr:TargetParameters>
    </tr:XiTrafo>
  </content>
</xiObj>
```

For **n:1** mappings, add multiple `<tr:Parameter>` in SourceParameters (Position 1, 2, ...). Source paths use `/ns0:Messages/ns0:Message1/...` with namespace `http://sap.com/xi/XI/SplitAndMerge`.

## 2. Schema References (`<lnks>`)

**XSD** (3 `<elem>` children): filename, folder, rootElement:
```xml
<lnkRole kpos="1" role="SOURCE_IFR_MESS"><lnk rMode="R"><key typeID="xsd" version="1.1"><elem>Source.xsd</elem><elem>src/main/resources/xsd</elem><elem>RootElement</elem></key></lnk></lnkRole>
```

**WSDL** (4 `<elem>` children): filename, folder, typeName, namespaceURI:
```xml
<lnkRole kpos="1" role="TARGET_IFR_MESS"><lnk rMode="R"><key typeID="wsdl" version="1.1"><elem>Target.wsdl</elem><elem>src/main/resources/wsdl</elem><elem>TypeName</elem><elem>urn:namespace:uri</elem></key></lnk></lnkRole>
```

Use `SOURCE_IFR_MESS` for source, `TARGET_IFR_MESS` for target. `kpos="1"` (or `2`, `3` for multi-source).

## 3. The Brick Element

Every mapping is composed of `<brick>` elements. Three types:

| `type` | Attrs | Purpose |
|--------|-------|---------|
| `Dst` | `gid="0" path="/Target/Field"` | Target field. Outermost brick. Must contain `<arg>`, `<group/>` |
| `Src` | `gid="0" path="/Source/Field"` | Source field reference |
| `Func` | `fname="..." fns="dflt"` | Function call. `fns="dflt"` for standard, library name for UDFs |

**Optional Src/Dst attributes:** `context="/XPath"` (iteration override), `object_uid="r1"` (reusable ref), `asXml="x"` (CDATA)

**Child elements:**
- `<viewData x="N" y="N"/>` — required, cosmetic. Defaults: Dst=`200,40`, Src=`50,40`, Func=`100,27`
- `<arg>` — input. First arg: no `pin`. Subsequent: `pin="1"`, `pin="2"`, etc.
- `<group/>` — required on Dst bricks (empty element)
- `<bindings>` — function parameters: `<param name="..."><value>...</value></param>`

**object_uid reuse:** First occurrence sets `object_uid="r1"` with full `gid`+`path`. Later: `<brick object_uid="r1"/>` (no other attrs).

## 4. Mapping Patterns

**1:1 field** (always map root first, then fields):
```xml
<brick gid="0" path="/Target" type="Dst"><viewData x="200" y="40"/><arg><brick gid="0" path="/Source" type="Src"><viewData x="50" y="40"/></brick></arg><group/></brick>
<brick gid="0" path="/Target/Field" type="Dst"><viewData x="200" y="40"/><arg><brick gid="0" path="/Source/Field" type="Src"><viewData x="50" y="40"/></brick></arg><group/></brick>
```

**Constant:**
```xml
<brick gid="0" path="/Target/Status" type="Dst"><viewData x="200" y="40"/><arg><brick fname="const" fns="dflt" type="Func"><viewData x="50" y="40"/><bindings><param name="value"><value>ACTIVE</value></param></bindings></brick></arg><group/></brick>
```

**Single-input function** (e.g., toUpperCase, trim, abs, neg):
```xml
<brick gid="0" path="/Target/Upper" type="Dst"><viewData x="200" y="40"/><arg><brick fname="toUpperCase" fns="dflt" type="Func"><viewData x="100" y="27"/><arg><brick gid="0" path="/Source/Name" type="Src"><viewData x="3" y="27"/></brick></arg></brick></arg><group/></brick>
```

**Two-input function** (e.g., add, sub, mul, stringEquals):
```xml
<brick gid="0" path="/Target/Total" type="Dst"><viewData x="280" y="27"/><arg><brick fname="add" fns="dflt" type="Func"><viewData x="167" y="27"/><arg><brick gid="0" path="/Source/Price" type="Src"><viewData x="3" y="27"/></brick></arg><arg pin="1"><brick gid="0" path="/Source/Tax" type="Src"><viewData x="3" y="83"/></brick></arg></brick></arg><group/></brick>
```

**Function with bindings** (e.g., TransformDate):
```xml
<brick gid="0" path="/Target/Date" type="Dst"><viewData x="300" y="27"/><arg><brick fname="TransformDate" fns="dflt" type="Func"><viewData x="150" y="27"/><arg><brick gid="0" path="/Source/RawDate" type="Src"><viewData x="3" y="27"/></brick></arg><bindings><param name="iform"><value>MM/dd/yyyy</value></param><param name="oform"><value>yyyyMMdd</value></param><param name="calend"><value><calend_props><fd>1</fd><md>1</md><le>true</le></calend_props></value></param></bindings></brick></arg><group/></brick>
```

**Conditional (iF):** pin0=trueValue, pin1=condition, pin2=falseValue:
```xml
<brick gid="0" path="/Target/Result" type="Dst"><viewData x="300" y="27"/><arg><brick fname="iF" fns="dflt" type="Func"><viewData x="180" y="27"/><arg><brick fname="const" fns="dflt" type="Func"><viewData x="3" y="27"/><bindings><param name="value"><value>YES</value></param></bindings></brick></arg><arg pin="1"><brick fname="stringEquals" fns="dflt" type="Func"><viewData x="80" y="60"/><arg><brick gid="0" path="/Source/Type" type="Src"><viewData x="3" y="27"/></brick></arg><arg pin="1"><brick fname="const" fns="dflt" type="Func"><viewData x="3" y="70"/><bindings><param name="value"><value>Premium</value></param></bindings></brick></arg></brick></arg><arg pin="2"><brick fname="const" fns="dflt" type="Func"><viewData x="3" y="120"/><bindings><param name="value"><value>NO</value></param></bindings></brick></arg></brick></arg><group/></brick>
```

**ifWithoutElse:** pin0=condition, pin1=trueValue, binding `keepss`:
```xml
<brick fname="ifWithoutElse" fns="dflt" type="Func"><viewData x="146" y="71"/><arg>{condition_brick}</arg><arg pin="1">{value_brick}</arg><bindings><param name="keepss"><value>false</value></param></bindings></brick>
```

**Null-safe pattern** (iF + exists + const space):
```xml
<brick fname="iF" fns="dflt" type="Func"><arg><brick gid="0" object_uid="r1" path="/Source/Field" type="Src"><viewData x="3" y="27"/></brick></arg><arg pin="1"><brick fname="exists" fns="dflt" type="Func"><arg><brick object_uid="r1"/></arg></brick></arg><arg pin="2"><brick fname="const" fns="dflt" type="Func"><bindings><param name="value"><value> </value></param></bindings></brick></arg></brick>
```

**createIf** (conditional element creation):
```xml
<brick gid="0" path="/Target/OptNode" type="Dst"><viewData x="300" y="40"/><arg><brick fname="createIf" fns="dflt" type="Func"><viewData x="200" y="40"/><arg><brick fname="exists" fns="dflt" type="Func"><arg><brick gid="0" path="/Source/OptField" type="Src"><viewData x="3" y="27"/></brick></arg></brick></arg></brick></arg><group/></brick>
```

**Repeating nodes** — map parent node, then child fields:
```xml
<brick gid="0" path="/Target/Items" type="Dst"><viewData x="200" y="40"/><arg><brick gid="0" path="/Source/LineItems" type="Src"><viewData x="50" y="40"/></brick></arg><group/></brick>
<brick gid="0" path="/Target/Items/Id" type="Dst"><viewData x="200" y="40"/><arg><brick gid="0" path="/Source/LineItems/Id" type="Src"><viewData x="50" y="40"/></brick></arg><group/></brick>
```

**Nested functions** — place Func brick inside another's `<arg>`:
```xml
<brick fname="replaceString" fns="dflt" type="Func"><arg><brick fname="trim" fns="dflt" type="Func"><arg><brick gid="0" path="/Source/Amount" type="Src"><viewData x="3" y="27"/></brick></arg></brick></arg><arg pin="1"><brick fname="const" fns="dflt" type="Func"><bindings><param name="value"><value>$</value></param></bindings></brick></arg><arg pin="2"><brick fname="const" fns="dflt" type="Func"><bindings><param name="value"><value/></param></bindings></brick></arg></brick>
```

## 5. Standard Function Reference

All standard functions use `fns="dflt"`. ONLY use the `fname` listed here.

### Arithmetic

| `fname` | Inputs | Bindings |
|---------|--------|----------|
| `add` | pin0, pin1 | — |
| `sub` | pin0, pin1 | — |
| `mul` | pin0, pin1 | — |
| `div` | pin0, pin1 | — |
| `equalsA` | pin0, pin1 | — |
| `abs` | pin0 | — |
| `sqrt` | pin0 | — |
| `sqr` | pin0 | — |
| `sign` | pin0 | — |
| `neg` | pin0 | — |
| `inv` | pin0 | — |
| `power` | pin0: number, pin1: exponent | — |
| `less` | pin0, pin1 | — |
| `greater` | pin0, pin1 | — |
| `max` | pin0, pin1 | — |
| `min` | pin0, pin1 | — |
| `ceil` | pin0 | — |
| `floor` | pin0 | — |
| `round` | pin0 | — |
| `counter` | *(none)* | `ini`: start (def `1`), `inc`: step (def `1`) |
| `formatNumber` | pin0 | `format`: pattern, `decsep`: separator |

### Boolean

| `fname` | Inputs | Bindings |
|---------|--------|----------|
| `and` | pin0, pin1 | — |
| `or` | pin0, pin1 | — |
| `not` | pin0 | — |
| `equals` | pin0, pin1 | — |
| `notEquals` | pin0, pin1 | — |
| `iF` | pin0: trueVal, pin1: condition, pin2: falseVal | — |
| `iFS` | pin0: trueVal, pin1: condition, pin2: falseVal | — |
| `ifWithoutElse` | pin0: condition, pin1: trueVal | `keepss`: `true`/`false` |
| `ifSWithoutElse` | pin0: condition, pin1: trueVal | `keepss`: `true`/`false` |
| `isNil` | pin0 | — |

### Constant

| `fname` | Inputs | Bindings |
|---------|--------|----------|
| `const` | *(none)* | `value`: the constant |
| `CopyValue` | pin0 | `nnumber`: index (0-based) |
| `xsiNil` | *(none)* | — |

### Conversions

| `fname` | Inputs | Bindings |
|---------|--------|----------|
| `FixValues` | pin0 | `vmdefault`, `vmstrategy` (`1`=use key, `2`=use default), `table`: `<properties><property name="key">value</property>...</properties>` |
| `valuemap` | pin0 | `srcns`, `srctype`, `dstns`, `dsttype`, `context`, `agency1`, `schema1`, `agency2`, `schema2`, `vmstrategy`, `vmdefault` |

### Date

All date functions use calend binding: `<param name="calend"><value><calend_props><fd>{1=Sun,2=Mon}</fd><md>1</md><le>true</le></calend_props></value></param>`

| `fname` | Inputs | Bindings |
|---------|--------|----------|
| `currentDate` | *(none)* | `oform`, `calend` |
| `TransformDate` | pin0 | `iform`, `oform`, `calend` |
| `DateAfter` | pin0: date1, pin1: date2 | `iform`, `oform`, `calend` |
| `DateBefore` | pin0: date1, pin1: date2 | `iform`, `oform`, `calend` |
| `CompareDates` | pin0: date1, pin1: date2 | `iform`, `oform`, `calend` |

### Node Functions

| `fname` | Inputs | Bindings |
|---------|--------|----------|
| `createIf` | pin0: condition | — |
| `removeContexts` | pin0 | — |
| `replaceValue` | pin0 | `value`: replacement |
| `exists` | pin0 | — |
| `getHeader` | pin0: key (Constant) | — |
| `getProperty` | pin0: key (Constant) | — |
| `SplitByValue` | pin0 | `type`: `0` (each value) / `1` (value change) |
| `collapseContexts` | pin0 | — |
| `useOneAsMany` | pin0: single, pin1: many, pin2: context | — |
| `sort` | pin0 | `comparator`: `<sort_comp type="cs"/>`, `order`: `<sort_order asc="true"/>` |
| `sortByKey` | pin0: key, pin1: value | `comparator`: `<sort_comp type="cs"/>`, `order`: `<sort_order asc="true"/>` |
| `mapWithDefault` | pin0 | `default_value` |
| `formatByExample` | pin0: input, pin1: pattern | — |

### Statistics

| `fname` | Inputs | Bindings |
|---------|--------|----------|
| `sum` | pin0 | — |
| `average` | pin0 | — |
| `count` | pin0 | — |
| `index` | pin0 | `start`, `inc`, `type`: `0` (reset) / `1` (no reset) |

### Text

| `fname` | Inputs | Bindings |
|---------|--------|----------|
| `substring` | pin0 | `start`, `count` |
| `concat` | pin0, pin1 (multiple pin1 ok) | `delimeter` |
| `stringEquals` | pin0, pin1 | — |
| `indexOf2` | pin0: string, pin1: pattern | — |
| `indexOf3` | pin0, pin1, pin2: startIndex | — |
| `lastIndexOf2` | pin0: string, pin1: pattern | — |
| `lastIndexOf3` | pin0, pin1, pin2: startIndex | — |
| `compare` | pin0, pin1 | — |
| `replaceString` | pin0: string, pin1: pattern, pin2: replacement | — |
| `length` | pin0 | — |
| `endWith` | pin0: string, pin1: suffix | — |
| `startWith2` | pin0: string, pin1: prefix | — |
| `startWith3` | pin0, pin1, pin2: offset | — |
| `toUpperCase` | pin0 | — |
| `toLowerCase` | pin0 | — |
| `trim` | pin0 | — |

## 6. Namespace Declarations

When paths use namespace prefixes (WSDL targets, n:1 SplitAndMerge), add at end of `<transformation>`:

```xml
<namespaces><properties><property name="{namespace_uri}">{prefix}</property></properties></namespaces>
```

Prefixes: `ns0`, `ns1`, etc. Used in paths as `/ns1:Root/ns1:Field`.

## 7. Custom Groovy UDFs

For functions not available in standard palette, reference external Groovy scripts.

**Add `<libref>` entry in `<libstorage>` (after the standard `<entry name="usernamespace">`):**
```xml
<entry name="{libraryNamespace}"><libref><key typeID=""><elem>{ScriptName}</elem><elem>src/main/resources/script</elem></key><name>{ScriptName}</name></libref></entry>
```

**Call with `fns="{libraryNamespace}"` instead of `fns="dflt"`:**
```xml
<brick fname="removeWhiteSpaces" fns="customScripts" type="Func"><arg>{source_brick}</arg></brick>
```

Groovy file goes in `src/main/resources/script/`.

## 8. Worked Example

XSD source → WSDL target. Shows: root mapping, 1:1, constant, getHeader, currentDate, TransformDate, conditional (iF), arithmetic (add), namespace-qualified target.

```xml
<xiObj xmlns="urn:sap-com:xi"><idInfo VID="01"><vc caption="LOCAL" sp="-1" swcGuid="00000000000000000000000000000000" vcType="S"><clCxt consider="A"/></vc><key typeID="XI_TRAFO" version=""/><version>1.0</version></idInfo><documentation><description/></documentation><generic><admInf><modifBy/><modifAt/><modifAtLong>1700000000000</modifAtLong><owner/></admInf><lnks><lnkRole kpos="1" role="TARGET_IFR_MESS"><lnk rMode="R"><key typeID="wsdl" version="1.1"><elem>OrderResponse.wsdl</elem><elem>src/main/resources/wsdl</elem><elem>OrderResponse</elem><elem>urn:example:order:response:v1</elem></key></lnk></lnkRole><lnkRole kpos="1" role="SOURCE_IFR_MESS"><lnk rMode="R"><key typeID="xsd" version="1.1"><elem>OrderRequest.xsd</elem><elem>src/main/resources/xsd</elem><elem>OrderRequest</elem></key></lnk></lnkRole></lnks><textInfo loadedL="EN"><textObj id="a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4" masterL="EN" type="0"><texts lang="EN"><text label=""/></texts></textObj></textInfo></generic><content><tr:XiTrafo xmlns:tr="urn:sap-com:xi:mapping:xitrafo"><tr:MetaData><mappingtool version="XI7.1"><project version="XI7.1"><libstorage><entry name="usernamespace"><functionstorage version="XI7.1"><key><key typeID=""><elem/><elem/></key></key><classname/><package/><imports/><globals><javaText/></globals><init><functionmodel><signature cacheType="0"/><name/><key/><tab/><title/><uiTitle/><implementation type="udf"><javaText/></implementation></functionmodel></init><cleanup><javaText/></cleanup><usedjars/></functionstorage></entry></libstorage><transformation><brick gid="0" path="/ns1:OrderResponse" type="Dst"><viewData x="200" y="40"/><arg><brick gid="0" path="/OrderRequest" type="Src"><viewData x="50" y="40"/></brick></arg><group/></brick><brick gid="0" path="/ns1:OrderResponse/ns1:OrderId" type="Dst"><viewData x="200" y="40"/><arg><brick gid="0" path="/OrderRequest/OrderId" type="Src"><viewData x="50" y="40"/></brick></arg><group/></brick><brick gid="0" path="/ns1:OrderResponse/ns1:Status" type="Dst"><viewData x="200" y="40"/><arg><brick fname="const" fns="dflt" type="Func"><viewData x="50" y="40"/><bindings><param name="value"><value>RECEIVED</value></param></bindings></brick></arg><group/></brick><brick gid="0" path="/ns1:OrderResponse/ns1:MessageId" type="Dst"><viewData x="300" y="27"/><arg><brick fname="getHeader" fns="dflt" type="Func"><viewData x="160" y="27"/><arg><brick fname="const" fns="dflt" type="Func"><viewData x="50" y="40"/><bindings><param name="value"><value>SAP_MessageProcessingLogID</value></param></bindings></brick></arg></brick></arg><group/></brick><brick gid="0" path="/ns1:OrderResponse/ns1:ProcessedAt" type="Dst"><viewData x="200" y="40"/><arg><brick fname="currentDate" fns="dflt" type="Func"><viewData x="50" y="40"/><bindings><param name="oform"><value>yyyy-MM-dd'T'HH:mm:ss</value></param><param name="calend"><value><calend_props><fd>1</fd><md>1</md><le>true</le></calend_props></value></param></bindings></brick></arg><group/></brick><brick gid="0" path="/ns1:OrderResponse/ns1:OrderDate" type="Dst"><viewData x="300" y="27"/><arg><brick fname="TransformDate" fns="dflt" type="Func"><viewData x="150" y="27"/><arg><brick gid="0" path="/OrderRequest/OrderDate" type="Src"><viewData x="3" y="27"/></brick></arg><bindings><param name="iform"><value>MM/dd/yyyy</value></param><param name="oform"><value>yyyyMMdd</value></param><param name="calend"><value><calend_props><fd>1</fd><md>1</md><le>true</le></calend_props></value></param></bindings></brick></arg><group/></brick><brick gid="0" path="/ns1:OrderResponse/ns1:Urgency" type="Dst"><viewData x="350" y="27"/><arg><brick fname="iF" fns="dflt" type="Func"><viewData x="200" y="27"/><arg><brick fname="const" fns="dflt" type="Func"><viewData x="3" y="27"/><bindings><param name="value"><value>URGENT</value></param></bindings></brick></arg><arg pin="1"><brick fname="stringEquals" fns="dflt" type="Func"><viewData x="100" y="60"/><arg><brick gid="0" path="/OrderRequest/Priority" type="Src"><viewData x="3" y="27"/></brick></arg><arg pin="1"><brick fname="const" fns="dflt" type="Func"><viewData x="3" y="70"/><bindings><param name="value"><value>HIGH</value></param></bindings></brick></arg></brick></arg><arg pin="2"><brick fname="const" fns="dflt" type="Func"><viewData x="3" y="120"/><bindings><param name="value"><value>NORMAL</value></param></bindings></brick></arg></brick></arg><group/></brick><brick gid="0" path="/ns1:OrderResponse/ns1:Total" type="Dst"><viewData x="280" y="27"/><arg><brick fname="add" fns="dflt" type="Func"><viewData x="167" y="27"/><arg><brick gid="0" path="/OrderRequest/UnitPrice" type="Src"><viewData x="3" y="27"/></brick></arg><arg pin="1"><brick gid="0" path="/OrderRequest/Tax" type="Src"><viewData x="3" y="83"/></brick></arg></brick></arg><group/></brick><namespaces><properties><property name="urn:example:order:response:v1">ns1</property></properties></namespaces></transformation><testData><instances/></testData><ViewState/><pcont/></project></mappingtool></tr:MetaData><tr:ByteCodeJar/><tr:SourceStructure/><tr:TargetStructure/><tr:Multiplicity>1:1</tr:Multiplicity><tr:SourceParameters><tr:Parameter><tr:Position>1</tr:Position><tr:Minoccurs>1</tr:Minoccurs><tr:Maxoccurs>1</tr:Maxoccurs></tr:Parameter></tr:SourceParameters><tr:TargetParameters><tr:Parameter><tr:Position>1</tr:Position><tr:Minoccurs>1</tr:Minoccurs><tr:Maxoccurs>1</tr:Maxoccurs></tr:Parameter></tr:TargetParameters></tr:XiTrafo></content></xiObj>
```
