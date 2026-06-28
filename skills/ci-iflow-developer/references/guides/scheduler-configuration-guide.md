# Scheduler Configuration Guide

Reference for generating `scheduleKey` values for both Timer Start Events and polling sender adapters (SFTP, FTP, SMB, SuccessFactors, etc.). All polling adapters use the same scheduler format.

## Externalization (Recommended — confirm with user in Phase A)

When the user opts for externalization, use `{{Scheduler}}` for `scheduleKey`. Place the actual schedule table in `parameters.prop`. When the user opts for hardcoded values, place the full schedule table inline in the `.iflw` XML (see "schedule1 Format Reference" below for encoding rules).

**In `.iflw` (Timer — on timerEventDefinition):**
```xml
<ifl:property>
    <key>scheduleKey</key>
    <value>{{Scheduler}}</value>
</ifl:property>
```

**In `.iflw` (Adapter — on messageFlow):**
```xml
<ifl:property>
    <key>scheduleKey</key>
    <value>{{Scheduler}}</value>
</ifl:property>
```

**In `parameters.prop`** (Java properties — escape `:` as `\:` and `=` as `\=`):
```
Scheduler=<row><cell>...</cell><cell>...</cell></row>...
```

**In `parameters.propdef`:**

Timer:
```xml
<parameter>
  <key/>
  <name>Scheduler</name>
  <type>custom:schedule</type>
  <isRequired>false</isRequired>
  <constraint/>
  <description/>
  <additionalMetadata/>
</parameter>
<param_references/>
```

Polling adapter (adds `param_references` block):
```xml
<parameter>
  <key/>
  <name>Scheduler</name>
  <type>custom:schedule</type>
  <isRequired>false</isRequired>
  <constraint/>
  <description/>
  <additionalMetadata/>
</parameter>
<param_references>
  <reference attribute_category="Sender" attribute_id="/attrId::scheduleKey" attribute_uilabel="" param_key="Scheduler"/>
</param_references>
```

---

## Timer Start Event Templates

Timer schedules are placed on the `<bpmn2:timerEventDefinition>` element. Timer iFlows have NO sender participant or messageFlow.

### Template T1: Run Once on Deploy

Fires once immediately when the iFlow is deployed. Use for one-time initialization or testing. Note: this schedule can also be set inline (not externalized) for simplicity — both approaches work.

**parameters.prop value:**
```
Scheduler=<row><cell>dateType</cell><cell>SIMPLE</cell></row><row><cell>hourValue</cell><cell>22</cell></row><row><cell>minutesValue</cell><cell>02</cell></row><row><cell>timeType</cell><cell>ON_TIME</cell></row><row><cell>timeZone</cell><cell>( UTC 0\:00 ) Greenwich Mean Time(Etc/GMT)</cell></row><row><cell>throwExceptionOnExpiry</cell><cell>true</cell></row><row><cell>second</cell><cell>0</cell></row><row><cell>minute</cell><cell>0/5</cell></row><row><cell>hour</cell><cell>*</cell></row><row><cell>day_of_month</cell><cell>?</cell></row><row><cell>month</cell><cell>*</cell></row><row><cell>dayOfWeek</cell><cell>*</cell></row><row><cell>year</cell><cell>*</cell></row><row><cell>startAt</cell><cell></cell></row><row><cell>endAt</cell><cell></cell></row><row><cell>attributeBehaviour</cell><cell>isThrowExceptionOnExpiryVisible,isScheduleAdvancedVisible,isScheduleAdvancedStartEndVisible,isScheduleSimpleVisible</cell></row><row><cell>triggerType</cell><cell>cron</cell></row><row><cell>noOfSchedules</cell><cell>1</cell></row><row><cell>schedule1</cell><cell>simple.repeat\=NONE&amp;trigger.timeZone\=Etc/GMT</cell></row>
```

### Template T2: Every N Minutes (Simple Repeat)

