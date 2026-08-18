-- Earlier calibration workbook imports used EQUIP_NO as the required GROUPING
-- fallback. Repair only unmistakable imported rows linked to unit stock.
UPDATE [dbo].[GAUGEANDTOOLS]
SET [GROUPING] = N'INSTRUMENTS'
WHERE [GROUPING] = [TOOL_OR_GAUGE_NO]
  AND EXISTS (
    SELECT 1
    FROM [dbo].[TOOLS_UNIT_STOCK] AS [s]
    WHERE [s].[REF_NO] = [dbo].[GAUGEANDTOOLS].[REF_NO]
  );
