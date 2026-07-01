# 🎨 Page-by-Page & Feature Directory

This chapter details every page, sub-feature, component, and user flow implemented on the CCIS Student Council Platform.

---

## 🌐 1. Public-Facing Student Portal (`src/App.tsx`)

The main entry point for students. Pages are swapped dynamically using an active tab state (`activeTab`) inside a single-page React wrapper.

### A. Hero & Landing Welcome Panel (`src/components/Hero.tsx`)
* **Features**:
  * **Curtain Entry Transition**: Operates a slide-up animation overlay on first visit using a GSAP timeline inside `LoadingScreen.tsx` to delay content rendering until core assets have initialized.
  * **Welcome CTA Callouts**: Dynamic navigation triggers ("Learn More", "Announcements") that route students to specific sections using smooth scroll hooks.
* **Implementation**: Uses direct state transitions passed via props from `App.tsx`.

### B. Dynamic Calendar & Upcoming Sidebar (`src/components/PublicEventCalendar.tsx`)
* **Features**:
  * **Calculated Calendar Grid**: Grid generator dynamically maps months and plots days.
  * **Color Cues**: General student activities (sports, tutorials) display dark green markings; priority deadlines (midterms, orgfee signups) show yellow/gold markings.
  * **Timeline Sidebar**: Queries the database to list the 5 most immediate upcoming events with dates and times.
* **Implementation**: Interacts with the `events` table. Utilizes Javascript date functions to structure the monthly offset tables.

### C. Announcements Board (`src/components/Announcements.tsx`)
* **Features**:
  * **Categories Filter**: Students filter posts via tabs: `ALL`, `EVENT`, `DEADLINE`, `RESULT`, and `GENERAL`.
  * **Rich Content Modal**: Clicking a post opens an overlay lightbox containing the banner image, date, author, and full content.
  * **Realtime Feed**: Interacts with Supabase realtime subscription hooks to display new posts instantly without reloading.
* **Implementation**: Subscribes to `public.announcements` table using:
  ```typescript
  supabase.channel('announcements-feed').on('postgres_changes', { event: 'INSERT' }, ...).subscribe();
  ```

### D. Event Booking & QR Ticket Portal (`src/components/Registration.tsx`)
* **Features**:
  * **Realtime Slots Indicator**: Queries capacity via the calculated database view `events_with_slots`. Disables checkout buttons and displays "Fully Booked" when slots reach 0.
  * **Embedded Boarding Pass**: Confirmed bookings generate a graphic pass containing student details and a ticket QR matrix.
  * **Export to Print**: Features a "Print Ticket" button that uses the local window layout to export a physical pass.
* **Implementation**: On successful registration, inserts records into `event_registrations` and calls a Deno Edge Function to send an email ticket.

### E. InfoHub Directory (`src/components/InfoHub.tsx`)
* **Features**:
  * **Historical Terms Selector**: Dropdown selector lets users switch between academic terms (**AY 2026-2027**, **AY 2025-2026**, **AY 2024-2025**).
  * **Executive Board Directory**: Renders officers sorted by hierarchy (Chairperson $\rightarrow$ Vice Chairperson $\rightarrow$ Secretary $\rightarrow$ Treasurer $\rightarrow$ Auditor).
  * **Year Representatives Directory**: Groups and lists representatives sequentially by year level (1st $\rightarrow$ 4th Year).
  * **Working Committees Desk**: Displays details, responsibilities, icons, and sub-divisions for each active working committee.
  * **Searchable FAQ Accordion**: Collapsible questions list with a search text input.
* **Implementation**: Standardizes input strings (e.g. converting double spacing) to ensure clean grouping rules in client-side code.

### F. Photobooth Frame Studio (`src/pages/GalleryPage.tsx`)
* **Features**:
  * **Live webcam Composite**: Connects to the user's camera stream and allows taking pictures.
  * **Polaroid & Retro Borders**: Users select graphic layouts to superimpose onto the photo.
  * **Public Gallery**: Displays a grid of user-uploaded snapshots.
* **Implementation**: Uses HTML5 Canvas elements to merge the webcam frame and layout borders into a single downloadable JPEG.

### G. Bukas Kaban Transparency Ledger (`src/pages/BukasKabanPage.tsx`)
* **Features**:
  * **Financial Charts**: Visualizes collection funds vs outgoing expenses using interactive graphs.
  * **Official PDF Repository**: Lists official financial sheets and liquidation documents available for direct download.
* **Implementation**: Fetches records from `public.transparency_reports` and uses local canvas elements to render charts.

### H. Patch Studio Video Player (`src/pages/PatchPage.tsx`)
* **Features**:
  * **Autoplay Hover Previews**: Hovering over video cards triggers video preview loops.
  * **Cinematic Lightbox**: Clicking a video opens a fullscreen player.
  * **Categories tabs**: Filters videos by "Full Episodes", "Highlights", and "Behind the Scenes".
* **Implementation**: Leverages HTML5 `<video>` refs for hover detection. Feeds from video assets in Supabase Storage.

### I. Support Widget (`src/components/SupportWidget.tsx`)
* **Features**:
  * **Floating Help Launcher**: Present in the bottom corner of all pages.
  * **Direct Chat Panel**: Provides a chat box interface that routes message streams directly to the admin dashboard.
  * **Live Typing Indicators**: Synchronizes read receipts in real-time.
* **Implementation**: Subscribes to real-time updates from `public.messages` and `public.conversations`.

---

## 🛠️ 2. Admin & Developer Dashboard (`src/admin/AdminApp.tsx`)

A secure control panel restricted to authorized roles.

### A. Dashboard Overview (`sections/Dashboard.tsx`)
* Renders telemetry dashboards showing registration trends, active student accounts, and quick access buttons.

### B. Announcements Manager (`sections/AnnouncementsManager.tsx`)
* Admin panel to write, edit, delete, publish, or pin announcements. Pinned announcements stay at the top of the student feed.

### C. Event Scheduler (`sections/EventCalendar.tsx`)
* Renders a calendar view where admins can click dates to create events, set capacity caps, specify categories, and configure location tags.

### D. Registration & CSV Manager (`sections/RegistrationManager.tsx`)
* Lists registrations for active events. Admins can manually update status flags (e.g., mark as "Attended" or "Cancelled") and download the list as a CSV file.

### E. Live Ticket Scanner (`sections/TicketScanner.tsx`)
* Uses the admin's device camera to scan ticket QR codes. Decodes the ticket ID, queries the database, checks capacity, marks the ticket as attended, and plays audio alerts (success/error chimes).

### F. Support Desk Inbox (`sections/MessagesInbox.tsx`)
* Consolidated console for student inquiries. Lists active chat threads with status tags (`New`, `In Progress`, `Resolved`). Admins can exchange messages and send canned replies.

### G. Officers & Committee Manager (`sections/OfficersManager.tsx`)
* Manage officers, set their display order, assign them to committees, and filter them by term (AY).

### H. User & Role Editor (`sections/UserManager.tsx`)
* Lists user profiles. Admins can ban users, lift bans, modify roles (e.g., promote to "Content Officer"), and edit student registration profiles.

### I. Verification Desk (`sections/VerificationManager.tsx`)
* Lists pending student registrations that require review. Admins verify student credentials and approve accounts.

### J. FAQ Manager (`sections/FaqManager.tsx`)
* Panel to add, edit, and organize FAQs.

### K. Theme Settings (`sections/SettingsRoles.tsx`)
* Admins can customize the platform's color palette (Primary, Accent, Background) using a color picker. Updates apply to all users in real-time via Supabase realtime connections.
