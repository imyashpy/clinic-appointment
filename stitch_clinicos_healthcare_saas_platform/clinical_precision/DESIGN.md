---
name: Clinical Precision
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#434655'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#006a61'
  on-secondary: '#ffffff'
  secondary-container: '#86f2e4'
  on-secondary-container: '#006f66'
  tertiary: '#006242'
  on-tertiary: '#ffffff'
  tertiary-container: '#007d55'
  on-tertiary-container: '#bdffdb'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#89f5e7'
  secondary-fixed-dim: '#6bd8cb'
  on-secondary-fixed: '#00201d'
  on-secondary-fixed-variant: '#005049'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.025em
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.02em
  tabular-data:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-lg: 1.5rem
  margin: 1rem
  margin-md: 1.5rem
  margin-lg: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
  space-2xl: 2rem
---

## Brand & Style

This design system blends the micro-engineered focus of Linear, the structural calm of Stripe Dashboard, and the scheduling fluidity of Calendly. Built specifically for high-velocity medical environments, it conveys absolute clinical reliability, unhurried precision, and technological sophistication.

The interface eliminates visual friction for practitioners managing patient queues while projecting an aura of calm competence to patients. Tactile responsiveness, dense yet breathable information layouts, and quiet visual restraint govern every screen.

## Colors

The palette operates on a clean, medical-grade spectrum. 

- **Primary Canvas & Surfaces:** Pure White (`#FFFFFF`) for elevated cards, active modals, and data tables against an expansive Page Canvas of Subtle Slate (`#F8FAFC`).
- **Typography & Structural Contrast:** Dominant typography utilizes Slate 900 (`#0F172A`) and Deep Medical Navy (`#172B4D`), counterbalanced by Slate 500 (`#64748B`) for metadata, sub-labels, and auxiliary indicators.
- **Accents:** Medical Royal Blue (`#2563EB`) commands primary actions, focused selections, and verified timestamps. Clinical Teal (`#0D9488`) identifies specialized treatment workflows and patient interactions.
- **Borders & Dividers:** Subtle Refined Grey (`#E2E8F0`) defines structural boundaries without high-contrast distraction.
- **Status System:** Semantic feedback relies on a soft-tint architecture:
  - *Confirmed*: Tint `#ECFDF5` with `#059669`
  - *Arrived / Waiting*: Tint `#EFF6FF` with `#2563EB` / Tint `#FEF3C7` with `#D97706`
  - *In Consultation*: Tint `#F0FDFA` with `#0D9488`
  - *Completed*: Tint `#F1F5F9` with `#475569`
  - *No Show / Cancelled*: Tint `#FEF2F2` with `#DC2626`
- **Role Accents:** Doctor profiles highlight in Medical Blue (`#2563EB`), Patients in Clinical Teal (`#0D9488`), Reception desks in Deep Indigo (`#4F46E5`), and Administrators in Slate Violet (`#475569`).

## Typography

Inter serves as the single typographic voice, selected for its micro-legibility and comprehensive OpenType feature support.

- **Tabular Figures (`tnum`):** All financial values (₹ amounts), clinic queue tokens, and calendar time-slots strictly mandate `font-feature-settings: "tnum" 1`. This prevents layout shifting during live state updates and keeps ledger lines aligned.
- **Hierarchy Structure:** Headings are drawn tightly with negative letter spacing for an editorial, modern product feel. Body copy prioritizes natural scanning, while captions and data column headers lean into crisp uppercase or medium weights for rapid legibility during consults.

## Layout & Spacing

The layout philosophy follows a multi-tier fluid grid optimized for high-density clinical management on desktop screens and clean vertical stacking on mobile surfaces.

- **Desktop (1024px+):** Employs an expansive 12-column layout with 24px gutters (`gutter-lg`) and 32px canvas margins (`margin-lg`). Sidebars lock to a fixed 260px footprint, while schedule matrices and patient queues expand dynamically to fill viewports.
- **Tablet (768px - 1023px):** Adapts to an 8-column layout with 16px gutters (`gutter`) and 24px margins (`margin-md`). Multi-panel consult notes shift from horizontal split screens to responsive drawer overlays.
- **Mobile (Under 768px):** Collapses into a 4-column stack with 16px margins (`margin`). Complex timetable schedules transform into sequential day selectors and card-based queue lists.
- **Spacing Rhythm:** Internal card structures and micro-elements conform strictly to an 8px modular baseline, using half-step units (4px) exclusively for input icon padding and pill badge alignments.

