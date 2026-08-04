---
name: ccis-umak-design
description: "CCIS Student Council Official Identity & Design System — Combined identity guidelines combining CCIS Student Council custom branding (Forest Green, Warm Gold, Cream) with UMak CIC Digital Design System standards (Metropolis typography, component geometry, semantic badge tokens). Use when creating, styling, or reviewing components, pages, forms, or admin interfaces for the CCIS Centralized Portal."
---

# CCIS Student Council — Official Design System & Branding Guidelines

This document serves as the authoritative design system specification for the **College of Computing and Information Sciences (CCIS) Student Council** centralized website at the **University of Makati (UMak)**.

It blends the custom **CCIS Student Council organizational identity** (color palette & mascot heritage) with the official **UMak Center for Integrated Communications (CIC)** digital design system rules (typography hierarchy, component geometry, semantic states, and accessibility standards).

---

## 1. Core Brand Colors & Palette Tokens

The CCIS portal maintains a distinct organizational palette while using UMak-compliant background surfaces and semantic state colors.

### 1.1 CCIS Brand Colors (Primary Identity)
*Do NOT change these brand colors to UMak Navy; forest green and warm gold are the official identity colors of the CCIS Student Council.*

| Token / Usage | Hex Code | Tailwind Utility / Usage Example |
| :--- | :--- | :--- |
| **CCIS Forest Green** (Primary Brand) | `#1A3C2E` | `bg-[#1A3C2E]`, `text-[#1A3C2E]`, `border-[#1A3C2E]` |
| **CCIS Forest Green Hover** | `#255541` | `hover:bg-[#255541]` |
| **CCIS Dark Green** (Drawer / Deep Surface) | `#132D22` | `bg-[#132D22]` |
| **CCIS Gold / Accent** (Secondary Brand) | `#F5B400` | `bg-[#F5B400]`, `text-[#F5B400]`, `border-[#F5B400]` |
| **CCIS Gold Hover** | `#FFC522` | `hover:bg-[#FFC522]` |
| **CCIS Cream** (Light Surface / Card Bg) | `#FAF7EA` | `bg-[#FAF7EA]`, `text-[#FAF7EA]` |
| **Mascot Identity** | *Herons* | Use "Herons" when addressing CCIS students (not Tigers) |

---

### 1.2 Neutral & Surface Tokens

| Role | Color / Hex | Usage |
| :--- | :--- | :--- |
| **Page Background** | `#FAF7EA` (Cream) | Default overall page background (`#FAF7EA`) |
| **Card Background** | `#FFFFFF` | Content containers, card components, form backgrounds |
| **Dark Page / Admin Surface**| `#09090B` / `#18181B` | Full-screen pages, admin login background highlights |
| **Primary Text** | `#1C1917` (Stone 900) | Body text, headings on light surfaces |
| **Secondary Text** | `#57534E` (Stone 600) | Captions, subtitles, secondary descriptions |
| **Subtle Border** | `#E7E5E4` (Stone 200) | Dividers, card borders |

---

### 1.3 Semantic State Badges & Alert Tokens
*Per UMak CIC design standards: Badges and status indicators MUST use solid, accessible semantic colors, never raw brand gold/green.*

```tsx
// StatusBadge Component Variant Standards
const VARIANT_CLASSES = {
  success: 'bg-[#e6f5ed] text-[#1a7a4a] border-[#1a7a4a]/25', // Approved / Verified
  warning: 'bg-[#fffbea] text-[#b8860b] border-[#b8860b]/25', // Pending / Action Required
  danger:  'bg-[#fdecea] text-[#c0392b] border-[#c0392b]/25', // Banned / Rejected / Error
  info:    'bg-[#c0d5f0] text-[#105389] border-[#105389]/25', // Announcements / Info
  neutral: 'bg-[#eaecf4] text-[#47528a] border-[#47528a]/20', // Draft / Archival
};
```

---

## 2. Typography Rules & System

### 2.1 Font Families

| Role | Font Family | Source / Fallback | Allowed Use Cases |
| :--- | :--- | :--- | :--- |
| **Web UI Default (Sans)** | `Metropolis` | `@fontsource/metropolis`, `sans-serif` | **ALL Web UI** (Headings, Body, Buttons, Nav, Labels, Forms, Admin) |
| **Formal / Print (Serif)** | `Marcellus` | `@fontsource/marcellus`, `serif` | Formal PDF certificates, official print press releases, `.font-marcellus` |
| **Data / Code (Mono)** | `JetBrains Mono` | `ui-monospace`, `monospace` | Student IDs, IP logs, timestamps, security reports |

> ⚠️ **CRITICAL RULE**: Do NOT apply `font-marcellus` globally to `h1–h6` elements. Marcellus is reserved strictly for formal print documents. All web headings (`h1–h6`) MUST use `Metropolis` (via `font-sans`).

---

### 2.2 Standard Type Scale & Weights

