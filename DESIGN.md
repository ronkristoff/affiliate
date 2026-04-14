

# Design System Inspired by Affilio

## 1. Visual Theme & Atmosphere

Affilio's design language strikes a deliberate balance between **corporate authority** and **approachable warmth** — a system that communicates trust to SaaS owners managing real revenue, while remaining inviting to affiliates and promoters who may be first-time entrepreneurs in Southeast Asia's vibrant digital ecosystem. The deep navy foundations evoke financial-grade seriousness and luxury, while the teal accent injects energy and optimism — a color historically associated with growth and prosperity in the region. Surfaces are light and airy, using generous whitespace and soft shadows to create a sense of spaciousness even in data-dense dashboards. Typography is rounded and friendly (Poppins) but deployed with disciplined hierarchy. The overall effect is a **premium fintech aesthetic** — think Stripe meets a warm, community-driven brand — where every pixel communicates "your money is safe here, and growing." Micro-interactions use subtle teal glows rather than aggressive animations, reinforcing the luxurious-yet-friendly personality. The system is built for multi-tenant contexts, so branding surfaces are clearly delineated from structural chrome.

**Key Characteristics:**
- Deep navy as the primary authority color, never overwhelming — used structurally in sidebars, headers, and CTAs
- Teal as the growth/action color — links, success states, progress indicators, and secondary actions
- Light blue-tinted whites create a premium, airy canvas that avoids sterile pure-white fatigue
- Generous whitespace and card-based layouts keep complex data approachable
- Soft, layered shadows create depth without harshness — a "floating card" philosophy
- Warm, rounded typography that feels human and accessible across English and Southeast Asian contexts
- Gold/amber accents for premium tiers, achievements, and celebratory moments
- Data visualizations favor teal-to-navy gradients for cohesion

---

## 2. Color Palette & Roles

### Primary
- **Brand Navy** (`#1C2260`): Primary brand color — sidebar backgrounds, primary buttons, headings, and trust-signaling surfaces
- **Brand Dark** (`#0E1333`): Deepest navy — page backgrounds in dark contexts, sidebar active states, footer backgrounds
- **Brand Hover** (`#161C50`): Interactive hover state for primary navy elements — buttons, sidebar items, nav links

### Accent Colors
- **Teal** (`#1FB5A5`): Secondary brand color — links, secondary buttons, success indicators, progress bars, affiliate portal accents
- **Teal Dark** (`#189E90`): Hover/active state for teal elements — button hover, link active states
- **Teal Light** (`#E6F9F7`): Teal-tinted surface — success banners, affiliate earnings highlight cards, tag backgrounds
- **Gold** (`#D4A853`): Premium/luxury accent — tier badges, achievement celebrations, revenue milestones, upgrade CTAs
- **Gold Light** (`#FDF6E3`): Gold-tinted surface — premium feature callouts, milestone notification backgrounds

### Interactive
- **Link Color** (`#1FB5A5`): All inline text links, breadcrumb active items, and interactive text
- **Link Hover** (`#189E90`): Link hover state — darkened teal
- **Focus Ring** (`#1FB5A5`): Focus outline for accessibility — `0 0 0 3px rgba(31, 181, 165, 0.35)`
- **Primary Button BG** (`#1C2260`): Primary call-to-action background
- **Primary Button Hover** (`#161C50`): Primary button hover background

### Neutral Scale
- **Neutral 950** (`#0A0D1A`): Highest contrast text — legal copy, critical labels
- **Neutral 900** (`#1A1D2E`): Primary heading text color
- **Neutral 800** (`#2D3148`): Secondary heading text, strong body text
- **Neutral 700** (`#3F4462`): Primary body text color
- **Neutral 600** (`#5A5F7A`): Secondary body text, descriptions, helper text
- **Neutral 500** (`#787D96`): Placeholder text, disabled labels
- **Neutral 400** (`#9DA1B4`): Muted icons, inactive breadcrumbs
- **Neutral 300** (`#C4C7D4`): Borders, dividers, input outlines (default)
- **Neutral 200** (`#DFE1E9`): Subtle borders, table row dividers
- **Neutral 100** (`#EEEEF3`): Hover backgrounds for table rows, subtle surface differentiation
- **Neutral 50** (`#F6F7FA`): Secondary page background, card inset areas, code block backgrounds

