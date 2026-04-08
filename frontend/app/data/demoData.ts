export type FeedEventStatus =
  | 'generating'
  | 'ats'
  | 'submitted'
  | 'captcha'
  | 'ghost'
  | 'referral'
  | 'failed'
  | 'interview'
  | 'rejected';

export interface DemoFeedEvent {
  id: string;
  timestamp: string;
  company: string;
  role: string;
  action: string;
  status: FeedEventStatus;
  score?: number;
  details?: string;
  resumeSnippet?: string;
  coverSnippet?: string;
  screenshotLabel?: string;
}

export interface DemoJob {
  id: string;
  company: string;
  role: string;
  location: string;
  source: 'Simplify' | 'PittCSC' | 'Apollo';
  fitScore: number;
  competition: 'High' | 'Medium' | 'Low';
  urgent?: boolean;
  daysLeft?: number;
  isGhost?: boolean;
  ghostReason?: string;
  hasReferral?: boolean;
  referralChain?: string;
  status: 'not_applied' | 'queued' | 'applied' | 'skipped';
  description?: string;
  requirements?: string;
  matchReasoning?: string;
}

export type AppStatus =
  | 'applied'
  | 'waiting'
  | 'interview'
  | 'rejected'
  | 'offer'
  | 'manual_needed';

export interface DemoApplication {
  id: string;
  company: string;
  role: string;
  date: string;
  method: 'ATS' | 'Email';
  fitScore: number;
  atsScore: number;
  status: AppStatus;
  daysWaiting: number;
  response?: string;
  nextAction?: string;
  nextActionType?: 'button' | 'link' | 'info';
  matchedKeywords?: string[];
  missingKeywords?: string[];
  autoRevised?: boolean;
  thankYouStatus?: 'sent' | 'pending';
  followUpStatus?: 'sent' | 'pending' | 'not_yet';
}

export interface DemoResume {
  id: string;
  company: string;
  role: string;
  date: string;
  atsScore: number;
  tags: string[];
}

export const demoFeedEvents: DemoFeedEvent[] = [
  {
    id: '1',
    timestamp: '2 min ago',
    company: 'Google',
    role: 'Software Engineer Intern',
    action: 'Interview request received',
    status: 'interview',
    details: 'Phone screen scheduled for Apr 8, 2026',
    resumeSnippet: 'Emphasized distributed systems and Python.',
    coverSnippet: 'Short paragraph on summer research alignment.',
    screenshotLabel: 'confirmation_google.png',
  },
  {
    id: '2',
    timestamp: '8 min ago',
    company: 'Meta',
    role: 'Frontend Developer',
    action: 'Submitted successfully',
    status: 'submitted',
    resumeSnippet: 'React and performance tuning highlighted.',
    coverSnippet: 'Product sense + design systems.',
  },
  {
    id: '3',
    timestamp: '15 min ago',
    company: 'Microsoft',
    role: 'Product Manager Intern',
    action: 'ATS Score: 91%',
    status: 'ats',
    score: 91,
    resumeSnippet: 'Metrics-led bullets for PM track.',
    coverSnippet: 'Stakeholder stories condensed.',
  },
  {
    id: '4',
    timestamp: '23 min ago',
    company: 'Stripe',
    role: 'Software Engineer',
    action: 'Generating resume...',
    status: 'generating',
  },
  {
    id: '5',
    timestamp: '31 min ago',
    company: 'Apple',
    role: 'iOS Engineer Intern',
    action: 'Referral path found',
    status: 'referral',
    details: 'You → Sarah Chen → Apple',
    referralChain: 'You → Sarah Chen (SWE) → Apple',
  },
  {
    id: '6',
    timestamp: '45 min ago',
    company: 'Coinbase',
    role: 'Backend Engineer',
    action: 'CAPTCHA detected, solving...',
    status: 'captcha',
  },
  {
    id: '7',
    timestamp: '1 hr ago',
    company: 'TechCorp',
    role: 'Full Stack Developer',
    action: 'Ghost job detected - skipped',
    status: 'ghost',
    details: 'Posted 6+ months ago, no updates',
  },
  {
    id: '8',
    timestamp: '1.5 hr ago',
    company: 'Netflix',
    role: 'Data Analyst Intern',
    action: 'Failed - flagged for manual',
    status: 'failed',
    details: 'Custom questionnaire requires human input',
  },
  {
    id: '9',
    timestamp: '2 hr ago',
    company: 'Airbnb',
    role: 'Design Engineer',
    action: 'Response received',
    status: 'rejected',
    response: 'Not moving forward',
  },
];

export const demoUpNextJobs = [
  { company: 'Amazon', role: 'SDE Intern', score: 88 },
  { company: 'Uber', role: 'Backend Engineer', score: 85 },
  { company: 'Spotify', role: 'Full Stack Dev', score: 82 },
  { company: 'Dropbox', role: 'Platform Engineer', score: 79 },
  { company: 'Databricks', role: 'ML Engineer', score: 77 },
];