Repeats every N minutes continuously. Replace `{N}` with the interval (e.g., 10).

**parameters.prop value (every 10 min):**
```
Scheduler=<row><cell>dateType</cell><cell>SIMPLE</cell></row><row><cell>hourValue</cell><cell>22</cell></row><row><cell>minutesValue</cell><cell>02</cell></row><row><cell>timeType</cell><cell>ON_TIME</cell></row><row><cell>timeZone</cell><cell>( UTC 0\:00 ) Greenwich Mean Time(Etc/GMT)</cell></row><row><cell>throwExceptionOnExpiry</cell><cell>true</cell></row><row><cell>second</cell><cell>0</cell></row><row><cell>minute</cell><cell>0/5</cell></row><row><cell>hour</cell><cell>*</cell></row><row><cell>day_of_month</cell><cell>?</cell></row><row><cell>month</cell><cell>*</cell></row><row><cell>dayOfWeek</cell><cell>*</cell></row><row><cell>year</cell><cell>*</cell></row><row><cell>startAt</cell><cell></cell></row><row><cell>endAt</cell><cell></cell></row><row><cell>attributeBehaviour</cell><cell>isThrowExceptionOnExpiryVisible,isScheduleAdvancedVisible,isScheduleAdvancedStartEndVisible,isScheduleSimpleVisible</cell></row><row><cell>triggerType</cell><cell>cron</cell></row><row><cell>noOfSchedules</cell><cell>1</cell></row><row><cell>schedule1</cell><cell>simple.repeat\=MINUTES&amp;simple.every\={N}&amp;trigger.timeZone\=Etc/GMT</cell></row>
```

**Substitution:** Replace `{N}` in `simple.every\={N}` with the desired interval (e.g., `10`, `15`, `30`).

### Template T3: Cron — Weekdays at Specific Time (Advanced)

Runs at a specific hour on weekdays only. Replace `{HOUR}` with 0-23.

**parameters.prop value (weekdays at 9 AM UTC):**
```
Scheduler=<row><cell>dateType</cell><cell>ADVANCED</cell></row><row><cell>hourValue</cell><cell>22</cell></row><row><cell>minutesValue</cell><cell>08</cell></row><row><cell>timeType</cell><cell>ON_TIME</cell></row><row><cell>timeZone</cell><cell>( UTC 0\:00 ) Greenwich Mean Time(Etc/GMT)</cell></row><row><cell>throwExceptionOnExpiry</cell><cell>true</cell></row><row><cell>second</cell><cell>0</cell></row><row><cell>minute</cell><cell>0</cell></row><row><cell>hour</cell><cell>{HOUR}</cell></row><row><cell>day_of_month</cell><cell>?</cell></row><row><cell>month</cell><cell>*</cell></row><row><cell>dayOfWeek</cell><cell>MON,TUE,WED,THU,FRI</cell></row><row><cell>year</cell><cell>*</cell></row><row><cell>startAt</cell><cell></cell></row><row><cell>endAt</cell><cell></cell></row><row><cell>attributeBehaviour</cell><cell>isThrowExceptionOnExpiryVisible,isScheduleAdvancedVisible,isScheduleAdvancedStartEndVisible,isScheduleSimpleVisible</cell></row><row><cell>triggerType</cell><cell>cron</cell></row><row><cell>noOfSchedules</cell><cell>1</cell></row><row><cell>schedule1</cell><cell>0+0+{HOUR}+?+*+MON,TUE,WED,THU,FRI+*&amp;trigger.timeZone\=Etc/GMT</cell></row>
```

**Substitution:** Replace `{HOUR}` in both the `<cell>` and `schedule1` with 0-23 (e.g., `9` for 9 AM).

---

## Polling Adapter Schedule Templates

Adapter schedules are placed on the `<bpmn2:messageFlow>` element alongside other adapter properties. These apply to ALL polling sender adapters: SFTP, FTP, SMB, SuccessFactors REST, SuccessFactors SOAP, Mail, etc.