### Surface & Borders
- **Brand Light** (`#EFF6FF`): Primary page background — light blue-tinted white canvas
- **Surface White** (`#FFFFFF`): Card backgrounds, modal surfaces, input backgrounds
- **Surface Elevated** (`#FAFBFE`): Slightly off-white for nested card surfaces, dropdown menus
- **Border Default** (`#DFE1E9`): Standard card borders, input borders, divider lines
- **Border Strong** (`#C4C7D4`): Emphasized borders — active input states, focused card outlines
- **Border Subtle** (`#EEEEF3`): Lightest borders — internal card dividers, secondary separators

### Semantic / Status
- **Success** (`#10B981`): Positive outcomes — paid status, active affiliates, conversion confirmations
- **Success Light** (`#ECFDF5`): Success banner backgrounds, positive metric card tints
- **Warning** (`#F59E0B`): Attention needed — pending payouts, approaching limits, draft campaigns
- **Warning Light** (`#FFFBEB`): Warning banner backgrounds, pending status card tints
- **Error** (`#EF4444`): Destructive actions — failed payouts, validation errors, declined affiliates
- **Error Light** (`#FEF2F2`): Error banner backgrounds, failed status card tints
- **Info** (`#3B82F6`): Informational — tips, onboarding guidance, system updates
- **Info Light** (`#EFF6FF`): Info banner backgrounds, tooltip surfaces

### Shadow Colors
- **Shadow SM** (`rgba(28, 34, 96, 0.04)`): Subtle elevation — input focus, flat cards
- **Shadow MD** (`rgba(28, 34, 96, 0.08)`): Standard card elevation
- **Shadow LG** (`rgba(28, 34, 96, 0.12)`): Modals, dropdowns, elevated panels
- **Shadow XL** (`rgba(28, 34, 96, 0.16)`): Popovers, command palettes, floating action panels
- **Shadow Teal Glow** (`rgba(31, 181, 165, 0.20)`): Interactive feedback — teal button hover glow, progress bar shimmer

---

## 3. Typography Rules

### Font Family
- **Primary:** `'Poppins', 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif`
- **Monospace:** `'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace`

Load Poppins weights: 300 (Light), 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold).

### Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing | Notes |
|---|---|---|---|---|---|---|
| Display / Hero | Poppins | 48px | 700 | 56px | `-0.02em` | Landing pages, onboarding hero, revenue totals |
| H1 — Page Title | Poppins | 32px | 700 | 40px | `-0.015em` | Dashboard page titles, settings section headers |
| H2 — Section Title | Poppins | 24px | 600 | 32px | `-0.01em` | Card group headers, report section titles |
| H3 — Card Title | Poppins | 20px | 600 | 28px | `-0.005em` | Individual card headers, modal titles |
| H4 — Subsection | Poppins | 16px | 600 | 24px | `0em` | Form group labels, table column groups |
| Body Large | Poppins | 16px | 400 | 26px | `0em` | Primary body text, descriptions, onboarding copy |
| Body Default | Poppins | 14px | 400 | 22px | `0em` | Standard UI text — table cells, form descriptions |
| Body Medium | Poppins | 14px | 500 | 22px | `0em` | Emphasized body — active nav items, selected tabs |
| Body Small | Poppins | 13px | 400 | 20px | `0.005em` | Secondary info — timestamps, helper text, metadata |
| Button Large | Poppins | 15px | 600 | 20px | `0.01em` | Primary CTA buttons |
| Button Default | Poppins | 14px | 600 | 20px | `0.01em` | Standard buttons |
| Button Small | Poppins | 13px | 500 | 18px | `0.01em` | Compact buttons, inline actions |
| Link | Poppins | inherit | 500 | inherit | `0em` | Inherits parent size; always teal `#1FB5A5` |
| Caption | Poppins | 12px | 400 | 16px | `0.01em` | Table footnotes, fine print, status labels |
| Overline | Poppins | 11px | 600 | 16px | `0.08em` | Uppercase labels — section overlines, badge text |
| Code Inline | JetBrains Mono | 13px | 400 | 20px | `0em` | Tracking IDs, API keys, code snippets |
| Code Block | JetBrains Mono | 13px | 400 | 22px | `0em` | Multi-line code — integration snippets, query builder |
| Metric / KPI | Poppins | 36px | 700 | 44px | `-0.02em` | Dashboard stat numbers — revenue, clicks, conversions |
| Metric Label | Poppins | 12px | 500 | 16px | `0.04em` | Labels beneath KPI numbers, often uppercase |

