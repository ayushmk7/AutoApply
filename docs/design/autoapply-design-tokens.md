# AutoApply - Frontend Design Prompt (Figma AI)

## Design Direction

Design a web application for AutoApply, an automated job application platform for college students. The visual language should feel like Apple's liquid glass aesthetic: translucent layers, frosted glass panels, soft depth, light refraction effects, and smooth rounded surfaces. The interface should feel physical, like panels of glass floating over a soft gradient canvas.

**This must not look AI-generated.** No purple-blue gradients. No generic SaaS dashboard look. No Inter font at weight 400. No flat cards with drop shadows. The goal is something a user would screenshot and share because it looks that good.

Think: Apple Vision Pro UI meets Linear meets Vercel's design language. Translucent, layered, precise, with moments of color that feel intentional.

---

## Design System Tokens

### Typography - Use Extremes

**Go to extremes**: Use 100-200 (thin) vs 800-900 (black), not safe 400 vs 600. Create hierarchy through weight contrast, not just size.

**Font Pairing:**
```
Display / Headings: 'SF Pro Display' or 'Space Grotesk' at weight 700-900, tight letter-spacing (-0.03em)
Body: 'SF Pro Text' or 'Inter' at weight 200-300, slight letter-spacing (0.01em)
Monospace (for feed, scores, data): 'JetBrains Mono' or 'SF Mono' at weight 400
```

The contrast between ultra-thin body text and heavy black headings creates the premium feel. Do not use medium weights (400-600) for anything except monospace data.

### Color Theme - Liquid Glass

The background is a soft, muted gradient. Not vibrant. Not dark mode cyberpunk. Think early morning fog with hints of color.

```
Canvas / Background:       #F2F0ED (warm off-white, not pure white)
Glass Panel Background:    rgba(255, 255, 255, 0.45) with backdrop-filter: blur(40px)
Glass Panel Border:        rgba(255, 255, 255, 0.6) (1px, subtle edge catch)
Glass Panel Shadow:        0 8px 32px rgba(0, 0, 0, 0.06)

Text Primary:              #1A1A1A
Text Secondary:            #6B6B6B
Text Tertiary:             #9B9B9B

Accent (Primary Action):   #0066FF (clean blue, not purple)
Accent Success:            #00B341
Accent Warning:            #F5A623
Accent Danger:             #FF3B30
Accent Info:               #5AC8FA

Status: Applied:           #0066FF (blue)
Status: Interview:         #00B341 (green)
Status: Rejected:          #FF3B30 (red)
Status: Waiting:           #F5A623 (amber)
Status: Manual Needed:     #AF52DE (purple)

Subtle tinted glass for cards:
  Blue tint panel:         rgba(0, 102, 255, 0.04)
  Green tint panel:        rgba(0, 179, 65, 0.04)
  Red tint panel:          rgba(255, 59, 48, 0.04)
```

The background canvas should have a very subtle radial gradient: slightly warm (peach/pink tint) in one corner, slightly cool (blue tint) in another. Barely perceptible. This gives the glass panels something to refract against.

### Glass Effect (Apply to All Panels and Cards)

Every card, sidebar, modal, and panel uses this treatment:

```
background: rgba(255, 255, 255, 0.45);
backdrop-filter: blur(40px) saturate(1.8);
-webkit-backdrop-filter: blur(40px) saturate(1.8);
border: 1px solid rgba(255, 255, 255, 0.6);
border-radius: 20px;
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.06);
```

Nested cards inside panels use a slightly more opaque version:
```
background: rgba(255, 255, 255, 0.3);
border-radius: 16px;
border: 1px solid rgba(255, 255, 255, 0.5);
```

### Motion - Orchestrated Page Load

Prioritize page-load choreography over scattered micro-interactions. Use staggered reveals to guide attention. Create entrance sequences that feel intentional.

