# Calibration Technical Structure

## Lifecycle

`Tool master -> Due list -> Calibration issue/DC -> Calibration receive -> Results update -> Next due/history`

The ERP tables remain authoritative for movement and status. App-owned result tables preserve full certificate and inspection data that cannot fit in the ERP's short remark fields.

## Database tables and fields

### `GAUGEANDTOOLS` — calibrated item master

| Column | Purpose |
|---|---|
| `REF_NO`, `TOOL_OR_GAUGE_NO` | Internal key and business tool/gauge number |
| `GROUPING`, `TYPE`, `NAME`, `DES` | Classification and identity |
| `STATUS`, `LOCATION`, `LOCATION_NAME` | Current operational state and location |
| `HISTORY_CARD_REQ` | Enables unit history/calibration lifecycle |
| `CALIBRATION_FRQ_MONTHS` | Recurrence interval |
| `CALI_PLANNED_WHO`, `CALIBRATION_RESPONSIBILITY` | Internal/external planning and ownership |
| `G_SPEC_*`, `W_LIMIT_*`, `PROD_SPEC_*` | Gauge, wear and product acceptance limits |
| `LEAST_COUNT`, `UOM` | Measurement metadata |

### `TOOLS_ISSUE_FOR_CALIBRATION` — issue/DC header

`DC_NO`, `ISSUE_DATE`, `RECEIVE_NAME`, `SUB_CODE`, `ISSUE_FOR`, `START_DT_TIME`, `TOOLS_PO_NO`, and audit fields.

### `TOOLS_TRANS_ISSUE_FOR_CALIBRATION` — issue/result lifecycle line

`ROW_ID`, `DC_NO`, `TOOL_OR_GAUGE_NO`, `GROUPING`, `ISSUE_QTY`, `SERIAL_NO`, `DUE_DATE`, `CALIB_DUE_DATE`, `STATUS`, `CALIBRATION_STATUS`, `NXT_CALIB_DATE`, `RESULT_STATUS`, `CALIB_RESULT_COMMENTS`, `CALIBRATED_BY`, `CALIBRATED_DATE`, `TOOL_REF_NO`, `REMARKS`, and audit fields.

### `TOOLS_RECEIVE_FOR_CALIBRATION` — receipt header

`REC_NO`, `DC_NO`, `RECEIVE_DATE`, `PARTY_DC_NO`, `VENDOR_CD`, `RECEIVER_NAME`, `STATUS`, and audit fields.

### `TOOLS_TRANS_RECEIVE_FOR_CALIBRATION` — receipt lines

`ROW_ID`, `REC_NO`, `DC_NO`, `TOOL_OR_GAUGE_NO`, `DESCRIPTION`, `SERIAL_NO`, `QTY`, `PRICE`, and `CREAT_DT`.

### `GAUGE_CONTROL_CARD` / `GAUGE_CONTROL_CARD_TRANS` — recurrence history

The header identifies the tool, type, status and frequency. Transaction rows store calibration date, next calibration date, remarks and audit data.

### `TOOLS_APP_CALIBRATION_RESULT` — full result header

| Column | Required | Purpose |
|---|---:|---|
| `ID` | Yes | App result key |
| `ISSUE_LINE_ROW_ID` | Yes, unique | One result per ERP issue line |
| `TOOL_OR_GAUGE_NO`, `DC_NO`, `SERIAL_NO` | Tool required | Traceability |
| `RESULT_STATUS` | Yes | Passed/recalibrated/failure disposition |
| `CERTIFICATE_NO` | No | Lab certificate identifier |
| `REFERENCE_STANDARD` | No | Standard/master instrument used |
| `ERROR_NOTICED` | No | Nonconformance/error detail |
| `COMMENTS` | No | Full result comments |
| `CALIBRATED_BY` | No | Technician/lab |
| `CALIBRATED_DATE`, `NEXT_CALIB_DATE` | Yes | Completion and recurrence dates |
| `LOCATION` | No | Return/assigned location |
| `CREATED_BY/AT`, `UPDATED_BY/AT` | Yes/automatic | Audit trail |

### `TOOLS_APP_CALIBRATION_RESULT_OBS` — parameter observations

`ID`, `RESULT_ID`, `LINE_NO`, `PARAMETER`, `SPECIFICATION`, `OBSERVED_MIN`, `OBSERVED_MAX`, `GAUGE_STATUS`, `REMARKS`, and `CREATED_AT`. Rows cascade-delete when their parent result is replaced/deleted.

## Backend routes

| Route | Method | Responsibility |
|---|---|---|
| `/api/tools/calibration-due` | GET | Due/overdue queue derived from issue, control card and tool master |
| `/api/calibration/issue` | GET/POST | Search/create calibration DCs and issue lines |
| `/api/calibration/issue/[id]` | GET/PATCH | DC detail and open-DC editing |
| `/api/calibration/receive` | GET/POST | Open issue list, partial/full receipt |
| `/api/calibration/results-update` | GET/POST | Open/closed list and transactional result posting |
| `/api/calibration/calendar` | GET | Calibration/preventive plan-versus-actual calendar |
| `/api/calibration/history/[toolOrGaugeNo]` | GET | Per-tool calibration history |

Result posting updates the ERP issue line, app result header/observations, control card, tool status/location, and physical unit status in one transaction. Authentication and `canManageCalibration` permission are required for writes.

## Frontend screens and fields

| Screen | Main fields/actions |
|---|---|
| Due List | Tool no, name/type, frequency, last/next date, overdue band, Issue Now |
| Calibration Issue | Receive name, issue for, issue date, subcontractor, selected tools/serials, DC creation/edit/PDF |
| Calibration Receive | DC, receive date, party DC, receiver, selected lines, quantity, price, certificate upload |
| Results Update | Location, frequency/spec limits, certificate, standard, error, observed min/max, per-parameter status, calibrated date/by, next date, result and comments |
| Calendar | Year/month range, calibration/preventive type, group/type, plan and actual |
| History Card Results | Open and completed results, tool/DC, dates, frequency, certificate, technician and status |

## Status rules

- Issue: tool/unit becomes `Under Calibration` / `ISSUE FOR CALIBRATION`.
- Receive: movement closes or becomes partial; result remains pending.
- Passed or recalibrated: tool/unit becomes `Available`; next date is scheduled.
- Failed, rejected, broken, worn out, or not in use: tool/unit becomes `Out of Service` or `Not In Use`.
- A result cannot be posted without an open calibration issue line.