## Elevation & Depth

Visual hierarchy avoids deep skeuomorphism, relying instead on clean, multi-layered ambient diffusion combined with low-contrast structural boundaries.

- **Flat / Ground Layer:** Background surfaces at `#F8FAFC` use zero elevation.
- **Surface Elevation (Cards, Panels):** Pure white container surfaces use an ultra-fine border (`1px solid #E2E8F0`) augmented by a two-stage ambient shadow:
  - `box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05), 0 4px 12px rgba(15, 23, 42, 0.03)`
- **Hover & Active States:** Interactive cards, patient queue rows, and selectable appointment blocks lift dynamically:
  - `box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.06), 0 10px 15px -3px rgba(15, 23, 42, 0.04)`
  - Border tint smoothly shifts from `#E2E8F0` to `#CBD5E1`.
- **Floating Overlays (Modals, Popovers, Dropdowns):**
  - `box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)`
  - Paired with a delicate background backdrop blur (`backdrop-filter: blur(4px)`) and a semi-transparent overlay (`rgba(15, 23, 42, 0.4)`).

## Shapes

The shape hierarchy is engineered to differentiate layout containers from micro-actions.

- **Outer Containers & Cards:** Clinical cards, schedule boards, and modal sheets adopt a precise 12px radius, delivering a contemporary and polished appearance without feeling playful.
- **Interactive Controls:** Form inputs, action buttons, dropdown triggers, and segmented pickers standardize on a crisp 8px to 10px radius (`rounded-md`).
- **Badges & Avatars:** Status pills, role tags, and circular patient profile indicators utilize fully rounded bounds (`9999px`) to maintain immediate contrast with rectangular data structures.

## Components

### Buttons
- **Primary:** Medical Blue (`#2563EB`) background with white text, 9px radius, 0 1px 2px rgba(0,0,0,0.05) shadow. Subtle darken (`#1D4ED8`) on hover.
- **Secondary:** White background, `#E2E8F0` border, `#0F172A` text. Hover shifts background to `#F8FAFC`.
- **Destructive:** Soft Rose (`#FEF2F2`) background with `#DC2626` text; scales to solid `#DC2626` fill upon critical confirmation states.

### Form Inputs & Selects
- Height fixed at 40px for desktop workflows, 44px for touch environments.
- Background: `#FFFFFF` with 1px border `#E2E8F0`, 8px radius.
- Focus: Border shifts to `#2563EB` accompanied by an ambient glow ring (`0 0 0 3px rgba(37, 99, 235, 0.12)`).
- Input groups with currency (₹) or calendar icons use Slate 500 (`#64748B`) indicators placed at a 12px inset.

### Status Badges & Chips
- Compact height (24px), font size 12px, font weight 500, pill-shaped (`9999px`).
- Always structured as soft pastel background combined with high-contrast, deeply saturated text:
  - *Confirmed*: `#ECFDF5` bg, `#047857` text.
  - *Waiting*: `#FEF3C7` bg, `#B45309` text.
  - *In Consultation*: `#F0FDFA` bg, `#0F766E` text.
  - *Cancelled*: `#FEF2F2` bg, `#B91C1C` text.
- Includes an optional 6px pulsing dot prefix for live active consultation states.

### Data Cards & Clinic Panels
- Built on `#FFFFFF` surfaces with subtle border `#E2E8F0` and layered ambient elevation.
- Standardized padding: 20px on desktop, 16px on mobile.
- Section headers within cards feature a 14px uppercase category tracker with border separator `#F1F5F9`.

### Queue Lists & Data Rows
- Zero-gap striped rows utilizing alternating hover transitions to `#F8FAFC`.
- Dedicated tabular column widths for Token IDs, Patient Identity, Assigned Doctor, Status Badge, and Quick Action menus.

### Role Badges
- Displayed alongside names or in system headers:
  - *Doctor*: Border `#DBEAFE`, text `#1D4ED8`, background `#EFF6FF`.
  - *Patient*: Border `#CCFBF1`, text `#0F766E`, background `#F0FDFA`.
  - *Receptionist*: Border `#E0E7FF`, text `#4338CA`, background `#EEF2FF`.
  - *Super Admin*: Border `#E2E8F0`, text `#334155`, background `#F8FAFC`.