```
Base setup: Elements start invisible.

.fade-in {
  opacity: 0;
  animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

Stagger delays:
.stagger-1 { animation-delay: 0.1s; }
.stagger-2 { animation-delay: 0.2s; }
.stagger-3 { animation-delay: 0.3s; }
.stagger-4 { animation-delay: 0.4s; }
.stagger-5 { animation-delay: 0.5s; }

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

Glass panels should fade in and scale slightly (from 0.97 to 1.0) on page load. Sidebar slides in from left. Content cards stagger in 0.1s apart.

### Spacing

```
--space-xs: 4px
--space-sm: 8px
--space-md: 16px
--space-lg: 24px
--space-xl: 40px
--space-2xl: 64px
```

Generous padding inside glass panels (24px-40px). Breathing room between cards (16px-24px gap). The interface should feel spacious, not cramped.

### Border Radius

```
Large panels / modals: 20px
Cards: 16px
Buttons: 12px
Input fields: 10px
Tags / badges: 8px (or fully round for pills)
Avatars / small icons: 50% (circle)
```

Everything is rounded. No sharp corners anywhere.

---

## Avoid These (AI Slop Checklist)

Do NOT use:
- Inter or Roboto as primary font at weights 400-600
- Purple-blue gradient backgrounds
- Flat white backgrounds with gray cards and drop shadows
- Pastel low-contrast colors
- Generic dashboard template layouts with left sidebar and top bar
- Stock illustration style empty states
- Gradient buttons with white text
- Cards that all look the same size and shape

DO aim for:
- Distinctive font pairing with extreme weight contrast (100-200 vs 800-900)
- Cohesive liquid glass theme with translucency and blur
- Orchestrated entrance animations with staggered timing
- Layered depth through glass panels on subtle gradient canvas
- Varied card sizes and layouts (not a uniform grid)
- Monospace font for data/numbers to create visual texture contrast
- Moments of bold accent color against the neutral translucent palette

---

## Pages and Screens

### Page 1: Landing Page

The first thing a visitor sees. Sells the product.

**Layout:**
- Full viewport height hero section
- Large headline at weight 900, tight tracking: "Upload Your CV. Get Interviews."
- Subheadline at weight 200: "Everything in between is automated."
- Two CTAs: "Get Started" (primary, filled blue) and "Skip to Demo" (secondary, glass button with border)
- Below the hero: a glass panel showing a preview of the live application feed with sample data scrolling. This should look like a real product screenshot, not a mockup.
- Feature highlights section: 3-4 glass cards in a staggered layout (not a uniform row). Each card highlights one feature:
  - "Custom Resume Per Application" with a small preview of two different resumes
  - "Ghost Job Detection" with a sample flagged listing
  - "Referral Mining" with a connection path visualization
  - "Interview Autopilot" with a timeline graphic
- Footer: minimal, just links and copyright

**Animation:** Hero text staggers in (headline first, subheadline second, CTAs third). Feature cards stagger as user scrolls into view. The feed preview auto-scrolls slowly to show activity.

### Page 2: Login / Register Page

**Layout:**
- Centered glass panel on the gradient canvas
- Two tabs at top of panel: "Sign In" and "Create Account"
- Sign In tab: email field, password field, "Sign In" button, "Continue with Google" button (glass style with Google icon)
- Create Account tab: email field, password field, confirm password field, "Create Account" button, "Continue with Google" button
- Below the panel: "Skip Login - Try the Demo" link (prominent, not hidden)
- The glass panel should have a soft inner glow or subtle light refraction effect on the border

**The "Skip Login" flow:** Clicking this bypasses Firebase auth entirely and loads the app with pre-populated demo data. This is for the frontend demo where Firebase is not connected. It should go straight to the main dashboard with sample data already loaded (sample applications in various states, sample jobs in the board, sample feed events).

### Page 3: Onboarding Flow

A multi-step wizard inside a large centered glass panel. Steps shown as a horizontal progress bar at the top of the panel (glass pills, active one filled with accent blue).

**Step 1: Upload CV**
- Drag-and-drop zone (large, dashed border, glass background)
- Or "Browse Files" button
- Accepted formats: PDF, DOCX
- After upload: loading state while Claude parses, then shows parsed sections for review

**Step 2: Review Parsed CV**
- Accordion sections: Education, Experience, Projects, Skills, Extracurriculars, Awards
- Each section shows the parsed data in editable fields
- User can correct any mistakes
- "Looks Good" button to proceed

**Step 3: Questionnaire**
- Grouped fields in sub-sections:
  - Work Authorization (dropdowns and toggles)
  - Demographics (optional, all fields have "Decline" option)
  - Availability (date pickers, location multi-select, toggles)
  - Default Answers (text fields for "How did you hear about us", salary, etc.)
  - Essay Bank (4 text areas with character count: technical project, teamwork, challenge, motivation)

**Step 4: Preferences**
- Resume template selection: 3 template previews in glass cards, selectable
- Auto-apply threshold: slider (0-100 fit score)
- Daily application limit: number input
- Upload LinkedIn connections CSV (optional, drag-drop zone)
- Connect Google Calendar (optional, OAuth button)
- Enable Google Sheets sync (optional, toggle)

**Step 5: Confirmation**
- Summary of profile
- "Start Applying" button (large, primary)

### Page 4: Dashboard - Live Application Feed (Home Screen)

This is the main screen after onboarding. The centerpiece of the product.

**Layout:**
- Left sidebar (glass panel, 280px wide):
  - User avatar and name at top
  - Navigation links (each is a glass pill on hover):
    - Live Feed (home icon)
    - Jobs Board (search icon)
    - Applications (list icon)
    - Resume Vault (document icon)
    - Settings (gear icon)
  - At bottom: quick stats in monospace font:
    - "47 Applied"
    - "12 Waiting"
    - "3 Interviews"
    - "2 Offers"

- Main content area:
  - Header: "Live Feed" in weight 900, with a green pulsing dot indicating the system is active
  - The feed is a vertical scrolling list of events, newest at top
  - Each event is a glass card with:
    - Timestamp (monospace, small, secondary color)
    - Company name (bold) + Role
    - Action description (what just happened)
    - Status indicator (colored dot or pill)
    - Expandable: click to see resume, cover letter, ATS score, screenshot
  - Event types and their visual treatment:
    - "Generating resume..." - blue pulse animation on the card
    - "ATS Score: 91%" - score shown in large monospace, green/amber/red based on value
    - "Submitted successfully" - green check, subtle celebration micro-animation
    - "CAPTCHA detected, solving..." - amber warning style
    - "Ghost job detected - skipped" - card has red tint, strikethrough on company name
    - "Referral path found" - card has special highlight, shows connection chain
    - "Failed - flagged for manual" - red tint, "Complete Manually" button inside
    - "Interview request received" - green tint, prominent, with "Respond" button
    - "Response received" - styled based on type (green for interview, red for rejection)

- Right panel (optional, 320px, collapses on smaller screens):
  - "Up Next" section showing the next 3-5 jobs in the application queue
  - Each with company, role, fit score, and "Skip" button

**Animation:** New feed events slide in from the top with a glass panel fade-in. Events push older ones down smoothly. The pulsing green dot on the header indicates live activity.

### Page 5: Jobs Board

**Layout:**
- Header: "Jobs Board" weight 900
- Filter bar (horizontal, glass panel): Source dropdown, Location dropdown, Min Fit Score slider, Competition filter, Ghost filter toggle ("Hide Ghost Jobs"), Referral filter toggle ("Has Referral"), Sort dropdown
- Below filters: total count ("234 jobs matched")
- Job cards in a masonry-like layout (2-3 columns, varied height based on content):
  Each card is a glass panel showing:
  - Company name (weight 800)
  - Role title (weight 300)
  - Location
  - Source badge (small pill: "Simplify", "PittCSC", "Apollo")
  - Fit Score (large monospace number, color-coded)
  - Competition estimate (small pill: "High", "Medium", "Low" with color)
  - Timing urgency (if urgent: amber banner at top of card "Closes in ~2 days")
  - Ghost flag (if suspicious: red-tinted card with "Likely Ghost" label and reason on hover)
  - Referral badge (if available: special icon + "You know someone here")
  - Status pill (not applied / queued / applied / skipped)
  - Two action buttons: "Apply" (primary) and "Skip" (secondary/ghost button)
  - Clicking card expands to show full job description, requirements, and the match reasoning from Claude

### Page 6: Applications Tracker

**Layout:**
- Header: "Applications" weight 900
- Tab bar (glass pills): All, Applied, Waiting, Interviews, Rejected, Offers, Manual Needed
- Table layout inside a glass panel:
  - Columns: Company, Role, Date, Method (pill: ATS/Email), Fit Score, ATS Score, Status (colored pill), Response, Days Waiting, Next Action
  - Each row is clickable, expands to show full detail:
    - Generated resume (PDF preview or link)
    - Cover letter (if generated)
    - ATS score breakdown (matched/missing keywords)
    - Submission screenshot
    - Email thread (if email path)
    - Interview details (if applicable)
    - Thank-you email status
    - Follow-up email status
    - User notes (editable text area)
  - "Next Action" column is smart:
    - If status is interview_scheduled: "Prep materials ready" (clickable)
    - If waiting 5+ days after interview: "Send follow-up?" (button)
    - If rejected via auto-screen: "ATS gap: missing Kubernetes, CI/CD" (info)
    - If manual needed: "Complete manually" (button with link)

### Page 7: Resume Vault

**Layout:**
- Header: "Resume Vault" weight 900
- Grid of resume cards (3 columns):
  Each card is a glass panel showing:
  - Company name and role
  - Date generated
  - ATS score (monospace, color-coded)
  - Thumbnail preview of the resume first page
  - Click to open full PDF preview in a modal
  - "Compare" toggle to compare this resume with the original CV side-by-side
  - Tags showing what was emphasized ("ML", "Python", "Leadership")
- Filter by company, date, ATS score range

### Page 8: Settings

**Layout:**
- Header: "Settings" weight 900
- Sections inside glass panels, stacked vertically:

**Profile**
- Edit name, email, phone
- Re-upload CV (triggers re-parse)
- Edit parsed CV data (links to the review screen from onboarding)

**Application Preferences**
- Auto-apply threshold slider with current value in monospace
- Daily application limit number input
- Resume template selection (3 cards, selectable)

**Essay Bank**
- 4 text areas (technical project, teamwork, challenge, motivation)
- Character count per field
- "These are used as raw material for custom application questions"

**Integrations**
- Google Sheets: toggle on/off, shows linked sheet ID if enabled, "Force Sync" button
- Google Calendar: connect/disconnect button, status indicator
- LinkedIn Connections: upload new CSV, shows "142 connections loaded"

**Account**
- Change password
- Delete account
- Sign out

### Page 9: Interview Detail View (Modal or Sub-page)

When user clicks into an application that has interview status:

**Layout (large glass modal or full page):**
- Company and role at top (weight 900)
- Interview timeline (horizontal):
  - Applied (date) -> Response (date) -> Interview (date) -> Thank You (sent/pending) -> Follow-up (sent/pending/not yet)
  - Each node is a circle on a line, filled if complete, outlined if pending
- Interview details panel:
  - Date and time
  - Format (phone/video/onsite)
  - Interviewer names (if extracted)
  - Calendar event link (if created)
- Prep materials panel:
  - Company overview (2-3 sentences)
  - Role-specific talking points
  - Likely questions
  - Your resume highlights for this role (what to emphasize)
- Post-interview section:
  - "How did it go?" text area for notes
  - "Generate Thank-You Email" button
  - Preview of generated thank-you email (editable)
  - "Send" button
- Follow-up section:
  - Timer display: "3 of 5 business days elapsed"
  - "Generate Follow-Up" button (available after timer)
  - Preview and send

### Page 10: ATS Score Detail (Modal)

When user clicks an ATS score anywhere in the app:

**Layout (glass modal):**
- Large score number at top (monospace, weight 900, color-coded: green 80+, amber 60-79, red below 60)
- Progress bar showing score visually
- "Matched Keywords" section: list of green pills with matched terms
- "Missing Keywords" section: list of red pills with missing terms
- "Suggestions" section: Claude's recommendations for improving the resume for this role
- "Resume was auto-revised" note if revision happened (with diff showing what changed)

### Page 11: Referral Detail (Modal)

When user clicks a referral badge:

**Layout (glass modal):**
- "Referral Path Found" header
- Visual connection chain: You -> [Connection Name, their role] -> [Company]
- Connection details: name, current role, how you are connected
- Draft referral request message (editable text area)
- Two action buttons:
  - "Send Referral Request" (primary) - sends via regular email, not AgentMail
  - "Apply Without Referral" (secondary) - proceeds with normal auto-apply
- Note: "Referral applications are 10x more likely to result in an interview"

---

## Responsive Behavior

- Desktop (1440px+): Full layout with sidebar, main content, and right panel
- Laptop (1024-1439px): Sidebar collapses to icons. Right panel hidden. Main content fills space.
- Tablet (768-1023px): Sidebar becomes bottom tab bar. Single column layout.
- Mobile (below 768px): Bottom tab bar. Cards stack vertically. Feed events full-width. Table becomes card list.

Glass effects should degrade gracefully on low-power devices. If `backdrop-filter` is not supported, fall back to a solid light background with subtle opacity.

---

## Empty States

Empty states should not use generic illustrations. Instead, use the monospace font with a simple text message and a clear CTA:

- Empty feed: "No activity yet. Upload your CV to get started." with "Upload CV" button.
- Empty jobs board: "No jobs scraped yet. The scraper runs every 2 hours." with "Check back soon" text.
- Empty applications: "No applications submitted yet. Head to the Jobs Board to get started." with link.
- Empty resume vault: "No resumes generated yet. They appear here after each application."

---

## Micro-interactions

- Buttons: slight scale (1.02) on hover, press down (0.98) on click
- Glass panels: subtle border brightness increase on hover
- Status pills: gentle pulse animation when status is "Applying..." or "Waiting..."
- Feed events: new events have a brief glow effect (box-shadow pulse) when they first appear
- Score numbers: count-up animation when they first render
- Toggle switches: smooth slide with glass knob
- Tabs: active tab slides a glass indicator pill underneath, animated

---

## Distinctive Frontend Design Reference

The following is a comprehensive reference for avoiding generic AI aesthetics and building memorable interfaces. Apply these principles throughout the design.

### Typography - Use Extremes

Font Weight Strategy:
- Go to extremes: Use 100-200 (thin) vs 800-900 (black), not safe 400 vs 600
- Create hierarchy through weight contrast, not just size
- Example combinations:
  - Headers: 900 weight, body: 200 weight
  - Headers: 100 weight (elegant), body: 500 weight

Font Pairing - Avoid generic system fonts. Use distinctive pairings:

Option 1: Geometric Sans + Monospace
--font-display: 'Space Grotesk', sans-serif;
--font-body: 'Inter', sans-serif;
--font-mono: 'JetBrains Mono', monospace;

Option 2: Serif Display + Sans Body
--font-display: 'Playfair Display', serif;
--font-body: 'Source Sans 3', sans-serif;

Option 3: Condensed + Wide
--font-display: 'Bebas Neue', cursive;
--font-body: 'DM Sans', sans-serif;

Option 4: Variable Font Extremes
--font-main: 'Recursive', sans-serif;
Then use font-weight: 300-1000 range

Implementation Pattern:

:root {
  --font-display: 'Space Grotesk', sans-serif;
  --font-body: 'Inter', sans-serif;
  --weight-thin: 100;
  --weight-light: 200;
  --weight-bold: 800;
  --weight-black: 900;
}

h1, h2, h3 {
  font-family: var(--font-display);
  font-weight: var(--weight-black);
  letter-spacing: -0.03em;
}

body, p {
  font-family: var(--font-body);
  font-weight: var(--weight-light);
  letter-spacing: 0.01em;
}

### Color & Theme - Commit to Cohesion

Strategy:
- Draw from cultural references: Movies, art movements, IDE themes, nature
- Use CSS variables for systematic color application
- Avoid: Safe blues/purples, low-contrast pastels

For this project, we use the Liquid Glass theme defined above. But here are alternative themes if the designer wants to explore:

Theme: Nordic Minimalism
--bg-primary: #2e3440;
--bg-secondary: #3b4252;
--accent-1: #88c0d0;
--accent-2: #bf616a;
--accent-3: #a3be8c;
--text-primary: #eceff4;
--text-secondary: #d8dee9;

Application Pattern:
body { background: var(--bg-primary); color: var(--text-primary); }
.card { background: var(--bg-secondary); border: 1px solid var(--accent-1); }
.cta-button { background: var(--accent-1); color: var(--bg-primary); }
.highlight { color: var(--accent-2); }

### Motion - Orchestrated Page Load

Strategy:
- Prioritize page-load choreography over scattered micro-interactions
- Use staggered reveals to guide attention
- Create entrance sequences that feel intentional

Implementation Patterns:

.fade-in {
  opacity: 0;
  animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.stagger-1 { animation-delay: 0.1s; }
.stagger-2 { animation-delay: 0.2s; }
.stagger-3 { animation-delay: 0.3s; }
.stagger-4 { animation-delay: 0.4s; }
.stagger-5 { animation-delay: 0.5s; }

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideInRight {
  from { opacity: 0; transform: translateX(-40px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}

### Backgrounds - Atmospheric Depth

Strategy:
- Layer gradients and patterns instead of flat colors
- Create depth through overlays
- Use subtle noise/grain for texture

Mesh gradient (layered):
background:
  radial-gradient(at 0% 0%, rgba(255, 113, 206, 0.4) 0, transparent 50%),
  radial-gradient(at 100% 0%, rgba(1, 205, 254, 0.4) 0, transparent 50%),
  radial-gradient(at 100% 100%, rgba(185, 103, 255, 0.4) 0, transparent 50%),
  radial-gradient(at 0% 100%, rgba(5, 255, 161, 0.4) 0, transparent 50%),
  #1a0033;

Noise texture overlay:
.textured-bg::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
  opacity: 0.05;
  mix-blend-mode: overlay;
}

For this project specifically, the background should be the warm off-white (#F2F0ED) with very subtle radial tints (barely visible peach in top-left, barely visible blue in bottom-right). The glass panels float on top of this. Add a very subtle noise texture overlay at 2-3% opacity for tactile quality.

### Test Against "AI Slop" Checklist

Avoid:
- Inter or Roboto as primary font
- Font weights: 400, 500, 600 (too safe)
- Purple-blue gradient backgrounds
- No page-load animation
- Flat white/gray backgrounds
- Pastel low-contrast colors

Aim for:
- Distinctive font pairing
- Extreme weight contrast (100-200 vs 800-900)
- Cohesive color theme with clear reference
- Orchestrated entrance animation
- Layered/textured backgrounds
- Bold, memorable aesthetic

### Dashboard-Specific Design Notes

For this project, since it is a dashboard:
- Typography: Monospace for data, sans-serif at 800 for headers
- Color: Light mode with frosted glass and 2-3 accent colors for status
- Motion: Slide-in sidebar, fade-in cards
- Background: Subtle gradient canvas + noise texture under glass panels

---

## Summary of All Screens

1. Landing Page - hero, feature highlights, feed preview
2. Login / Register - centered glass panel, skip login option
3. Onboarding - 5-step wizard (CV upload, review, questionnaire, preferences, confirmation)
4. Live Feed (Home) - sidebar, real-time event feed, up-next panel
5. Jobs Board - filters, masonry job cards with scores/badges/flags
6. Applications Tracker - table with expandable rows, smart next actions
7. Resume Vault - grid of resume cards with previews and tags
8. Settings - profile, preferences, essay bank, integrations
9. Interview Detail - timeline, prep, thank-you, follow-up
10. ATS Score Detail (modal) - score breakdown, matched/missing keywords
11. Referral Detail (modal) - connection path, draft message, action buttons

Every single screen uses the glass panel treatment. Every screen has staggered entrance animations. Every data point uses monospace font. Every status uses color-coded pills. The design should feel cohesive, premium, and distinctly non-generic.