### Template A1: Every N Minutes

Polls every N minutes, all day (0:00-23:59). Replace `{N}` with the interval.

**parameters.prop value (every 15 min):**
```
Scheduler=<row><cell>dayValue</cell><cell></cell></row><row><cell>monthValue</cell><cell></cell></row><row><cell>yearValue</cell><cell></cell></row><row><cell>dateType</cell><cell>DAILY</cell></row><row><cell>secondValue</cell><cell>0</cell></row><row><cell>minutesValue</cell><cell></cell></row><row><cell>hourValue</cell><cell></cell></row><row><cell>toInterval</cell><cell>24</cell></row><row><cell>fromInterval</cell><cell>0</cell></row><row><cell>OnEveryMinute</cell><cell>{N}</cell></row><row><cell>timeType</cell><cell>TIME_INTERVAL</cell></row><row><cell>timeZone</cell><cell>( UTC 0\:00 ) Greenwich Mean Time(Etc/GMT)</cell></row><row><cell>throwExceptionOnExpiry</cell><cell>true</cell></row><row><cell>second</cell><cell>0/10</cell></row><row><cell>minute</cell><cell>*</cell></row><row><cell>hour</cell><cell>0-24</cell></row><row><cell>day_of_month</cell><cell>?</cell></row><row><cell>month</cell><cell>*</cell></row><row><cell>dayOfWeek</cell><cell>*</cell></row><row><cell>year</cell><cell>*</cell></row><row><cell>startAt</cell><cell></cell></row><row><cell>endAt</cell><cell></cell></row><row><cell>attributeBehaviour</cell><cell>isScheduleOnDayRequired,isScheduleRecurRequired,isScheduleAdvancedVisible</cell></row><row><cell>triggerType</cell><cell>cron</cell></row><row><cell>noOfSchedules</cell><cell>1</cell></row><row><cell>schedule1</cell><cell>0+0/{N}+0-23+?+*+*+*&amp;trigger.timeZone\=Etc/GMT</cell></row>
```

**Substitution:** Replace `{N}` in both `OnEveryMinute` cell and `schedule1` (e.g., `15`, `30`, `60`).

### Template A2: One-time on Specific Date

Fires once at a specific date and time. Replace `{YEAR}`, `{MONTH}`, `{DAY}`, `{HOUR}`.

**parameters.prop value (Apr 15, 2026 at 6 AM UTC):**
```
Scheduler=<row><cell>yearValue</cell><cell>{YEAR}</cell></row><row><cell>dayValue</cell><cell>{DAY}</cell></row><row><cell>monthValue</cell><cell>{MONTH}</cell></row><row><cell>dateType</cell><cell>ON_DATE</cell></row><row><cell>hourValue</cell><cell>{HOUR}</cell></row><row><cell>minutesValue</cell><cell>{MINUTE}</cell></row><row><cell>timeType</cell><cell>ON_TIME</cell></row><row><cell>timeZone</cell><cell>( UTC 0\:00 ) Greenwich Mean Time(Etc/GMT)</cell></row><row><cell>throwExceptionOnExpiry</cell><cell>true</cell></row><row><cell>second</cell><cell>0/10</cell></row><row><cell>minute</cell><cell>*</cell></row><row><cell>hour</cell><cell>0-24</cell></row><row><cell>day_of_month</cell><cell>?</cell></row><row><cell>month</cell><cell>*</cell></row><row><cell>dayOfWeek</cell><cell>*</cell></row><row><cell>year</cell><cell>*</cell></row><row><cell>startAt</cell><cell></cell></row><row><cell>endAt</cell><cell></cell></row><row><cell>attributeBehaviour</cell><cell>isScheduleOnDayRequired,isScheduleRecurRequired,isScheduleAdvancedVisible</cell></row><row><cell>triggerType</cell><cell>cron</cell></row><row><cell>noOfSchedules</cell><cell>1</cell></row><row><cell>schedule1</cell><cell>0+{MINUTE}+{HOUR}+{DAY}+{MONTH}+?+{YEAR}&amp;trigger.timeZone\=Etc/GMT</cell></row>
```