export const demoJobs: DemoJob[] = [
  {
    id: '1',
    company: 'Stripe',
    role: 'Software Engineer Intern',
    location: 'San Francisco, CA',
    source: 'Simplify',
    fitScore: 94,
    competition: 'High',
    hasReferral: true,
    referralChain: 'You → Jordan Lee (Payments) → Stripe',
    status: 'not_applied',
    urgent: true,
    daysLeft: 2,
    description: 'Build reliable APIs and internal tools for money movement.',
    requirements: 'Python, Go, or Ruby; strong systems thinking.',
    matchReasoning:
      'Strong match for payments domain from fintech internship and API design coursework.',
  },
  {
    id: '2',
    company: 'Figma',
    role: 'Product Designer',
    location: 'Remote',
    source: 'Apollo',
    fitScore: 88,
    competition: 'High',
    status: 'queued',
    description: 'Design workflows for collaborative creation.',
    requirements: 'Portfolio, Figma fluency, systems thinking.',
    matchReasoning: 'Portfolio shows design systems and prototyping depth.',
  },
  {
    id: '3',
    company: 'OpenAI',
    role: 'ML Research Intern',
    location: 'San Francisco, CA',
    source: 'Simplify',
    fitScore: 92,
    competition: 'High',
    status: 'not_applied',
    description: 'Research adjacent to model safety and evals.',
    requirements: 'PyTorch, papers, strong math.',
    matchReasoning: 'Research lab + NLP coursework aligns with role.',
  },
  {
    id: '4',
    company: 'Notion',
    role: 'Frontend Engineer',
    location: 'New York, NY',
    source: 'PittCSC',
    fitScore: 85,
    competition: 'Medium',
    status: 'applied',
    description: 'Performance and polish for editor surfaces.',
    requirements: 'React, TypeScript, performance profiling.',
    matchReasoning: 'Editor internship maps to doc surface problems.',
  },
  {
    id: '5',
    company: 'Linear',
    role: 'Full Stack Engineer',
    location: 'Remote',
    source: 'Apollo',
    fitScore: 89,
    competition: 'Low',
    hasReferral: true,
    referralChain: 'You → Alex Kim (Eng) → Linear',
    status: 'not_applied',
    description: 'Ship product velocity tools end-to-end.',
    requirements: 'React, Node, Postgres.',
    matchReasoning: 'Full-stack projects and startup pace.',
  },
  {
    id: '6',
    company: 'Vercel',
    role: 'DevRel Engineer',
    location: 'Remote',
    source: 'Simplify',
    fitScore: 81,
    competition: 'Medium',
    status: 'not_applied',
    description: 'Teach developers to ship faster on the web.',
    requirements: 'Communication, Next.js, content.',
    matchReasoning: 'Talks + OSS contributions signal DevRel fit.',
  },
  {
    id: '7',
    company: 'TechCorp Inc',
    role: 'Software Developer',
    location: 'Generic City',
    source: 'Apollo',
    fitScore: 45,
    competition: 'Low',
    isGhost: true,
    ghostReason: 'Posted 6+ months ago with no updates',
    status: 'skipped',
    description: 'Generic listing with sparse detail.',
    requirements: 'Unclear stack; repetitive boilerplate.',
    matchReasoning: 'Low signal role; flagged as likely ghost.',
  },
  {
    id: '8',
    company: 'Ramp',
    role: 'Backend Engineer',
    location: 'New York, NY',
    source: 'PittCSC',
    fitScore: 87,
    competition: 'Medium',
    status: 'not_applied',
    description: 'Card infra and ledger correctness.',
    requirements: 'Java/Kotlin, distributed systems.',
    matchReasoning: 'Payments coursework + internships.',
  },
];