### Principles
- **Warmth through weight:** Use SemiBold (600) for headings instead of Bold (700) in most UI contexts — reserve Bold for display/hero and KPI metrics to maintain a friendly tone
- **Tight headings, relaxed body:** Negative letter-spacing on headings creates sophistication; generous line-height on body text ensures readability for non-native English speakers
- **Size discipline:** Never go below 11px in any context; 12px minimum for readable content; 11px reserved only for overline labels
- **Hierarchy through weight, not just size:** Differentiate emphasis using 400 vs 500 vs 600 before resorting to size changes — keeps layouts compact in data-dense dashboards
- **Numbers use tabular figures:** Enable `font-variant-numeric: tabular-nums` on all financial data, tables, and KPI metrics for proper alignment

---

## 4. Component Stylings

### Buttons

**Primary Button**
- Background: `#1C2260`
- Text color: `#FFFFFF`
- Font: Poppins, 14px, weight 600, letter-spacing `0.01em`
- Padding: `12px 24px`
- Border radius: `10px`
- Border: `none`
- Box shadow: `0 1px 3px rgba(28, 34, 96, 0.12), 0 1px 2px rgba(28, 34, 96, 0.08)`
- Hover: background `#161C50`, box-shadow `0 4px 12px rgba(28, 34, 96, 0.20)`
- Active: background `#0E1333`, box-shadow `0 1px 2px rgba(28, 34, 96, 0.08)`, transform `translateY(1px)`
- Focus: `0 0 0 3px rgba(31, 181, 165, 0.35)` outline
- Disabled: background `#C4C7D4`, text `#FFFFFF`, cursor `not-allowed`, no shadow
- Transition: `all 150ms ease`

**Secondary Button (Teal)**
- Background: `#1FB5A5`
- Text color: `#FFFFFF`
- Font: Poppins, 14px, weight 600, letter-spacing `0.01em`
- Padding: `12px 24px`
- Border radius: `10px`
- Border: `none`
- Box shadow: `0 1px 3px rgba(31, 181, 165, 0.12), 0 1px 2px rgba(31, 181, 165, 0.08)`
- Hover: background `#189E90`, box-shadow `0 4px 12px rgba(31, 181, 165, 0.25)`
- Active: background `#14877B`, transform `translateY(1px)`
- Focus: `0 0 0 3px rgba(31, 181, 165, 0.35)` outline
- Disabled: background `#C4C7D4`, text `#FFFFFF`

**Ghost Button**
- Background: `transparent`
- Text color: `#1C2260`
- Font: Poppins, 14px, weight 500
- Padding: `12px 24px`
- Border radius: `10px`
- Border: `1.5px solid #DFE1E9`
- Box shadow: `none`
- Hover: background `#EFF6FF`, border-color `#C4C7D4`
- Active: background `#DFE1E9`
- Focus: `0 0 0 3px rgba(31, 181, 165, 0.35)` outline

**Danger Button**
- Background: `#EF4444`
- Text color: `#FFFFFF`
- Font: Poppins, 14px, weight 600
- Padding: `12px 24px`
- Border radius: `10px`
- Border: `none`
- Hover: background `#DC2626`, box-shadow `0 4px 12px rgba(239, 68, 68, 0.25)`
- Focus: `0 0 0 3px rgba(239, 68, 68, 0.30)` outline

