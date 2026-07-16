# Design System: FStu

## 1. Design Read

FStu is a course-document QA product for an FPT HCM SWP project. It helps students upload course materials, ask document-grounded questions, compare RAG with fine-tuning, and verify answers with citations.

Design direction:

- **Page kind:** public landing page + authenticated study workspace.
- **Audience:** students, professors, project graders.
- **Vibe:** academic, focused, clean, trustworthy.
- **Style:** modern SaaS with a soft academic teal identity.
- **Font:** Manrope for display and body.
- **Primary platform:** desktop/laptop first. Mobile responsiveness comes later.

## 2. Language Rule

- Website UI text must be English only.
- The chatbot must still understand Vietnamese chat input.
- Vietnamese appears only if typed by the user inside the chatbox.

## 3. Current Visual System

FStu uses HSL CSS variables in [index.css](D:/SWP/FRONTEND/src/styles/index.css):

```css
--primary: 176 77% 26%;
--primary-foreground: 0 0% 100%;
--background: 0 0% 100%;
--foreground: 240 10% 10%;
--muted-foreground: 240 5% 55%;
--border: 210 24% 88%;
--nav-bg: 180 23% 97%;
--secondary: 210 31% 96%;
--accent: 210 31% 96%;
```

Brand rule:

- Keep the academic teal/green theme.
- Header logo assets should render without a white container pill when the PNG already has transparency.
- Do not introduce unrelated section palettes like purple, amber, cyan, or indigo as dominant themes.
- Sections may alternate between light surfaces and soft green/teal surfaces.
- CTA color remains `primary`.

## 4. Landing Page Design

Current landing page route: `/`.

Implemented sections:

- `LandingHeader`
- `LandingHero`
- `FeatureOverview`
- `WorkflowTimeline`
- `ResearchSection`
- `LandingFooter`

Landing behavior:

- Navbar is a floating pill.
- CTA text is `Let's get started`.
- CTA links to `/login`.
- Hero uses video background source `/hero-bg.mp4`; place the file in `public/hero-bg.mp4`.
- Hero uses a muted video with overlay blur.
- Dashboard preview currently uses a placeholder image.
- Footer includes mock contact information.

Theme alternation:

- Hero: light background with teal accent.
- Features/Documents: soft green/teal background.
- Workflow: light background.
- Research: soft green/emerald background.
- Footer: light background.

Navbar theme:

- Navbar theme changes based on the current section.
- Implementation uses `IntersectionObserver` in `LandingPage.jsx`.
- Do not use continuous `window.addEventListener('scroll')` for this.

## 5. Auth Pages

Routes:

```text
/login
/register
```

Current behavior:

- Login and register are mock pages.
- Form submission navigates to `/app`.
- No backend auth yet.

Login page design:

- Two-column premium auth layout.
- Left brand panel with teal background.
- Right form panel.
- Uses FStu logo from `public`.
- UI text is English only.

## 6. Workspace Direction

Route:

```text
/app
```

Current state:

- Placeholder workspace page only.

Next app shell should include:

- Top bar with FStu logo and user/status area.
- Left sidebar for sessions and documents.
- Center chat workspace.
- Right citation/source panel.

Desktop layout target:

```text
┌──────────────────────────────────────────────────────────────┐
│ Top Bar: FStu | Subject SWP391 | User/Status                 │
├───────────────┬──────────────────────────────┬───────────────┤
│ Left Sidebar  │ Main Chat Workspace           │ Right Context │
│ Sessions      │ Messages + Composer           │ Sources       │
│ Documents     │                              │ Document Info │
└───────────────┴──────────────────────────────┴───────────────┘
```

## 7. Chat Workspace Requirements

Must include:

- Session history.
- Chat messages.
- Composer.
- `RAG` / `Fine-tuning` segmented toggle.
- Citation panel.
- Out-of-scope response state.

Module toggle:

- Default: `RAG`.
- Changing mode must not clear current messages.
- New messages should be sent with selected mode.
- In `RAG`, prioritize source citations.
- In `Fine-tuning`, handle missing citations gracefully.

## 8. Document Management Requirements

Must include:

- Upload zone.
- Accepted file types: PDF, DOCX, PPT, PPTX.
- Document list/table.
- Status badges: uploaded, indexing, indexed, failed.
- Chapter/subject metadata.
- Clear note that documents are usable in RAG only after indexing.

## 8.1 Library Page Design

Current route:

```text
/library
```

Library redesign direction:

- Uses the existing Manrope family for the Library surface to keep typography consistent across the app.
- Library heading rhythm should match AI Chat: small uppercase eyebrow, `text-3xl`/`sm:text-4xl` `font-black` title, and `text-sm font-semibold` supporting copy.
- Keeps the teal/green academic brand and glassy workspace panels.
- Filter toolbar uses custom animated dropdowns instead of native selects for Course, File type, and Status.
- Filter dropdown labels and selected values should use medium/semibold weights, not `font-black`, so controls stay calm and readable.
- Filter menus open with a restrained downward roll/slide animation, staggered option reveal, rotating chevron, and teal active state.
- Library typography avoids blanket heavy weights while preserving bold emphasis for page title, metric values, document names, and primary actions.
- Document stats and cards animate with lightweight transform/opacity transitions.
- Document card hover stays subtle without tilt or table-row scaling, preserving readable document management UI.
- Filter dropdowns must sit above document cards and tables when opened.
- Document tables should keep a light bottom gap so the final panel never feels attached to the viewport/footer.

## 8.2 Admin Test Set And Research Design

Current routes:

```text
/admin/test-set
/admin/research-dashboard
```

Admin workspace direction:

- Keep the same Manrope typography and teal academic identity as AI Chat and Library.
- Page titles, metric values, and primary section titles may use heavy weight for hierarchy.
- Filters, selects, form labels, status badges, table headings, and helper text should use medium/semibold weights instead of blanket `font-black`.
- Admin controls should feel operational and calm: clear spacing, strong focus rings, no crowded toolbar rows.
- Test Set uses a dataset summary area with concise stats, a contained fine-tuning file list, and readable tables with subtle row hover.
- Decorative gradients inside admin panels must stay behind content with explicit stacking (`z-0` background, `relative z-10` content) so dataset titles and labels never look washed out.
- Research uses a clear experiment selector panel, visible experiment metadata, summary metric cards, and score bars for evaluation metrics.
- Tables should animate or respond only through opacity/color/position transitions; avoid hover scaling on table rows because it makes data grids feel unstable.
- Empty and loading states should preserve page rhythm with enough vertical space and clear English copy.

## 9. Component Rules

Buttons:

- Use `src/components/common/Button.jsx`.
- `cta` variant uses primary background and white text.
- Rounded-full CTAs are preferred on landing/auth.

Cards and panels:

- Use soft rounded shapes.
- Prefer border + subtle shadow.
- Avoid nested cards inside cards unless the outer layer acts as a bezel/shell.

Inputs:

- Label above input.
- Focus ring in primary color.
- Error/help text below.

Badges:

- Use text labels, not color alone.
- Status badges can use teal/green/amber/red semantic colors.

## 10. Motion & Interaction

- Use lightweight transitions.
- Animate `transform` and `opacity`.
- Navbar theme changes should be smooth.
- Avoid heavy continuous scroll handlers.
- Respect reduced-motion later when animation scope grows.

## 11. Accessibility

- Buttons and links must have readable contrast.
- Icon-only buttons need `aria-label`.
- Forms need visible labels.
- Status must be expressed with text, not color alone.
- Text should not overflow containers.

## 12. Implementation Plan

Completed:

- Landing page.
- Manrope font setup.
- HSL CSS variables.
- Floating navbar.
- Section theme alternation.
- Navbar theme switching by section.
- Login/register mock pages.
- `/app` placeholder route.

Next:

1. Build `/app` authenticated app shell.
2. Add mock document management.
3. Add chat workspace.
4. Add `RAG` / `Fine-tuning` toggle.
5. Add citation panel.
6. Add session history.
7. Move mock data into services.
8. Integrate backend APIs.
9. Add responsive/mobile polish later.

## 13. Anti-Patterns

- Do not change brand theme away from teal/green.
- Do not add unrelated dominant palettes per section.
- Do not use Vietnamese for visible UI labels.
- Do not turn the landing page into generic marketing unrelated to course documents.
- Do not remove citation emphasis.
- Do not hide the RAG vs fine-tuning research angle.
- Do not hardcode API logic into large components.

## 14. Acceptance Checklist

- Landing page uses FStu branding.
- UI text is English.
- CTA links to `/login`.
- Login/register mock flow leads to `/app`.
- Landing sections alternate between light and green/teal surfaces.
- Navbar changes theme with active section.
- Build passes.
- Lint passes.
