# Parameter Generation Guide

Reference for generating `parameters.prop` and `parameters.propdef` files. Read this guide during Phase C steps 5-8. For format specs see `bpmn-generation-guide.md` §9-10. For schedule-specific templates see `scheduler-configuration-guide.md`.

## 1. Parameter Naming Convention

| Adapter / Step | Prefix | Example Parameters |
|---|---|---|
| HTTPS Sender | `sender.` | `sender.Address`, `sender.Authorization`, `sender.UserRole`, `sender.CSRFProtected` |
| HTTP Receiver | `receiver.` | `receiver.Address`, `receiver.Credential`, `receiver.Authentication`, `receiver.ProxyType`, `receiver.ThrowException` |
| OData V2 Receiver | `receiver.` | `receiver.Address`, `receiver.AuthMethod`, `receiver.Credential`, `receiver.ProxyType` |
| SOAP Sender | `sender.` | `sender.Address`, `sender.MessageExchangePattern` |
| SFTP Receiver | `sftp.` | `sftp.Address`, `sftp.directory`, `sftp.filename`, `sftp.Credential`, `sftp.AuthMethod`, `sftp.proxyType` |
| Mail POP3 Sender | `mail.sender.` | `mail.sender.Server`, `mail.sender.Credential` |
| Mail SMTP Receiver | `mail.receiver.` | `mail.receiver.Server`, `mail.receiver.From`, `mail.receiver.To`, `mail.receiver.Credential` |
| IDoc Receiver | `idoc.` | `idoc.Address`, `idoc.Credential`, `idoc.AuthMethod`, `idoc.ProxyType` |
| Timer Schedule | `Scheduler` | `Scheduler` (always this exact name, type `custom:schedule`) |
| Polling Schedule | `{adapter}.Scheduler` or `Scheduler` | `mail.Scheduler`, `Scheduler` (type `custom:schedule`) |
| Content Modifier | descriptive name | `headerValue`, `Incoming_payload`, `Attached_payload` |
| Data Store Write | descriptive name | `datastoreName` |
| PGP Encryptor | descriptive name | `UserID` |

**General pattern:** `{participantOrAdapter}.{PropertyLabel}`. When multiple receivers share the same adapter type, use distinguishing prefixes (e.g., `http.Address` vs `sftp.Address`).

## 2. `param_references` Rules

**CRITICAL: Sender and receiver adapters use DIFFERENT `attribute_id` formats.**

### Receiver Adapter References (full cmdVariantUri)

```xml
<reference
  attribute_category="Receiver"
  attribute_id="ctype::AdapterVariant/cname::HTTP/tp::HTTP/mp::None/direction::Receiver/version::1.17.0/attrId::httpAddressWithoutQuery"
  attribute_uilabel="Address"
  param_key="receiver.Address"/>
```

- `attribute_id` = adapter's `cmdVariantUri` (with `sap:` prefix DROPPED from `cname::`) + `/attrId::{propertyKey}`
- `attribute_category` = participant name, optionally with sub-path for UI tab placement: `Receiver`, `Receiver.Receiver.Auth`, `Receiver.Receiver.System`, `Receiver1`, `Receiver1.Receiver.Auth`
- `attribute_uilabel` = property's UI label from metadata JSON (e.g., `"Address"`, `"Authentication"`, `"Credential Name"`)

### Sender Adapter References (short form)

```xml
<reference
  attribute_category="Sender"
  attribute_id="/attrId::urlPath"
  attribute_uilabel=""
  param_key="sender.Address"/>
```

- `attribute_id` = `/attrId::{propertyKey}` — NO cmdVariantUri prefix
- `attribute_category` = `"Sender"` or `"Sender.Receiver.System"` (for address-type properties)
- `attribute_uilabel` = always `""` (empty)

### Flow Step Parameters (NO references)

Content Modifier, Data Store, PGP Encryptor, and other flow step parameters appear as `<parameter>` elements in `parameters.propdef` but have **NO** corresponding `<reference>` entry in `<param_references>`. Only adapter messageFlow properties get `<reference>` entries.

### Timer Schedule (NO reference)

Timer `Scheduler` parameter with type `custom:schedule` has NO `<reference>` entry. However, other adapter parameters in the same iFlow (e.g., OData receiver) still get their own references.

