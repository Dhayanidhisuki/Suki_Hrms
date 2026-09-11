import { z } from 'zod';

const JD_STATUSES = ['Draft', 'Active', 'Archived'] as const;

function optionalNumber<T extends z.ZodTypeAny>(inner: T) {
  return z.preprocess((v) => (v === '' || v === null ? undefined : v), inner.optional());
}

const tagsField = z.preprocess((v) => {
  if (v == null || v === '') return [];
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* comma-separated */
    }
    return v.split(/[,;]/);
  }
  return [];
}, z.array(z.union([z.string(), z.number()])).max(40));

const optionalExperience = optionalNumber(z.coerce.number().min(0).max(60));
const optionalSalary = z.preprocess(
  (v) => (v === '' || v == null ? null : v),
  z.string().trim().max(100).nullable().optional()
);

const experienceSalaryFields = {
  minExperienceYears: optionalExperience,
  maxExperienceYears: optionalExperience,
  salaryPackage: optionalSalary,
};

export const jobDescriptionCreateSchema = z
  .object({
    departmentId: z.coerce.number().int().positive(),
    designationId: z.coerce.number().int().positive(),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1),
    status: z.enum(JD_STATUSES).optional().default('Active'),
    tags: tagsField.optional(),
    acknowledgeDuplicate: z.preprocess((v) => v === true || v === 'true' || v === '1', z.boolean()).optional(),
    ...experienceSalaryFields,
  })
  .refine(
    (v) =>
      v.minExperienceYears == null ||
      v.maxExperienceYears == null ||
      v.minExperienceYears <= v.maxExperienceYears,
    { message: 'Min experience cannot exceed max experience', path: ['minExperienceYears'] }
  );

export const jobDescriptionUpdateSchema = z
  .object({
    departmentId: optionalNumber(z.coerce.number().int().positive()),
    designationId: optionalNumber(z.coerce.number().int().positive()),
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().min(1).optional(),
    status: z.enum(JD_STATUSES).optional(),
    tags: tagsField.optional(),
    acknowledgeDuplicate: z.preprocess((v) => v === true || v === 'true' || v === '1', z.boolean()).optional(),
    ...experienceSalaryFields,
  })
  .refine(
    (v) =>
      v.minExperienceYears == null ||
      v.maxExperienceYears == null ||
      v.minExperienceYears <= v.maxExperienceYears,
    { message: 'Min experience cannot exceed max experience', path: ['minExperienceYears'] }
  );

export const jobDescriptionStatusSchema = z.object({
  status: z.enum(JD_STATUSES),
  acknowledgeDuplicate: z.preprocess((v) => v === true || v === 'true' || v === '1', z.boolean()).optional(),
});

export const jobPostingCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  departmentId: optionalNumber(z.coerce.number().int().positive()),
  designationId: optionalNumber(z.coerce.number().int().positive()),
  jdId: optionalNumber(z.coerce.number().int().positive()),
  status: z.string().trim().max(20).optional().default('Open'),
});

export const bulkJdRowSchema = z.object({
  department: z.string().trim().min(1),
  designation: z.string().trim().min(1),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1),
  tags: z.string().optional().nullable(),
  minExperienceYears: optionalNumber(z.coerce.number().min(0).max(60)),
  maxExperienceYears: optionalNumber(z.coerce.number().min(0).max(60)),
  salaryPackage: z.string().trim().max(100).optional().nullable(),
  fileName: z.string().trim().max(200).optional().nullable(),
});