**Button Sizes:**
- Small: padding `8px 16px`, font-size `13px`, border-radius `8px`
- Default: padding `12px 24px`, font-size `14px`, border-radius `10px`
- Large: padding `14px 32px`, font-size `15px`, border-radius `12px`

### Cards & Containers

**Standard Card**
- Background: `#FFFFFF`
- Border: `1px solid #EEEEF3`
- Border radius: `14px`
- Padding: `24px`
- Box shadow: `0 1px 3px rgba(28, 34, 96, 0.04), 0 1px 2px rgba(28, 34, 96, 0.02)`
- Hover (if interactive): box-shadow `0 4px 16px rgba(28, 34, 96, 0.08)`, border-color `#DFE1E9`, transition `all 200ms ease`

**KPI Metric Card**
- Background: `#FFFFFF`
- Border: `1px solid #EEEEF3`
- Border radius: `14px`
- Padding: `24px`
- Box shadow: `0 1px 3px rgba(28, 34, 96, 0.04)`
- Metric number: Poppins, 36px, weight 700, color `#1A1D2E`, `font-variant-numeric: tabular-nums`
- Metric label: Poppins, 12px, weight 500, color `#5A5F7A`, letter-spacing `0.04em`, uppercase
- Trend indicator (positive): color `#10B981`, font-size 13px, weight 500
- Trend indicator (negative): color `#EF4444`, font-size 13px, weight 500

**Featured / Premium Card**
- Background: `linear-gradient(135deg, #1C2260 0%, #0E1333 100%)`
- Border: `1px solid rgba(255, 255, 255, 0.08)`
- Border radius: `16px`
- Padding: `28px`
- Box shadow: `0 8px 32px rgba(14, 19, 51, 0.24)`
- Text color: `#FFFFFF`
- Accent elements: `#D4A853` for icons, badges, highlights

**Container / Section Wrapper**
- Background: `#EFF6FF` (page background)
- Max width: `1440px`
- Padding: `32px`
- Inner content area: `#FFFFFF` or card-based layout

### Inputs & Forms

**Text Input (Default)**
- Background: `#FFFFFF`
- Border: `1.5px solid #DFE1E9`
- Border radius: `10px`
- Padding: `12px 16px`
- Font: Poppins, 14px, weight 400, color `#1A1D2E`
- Placeholder color: `#9DA1B4`
- Height: `44px`
- Transition: `border-color 150ms ease, box-shadow 150ms ease`

**Text Input (Focus)**
- Border color: `#1FB5A5`
- Box shadow: `0 0 0 3px rgba(31, 181, 165, 0.15)`
- Outline: `none`

**Text Input (Error)**
- Border color: `#EF4444`
- Box shadow: `0 0 0 3px rgba(239, 68, 68, 0.12)`
- Error message: Poppins, 12px, weight 400, color `#EF4444`, margin-top `6px`

**Text Input (Disabled)**
- Background: `#F6F7FA`
- Border color: `#EEEEF3`
- Text color: `#9DA1B4`
- Cursor: `not-allowed`

**Input Label**
- Font: Poppins, 13px, weight 500, color `#3F4462`
- Margin bottom: `6px`
- Required asterisk: color `#EF4444`

**Select / Dropdown**
- Same styles as text input
- Chevron icon: `#787D96`, 16px, right-aligned with `16px` right padding
- Dropdown menu: background `#FFFFFF`, border `1px solid #EEEEF3`, border-radius `12px`, box-shadow `0 8px 24px rgba(28, 34, 96, 0.12)`, padding `4px`
- Dropdown item: padding `10px 14px`, border-radius `8px`, font Poppins 14px weight 400
- Dropdown item hover: background `#EFF6FF`
- Dropdown item selected: background `#E6F9F7`, color `#1FB5A5`, weight 500