### Polling Adapter Schedule (short form reference)

```xml
<reference attribute_category="Sender" attribute_id="/attrId::scheduleKey" attribute_uilabel="" param_key="mail.Scheduler"/>
```

Same short form as other sender adapter properties.

## 3. `additionalMetadata` Rules

| Field Type | `<additionalMetadata>` |
|---|---|
| Dropdown/combobox (Authentication, ProxyType, etc.) | `<isCombobox>true</isCombobox>` |
| Boolean toggle | `<isCombobox>false</isCombobox>` |
| Free-text input | `<additionalMetadata/>` (empty) |

## 4. Example 1: HTTPS Sender + HTTP Receiver (Sync Request-Reply)

**Adapters:** HTTPS sender (Sender participant) → HTTP receiver (Receiver participant)
**Also includes:** Content Modifier header and property externalization (flow step — no `param_references`)

### parameters.prop

```properties
#Sun Apr 12 10:17:31 UTC 2026
receiver.ThrowException=true
sender.CSRFProtected=0
headerValue=123
receiver.Address=http\://demo\:8088/mockNumberConversionSoapBinding
receiver.Credential=
receiver.Authentication=Basic
sender.Authorization=RoleBased
sender.Address=/httpsender
Incoming_payload=
receiver.ProxyType=sapcc
sender.UserRole=ESBMessaging.send
```

### parameters.propdef

```xml
<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<parameters>
  <parameter>
    <key/><name>sender.Address</name><type>xsd:string</type>
    <isRequired>false</isRequired><constraint/><description/><additionalMetadata/>
  </parameter>
  <parameter>
    <key/><name>sender.Authorization</name><type>xsd:string</type>
    <isRequired>false</isRequired><constraint/><description/>
    <additionalMetadata><isCombobox>true</isCombobox></additionalMetadata>
  </parameter>
  <parameter>
    <key/><name>sender.UserRole</name><type>xsd:string</type>
    <isRequired>false</isRequired><constraint/><description/><additionalMetadata/>
  </parameter>
  <parameter>
    <key/><name>sender.CSRFProtected</name><type>xsd:boolean</type>
    <isRequired>false</isRequired><constraint/><description/>
    <additionalMetadata><isCombobox>false</isCombobox></additionalMetadata>
  </parameter>
  <parameter>
    <key/><name>headerValue</name><type>xsd:string</type>
    <isRequired>false</isRequired><constraint/>
    <description>This is sample description</description><additionalMetadata/>
  </parameter>
  <parameter>
    <key/><name>Incoming_payload</name><type>xsd:string</type>
    <isRequired>false</isRequired><constraint/><description/><additionalMetadata/>
  </parameter>
  <parameter>
    <key/><name>receiver.Address</name><type>xsd:string</type>
    <isRequired>false</isRequired><constraint/><description/><additionalMetadata/>
  </parameter>
  <parameter>
    <key/><name>receiver.Credential</name><type>xsd:string</type>
    <isRequired>false</isRequired><constraint/><description/><additionalMetadata/>
  </parameter>
  <parameter>
    <key/><name>receiver.Authentication</name><type>xsd:string</type>
    <isRequired>false</isRequired><constraint/><description/>
    <additionalMetadata><isCombobox>true</isCombobox></additionalMetadata>
  </parameter>
  <parameter>
    <key/><name>receiver.ProxyType</name><type>xsd:string</type>
    <isRequired>false</isRequired><constraint/><description/>
    <additionalMetadata><isCombobox>true</isCombobox></additionalMetadata>
  </parameter>
  <parameter>
    <key/><name>receiver.ThrowException</name><type>xsd:boolean</type>
    <isRequired>false</isRequired><constraint/><description/>
    <additionalMetadata><isCombobox>false</isCombobox></additionalMetadata>
  </parameter>
  <param_references>
    <!-- Receiver adapter: FULL cmdVariantUri in attribute_id, uilabel populated -->
    <reference attribute_category="Receiver" attribute_id="ctype::AdapterVariant/cname::HTTP/tp::HTTP/mp::None/direction::Receiver/version::1.17.0/attrId::throwExceptionOnFailure" attribute_uilabel="Throw Exception On Failure" param_key="receiver.ThrowException"/>
    <reference attribute_category="Receiver.Receiver.Auth" attribute_id="ctype::AdapterVariant/cname::HTTP/tp::HTTP/mp::None/direction::Receiver/version::1.17.0/attrId::authenticationMethod" attribute_uilabel="Authentication" param_key="receiver.Authentication"/>
    <reference attribute_category="Receiver" attribute_id="ctype::AdapterVariant/cname::HTTP/tp::HTTP/mp::None/direction::Receiver/version::1.17.0/attrId::proxyType" attribute_uilabel="Proxy Type" param_key="receiver.ProxyType"/>
    <reference attribute_category="Receiver.Receiver.Auth" attribute_id="ctype::AdapterVariant/cname::HTTP/tp::HTTP/mp::None/direction::Receiver/version::1.17.0/attrId::credentialName" attribute_uilabel="Credential Name" param_key="receiver.Credential"/>
    <reference attribute_category="Receiver" attribute_id="ctype::AdapterVariant/cname::HTTP/tp::HTTP/mp::None/direction::Receiver/version::1.17.0/attrId::httpAddressWithoutQuery" attribute_uilabel="Address" param_key="receiver.Address"/>
    <!-- Sender adapter: SHORT /attrId:: form, uilabel empty -->
    <reference attribute_category="Sender" attribute_id="/attrId::xsrfProtection" attribute_uilabel="" param_key="sender.CSRFProtected"/>
    <reference attribute_category="Sender" attribute_id="/attrId::userRole" attribute_uilabel="" param_key="sender.UserRole"/>
    <reference attribute_category="Sender" attribute_id="/attrId::urlPath" attribute_uilabel="" param_key="sender.Address"/>
    <reference attribute_category="Sender" attribute_id="/attrId::senderAuthType" attribute_uilabel="" param_key="sender.Authorization"/>
    <!-- NOTE: headerValue and Incoming_payload are Content Modifier (flow step) params — NO reference entries -->
  </param_references>
</parameters>
```

