# DO NOT APPLY THIS MIGRATION WITHOUT ASKING FIRST

This migration is the only one left pending. It is **destructive** and would
partially undo work that is already live.

## What it does

2,480 lines containing **40 `DROP TABLE`**, **40 `CREATE TABLE [_prisma_new_*]`**
and **126 `sp_rename`** — Prisma's table-rebuild pattern (build shadow, copy,
drop original, rename).

Among the tables it rebuilds are `KpiTemplate`, `KpiGoal`, `EmployeeKraCycle`
and `EmployeeKraLine` — the legacy KPI/KRA stack that migration
`000067_kpi_kra_performance` deliberately dropped when `Kra` / `Kpi` /
`GoalTemplate` replaced it. Applying this would resurrect them.

## Why it has not simply been deleted

Its own commit (`5186e44`, Ajith Kumar, 16 Sep) says the intent was:

> Stub models for 43 existing DB tables … that were never in schema.prisma —
> prevents prisma migrate from dropping them

That reads as though the SQL is an artefact of `prisma migrate dev` generating a
diff, and was never meant to run — the schema edits in the same commit achieved
the goal. But `a483fa3` (Franklin, 17 Sep) then edited this file
(+171/−154), so somebody treated the SQL as meaningful afterwards. Deciding
"regenerate against current schema" vs "discard" needs those two, not a guess.

## The trap

`prisma migrate deploy` currently fails on this migration with
"There is already an object named 'OnDutyRequest'". **That collision is an
accident, not a safeguard.** If someone resolves it incidentally — dropping the
conflicting object to "unblock the build" — the rebuild behind it executes.

Ask Ajith Kumar (intent) and Franklin (what his edit addressed) before touching
this, and take a database backup first regardless of the answer.
