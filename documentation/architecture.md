# 🏗️ System Architecture & Tech Stack

This chapter describes the high-level system architecture, technology selections, and runtime data flows for the CCIS Centralized Platform.

---

## 🌐 1. Architectural Overview

The application follows a decoupled **Client-Server-BaaS** paradigm designed to minimize hosting costs while ensuring rapid reactivity:

```mermaid
graph TD
    classDef client fill:#e0f2fe,stroke:#0284c7,stroke-width:2px,color:#0369a1;
    classDef api fill:#fef9c3,stroke:#ca8a04,stroke-width:2px,color:#854d0e;
    classDef edge fill:#f3e8ff,stroke:#7e22ce,stroke-width:2px,color:#6b21a8;
    classDef db fill:#dcfce7,stroke:#15803d,stroke-width:2px,color:#166534;

    subgraph Client ["Client Tier (Browser)"]
        SPA["React 19 / Vite SPA"]:::client
        Scanner["Html5Qrcode Engine"]:::client
        Theme["Theme CSS Engine"]:::client
    end

    subgraph BaaS ["Supabase (API Gateway)"]
        SAuth["Supabase Auth"]:::api
        SRealtime["Realtime Channels"]:::api
        SEdge["Deno Edge Functions"]:::api
    end

    subgraph Data ["Database & Storage"]
        DB["Postgres DB (RLS)"]:::db
        Store["Storage Buckets"]:::db
        Trig["PL/pgSQL Triggers"]:::db
    end

    subgraph External ["External Pipelines"]
        Resend["Resend API"]:::edge
        QRServer["QR Code Generator API"]:::edge
    end

    SPA -->|HTTPS Reads & Writes| SAuth
    SPA -->|WebSocket Subscription| SRealtime
    SPA -->|RPC Dispatch| SEdge
    SPA -->|Webcam Decoding| Scanner
    
    SAuth --> DB
    SRealtime --> DB
    SEdge --> DB
    DB --> Trig
    DB --> Store
    
    SEdge -->|Dispatches passes| Resend
    Resend -->|Generates embedded matrix| QRServer
```

---

## 🛠️ 2. Detailed Tech Stack

### Frontend Tier
* **React 19 & TypeScript**: Provides type safety matched exactly to the database schema. High efficiency rendering with React hooks.
* **Vite 6**: Used for super fast hot reloading during dev and optimized Rollup tree-shaking for builds.
* **Tailwind CSS v4**: Utility styles combined with reactive CSS variables for on-the-fly colors.
* **GSAP (GreenSock)**: Orchestrates hardware-accelerated micro-animations, loading covers, page entry sweeps, and dynamic tab sweeps.
* **Html5Qrcode**: Local library using canvas arrays to analyze video stream frames and decode ticket QR matrices offline (no external camera-server calls needed during scan).

### Backend-as-a-Service (BaaS) Tier (Supabase)
* **Supabase Database**: PostgreSQL relational database with multi-table links, views, and indexes.
* **Row-Level Security (RLS)**: Fine-grained security constraints defined at the SQL layer, preventing unauthorized updates from the browser.
* **Realtime Websockets**: Listens for message inputs in active support chats and instant announcement notifications, updating views immediately without user refreshes.
* **Supabase Storage**: Bucket directories storing photobooth layouts, student profile photos, event posters, and bukaskaban PDFs.

### Transactional Email Pipeline
To avoid storing credentials in the browser, email generation runs in serverless contexts:
1. **Edge Function**: A Deno-based function (`send-ticket-email`) triggered via database changes or directly invoked via RPC, which integrates with **Resend** to dispatch tickets.
2. **Local Worker Daemon**: If Supabase serverless budgets are exceeded, a local script (`email-worker.js`) polls database registers to process queue tasks and deliver emails directly through SMTP.

---

## 🔄 3. Core Functional Data Flows

### A. domain-Locked Sign-Up Flow
```mermaid
sequenceDiagram
    autonumber
    actor User as Student Client
    participant Auth as Supabase Auth
    participant DB as Postgres DB
    participant Trig as DB Trigger (sync_profile_role)

    User->>Auth: Input email (e.g. jdoe@umak.edu.ph)
    Auth->>Auth: Validate domain constraints
    Auth->>DB: Create authentication account
    DB-->>Trig: Trigger profile sync
    Trig->>Auth: Propagate student role metadata to JWT
    Auth-->>User: Issue Session Token (contains role claims)
```

### B. Event Ticketing & Verification Flow
```mermaid
sequenceDiagram
    autonumber
    actor Student as Student Client
    participant UI as Registration Page
    participant DB as Postgres DB
    participant Edge as Edge Pipeline / Worker
    actor Admin as Admin Scanner

    Student->>UI: Select event and confirm registration
    UI->>DB: Check remaining slots & insert ticket status: confirmed
    DB-->>UI: Return Registration ID (UUID)
    UI->>Edge: Trigger ticket compilation
    Edge->>Student: Deliver HTML boarding pass with QR to email inbox
    Note over Student, Admin: Day of Event
    Student->>Admin: Present QR code email
    Admin->>UI: Decode QR ID using webcam scanner page
    UI->>DB: Fetch registration where id = scanned_uuid
    DB-->>UI: Validate entry & update status: attended
    UI-->>Admin: Show check-in success banner & audio cue
```