```css
/* Typography Scale & Weight Tokens */
h1 (Hero / Page Title):    font-sans font-black text-3xl md:text-5xl tracking-tight
h2 (Section Header):       font-sans font-black text-xl md:text-2xl tracking-tight
h3 (Card Title):           font-sans font-bold text-lg
h4 (Subtitle):             font-sans font-semibold text-sm

Body Regular:              font-sans font-normal text-sm leading-relaxed
Body Small / Caption:      font-sans font-normal text-xs text-stone-500

Nav Links:                 font-sans font-bold text-xs uppercase tracking-widest
Primary CTA Button:        font-sans font-black text-[11px] uppercase tracking-widest
Secondary CTA Button:      font-sans font-semibold text-xs uppercase tracking-widest
Badge Labels:              font-sans font-bold text-[9px] uppercase tracking-wider
```

---

## 3. Component Geometry & Specs

### 3.1 Navigation Bar (`NavBar.tsx`)
- **Height**: `h-16` (64px) sticky top header with `backdrop-blur`
- **Background**: `bg-[#1A3C2E]` (Forest Green) with bottom border `border-b border-[#F5B400]/20`
- **Brand Block**:
  - Logo: 44×44px (`w-11 h-11`) circular seal with `bg-[#FAF7EA] border border-[#F5B400]`
  - Text: `College of Computing Information Sciences` split cleanly across 2 lines
- **Active Navigation Link**: `text-[#F5B400] border-b-2 border-[#F5B400]`
- **Sign In CTA**:
  - **Shape**: Slightly rounded rectangle `rounded` (4px radius per UMak spec — **NOT `rounded-full`**)
  - **Style**: `bg-[#F5B400] text-[#1A3C2E] px-5 py-2 font-sans font-black text-[11px] uppercase tracking-widest`

---

### 3.2 Hero Section (`Hero.tsx`)
- **Background**: `bg-[#1A3C2E]` with dark gradient overlays (`bg-gradient-to-r from-[#132D22]`)
- **Headline**: `font-sans font-black text-white`
- **Primary CTA**: Squared gold button `bg-[#F5B400] text-[#1A3C2E] font-black uppercase tracking-widest hover:bg-[#ffc522]`
- **Secondary CTA**: Ghost border button `border border-white/30 text-white/80 font-semibold text-xs uppercase tracking-widest`

---

### 3.3 Buttons & Interactive Controls
*Following UMak `btn-primary` and `btn-secondary` geometry rules:*

- **Border Radius**: Use `rounded` (4px) or `rounded-lg` (8px). Avoid `rounded-full` pill shapes for standard action CTAs.
- **States**:
  - Hover: subtle background shift + transition duration 200–300ms
  - Active: `active:scale-98` micro-animation
  - Disabled: `opacity-40 cursor-not-allowed`

---

### 3.4 Footer (`Footer.tsx`)
- **Background**: `bg-[#1A3C2E] text-[#FAF7EA] py-12 border-t-2 border-[#F5B400]`
- **Brand Column**:
  - Layout: `flex flex-row items-center gap-4` (Logo beside text)
  - Circular Logo: 80×80px (`w-20 h-20`) with double gold accent rings:
    - Outer ring: `border-2 border-[#F5B400]/30 scale-110 rounded-full`
    - Inner ring: `border border-[#F5B400]/50 rounded-full`
    - Inner circle: `bg-[#FAF7EA] rounded-full overflow-hidden shadow-xl`
  - Title: `College of Computing<br />Information Sciences` (`font-sans font-black text-white text-sm uppercase leading-snug`)
- **Copyright Requirement**: `© [Year] College of Computing and Information Sciences Student Council. All Rights Reserved.`

---

### 3.5 Loading Screen (`LoadingScreen.tsx`)
- **Tagline Animation**: Cycles words sequentially: **Code.** → **Create.** → **Connect.**
- **Styling**: `font-sans font-extrabold italic uppercase text-3xl md:text-5xl text-[#F5B400]`
- **Progress Bar**: Smooth 3-second progress indicator in `bg-[#F5B400]` with forest green container.

---

### 3.6 Form Fields & Input Standards
- **Label**: `font-sans font-semibold text-xs uppercase text-[#1A3C2E]`
- **Input Field**: `bg-white border border-stone-200 rounded-lg px-4 py-2.5 text-xs text-stone-800 outline-none focus:border-[#F5B400] transition-colors`
- **Error Field / Validation Alert**: `bg-[#fdecea] border border-[#c0392b] text-[#c0392b] text-xs px-4 py-2.5 rounded-lg`

---

## 4. Security & Administrative Standards

When building or updating admin functionality:
1. **Per-Profile Bans Only**: Use `profiles.banned` and `profiles.banned_until`. Do NOT use network-wide IP bans (prevents accidental blocking of shared campus WiFi users).
2. **Institutional Access**: Enforce `@umak.edu.ph` email requirement. Environment variable `VITE_ADMIN_BYPASS_EMAILS` handles admin exceptions (never hardcode emails in source code).
3. **HTTP Security**: All production headers (`CSP`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`) are configured in `vercel.json`.