**Checkbox**
- Size: `18px × 18px`
- Border: `1.5px solid #C4C7D4`
- Border radius: `5px`
- Checked: background `#1C2260`, border-color `#1C2260`, checkmark `#FFFFFF`
- Focus: `0 0 0 3px rgba(31, 181, 165, 0.35)`

**Toggle Switch**
- Track: `44px × 24px`, border-radius `12px`
- Off state: background `#DFE1E9`
- On state: background `#1FB5A5`
- Thumb: `20px × 20px`, background `#FFFFFF`, border-radius `50%`, box-shadow `0 1px 3px rgba(0,0,0,0.12)`
- Transition: `all 200ms ease`

**Textarea**
- Same border/radius/font as text input
- Padding: `12px 16px`
- Min height: `120px`
- Resize: `vertical`

### Navigation

**Sidebar Navigation**
- Width: `260px` (expanded), `72px` (collapsed)
- Background: `#0E1333`
- Border right: `none`
- Logo area: padding `24px 20px`, height `72px`
- Transition: `width 250ms ease`

**Sidebar Nav Item (Default)**
- Padding: `10px 16px`
- Margin: `2px 12px`
- Border radius: `10px`
- Font: Poppins, 14px, weight 400, color `rgba(255, 255, 255, 0.65)`
- Icon: `20px`, color `rgba(255, 255, 255, 0.50)`, margin-right `12px`
- Background: `transparent`

**Sidebar Nav Item (Hover)**
- Background: `rgba(255, 255, 255, 0.06)`
- Text color: `rgba(255, 255, 255, 0.85)`
- Icon color: `rgba(255, 255, 255, 0.70)`

**Sidebar Nav Item (Active)**
- Background: `rgba(31, 181, 165, 0.12)`
- Text color: `#1FB5A5`
- Font weight: 500
- Icon color: `#1FB5A5`
- Left indicator: `3px` wide, `24px` tall, border-radius `0 3px 3px 0`, background `#1FB5A5`, positioned at left edge

**Sidebar Section Label**
- Font: Poppins, 11px, weight 600, color `rgba(255, 255, 255, 0.35)`, letter-spacing `0.08em`, uppercase
- Padding: `20px 20px 8px 28px`

**Top Bar**
- Height: `72px`
- Background: `#FFFFFF`
- Border bottom: `1px solid #EEEEF3`
- Box shadow: `0 1px 3px rgba(28, 34, 96, 0.03)`
- Padding: `0 32px`
- Content: page title (left), search + notifications + avatar (right)

**Breadcrumb**
- Font: Poppins, 13px, weight 400
- Inactive color: `#9DA1B4`
- Active/current color: `#3F4462`, weight 500
- Separator: `/` in color `#C4C7D4`, margin `0 8px`

### Badges & Status Pills

**Status Badge**
- Padding: `4px 10px`
- Border radius: `6px`
- Font: Poppins, 12px, weight 500

**Variants:**
- Active/Paid: background `#ECFDF5`, color `#059669`
- Pending: background `#FFFBEB`, color `#D97706`
- Failed/Declined: background `#FEF2F2`, color `#DC2626`
- Info/Draft: background `#EFF6FF`, color `#2563EB`
- Premium: background `#FDF6E3`, color `#B8922F`
- Neutral: background `#F6F7FA`, color `#5A5F7A`

### Tabs

**Tab Bar**
- Border bottom: `2px solid #EEEEF3`
- Padding bottom: `0`

**Tab Item (Default)**
- Padding: `12px 20px`
- Font: Poppins, 14px, weight 400, color `#787D96`
- Border bottom: `2px solid transparent`
- Margin bottom: `-2px`

**Tab Item (Active)**
- Color: `#1C2260`
- Font weight: 600
- Border bottom: `2px solid #1C2260`

**Tab Item (Hover)**
- Color: `#3F4462`
- Background: `#F6F7FA`
- Border radius: `8px 8px 0 0`

### Tables

