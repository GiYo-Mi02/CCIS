# CCIS Student Council — Official Branding & Design System (BRANDING.md)

This document provides the authoritative design and branding specification for all web applications, portals, and digital systems built for the **College of Computing and Information Sciences (CCIS) Student Council** at the **University of Makati (UMak)**.

---

## 1. Color Palette Tokens

| Token Name | Hex Code | Tailwind Utility | Role / Purpose |
| :--- | :--- | :--- | :--- |
| **CCIS Green** (Primary) | `#123524` | `bg-[#123524]`, `text-[#123524]`, `border-[#123524]` | Navigation bars, primary buttons, footers, headers |
| **CCIS Green Hover** | `#1a4a33` / `#163e2b` | `hover:bg-[#1a4a33]` | Hover states for primary green buttons |
| **Deep Green Surface** | `#0b2116` | `bg-[#0b2116]` | Drawer backgrounds, dark gradient origins |
| **CCIS Yellow** (Accent) | `#FFBC00` | `bg-[#FFBC00]`, `text-[#FFBC00]`, `border-[#FFBC00]` | Secondary highlights, active tabs, yellow badges, icons |
| **CCIS Yellow Hover** | `#ffd043` | `hover:bg-[#ffd043]` | Hover state for yellow CTA buttons |
| **Cream Surface** | `#FAF7EA` | `bg-[#FAF7EA]` | Primary page body background |
| **Crisp Council Border** | `rgba(18, 53, 36, 0.22)` | `border-[#123524]/25` | 1px visible border standard across cards, tables, inputs |

### Semantic State Badges
- **Approved / Attended / Verified**: `bg-emerald-100 text-emerald-800 border-emerald-200`
- **Pending / Under Review**: `bg-amber-100 text-amber-800 border-amber-200`
- **Rejected / Banned / Cancelled**: `bg-rose-100 text-rose-800 border-rose-200`
- **General / Informational**: `bg-blue-100 text-blue-800 border-blue-200`
- **Archived / Inactive**: `bg-stone-100 text-stone-700 border-stone-200`

---

## 2. Typography Hierarchy

- **Headings (`h1`, `h2`, `h3`, `h4`, `h5`, `h6`)**: Standardized to **`Marcellus`** (`'Marcellus', Georgia, serif !important`) for collegiate identity.
- **Hero Slogan (*"Code. Create. Connect."*)**: **`Marcellus`** (`font-marcellus text-white uppercase tracking-tight`).
- **Body Text, UI Controls, Buttons, Forms, & Tables**: Standardized to **`Metropolis`** (`font-sans`).
- **Monospace Tokens (Student IDs, Timestamps, IP Logs, QR Hashes)**: **`JetBrains Mono`** (`font-mono`).

---

## 3. Crisp 1px Border Rule

To prevent borders from washing out or vanishing on large high-DPI displays:
- All cards, tables, search bars, filter containers, and modals MUST use `border border-[#123524]/25 shadow-xs`.
- Admin dashboard pages automatically inject 1px council borders via `#admin-root` rules in `src/index.css`.

---

## 4. Icon System (No Emojis Policy)

Emojis are **strictly forbidden** in UI text, cards, and buttons. Always use official **`lucide-react`** SVG icons:
- Competitions / Tournaments: `<Trophy />`
- General Assemblies / Seminars: `<GraduationCap />`
- Universal Attendance QR Pass: `<QrCode />`
- Participant Tickets: `<Ticket />`
- Calendars & Timetables: `<Calendar />` / `<CalendarDays />`
- Images & Banners: `<ImageIcon />`
- Notices & Badges: `<Sparkles />`

---

## 5. Event & Attendance Architecture

1. **Competitions (Participant Track)**:
   - Category badge: `<Trophy /> Competition` (Amber)
   - Requires pre-registration via the Our Events page to reserve competitor slots.
2. **General Events & Assemblies (Audience Track)**:
   - Category badge: `<GraduationCap /> General Event` (Emerald)
   - Open to all students; no separate pre-registration needed.
   - Attendees present their **Universal Audience Attendance Pass** generated on their **Account** page.
   - Button CTA: *"Get Universal Attendance QR"* (With high-contrast hover state).

---

## 6. Council Identity & Mascot
- **College Name**: College of Computing and Information Sciences
- **Student Body Mascot**: *Herons* (Never "Tigers")
- **College Seal**: Circular yellow and CCIS green emblem with UMak heron crest.
