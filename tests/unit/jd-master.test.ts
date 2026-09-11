import { describe, it, expect } from 'vitest';
import { jobDescriptionCreateSchema } from '@/lib/validations/jd-master';
import { formatJdCode, normalizeTags } from '@/lib/jd-master';

describe('formatJdCode', () => {
  it('pads sequential numbers as JD0001', () => {
    expect(formatJdCode(1)).toBe('JD0001');
    expect(formatJdCode(12)).toBe('JD0012');
    expect(formatJdCode(10000)).toBe('JD10000');
  });
});

describe('normalizeTags', () => {
  it('trims, lowercases, and de-duplicates', () => {
    expect(normalizeTags([' React ', 'react', 'NODE'])).toEqual(['react', 'node']);
  });
});

describe('jobDescriptionCreateSchema', () => {
  it('requires title and description', () => {
    expect(
      jobDescriptionCreateSchema.safeParse({
        departmentId: 1,
        designationId: 1,
        title: '',
        description: 'x',
      }).success
    ).toBe(false);
  });

  it('defaults status to Active and parses JSON tags from multipart', () => {
    const parsed = jobDescriptionCreateSchema.safeParse({
      departmentId: '3',
      designationId: '4',
      title: 'Engineer',
      description: 'Builds things',
      tags: '["SQL"," excel "]',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.status).toBe('Active');
      expect(parsed.data.departmentId).toBe(3);
      expect(parsed.data.tags).toEqual(['SQL', ' excel ']);
    }
  });
});