**Key takeaways:**
- HTTP receiver references use full `ctype::AdapterVariant/cname::HTTP/.../attrId::{key}`
- HTTPS sender references use short `/attrId::{key}`
- `headerValue` and `Incoming_payload` (Content Modifier) have NO `<reference>` entries

## 5. Example 2: Timer + OData V2 Receiver

**Adapters:** Timer Start Event → OData V2 receiver (Receiver participant)
**Also includes:** Content Modifier property externalization (flow step — no `param_references`)

### parameters.prop

```properties
#Sun Apr 12 10:32:39 UTC 2026
Attached_payload=XYZ
Scheduler=<row><cell>dateType</cell><cell>ADVANCED</cell></row><row><cell>hourValue</cell><cell>15</cell></row><row><cell>minutesValue</cell><cell>53</cell></row><row><cell>timeType</cell><cell>ON_TIME</cell></row><row><cell>timeZone</cell><cell>( UTC 0\:00 ) Greenwich Mean Time(Etc/GMT)</cell></row><row><cell>throwExceptionOnExpiry</cell><cell>true</cell></row><row><cell>second</cell><cell>0</cell></row><row><cell>minute</cell><cell>0/5</cell></row><row><cell>hour</cell><cell>*</cell></row><row><cell>day_of_month</cell><cell>?</cell></row><row><cell>month</cell><cell>*</cell></row><row><cell>dayOfWeek</cell><cell>*</cell></row><row><cell>year</cell><cell>*</cell></row><row><cell>startAt</cell><cell></cell></row><row><cell>endAt</cell><cell></cell></row><row><cell>attributeBehaviour</cell><cell>isThrowExceptionOnExpiryVisible,isScheduleAdvancedVisible,isScheduleAdvancedStartEndVisible,isScheduleSimpleVisible</cell></row><row><cell>triggerType</cell><cell>cron</cell></row><row><cell>noOfSchedules</cell><cell>1</cell></row><row><cell>schedule1</cell><cell>0+0/5+*+?+*+*+*&amp;trigger.timeZone\=Etc/GMT</cell></row>
receiver.Address=http\://i10\:50000/sap/opu/odata/IWBEP/GWSAMPLE_BASIC
receiver.AuthMethod=Basic
receiver.Credential=I10_S4H
receiver.ProxyType=sapcc
```