**Substitution:** Replace `{YEAR}` (e.g., `2026`), `{MONTH}` (01-12, e.g., `04`), `{DAY}` (01-31, e.g., `15`), `{HOUR}` (0-23, e.g., `06`), `{MINUTE}` (00-59, e.g., `00`).

### Template A3: Cron — Weekdays at Specific Time (Advanced)

Runs at a specific hour on weekdays only. Replace `{HOUR}` with 0-23.

**parameters.prop value (weekdays at 8 AM UTC):**
```
Scheduler=<row><cell>dateType</cell><cell>ADVANCED</cell></row><row><cell>hourValue</cell><cell>06</cell></row><row><cell>minutesValue</cell><cell>00</cell></row><row><cell>timeType</cell><cell>ON_TIME</cell></row><row><cell>timeZone</cell><cell>( UTC 0\:00 ) Greenwich Mean Time(Etc/GMT)</cell></row><row><cell>throwExceptionOnExpiry</cell><cell>true</cell></row><row><cell>second</cell><cell>0</cell></row><row><cell>minute</cell><cell>0</cell></row><row><cell>hour</cell><cell>{HOUR}</cell></row><row><cell>day_of_month</cell><cell>?</cell></row><row><cell>month</cell><cell>*</cell></row><row><cell>dayOfWeek</cell><cell>MON,TUE,WED,THU,FRI</cell></row><row><cell>year</cell><cell>*</cell></row><row><cell>startAt</cell><cell></cell></row><row><cell>endAt</cell><cell></cell></row><row><cell>attributeBehaviour</cell><cell>isScheduleOnDayRequired,isScheduleRecurRequired,isScheduleAdvancedVisible</cell></row><row><cell>triggerType</cell><cell>cron</cell></row><row><cell>noOfSchedules</cell><cell>1</cell></row><row><cell>schedule1</cell><cell>0+0+{HOUR}+?+*+MON,TUE,WED,THU,FRI+*&amp;trigger.timeZone\=Etc/GMT</cell></row>
```

**Substitution:** Replace `{HOUR}` in both the `<cell>` and `schedule1` with 0-23 (e.g., `8`).

---

## Key Differences: Timer vs Adapter

| Aspect | Timer Start Event | Polling Adapter |
|--------|------------------|-----------------|
| XML location | `<bpmn2:timerEventDefinition>` extensionElements | `<bpmn2:messageFlow>` extensionElements |
| `attributeBehaviour` | `isThrowExceptionOnExpiryVisible,isScheduleAdvancedVisible,isScheduleAdvancedStartEndVisible,isScheduleSimpleVisible` | `isScheduleOnDayRequired,isScheduleRecurRequired,isScheduleAdvancedVisible` |
| `dateType` values | `SIMPLE`, `ADVANCED` | `DAILY`, `ON_DATE`, `ADVANCED` |
| Extra fields (adapter only) | N/A | `dayValue`, `monthValue`, `yearValue`, `OnEveryMinute`, `fromInterval`, `toInterval`, `secondValue` |
| `propdef` param_references | `<param_references/>` (empty) | `<reference attribute_category="Sender" attribute_id="/attrId::scheduleKey" .../>` |
| Run Once mode | `triggerType=simple`, `schedule1=fireNow=true` | Not applicable (use `dateType=ON_DATE` for one-time) |

---

## schedule1 Format Reference

The `schedule1` field is a `&`-separated key=value string (escaped as `&amp;` in XML, `\=` in properties). Two formats:

