import { z } from 'zod';

const resumeTemplateSchema = z.enum(['jakes', 'sidebar', 'minimal']);

const cvEducationSchema = z.object({
  school: z.string().max(500).default(''),
  degree: z.string().max(200).default(''),
  major: z.string().max(200).default(''),
  gpa: z.string().max(40).default(''),
  graduation: z.string().max(120).default(''),
  coursework: z.array(z.string().max(500)).max(80).default([]),
  honors: z.array(z.string().max(500)).max(80).default([]),
});

const cvExperienceSchema = z.object({
  company: z.string().max(300).default(''),
  role: z.string().max(300).default(''),
  dates: z.string().max(120).default(''),
  bullets: z.array(z.string().max(2000)).max(25).default([]),
  skills_used: z.array(z.string().max(200)).max(80).default([]),
});

const cvProjectSchema = z.object({
  name: z.string().max(300).default(''),
  description: z.string().max(5000).default(''),
  tech_stack: z.array(z.string().max(120)).max(80).default([]),
  bullets: z.array(z.string().max(2000)).max(40).default([]),
});

const cvSkillsSchema = z.object({
  languages: z.array(z.string().max(120)).max(200).default([]),
  frameworks: z.array(z.string().max(120)).max(200).default([]),
  tools: z.array(z.string().max(120)).max(200).default([]),
  other: z.array(z.string().max(120)).max(200).default([]),
});

/** Strips unknown keys (Claude parse). */
export const profileCvSchema = z.object({
  education: z.array(cvEducationSchema).max(30).default([]),
  experience: z.array(cvExperienceSchema).max(25).default([]),
  projects: z.array(cvProjectSchema).max(40).default([]),
  skills: cvSkillsSchema.default({
    languages: [],
    frameworks: [],
    tools: [],
    other: [],
  }),
  extracurriculars: z.array(z.unknown()).max(80).default([]),
  awards: z.array(z.unknown()).max(80).default([]),
  publications: z.array(z.unknown()).max(80).default([]),
  certifications: z.array(z.unknown()).max(80).default([]),
});

/** Phase 4.3 — user `PUT /api/profile/cv`: reject unknown fields. */
export const profileCvSchemaStrict = profileCvSchema.strict();

const questionnaireSchema = z.object({
  work_auth: z
    .object({
      authorized: z.boolean().default(false),
      sponsorship_needed: z.boolean().default(false),
      citizenship: z.string().max(200).default(''),
      visa_type: z.string().max(200).default(''),
    })
    .partial()
    .optional(),
  demographics: z
    .object({
      gender: z.string().max(120).default(''),
      ethnicity: z.string().max(120).default(''),
      veteran: z.string().max(120).default(''),
      disability: z.string().max(120).default(''),
    })
    .partial()
    .optional(),
  education_meta: z
    .object({
      graduation_date: z.string().max(80).default(''),
      student_status: z.boolean().default(false),
    })
    .partial()
    .optional(),
  availability: z
    .object({
      start_date: z.string().max(120).default(''),
      terms: z.array(z.string().max(80)).max(40).optional(),
      locations: z.array(z.string().max(200)).max(80).optional(),
      relocate: z.boolean().optional(),
      remote_ok: z.boolean().optional(),
    })
    .partial()
    .optional(),
  defaults: z
    .object({
      hear_about: z.string().max(500).default(''),
      salary: z.string().max(120).default(''),
    })
    .partial()
    .optional(),
  essays: z
    .object({
      technical_project: z.string().max(50_000).default(''),
      teamwork: z.string().max(50_000).default(''),
      challenge: z.string().max(50_000).default(''),
      motivation: z.string().max(50_000).default(''),
    })
    .partial()
    .optional(),
});

export const putProfileBodySchema = z.object({
  email: z.string().email().optional(),
  questionnaire: questionnaireSchema.optional(),
  preferences: z
    .object({
      resume_template: resumeTemplateSchema.optional(),
      auto_apply_threshold: z.number().int().min(0).max(100).optional(),
      daily_limit: z.number().int().positive().optional(),
      sheets_enabled: z.boolean().optional(),
      sheets_id: z.string().max(500).optional(),
      calendar_connected: z.boolean().optional(),
    })
    .optional(),
});

export const putPreferencesBodySchema = z.object({
  resume_template: resumeTemplateSchema,
  auto_apply_threshold: z.number().int().min(0).max(100),
  daily_limit: z.number().int().positive(),
  sheets_enabled: z.boolean(),
  sheets_id: z.string().max(500),
  calendar_connected: z.boolean(),
});

export type PutPreferencesBody = z.infer<typeof putPreferencesBodySchema>;