### parameters.propdef

```xml
<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<parameters>
  <parameter>
    <key/><name>receiver.Address</name><type>xsd:string</type>
    <isRequired>false</isRequired><constraint/><description/><additionalMetadata/>
  </parameter>
  <parameter>
    <key/><name>receiver.AuthMethod</name><type>xsd:string</type>
    <isRequired>false</isRequired><constraint/><description/>
    <additionalMetadata><isCombobox>true</isCombobox></additionalMetadata>
  </parameter>
  <parameter>
    <key/><name>receiver.Credential</name><type>xsd:string</type>
    <isRequired>false</isRequired><constraint/><description/><additionalMetadata/>
  </parameter>
  <parameter>
    <key/><name>receiver.ProxyType</name><type>xsd:string</type>
    <isRequired>false</isRequired><constraint/><description/>
    <additionalMetadata><isCombobox>true</isCombobox></additionalMetadata>
  </parameter>
  <parameter>
    <key/><name>Scheduler</name><type>custom:schedule</type>
    <isRequired>false</isRequired><constraint/><description/><additionalMetadata/>
  </parameter>
  <parameter>
    <key/><name>Attached_payload</name><type>xsd:string</type>
    <isRequired>false</isRequired><constraint/><description/><additionalMetadata/>
  </parameter>
  <param_references>
    <!-- OData V2 receiver: FULL cmdVariantUri, note cname::HCIOData (not OData) -->
    <reference attribute_category="Receiver.Receiver.System" attribute_id="ctype::AdapterVariant/cname::HCIOData/tp::HTTP/mp::OData V2/direction::Receiver/version::1.27.0/attrId::address" attribute_uilabel="Address" param_key="receiver.Address"/>
    <reference attribute_category="Receiver.Receiver.Auth" attribute_id="ctype::AdapterVariant/cname::HCIOData/tp::HTTP/mp::OData V2/direction::Receiver/version::1.27.0/attrId::authenticationMethod" attribute_uilabel="Authentication" param_key="receiver.AuthMethod"/>
    <reference attribute_category="Receiver" attribute_id="ctype::AdapterVariant/cname::HCIOData/tp::HTTP/mp::OData V2/direction::Receiver/version::1.27.0/attrId::proxyType" attribute_uilabel="Proxy Type" param_key="receiver.ProxyType"/>
    <reference attribute_category="Receiver.Receiver.Auth" attribute_id="ctype::AdapterVariant/cname::HCIOData/tp::HTTP/mp::OData V2/direction::Receiver/version::1.27.0/attrId::alias" attribute_uilabel="Credential Name" param_key="receiver.Credential"/>
    <!-- Timer Scheduler: NO reference entry. Attached_payload (Content Modifier): NO reference entry. -->
  </param_references>
</parameters>
```

**Key takeaways:**
- Timer `Scheduler` (type `custom:schedule`) has NO `<reference>` entry — Timer is not an adapter messageFlow
- OData V2 uses `cname::HCIOData` (not `cname::OData`) in `attribute_id`
- OData credential key is `alias` (not `credentialName`)
- `Attached_payload` (Content Modifier) has NO `<reference>`

## 6. Example 3: Mail POP3 Sender + Mail SMTP Receiver + IDoc Receiver (Polling + Multi-Receiver)

**Adapters:** Mail POP3 sender (polling) → Mail SMTP receiver (Receiver) + IDoc receiver (Receiver1)
**Also includes:** Data Store Write (`datastoreName`) and PGP Encryptor (`UserID`) — flow step params, no references

### parameters.prop

