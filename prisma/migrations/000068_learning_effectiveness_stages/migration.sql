-- Phase 10: allow multiple effectiveness evaluations per employee per
-- schedule (IMMEDIATE / D30 / D60 / D90) by including evaluationStage in
-- the unique key.

BEGIN TRAN;

-- Backfill: existing single-evaluation rows count as the IMMEDIATE stage.
UPDATE dbo.TrainingEffectiveness SET evaluationStage = 'IMMEDIATE' WHERE evaluationStage IS NULL;

-- The original @@unique was never materialized on this table (learning
-- tables were created without constraints), so create it fresh.
CREATE UNIQUE INDEX TrainingEffectiveness_companyId_trainingScheduleId_employeeId_evaluationStage_key
  ON dbo.TrainingEffectiveness (companyId, trainingScheduleId, employeeId, evaluationStage);

COMMIT TRAN;
