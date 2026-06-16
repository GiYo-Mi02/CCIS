# 🎓 CCIS Student Council Centralized Platform

Welcome to the **College of Computer and Information Sciences (CCIS) Student Council Centralized Platform**. This website serves as a unified digital ecosystem connecting the CCIS student body with the Student Council (SC) executive team. 

The application features a gorgeous, theme-customizable, highly interactive **Public Student Portal** alongside a robust **Admin Management System** with role-based access control.

---

## ✨ System Features

### 1. 🌐 Public Student Portal
Designed with responsive layouts, modern micro-interactions, and premium typography:
*   🏠 **Interactive Home Page**: Features a custom-animated GSAP loading screen, a pinned announcements ticker, a featured community photobooth strip, the **Academic & Council Calendar (Timetable)** with direct event booking integration, and collapsible FAQs.
*   ℹ️ **Information Hub**:
    *   **Officers & Committees**: Complete directories for the Executive Board, Year Level Representatives, and specialized committees (Logistics, Finance, Technical, External Affairs, Developers, etc.) with custom ordering.
    *   **Dynamic Info Tabs**: Clickable organization seals to toggle details between the College itself, the Student Council (Mother Org), and the Computer Society (ComSoc).
*   📥 **Student Concerns Desk**: A custom ticketing tool allowing students to submit inquiries, reports, or suggestions directly to the council.
*   📢 **Announcements Board**: Categorized updates (Events, Deadlines, Results, General) with search queries, status badges, and scroll-safe centered modals.
*   📝 **Event Registration Portal**: Live seat availability check, student profile validation, instant confirmation tracking, and a responsive split layout (event details on the left, secure form on the right) utilizing React Portals for perfect viewport modal centering.
*   📸 **Virtual Photobooth**: Real-time simulated camera sandbox with selectable custom frames, camera toggles, snapshot capture actions, local downloads, and a community gallery feed.

### 2. 🛡️ Admin Management Portal
A restricted administrative system for council members to organize events and handle operations:
*   📊 **Dashboard**: Real-time analytical counters for active registrations, unread concerns, and a notifications center feed.
*   📣 **Announcements Manager**: Complete CRUD workflow (Create, Read, Update, Delete) supporting pinned states, draft/publish statuses, and custom banner attachments.
*   🗓️ **Event & Calendar Scheduler**: Configure event listings, date/time scheduling, location properties, and registration cap parameters.
*   👥 **Officers & Committees Manager**: Modify the organizational layout, change officer detail cards, and reorder hierarchy.
*   📥 **Concerns Inbox**: Active ticketing queue. Admins can read incoming queries, assign issues to respective committees, track statuses (`New`, `In Progress`, `Resolved`), and draft replies.
*   🎨 **Dynamic Theme Customizer**: Choose color themes or inject custom hex overrides. Changing themes updates the global stylesheet in real-time.
*   ⚙️ **Roles & Permissions Manager**: Invite admin users and configure distinct access controls.

---

## 🎨 Global Theme Customizer Presets

The system uses CSS Custom Properties updated in real-time from the database or local storage settings. Presets include:

| Theme Preset | Primary Theme | Accent Color | Canvas Background | Use Case |
| :--- | :--- | :--- | :--- | :--- |
| **Default CCIS SC** | `#1A3C2E` (Deep Forest) | `#F5B400` (Gold) | `#FAF7EA` (Cream) | Academic Term & General Use |
| **Cyber Tiger Tech** | `#0F172A` (Slate/Dark) | `#38BDF8` (Sky Blue) | `#F8FAFC` (Ghost White) | Hackathons & DevCom Events |
| **Sportsfest Tiger Blood** | `#7F1D1D` (Crimson) | `#F5B400` (UST Gold) | `#FFFBEB` (Warm Amber) | Annual Athletics & Pep Rallies |
| **CCIS Innovate** | `#3B0764` (Deep Purple) | `#22C55E` (Lime Green) | `#F5F3FF` (Lavender Light) | Technology Seminars |
| **Retro Terminal** | `#090D16` (Blackboard) | `#39FF14` (Neon Lime) | `#121824` (Cyberpunk Dark) | Programming Contests |

---

## 🔐 Administrative Role Matrix

Admin permissions are enforced dynamically across views using the following roles:

*   **DevCom Head**: Full access to all components, settings, role invitations, and layout theme configurations.
*   **Comm — Content**: Access to Announcements Manager and Calendar Event scheduling.
*   **Comm — Registration**: Access to Event Registration list monitoring and confirmation/attendance updates.
*   **Comm — Photobooth**: Control over Photobooth frame uploads and gallery curation.
*   **Officer (Read-Only)**: Access to the main Dashboard telemetry and Concerns list for observation only.

---

## 🛠️ Tech Stack & Architecture

*   **Core Engine**: React 19 + TypeScript + Vite 6
*   **Styling**: Tailwind CSS v4 with real-time CSS Custom Properties integration.
*   **Animations**: GSAP (GreenSock Animation Platform) + Tailwind transitions.
*   **Icons**: Lucide React.
*   **Data Layer**: Supabase backend database integration for real-time announcements, events, officers, committees, registrations, FAQs, and custom theme presets.

---

## 🚀 Running Locally

### Prerequisites
*   [Node.js](https://nodejs.org/) (v18 or higher recommended)

### Step-by-Step Installation

1.  **Clone the Repository** and navigate to the root directory.
2.  **Install Dependencies**:
    ```bash
    npm install
    ```
3.  **Set up Environmental Keys**:
    Create a `.env.local` file in the root directory and define your Gemini API key:
    ```env
    GEMINI_API_KEY=your_gemini_api_key_here
    ```
4.  **Run Development Server**:
    ```bash
    npm run dev
    ```
    The website will be served at `http://localhost:3000`.

### Scripts Overview
*   `npm run dev` — Launches the local Vite server (accessible at port 3000, binding to host `0.0.0.0`).
*   `npm run build` — Bundles optimized static assets into the `/dist` directory.
*   `npm run preview` — Locally previews the production build.
*   `npm run lint` — Performs static type checking via TypeScript (`tsc --noEmit`).
*   `npm run clean` — Cleans up previous build distributions.

---

## 📂 Project Directory Structure

```text
ccis_website/
├── public/                 # Static assets (logos, seals, background patterns)
├── src/
│   ├── admin/              # Admin Portal Module
│   │   ├── components/     # Admin-specific UI elements (Sidebar, Topbar, Toast)
│   │   ├── data/           # Mock database presets (mockData.ts)
│   │   ├── sections/       # Admin sub-pages (Dashboard, Concerns, Announcements, etc.)
│   │   ├── AdminApp.tsx    # Admin main hub & routing coordinator
│   │   └── AdminContext.tsx# Administrative authentication & global states
│   ├── components/         # Public Website Components (Hero, InfoHub, Registration, etc.)
│   ├── utils/              # Utility helper scripts
│   │   └── theme.ts        # Hex color handlers & real-time theme injector stylesheet
│   ├── App.tsx             # Public Portal layout router
│   ├── index.css           # Global custom styles and Tailwind setup
│   ├── main.tsx            # React entry mounting point
│   ├── RootRouter.tsx      # Main application router (toggles public vs. admin modes)
│   └── types.ts            # Shared TypeScript type definitions
├── index.html              # HTML document template
├── vite.config.ts          # Vite configuration
└── tsconfig.json           # TypeScript configuration
```
