# 🎓 CCIS Centralized Platform — Documentation Index

Welcome to the official developer hand-off and system documentation for the **College of Computing and Information Sciences (CCIS) Student Council Centralized Platform**.

This platform was built to consolidate all operations of the CCIS Student Council into a single high-performance web app. It is designed to scale across academic terms, automate repetitive task pipelines (such as student event verification and ticket dispatch), and maintain transparent records of student concerns and financial audits.

---

## 📂 Documentation Chapters

Select a chapter below to read the comprehensive technical documentation for each component of the platform:

### 🏗️ [1. System Architecture & Tech Stack](file:///c:/Users/gio%20joshua%20gonzales/OneDrive/Desktop/ccis_website/documentation/architecture.md)
* Frontend architecture (React 19, TypeScript, Vite)
* BaaS architecture (Supabase proxy and client setup)
* Background pipelines (Deno serverless edge functions, local email worker)
* Detailed data flow diagrams (OAuth login, Ticket generation)

### 🗄️ [2. Database Schema & Security (RLS)](file:///c:/Users/gio%20joshua%20gonzales/OneDrive/Desktop/ccis_website/documentation/database.md)
* Complete schema summaries for all 14+ public database tables
* Security policies (Row Level Security - RLS) for users, officers, events, and chats
* Advanced PL/pgSQL database triggers and optimized indexes
* Database Entity-Relationship Diagram (ERD)

### 🎨 [3. Page-by-Page & Feature Directory](file:///c:/Users/gio%20joshua%20gonzales/OneDrive/Desktop/ccis_website/documentation/pages_and_features.md)
* Public-Facing views: Landing/Home, Announcements, Event Registration, Live Timetable Calendar, InfoHub (Officers & Committees Directory, ComSoc Desk, FAQs), Photobooth Snap Gallery, Bukas Kaban (Transparency Reports), and CCIS Patch (Video player).
* Backend/Admin Dashboard: Registration Managers, Live Ticket Web-Scanner, Announcements & FAQs CRUDs, Officers & Committee Managers, Real-Time Support Chat Inbox, and User Role & Verification Managers.
* Shared Components: Auth onboarding, Domain gate, CSS theme engine, and Support Widget.

### 🛠️ [4. Handover & Debugging Guide](file:///c:/Users/gio%20joshua%20gonzales/OneDrive/Desktop/ccis_website/documentation/debugging_and_handover.md)
* Step-by-step local development setup instructions
* How to run the local email background service worker
* Credential management and `.env.local` schema
* Common debugging issues (such as local clock skew errors, table alterations, and SMTP errors)
* Handover recommendations for the incoming DevCom committee

---

## 🚀 Quick Local Launch Reference

To get the platform running locally on your development machine in under 2 minutes:

1. Clone the repository and navigate to the project root:
   ```bash
   cd ccis_website
   ```
2. Install local node dependencies:
   ```bash
   npm install
   ```
3. Configure your local environment file [`.env.local`](file:///c:/Users/gio%20joshua%20gonzales/OneDrive/Desktop/ccis_website/.env.local) matching the schema detailed in the [Handover & Debugging Guide](file:///c:/Users/gio%20joshua%20gonzales/OneDrive/Desktop/ccis_website/documentation/debugging_and_handover.md).
4. Run the Dev Coordinator script to launch both the Vite frontend server (port 3000) and the background Email Worker:
   ```bash
   npm run dev
   ```
