/**
 * Seeds DropdownMaster categories for the Learning module (BRD §9-11, §47).
 * DropdownMaster is a global (non-company-scoped) lookup table, so this runs
 * once per environment. Idempotent — upserts on (category, value).
 *
 *   node scripts/seed-learning-dropdowns.mjs
 */

import { readFileSync } from 'node:fs';

for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (!m) continue;
  const v = m[2].trim().replace(/^["']|["']$/g, '');
  if (!process.env[m[1]]) process.env[m[1]] = v;
}

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

const CATEGORIES = {
  TRAINING_METHOD: ['Classroom', 'Online', 'On-the-Job', 'Workshop', 'Blended', 'Webinar', 'External', 'Self-Paced'],
  TRAINING_CATEGORY: ['Technical', 'Behavioral', 'Safety', 'Compliance', 'Leadership', 'Functional', 'Soft Skills', 'Induction'],
  TRAINING_TYPE: ['Internal', 'External'],
  TRAINING_PRIORITY: ['Critical', 'High', 'Medium', 'Low'],
  TRAINING_REASON: ['Skill Gap', 'TNA', 'Mandatory', 'Manager', 'Plan', 'Promotion', 'New Joining'],
  QUESTION_TYPE: ['MCQ', 'Multi Select', 'True/False', 'Short Answer', 'Descriptive', 'Scenario', 'Practical', 'Fill in Blank', 'Rating'],
  TRAINING_COST_HEAD: ['Trainer Fee', 'Venue', 'Travel', 'Accommodation', 'Material', 'Food & Refreshment', 'Certification', 'Miscellaneous'],
  TRAINING_FREQUENCY: ['One-time', 'Monthly', 'Quarterly', 'Half-Yearly', 'Annual'],
  EFFECTIVENESS_RATING: ['Excellent', 'Good', 'Average', 'Poor'],
  TRAINING_EVALUATION_STAGE: ['Immediate', '30 Days', '60 Days', '90 Days'],
  // §47 Training Rating Master — the 5-point scale used by feedback,
  // effectiveness, and participant evaluation forms. Values are numeric so
  // forms can post them straight into Int rating columns.
  TRAINING_RATING: [
    { label: '1 — Very Poor', value: '1' },
    { label: '2 — Poor', value: '2' },
    { label: '3 — Average', value: '3' },
    { label: '4 — Good', value: '4' },
    { label: '5 — Excellent', value: '5' },
  ],
};

// Entries may be plain strings (label = value) or {label, value} pairs.
const normalize = (e) => (typeof e === 'string' ? { label: e, value: e } : e);

let created = 0;
let skipped = 0;
for (const [category, values] of Object.entries(CATEGORIES)) {
  for (let i = 0; i < values.length; i++) {
    const { label, value } = normalize(values[i]);
    const existing = await prisma.dropdownMaster.findFirst({ where: { category, value, deletedAt: null } });
    if (existing) { skipped++; continue; }
    await prisma.dropdownMaster.create({
      data: { category, label, value, sortOrder: i + 1 },
    });
    created++;
  }
}

console.log(`Done — created ${created}, already present ${skipped}`);
await prisma.$disconnect();