> **CRITICAL — Encoding differs between `.prop` and inline `.iflw` XML:**
> - **In `parameters.prop`:** Use `&amp;` (literal text in Java properties file) — e.g., `schedule1=0+0/5+0-23+?+*+*+*&amp;trigger.timeZone=Etc/GMT`
> - **In inline `.iflw` XML** (hardcoded `scheduleKey` value): Use `&amp;amp;` (double XML-encoded) — e.g., `&lt;cell&gt;0+0/5+0-23+?+*+*+*&amp;amp;trigger.timeZone=Etc/GMT&lt;/cell&gt;`
> - **Why:** The `.iflw` is XML, so `&amp;amp;` XML-decodes to `&amp;`. CPI's scheduler parser then reads that `&amp;` as the `&` separator. Using single `&amp;` in XML decodes to bare `&`, which triggers `SAXParseException` during UI rendering because the parser sees `&trigger` as a malformed XML entity reference.
> - The minimal-iflow templates (`.iflw` files) already use `&amp;amp;` correctly. When copying schedule values from `.prop` templates into inline XML, you MUST double-encode the `&amp;`.

**Simple mode** (Timer only):
```
simple.repeat={NONE|SECONDS|MINUTES|HOURS|DAYS|WEEKS|MONTHS|YEARS}&simple.every={N}&trigger.timeZone={TZ_IANA}
```
- `simple.repeat=NONE` → fire once (with `fireNow=true` in schedule1 for immediate)
- `simple.repeat=MINUTES&simple.every=10` → every 10 minutes

**Cron mode** (Timer and Adapter):
```
{second}+{minute}+{hour}+{day_of_month}+{month}+{dayOfWeek}+{year}&trigger.timeZone={TZ_IANA}
```
7 fields separated by `+`, followed by `&trigger.timeZone=`. Each field uses standard cron syntax.

### Common Cron Patterns

| Schedule | second | minute | hour | day_of_month | month | dayOfWeek | year |
|----------|--------|--------|------|-------------|-------|-----------|------|
| Every 5 min, all day | 0 | 0/5 | * | ? | * | * | * |
| Every 15 min, all day | 0 | 0/15 | 0-23 | ? | * | * | * |
| Every hour | 0 | 0 | * | ? | * | * | * |
| Daily at 6 AM | 0 | 0 | 6 | ? | * | * | * |
| Weekdays at 9 AM | 0 | 0 | 9 | ? | * | MON,TUE,WED,THU,FRI | * |
| 1st of month at 6 AM | 0 | 0 | 6 | 1 | * | ? | * |
| Specific date (Apr 15, 2026 6 AM) | 0 | 0 | 6 | 15 | 4 | ? | 2026 |

**Day fields rule:** When using `dayOfWeek`, set `day_of_month` to `?` (and vice versa). Never set both to specific values.

---

## Timezone Format

Must match CPI's format exactly: `( UTC {offset} ) {Name}({IANA_Code})`

Common values:
- `( UTC 0:00 ) Greenwich Mean Time(Etc/GMT)`
- `( UTC +1:00 ) Central European Time(Europe/Berlin)`
- `( UTC +5:30 ) India Standard Time(Asia/Kolkata)`
- `( UTC -5:00 ) Eastern Standard Time(US/Eastern)`
- `( UTC +8:00 ) Singapore Time(Asia/Singapore)`
- `( UTC +9:00 ) Japan Standard Time(Asia/Tokyo)`

In `parameters.prop`, escape the colon: `( UTC 0\:00 )`.

---

## ~~Fallback: schedulerType=trigger~~ (DEPRECATED — does not work)

> **WARNING: Do NOT use `schedulerType=trigger` + `pollInterval`.** This approach does NOT satisfy CPI's deployment validation. Deploying with only `schedulerType`+`pollInterval` (without `scheduleKey`) produces: `"Timer is not configured. Please set a schedule"` / `"SFTP Sender doesn't support the Trigger Option null"`. **Always provide a `scheduleKey`** — either externalized as `{{Scheduler}}` (preferred) or hardcoded inline with correct double-encoding (for fresh scaffolds per SKILL.md non-negotiable #10).