export const demoApplications: DemoApplication[] = [
  {
    id: '1',
    company: 'Google',
    role: 'Software Engineer Intern',
    date: 'Apr 1, 2026',
    method: 'ATS',
    fitScore: 94,
    atsScore: 91,
    status: 'interview',
    daysWaiting: 2,
    response: 'Interview scheduled',
    nextAction: 'Prep materials ready',
    nextActionType: 'button',
    matchedKeywords: ['Python', 'Distributed Systems', 'Kubernetes'],
    missingKeywords: [],
    thankYouStatus: 'pending',
    followUpStatus: 'not_yet',
  },
  {
    id: '2',
    company: 'Meta',
    role: 'Frontend Developer',
    date: 'Apr 1, 2026',
    method: 'ATS',
    fitScore: 88,
    atsScore: 87,
    status: 'waiting',
    daysWaiting: 2,
    response: '—',
    matchedKeywords: ['React', 'TypeScript', 'GraphQL'],
    missingKeywords: ['Relay'],
  },
  {
    id: '3',
    company: 'Microsoft',
    role: 'Product Manager Intern',
    date: 'Mar 31, 2026',
    method: 'Email',
    fitScore: 91,
    atsScore: 89,
    status: 'applied',
    daysWaiting: 3,
    response: 'Acknowledged',
    matchedKeywords: ['SQL', 'Roadmapping', 'Metrics'],
    missingKeywords: [],
    thankYouStatus: 'sent',
    followUpStatus: 'not_yet',
  },
  {
    id: '4',
    company: 'Stripe',
    role: 'Software Engineer',
    date: 'Mar 31, 2026',
    method: 'ATS',
    fitScore: 92,
    atsScore: 94,
    status: 'waiting',
    daysWaiting: 3,
    response: '—',
    matchedKeywords: ['APIs', 'Python', 'Payments'],
    missingKeywords: [],
  },
  {
    id: '5',
    company: 'Netflix',
    role: 'Data Analyst Intern',
    date: 'Mar 30, 2026',
    method: 'ATS',
    fitScore: 78,
    atsScore: 72,
    status: 'rejected',
    daysWaiting: 4,
    response: 'Auto-screen',
    nextAction: 'ATS gap: missing SQL, Tableau',
    nextActionType: 'info',
    matchedKeywords: ['Python', 'Experimentation'],
    missingKeywords: ['SQL', 'Tableau'],
  },
  {
    id: '6',
    company: 'Apple',
    role: 'iOS Engineer Intern',
    date: 'Mar 29, 2026',
    method: 'ATS',
    fitScore: 89,
    atsScore: 88,
    status: 'waiting',
    daysWaiting: 5,
    response: '—',
    nextAction: 'Send follow-up?',
    nextActionType: 'button',
    matchedKeywords: ['Swift', 'UIKit', 'Concurrency'],
    missingKeywords: [],
  },
  {
    id: '7',
    company: 'Coinbase',
    role: 'Backend Engineer',
    date: 'Mar 28, 2026',
    method: 'ATS',
    fitScore: 85,
    atsScore: 0,
    status: 'manual_needed',
    daysWaiting: 6,
    response: '—',
    nextAction: 'Complete manually',
    nextActionType: 'button',
    matchedKeywords: [],
    missingKeywords: ['Custom form'],
  },
  {
    id: '8',
    company: 'Amazon',
    role: 'SDE Intern',
    date: 'Mar 27, 2026',
    method: 'ATS',
    fitScore: 88,
    atsScore: 86,
    status: 'interview',
    daysWaiting: 7,
    response: 'OA passed',
    nextAction: 'Send follow-up?',
    nextActionType: 'button',
    matchedKeywords: ['Java', 'AWS', 'Algorithms'],
    missingKeywords: [],
    thankYouStatus: 'sent',
    followUpStatus: 'pending',
  },
];

export const demoResumes: DemoResume[] = [
  { id: '1', company: 'Google', role: 'Software Engineer Intern', date: 'Apr 1, 2026', atsScore: 91, tags: ['Python', 'ML', 'Research'] },
  { id: '2', company: 'Meta', role: 'Frontend Developer', date: 'Apr 1, 2026', atsScore: 87, tags: ['React', 'TypeScript', 'UI'] },
  { id: '3', company: 'Microsoft', role: 'Product Manager Intern', date: 'Mar 31, 2026', atsScore: 89, tags: ['Leadership', 'Strategy', 'Data'] },
  { id: '4', company: 'Stripe', role: 'Software Engineer', date: 'Mar 31, 2026', atsScore: 94, tags: ['Backend', 'APIs', 'Payments'] },
  { id: '5', company: 'Apple', role: 'iOS Engineer Intern', date: 'Mar 29, 2026', atsScore: 88, tags: ['Swift', 'iOS', 'Mobile'] },
  { id: '6', company: 'Amazon', role: 'SDE Intern', date: 'Mar 27, 2026', atsScore: 86, tags: ['Java', 'AWS', 'Distributed'] },
];

export const demoAtsDetail = {
  score: 91,
  matched: ['Python', 'Distributed Systems', 'gRPC', 'Kubernetes', 'CI/CD'],
  missing: ['Terraform'],
  suggestions:
    'Add a bullet quantifying scale (QPS/latency) and mention Terraform if you have course or project exposure.',
  autoRevised: true,
  diffSummary: 'Added Kubernetes and CI/CD keywords from your capstone description.',
};

export const demoInterviewDetail = {
  company: 'Google',
  role: 'Software Engineer Intern',
  appliedDate: 'Mar 20, 2026',
  responseDate: 'Mar 28, 2026',
  interviewDate: 'Apr 8, 2026',
  format: 'Video' as const,
  interviewers: ['Jamie L.', 'Riley K.'],
  calendarLink: '',
  prepOverview:
    'Google values clarity, data-backed tradeoffs, and coding fluency under time pressure.',
  talkingPoints: ['System design for read-heavy API', 'Conflict resolution in team project', 'Complexity analysis habits'],
  likelyQuestions: ['Tell me about a hard bug', 'Design a URL shortener', 'How do you prioritize tech debt?'],
  resumeHighlights: ['Python backend internship', 'Research publication', 'Teaching assistant'],
};

export const demoReferralDetail = {
  connectionName: 'Sarah Chen',
  connectionRole: 'Software Engineer',
  company: 'Apple',
  howConnected: 'Met through CMU alumni network; interned together.',
  draftMessage:
    'Hi Sarah — hope you are well. I applied to the iOS intern role and would love a quick referral if you are comfortable. Happy to share my resume.',
};