```properties
#Sun Apr 12 10:32:18 UTC 2026
mail.receiver.From=
mail.sender.Credential=
idoc.Credential=
mail.sender.Server=
idoc.ProxyType=default
idoc.AuthMethod=Basic
datastoreName=DS_sample
idoc.Address=
mail.receiver.Credential=
mail.receiver.To=
UserID=user456
mail.Scheduler=<row><cell>dayValue</cell><cell></cell></row><row><cell>monthValue</cell><cell></cell></row><row><cell>yearValue</cell><cell></cell></row><row><cell>dateType</cell><cell>DAILY</cell></row><row><cell>secondValue</cell><cell>0</cell></row><row><cell>minutesValue</cell><cell></cell></row><row><cell>hourValue</cell><cell></cell></row><row><cell>toInterval</cell><cell>24</cell></row><row><cell>fromInterval</cell><cell>0</cell></row><row><cell>OnEverySecond</cell><cell>10</cell></row><row><cell>timeType</cell><cell>TIME_SECOND_INTERVAL</cell></row><row><cell>timeZone</cell><cell>( UTC 0\:00 ) Greenwich Mean Time(Etc/GMT)</cell></row><row><cell>throwExceptionOnExpiry</cell><cell>true</cell></row><row><cell>second</cell><cell>0/10</cell></row><row><cell>minute</cell><cell>*</cell></row><row><cell>hour</cell><cell>0-24</cell></row><row><cell>day_of_month</cell><cell>?</cell></row><row><cell>month</cell><cell>*</cell></row><row><cell>dayOfWeek</cell><cell>*</cell></row><row><cell>year</cell><cell>*</cell></row><row><cell>startAt</cell><cell></cell></row><row><cell>endAt</cell><cell></cell></row><row><cell>attributeBehaviour</cell><cell>isScheduleOnDayRequired,isScheduleRecurRequired</cell></row><row><cell>triggerType</cell><cell>cron</cell></row><row><cell>noOfSchedules</cell><cell>1</cell></row><row><cell>schedule1</cell><cell>0/10+*+0-23+?+*+*+*&amp;trigger.timeZone\=Etc/GMT</cell></row>
mail.receiver.Server=
```

### parameters.propdef

