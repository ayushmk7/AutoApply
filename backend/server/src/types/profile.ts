/**
 * Aligns with `docs/02_TECHNICAL_PRD.md` §7.1 (Firestore user/profile document fields).
 */

export type ResumeTemplate = 'jakes' | 'sidebar' | 'minimal';

export interface CvEducation {
  school: string;
  degree: string;
  major: string;
  gpa: string;
  graduation: string;
  coursework: string[];
  honors: string[];
}

export interface CvExperience {
  company: string;
  role: string;
  dates: string;
  bullets: string[];
  skills_used: string[];
}

export interface CvProject {
  name: string;
  description: string;
  tech_stack: string[];
  bullets: string[];
}

export interface CvSkills {
  languages: string[];
  frameworks: string[];
  tools: string[];
  other: string[];
}

export interface ProfileCv {
  education: CvEducation[];
  experience: CvExperience[];
  projects: CvProject[];
  skills: CvSkills;
  extracurriculars: unknown[];
  awards: unknown[];
  publications: unknown[];
  certifications: unknown[];
}

export interface ProfileQuestionnaire {
  work_auth: {
    authorized: boolean;
    sponsorship_needed: boolean;
    citizenship: string;
    visa_type: string;
  };
  demographics: {
    gender: string;
    ethnicity: string;
    veteran: string;
    disability: string;
  };
  education_meta: {
    graduation_date: string;
    student_status: boolean;
  };
  availability: {
    start_date: string;
    terms: string[];
    locations: string[];
    relocate: boolean;
    remote_ok: boolean;
  };
  defaults: {
    hear_about: string;
    salary: string;
  };
  essays: {
    technical_project: string;
    teamwork: string;
    challenge: string;
    motivation: string;
  };
}

export interface ProfilePreferences {
  resume_template: ResumeTemplate;
  auto_apply_threshold: number;
  daily_limit: number;
  sheets_enabled: boolean;
  sheets_id: string;
  calendar_connected: boolean;
  linkedin_connections: unknown[];
}

export interface ProfileDocument {
  uid: string;
  email: string;
  cv: ProfileCv;
  questionnaire: ProfileQuestionnaire;
  preferences: ProfilePreferences;
  agentmail_address: string;
  /** Phase 4.2 — last CV upload correlation id (last-write-wins). */
  cv_upload_id?: string;
  /** Demo sessions from `POST /api/auth/skip` (Phase 3.3). */
  is_demo?: boolean;
  created_at: unknown;
  updated_at: unknown;
}