**Table Header**
- Background: `#F6F7FA`
- Font: Poppins, 12px, weight 600, color `#5A5F7A`, letter-spacing `0.03em`, uppercase
- Padding: `12px 16px`
- Border bottom: `1px solid #DFE1E9`

**Table Row**
- Padding: `14px 16px`
- Border bottom: `1px solid #EEEEF3`
- Font: Poppins, 14px, weight 400, color `#3F4462`

**Table Row (Hover)**
- Background: `#F6F7FA`

**Table Row (Selected)**
- Background: `#EFF6FF`
- Border-left: `3px solid #1C2260`

### Modals & Dialogs

**Modal Overlay**
- Background: `rgba(14, 19, 51, 0.50)`
- Backdrop filter: `blur(4px)`

**Modal Container**
- Background: `#FFFFFF`
- Border radius: `18px`
- Box shadow: `0 24px 64px rgba(14, 19, 51, 0.20)`
- Padding: `32px`
- Max width: `560px`
- Width: `90vw`
- Animation: `fadeIn 200ms ease, slideUp 200ms ease`

**Modal Header**
- Font: Poppins, 20px, weight 600, color `#1A1D2E`
- Margin bottom: `8px`
- Close button: `36px × 36px`, border-radius `8px`, hover background `#F6F7FA`

### Tooltips

- Background: `#1A1D2E`
- Text: `#FFFFFF`, Poppins, 12px, weight 400
- Padding: `8px 12px`
- Border radius: `8px`
- Box shadow: `0 4px 12px rgba(14, 19, 51, 0.20)`
- Arrow: `6px` triangle matching background
- Max width: `240px`

### Toast / Notification

- Background: `#FFFFFF`
- Border radius: `12px`
- Padding: `16px 20px`
- Box shadow: `0 8px 32px rgba(28, 34, 96, 0.16)`
- Border left: `4px solid` (color matches type: Success `#10B981`, Error `#EF4444`, Warning `#F59E0B`, Info `#3B82F6`)
- Title: Poppins, 14px, weight 600, color `#1A1D2E`
- Body: Poppins, 13px, weight 400, color `#5A5F7A`
- Animation: slide in from right, `300ms ease`

---

## 5. Layout Principles

### Spacing System

Base unit: `4px`. All spacing values are multiples of 4.

- `4px` — Tight internal spacing: icon-to-text in badges, inline element gaps
- `8px` — Compact spacing: between related form elements, small paddings
- `12px` — Default inner padding for small components: badges, chips, compact buttons
- `16px` — Standard gap: between form fields, card inner element spacing, icon margins
- `20px` — Comfortable content padding: sidebar nav item horizontal padding
- `24px` — Default card padding, section content padding, spacing between card groups
- `32px` — Page-level padding, major section spacing, top bar horizontal padding
- `40px` — Separation between major content sections on a page
- `48px` — Large vertical rhythm: between dashboard widget rows
- `64px` — Hero section padding, onboarding flow section spacing
- `80px` — Landing page section vertical padding
- `96px` — Maximum section padding for marketing/landing contexts

### Grid & Container

- **Page max width:** `1440px`
- **Content max width (within sidebar layout):** `1180px` (with sidebar) → `calc(100vw - 260px)`
- **Centered content (settings/forms):** `720px` max
- **Dashboard grid:** 12-column CSS Grid with `24px` gap
- **KPI row:** typically 4 columns, each `1fr`
- **Card grid (campaigns, affiliates):** `repeat(auto-fill, minmax(320px, 1fr))` with `24px` gap
- **Form layout:** single column at `560px` max, or 2-column at `720px` with `24px` column gap and `20px` row gap

### Whitespace Philosophy

Affilio uses **progressive density** — KPI dashboards are spacious with `48px` between widget rows to let numbers breathe, while data tables are tighter with `14px` row padding for scanability. The principle is: **the more important the number, the more whitespace around it.** Financial figures (earnings, commissions, payouts) always sit in generous containers. Lists and tables compress gracefully. Settings and forms use comfortable but not extravagant spacing.

### Border Radius Scale

- `4px` — Checkboxes, tiny inline