# Searchable Dropdown Audit

**Date:** 18 August 2026  
**Rule used:** A dropdown should provide type-ahead search when its available data source contains, or can routinely contain, more than 30 records. Small fixed lists such as Yes/No, status, company unit, month, and workflow type should remain normal dropdowns.

## Executive Summary

- Audited native `<select>` controls, the shared `FormSelect`, `SelectionFilter`, and existing `SearchSelect` usage across `src/app/dashboard` and shared components.
- Found **10 definite searchable-dropdown gaps across 7 screens**.
- Live read-only database counts confirm the main high-volume sources:
  - Suppliers: **1,225**
  - Subcontractors: **327**
  - Tools/instruments: **1,731**
  - Distinct tool locations: **99**
- Existing searchable selectors in Tools Issue and Tools Receive were not counted as gaps.

## Implementation Status — Completed 18 August 2026

All 10 definite gaps listed below have been converted to searchable selectors. Large supplier, subcontractor, tool, and ledger masters now use debounced server-side queries capped at 25 matches. Location search filters the complete 99-row lookup client-side. Selected values remain visible, and the PO Schedule and GRN forms now explicitly validate that every line has a selected tool.

Shared implementation: `src/components/ui/MasterSearchSelect.tsx`.

## Definite Gaps — Convert to Searchable Select

| Priority | Screen / form | Field | Current source size | Evidence |
|---|---|---:|---:|---|
| Critical | Calibration → Issue Calibration DC | Party Name | 327 subcontractors | Plain select populated from `/api/subcontractors?pageSize=200`; it also truncates the 327-record master to the first 200. |
| Critical | Calibration → Issue Calibration DC → Edit DC | Sub Code | 327 subcontractors | Plain select using the same subcontractor list. |
| Critical | PO Linked → Create Purchase Order | Supplier | 1,225 suppliers | Plain select populated from `/api/suppliers?pageSize=500`; users cannot search and only the first 500 can be loaded. |
| Critical | PO Linked → Receive / GRN form | Supplier | 1,225 suppliers | Plain select populated from `/api/suppliers?pageSize=500`. |
| Critical | PO Linked → Receive / GRN form | Tool on each staged line | 1,731 tools | Plain select; page loads only `/api/tools?pageSize=100`, so most tools are unavailable in this control. |
| Critical | PO Linked → Schedule form | Select Tool | 1,731 tools | Plain select backed by `/api/tools`; should use server-side search rather than loading a large master. |
| High | PO Linked → Purchase Orders list | Supplier filter | 1,225 suppliers | Plain filter select populated from `/api/suppliers?pageSize=200`; both searchability and completeness are affected. |
| High | PO Linked → Receive list | Supplier filter | 1,225 suppliers | Plain filter select populated from `/api/suppliers?pageSize=500`; list filters also need search for client usability. |
| High | Calibration → Results Update form | Location | 99 distinct tool locations | Plain select populated from `/api/lookups/locations`. |
| High | PO Linked → Create Purchase Order → line item | Expense Ledger Code | API permits up to 300–500 finance-ledger rows | Plain select populated from `/api/gl-codes?pageSize=300`; this master is designed as a large lookup and should use code/name search. |

## Currently Below 30 — No Immediate Conversion Needed

These are dynamic controls but current live data is below the agreed threshold:

| Screen / form | Field | Current evidence | Recommendation |
|---|---|---:|---|
| Calibration → Issue Calibration DC | Type of Item | 10 distinct tool types | Keep normal dropdown. |
| Calibration → Issue Calibration DC | Group / Name | 2 distinct groups | Keep normal dropdown. |
| Tools Master create/edit | Group, Type, Name, Department, UOM | Current distinct counts: 2, 10, 1, 0, 1 | Keep normal dropdown; reassess if a lookup reaches 30. |
| Tool Group / Tool Subgroup / Tool Type masters | Parent group/type fields | Current master rows are below 30 | Keep normal dropdown. |
| Tools Issue | Open Requisition No | 3 requisitions currently | Keep for now; convert when open requisitions reach 30. |
| Tools Consumption | Issue DC | 3 issue DCs currently | Keep for now; this is likely to need server-side search as transaction history grows. |
| Settings → Users | Role | Small administrative master | Keep normal dropdown. |

## Fixed Lists — Search Would Reduce Usability

Do not add search to Company Unit, Yes/No, Active/Inactive/Blocked, calibration result, receive condition, returnable, issue-for type, month, status, document type, and similar short controlled lists.

## Implementation Standard

For every high-volume field:

1. Use the existing accessible `SearchSelect` interaction pattern.
2. Search by both code and display name (for example supplier code + supplier name).
3. Use server-side search with a small result page (about 20–30 rows); do not preload 500–1,731 options.
4. Preserve the selected item even when it is outside the current search results.
5. Support keyboard navigation, clear/change, loading, no-results, and error states.
6. For dependent fields, reset the child selection when the parent changes.

## Recommended Delivery Order

1. Calibration Party Name and Edit Sub Code.
2. PO Create supplier and expense ledger.
3. PO Receive supplier and staged-line tool.
4. PO Schedule tool.
5. Supplier filters on PO and GRN lists.
6. Calibration Results location.

## Audit Scope Note

The audit is based on application source plus live read-only database counts. It does not classify free-text search boxes, date inputs, radio-style filters, or already-searchable `SearchSelect` controls as gaps.
