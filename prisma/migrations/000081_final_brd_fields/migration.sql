-- Final BRD gap fields — all additive nullable columns.
-- §24 question-level links, §43 OJT assessment link, §35 external trainer name.

-- §24: question-level Category, Topic, Skill, Proficiency Level links.
ALTER TABLE [dbo].[QuestionBank] ADD
    [skillId] INT NULL,
    [proficiencyLevelId] INT NULL,
    [category] NVARCHAR(100) NULL,
    [topic] NVARCHAR(200) NULL;

-- §43: OJT assessment link + score.
ALTER TABLE [dbo].[OjtAssignment] ADD
    [assessmentId] INT NULL,
    [assessmentScore] DECIMAL(5,2) NULL;

-- §35: external trainer name (distinct from the provider organisation).
ALTER TABLE [dbo].[ExternalTraining] ADD
    [trainerName] NVARCHAR(100) NULL;