```xml
<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<parameters>
  <parameter><key/><name>mail.Scheduler</name><type>custom:schedule</type><isRequired>false</isRequired><constraint/><description/><additionalMetadata/></parameter>
  <parameter><key/><name>mail.sender.Server</name><type>xsd:string</type><isRequired>false</isRequired><constraint/><description/><additionalMetadata/></parameter>
  <parameter><key/><name>mail.sender.Credential</name><type>xsd:string</type><isRequired>false</isRequired><constraint/><description/><additionalMetadata/></parameter>
  <parameter><key/><name>mail.receiver.Server</name><type>xsd:string</type><isRequired>false</isRequired><constraint/><description/><additionalMetadata/></parameter>
  <parameter><key/><name>mail.receiver.From</name><type>xsd:string</type><isRequired>false</isRequired><constraint/><description/><additionalMetadata/></parameter>
  <parameter><key/><name>mail.receiver.To</name><type>xsd:string</type><isRequired>false</isRequired><constraint/><description/><additionalMetadata/></parameter>
  <parameter><key/><name>mail.receiver.Credential</name><type>xsd:string</type><isRequired>false</isRequired><constraint/><description/><additionalMetadata/></parameter>
  <parameter><key/><name>idoc.Address</name><type>xsd:string</type><isRequired>false</isRequired><constraint/><description/><additionalMetadata/></parameter>
  <parameter><key/><name>idoc.Credential</name><type>xsd:string</type><isRequired>false</isRequired><constraint/><description/><additionalMetadata/></parameter>
  <parameter><key/><name>idoc.AuthMethod</name><type>xsd:string</type><isRequired>false</isRequired><constraint/><description/><additionalMetadata><isCombobox>true</isCombobox></additionalMetadata></parameter>
  <parameter><key/><name>idoc.ProxyType</name><type>xsd:string</type><isRequired>false</isRequired><constraint/><description/><additionalMetadata><isCombobox>true</isCombobox></additionalMetadata></parameter>
  <parameter><key/><name>datastoreName</name><type>xsd:string</type><isRequired>false</isRequired><constraint/><description/><additionalMetadata/></parameter>
  <parameter><key/><name>UserID</name><type>xsd:string</type><isRequired>false</isRequired><constraint/><description/><additionalMetadata/></parameter>
  <param_references>
    <!-- Mail SMTP Receiver: FULL cmdVariantUri -->
    <reference attribute_category="Receiver" attribute_id="ctype::AdapterVariant/cname::Mail/tp::SMTP/mp::None/direction::Receiver/version::1.12.0/attrId::server" attribute_uilabel="Address" param_key="mail.receiver.Server"/>
    <reference attribute_category="Receiver" attribute_id="ctype::AdapterVariant/cname::Mail/tp::SMTP/mp::None/direction::Receiver/version::1.12.0/attrId::from" attribute_uilabel="From" param_key="mail.receiver.From"/>
    <reference attribute_category="Receiver" attribute_id="ctype::AdapterVariant/cname::Mail/tp::SMTP/mp::None/direction::Receiver/version::1.12.0/attrId::to" attribute_uilabel="To" param_key="mail.receiver.To"/>
    <reference attribute_category="Receiver" attribute_id="ctype::AdapterVariant/cname::Mail/tp::SMTP/mp::None/direction::Receiver/version::1.12.0/attrId::user" attribute_uilabel="Credential Name" param_key="mail.receiver.Credential"/>
    <!-- IDoc Receiver: FULL cmdVariantUri, participant name "Receiver1" -->
    <reference attribute_category="Receiver1.Receiver.System" attribute_id="ctype::AdapterVariant/cname::IDOC/tp::HTTP/mp::IDoc SOAP/direction::Receiver/version::1.8.2/attrId::address" attribute_uilabel="Address" param_key="idoc.Address"/>
    <reference attribute_category="Receiver1" attribute_id="ctype::AdapterVariant/cname::IDOC/tp::HTTP/mp::IDoc SOAP/direction::Receiver/version::1.8.2/attrId::proxyType" attribute_uilabel="Proxy Type" param_key="idoc.ProxyType"/>
    <reference attribute_category="Receiver1.Receiver.Auth" attribute_id="ctype::AdapterVariant/cname::IDOC/tp::HTTP/mp::IDoc SOAP/direction::Receiver/version::1.8.2/attrId::credentialName" attribute_uilabel="Credential Name" param_key="idoc.Credential"/>
    <reference attribute_category="Receiver1" attribute_id="ctype::AdapterVariant/cname::IDOC/tp::HTTP/mp::IDoc SOAP/direction::Receiver/version::1.8.2/attrId::authentication" attribute_uilabel="Authentication" param_key="idoc.AuthMethod"/>
    <!-- Mail POP3 Sender: SHORT form -->
    <reference attribute_category="Sender" attribute_id="/attrId::server" attribute_uilabel="" param_key="mail.sender.Server"/>
    <reference attribute_category="Sender" attribute_id="/attrId::scheduleKey" attribute_uilabel="" param_key="mail.Scheduler"/>
    <reference attribute_category="Sender" attribute_id="/attrId::user" attribute_uilabel="" param_key="mail.sender.Credential"/>
    <!-- datastoreName (Data Store) and UserID (PGP Encryptor): NO reference entries — flow step params -->
  </param_references>
</parameters>
```

**Key takeaways:**
- Multi-receiver: `attribute_category` uses participant names `Receiver` and `Receiver1` to distinguish
- Polling adapter `scheduleKey` gets SHORT form reference: `/attrId::scheduleKey`
- IDoc uses `cname::IDOC` (not `cname::IDoc`) — uppercase
- `datastoreName` and `UserID` (Data Store Write and PGP Encryptor) have NO `<reference>` entries

## 7. Common Pitfalls

1. **Using full cmdVariantUri for sender adapter references** — Sender adapters use SHORT form `/attrId::{key}`, not the full path
2. **Adding `<reference>` entries for Content Modifier/Data Store/PGP params** — Flow step parameters have NO references
3. **Empty `<param_references/>` when adapter params exist** — Causes "Enter adapter details for channel" errors
4. **Using `cname::sap:HTTP` instead of `cname::HTTP`** — Drop the `sap:` prefix in `attribute_id`
5. **Using `credentialName` for OData credential** — OData V2 uses `alias` as the credential property key, not `credentialName`. Check the adapter metadata JSON for the correct `attrId`.
6. **Forgetting `isCombobox` metadata** — Dropdown fields need `<isCombobox>true</isCombobox>`
7. **parameters.propdef in Java properties format** — Must be XML, not `key=value` format
8. **Colons not escaped in .prop** — Values with `:` must use `\:` (e.g., `http\://`)
