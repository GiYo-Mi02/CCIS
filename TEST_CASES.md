# 🧪 CCIS Centralized Student Portal — Comprehensive Test Plan & Test Cases

This document provides an exhaustive, end-to-end suite of manual and automated test cases covering **every page, component, modal, user role, security policy, device, and administrative workflow** of the CCIS Student Council Portal.

---

## 📋 Table of Contents
1. [Authentication & Onboarding Flow](#1-authentication--onboarding-flow)
2. [Header Navigation Bar](#2-header-navigation-bar)
3. [Home Page & Public Hub](#3-home-page--public-hub)
4. [Info Hub / About CCIS Page](#4-info-hub--about-ccis-page)
5. [Announcements Page](#5-announcements-page)
6. [Event Catalog & Registration Page](#6-event-catalog--registration-page)
7. [Gallery Page](#7-gallery-page)
8. [Bukas Kaban / Transparency Page](#8-bukas-kaban--transparency-page)
9. [Patch Notes & Dev Log Page](#9-patch-notes--dev-log-page)
10. [Helpdesk Direct Messaging Page](#10-helpdesk-direct-messaging-page)
11. [Student Account & Profile Page](#11-student-account--profile-page)
12. [Floating Support Widget](#12-floating-support-widget)
13. [Admin Authentication & Access Control](#13-admin-authentication--access-control)
14. [Admin Dashboard](#14-admin-dashboard)
15. [Admin Announcements Manager](#15-admin-announcements-manager)
16. [Admin Registration & Event Manager](#16-admin-registration--event-manager)
17. [Admin Ticket QR Scanner](#17-admin-ticket-qr-scanner)
18. [Admin Officers & Committee Manager](#18-admin-officers--committee-manager)
19. [Admin Helpdesk Messages Inbox](#19-admin-helpdesk-messages-inbox)
20. [Admin Academic Calendar Manager](#20-admin-academic-calendar-manager)
21. [Admin Student Verification Manager](#21-admin-student-verification-manager)
22. [Admin User Accounts Manager](#22-admin-user-accounts-manager)
23. [Admin FAQ Manager](#23-admin-faq-manager)
24. [Admin Roles & System Settings](#24-admin-roles--system-settings)
25. [Background Email Queue Worker](#25-background-email-queue-worker)
26. [Security, RLS & Content Filtering Tests](#26-security-rls--content-filtering-tests)
27. [Cross-Browser, Mobile & Hardware Device Tests](#27-cross-browser-mobile--hardware-device-tests)
28. [Performance, Network & Edge-Case Resilience Tests](#28-performance-network--edge-case-resilience-tests)
29. [Test Environment Setup & Data Seeding Guide](#29-test-environment-setup--data-seeding-guide)
30. [Quality Assurance Test Execution & Sign-Off Record Sheet](#30-quality-assurance-test-execution--sign-off-record-sheet)

---

## 1. Authentication & Onboarding Flow

| Test Case ID | Feature / Component | Test Objective | Preconditions | Execution Steps | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-AUTH-001** | Google Sign-In | Verify successful login with `@umak.edu.ph` email | User not logged in | 1. Click "Sign in with Google"<br>2. Select `@umak.edu.ph` account | User successfully authenticated; redirected to Profile Setup (if new) or Home Page. |
| **TC-AUTH-002** | Google Sign-In | Reject non-UMak domain emails | User not logged in | 1. Click "Sign in with Google"<br>2. Select a regular `@gmail.com` email | System displays an error toast blocking authentication unless listed in `VITE_ADMIN_BYPASS_EMAILS`. |
| **TC-AUTH-003** | Admin Email Bypass | Allow whitelisted admin emails | Email in `VITE_ADMIN_BYPASS_EMAILS` | 1. Sign in with whitelisted non-UMak email | System allows login and bypasses domain restriction. |
| **TC-AUTH-004** | Profile Setup | Enforce mandatory onboarding fields | New account authenticated | 1. Leave Student No / Program empty<br>2. Click "Complete Registration" | Validation errors trigger; form submission blocked until all required fields are filled. |
| **TC-AUTH-005** | Profile Setup | Complete user profile creation | New account authenticated | 1. Fill Full Name, Student No, Program, Year Level, Section, Contact<br>2. Accept Privacy Policy<br>3. Submit | Profile record created in Supabase with `profile_complete = true` and initial `status = 'pending'`. |
| **TC-AUTH-006** | Verification Banner | Display unverified alert banner | Account in `status = 'pending'` | 1. Log in with an unverified student account | Top alert banner appears: "Your account is pending admin verification. Fallback access enabled." |
| **TC-AUTH-007** | Account Suspension | Display Ban Notice Modal | Account has `banned = true` | 1. Attempt login with suspended account | Full-screen "Account Restricted" modal appears with ban duration or permanent notice; access blocked. |

---

## 2. Header Navigation Bar

| Test Case ID | Feature / Component | Test Objective | Preconditions | Execution Steps | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-NAV-001** | Tab Switching | Navigate between main sections | User on Home Page | 1. Click "Info Hub", "Announcements", "Events", "Gallery", "Bukas Kaban", "Patch", "Helpdesk" | Page seamlessly transitions to target tab without full browser refresh; active tab pill highlights. |
| **TC-NAV-002** | User Menu | Display user avatar and dropdown | User authenticated | 1. Click user avatar in top right | Dropdown menu expands showing student name, email, student number, "My Account", and "Sign Out". |
| **TC-NAV-003** | Admin Switch | Show Admin Portal button for admins | User has role `devcom_head` or `officer` | 1. Inspect top navigation bar | "Admin Portal" button is visible and clickable. |
| **TC-NAV-004** | Admin Switch | Hide Admin Portal button for regular students | User has role `student` | 1. Inspect top navigation bar | "Admin Portal" button is hidden. |
| **TC-NAV-005** | Mobile Drawer | Toggle responsive navigation menu | Mobile viewport (<768px) | 1. Tap hamburger icon<br>2. Select a tab<br>3. Tap backdrop | Drawer opens smoothly; navigating closes drawer; backdrop tap closes drawer. |

---

## 3. Home Page & Public Hub

| Test Case ID | Feature / Component | Test Objective | Preconditions | Execution Steps | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-HOME-001** | Hero CTA Buttons | Verify Hero action triggers | User on Home tab | 1. Click "Explore Info Hub"<br>2. Return and click "View Announcements" | "Explore Info Hub" navigates to Info Hub tab; "View Announcements" navigates to Announcements feed. |
| **TC-HOME-002** | Announcements Quick Strip | Display latest pinned announcements | Announcements exist in DB | 1. Scroll to Announcements Quick Strip | Displays top 3 recent announcements with category badges and dates. |
| **TC-HOME-003** | Calendar Navigation | Switch calendar months | Events populated | 1. Click Next/Prev month arrows on public calendar | Calendar grid updates to show target month events and dates accurately. |
| **TC-HOME-004** | Calendar Event Filters | Filter calendar events by category | Events populated | 1. Click "General Event" or "Priority Academic" filter pill | Calendar highlights matching event types with corresponding color codes (#123524 / #FFBC00). |
| **TC-HOME-005** | Upcoming Events List | Navigate to Event Registration from list | Upcoming events active | 1. Click "Register Now" on an upcoming event card | Page switches to Event Registration tab with the selected event pre-opened in modal. |
| **TC-HOME-006** | Developer Dedication | Verify audio player and team showcase | User on Home tab | 1. Click play on dedication track<br>2. Hover over developer cards | Audio plays smoothly; developer cards animate with tech stack badges and social links. |
| **TC-HOME-007** | Accordion FAQ | Expand/Collapse FAQ items | FAQs exist in DB | 1. Click an FAQ question header | Answer expands smoothly; clicking again collapses it. |

---

## 4. Info Hub / About CCIS Page

| Test Case ID | Feature / Component | Test Objective | Preconditions | Execution Steps | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-INFO-001** | Mission & Vision | Render council values | User on Info Hub tab | 1. Scroll through About CCIS section | Mission, Vision, and Core Values render with styled geometry cards. |
| **TC-INFO-002** | Officer Directory | Filter officers by committee | Officers populated | 1. Click "Executive", "DevCom", "Secretariat", "Creatives", "Logistics" tabs | Grid updates to show officers belonging to the selected committee. |
| **TC-INFO-003** | Officer Bio Modal | Open detailed officer profile | Officers populated | 1. Click on an officer card | Modal opens showing officer photo, full name, role, committee, quote, and contact info. |
| **TC-INFO-004** | Academic Programs | Display CCIS degree program details | User on Info Hub tab | 1. Inspect Programs sector | Displays BSCS, BSIT, and ACT degree program highlights and descriptions. |

---

## 5. Announcements Page

| Test Case ID | Feature / Component | Test Objective | Preconditions | Execution Steps | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-ANN-001** | Search Announcements | Filter feed by keyword search | Announcements exist | 1. Type keyword into search input | Feed dynamically updates to show matching announcement titles/content. |
| **TC-ANN-002** | Category Filtering | Filter feed by category tags | Announcements exist | 1. Click "Academic", "Urgent", or "General" filter pill | Feed displays only announcements matching selected category. |
| **TC-ANN-003** | Announcement Detail Modal | View full announcement post | Announcements exist | 1. Click "Read More" on an announcement card | Modal opens displaying formatted announcement text, attached images, date, and author. |
| **TC-ANN-004** | Pin / Bookmark | Pin priority announcement to top | Urgent post exists | 1. Observe feed layout | Urgent/Pinned announcements appear at the top with distinct border styling. |

---

## 6. Event Catalog & Registration Page

| Test Case ID | Feature / Component | Test Objective | Preconditions | Execution Steps | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-EVT-001** | Event Catalog Display | Show active event cards with capacity | Events published | 1. Navigate to Events tab | Displays event poster, title, date, venue, remaining slots, and eligibility. |
| **TC-EVT-002** | Event Details Modal | Inspect complete event details | User on Events tab | 1. Click "View Event & Register" | Modal displays full description, agenda, venue map, and registration form. |
| **TC-EVT-003** | Registration Submission | Complete event registration | User authenticated, slots > 0 | 1. Select shirt size (if applicable)<br>2. Accept event waiver<br>3. Click "Confirm Registration" | Registration saved; remaining slots decrement by 1; Digital Ticket modal triggers. |
| **TC-EVT-004** | Digital QR Ticket | Generate QR ticket modal | Registration completed | 1. Inspect generated ticket modal | Displays unique ticket ID, QR code image, student name, event title, and "Download Ticket" button. |
| **TC-EVT-005** | Duplicate Registration | Block re-registration for registered event | User already registered | 1. Open an event already registered for | Button states "Already Registered"; registration form is disabled. |
| **TC-EVT-006** | Capacity Limit | Block registration when event is full | Event slots = 0 | 1. Open a full event | Button states "Event Full / Capacity Reached"; registration form is disabled. |

---

## 7. Gallery Page

| Test Case ID | Feature / Component | Test Objective | Preconditions | Execution Steps | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-GAL-001** | Hero Carousel | Auto-play and manual hero navigation | Gallery items exist | 1. Observe hero carousel<br>2. Click carousel arrows or thumbnail indicators | Carousel slides automatically every 5s; manual clicks switch slides instantly. |
| **TC-GAL-002** | Gallery Grid | Filter photos by album category | Gallery items exist | 1. Click "Assemblies", "Sports", "Workshops" filter tabs | Grid displays only photos belonging to the selected category. |
| **TC-GAL-003** | Lightbox Modal | Open full-screen photo viewer | Gallery items exist | 1. Click any gallery image | Full-screen lightbox opens with high-res image, title, date, download link, and close button. |
| **TC-GAL-004** | Inline Admin Upload | Upload new gallery item (Admin) | User is Admin | 1. Click "+ Add New Gallery Item"<br>2. Fill title, image URL, category<br>3. Submit | New photo added to gallery grid immediately. |

---

## 8. Bukas Kaban / Transparency Page

| Test Case ID | Feature / Component | Test Objective | Preconditions | Execution Steps | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-TRN-001** | Financial Overview | Display summary statistics | Reports published | 1. Navigate to Bukas Kaban tab | Renders total budget, total expenses, remaining balance, and audited report count cards. |
| **TC-TRN-002** | Expense Breakdown Chart | Render category expense breakdown | Data populated | 1. Inspect Expense Breakdown section | Displays interactive charts/progress bars showing funds allocated per committee. |
| **TC-TRN-003** | Download Liquidated Reports | Access downloadable PDFs/CSVs | Reports attached | 1. Click "Download PDF" on a financial report item | Report file downloads or opens in new tab cleanly. |
| **TC-TRN-004** | Submit Inquiry | Submit financial transparency inquiry | User logged in | 1. Fill inquiry message box<br>2. Click "Send Inquiry" | Inquiry saved to database and routed to Finance/Admin inbox with success toast. |
| **TC-TRN-005** | Inline Admin Upload | Upload liquidated financial report (Admin) | User is Admin | 1. Click "+ Upload Financial Report"<br>2. Attach title, period, amount, file URL<br>3. Submit | New report appears in Bukas Kaban liquidated reports list. |

---

## 9. Patch Notes & Dev Log Page

| Test Case ID | Feature / Component | Test Objective | Preconditions | Execution Steps | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-PAT-001** | Version History | Render platform release timeline | Patch logs exist | 1. Navigate to Patch tab | Timeline displays release version, date, title, and bulleted features/bug fixes. |
| **TC-PAT-002** | Demo Video Player | Play patch feature demo video | Video entry exists | 1. Click play on patch video card | HTML5 video player plays demo with controls (play, pause, mute, fullscreen). |
| **TC-PAT-003** | Inline Admin Video Upload | Add new patch video highlight (Admin) | User is Admin | 1. Click "+ Add Patch Video"<br>2. Input title, video URL, description<br>3. Submit | Video card appended to Patch Page video feed. |

---

## 10. Helpdesk Direct Messaging Page

| Test Case ID | Feature / Component | Test Objective | Preconditions | Execution Steps | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-MSG-001** | Create New Ticket | Start a direct helpdesk inquiry | User authenticated | 1. Click "New Inquiry"<br>2. Select category (Academic, Event, General)<br>3. Type message<br>4. Send | Conversation thread created with status `pending`; message appears in chat thread. |
| **TC-MSG-002** | Real-Time Messaging | Receive real-time admin replies | Active conversation | 1. Send message as student<br>2. Send reply as admin in another window | Student chat window updates instantly via Supabase Realtime subscription without refresh. |
| **TC-MSG-003** | Status Indicator | Show ticket resolution status | Active conversation | 1. Inspect conversation header | Badge accurately reflects `Pending`, `In Progress`, or `Resolved`. |

---

## 11. Student Account & Profile Page

| Test Case ID | Feature / Component | Test Objective | Preconditions | Execution Steps | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-ACC-001** | Profile Info Display | Render student profile details | User logged in | 1. Navigate to My Account tab | Displays student name, student number, program, year level, section, email, and contact info. |
| **TC-ACC-002** | Edit Profile | Update editable profile fields | User logged in | 1. Click "Edit Profile"<br>2. Update section, year level, contact number<br>3. Save | Profile updated in Supabase; success toast displayed; new values rendered. |
| **TC-ACC-003** | My Event Passes | View registered digital QR passes | User registered for events | 1. Scroll to "My Event Passes" sector | Lists registered events with clickable "View QR Ticket" buttons. |
| **TC-ACC-004** | Email Preferences | Toggle announcement email subscription | User logged in | 1. Toggle "Email Announcements & Alerts" switch | Database field `subscribe_announcements_events` updates immediately; toast notifies user. |
| **TC-ACC-005** | Sign Out | Log out of active portal session | User logged in | 1. Click "Sign Out Account" | Auth session terminated; app redirects to Login / Auth page. |

---

## 12. Floating Support Widget

| Test Case ID | Feature / Component | Test Objective | Preconditions | Execution Steps | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-WGT-001** | Toggle Widget | Open/close floating chat widget | User on any public page | 1. Click floating chat bubble in bottom-right corner | Support widget window toggles open/closed with smooth animation. |
| **TC-WGT-002** | Quick FAQ Search | Click quick answer prompt | Widget open | 1. Click "How do I register for events?" or "Where is Bukas Kaban?" | Widget bot instantly returns structured answer with direct link button. |
| **TC-WGT-003** | Route to Helpdesk | Redirect to direct messaging | Widget open | 1. Click "Contact Support Desk" | Widget closes and app navigates to Helpdesk Direct Messaging tab (`activeTab = 'messages'`). |

---

## 13. Admin Authentication & Access Control

| Test Case ID | Feature / Component | Test Objective | Preconditions | Execution Steps | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-ADM-AUTH-001** | Admin Role Check | Permit access for authorized admin roles | User has `devcom_head` or `officer` role | 1. Navigate to Admin Portal (`activeTab = 'admin'`) | Admin Portal dashboard loads cleanly. |
| **TC-ADM-AUTH-002** | Block Student Access | Deny Admin Portal to regular students | User has `student` role | 1. Attempt accessing Admin Portal | Admin Login screen triggers stating "Access Denied: Admin privileges required." |
| **TC-ADM-AUTH-003** | Exit Admin | Return to public portal | User in Admin Portal | 1. Click "Exit Admin Portal" button in sidebar | App switches back to public portal view. |

---

## 14. Admin Dashboard

| Test Case ID | Feature / Component | Test Objective | Preconditions | Execution Steps | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-ADM-DASH-001** | Metric Cards | Display live platform metrics | Admin logged in | 1. Inspect Dashboard | Stat cards display total students, active events, pending verifications, and open tickets. |
| **TC-ADM-DASH-002** | Quick Action Links | Trigger direct manager section navigation | Admin logged in | 1. Click "New Announcement", "Scan Ticket", or "Verify Students" | Switches active admin section to corresponding manager component. |
| **TC-ADM-DASH-003** | Email Queue Status | Monitor background email worker health | Admin logged in | 1. Check Queue Health widget | Displays pending, sent, and failed email queue counters. |

---

## 15. Admin Announcements Manager

| Test Case ID | Feature / Component | Test Objective | Preconditions | Execution Steps | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-ADM-ANN-001** | Create Announcement | Publish new announcement post | Role: `devcom_head` or `comm_content` | 1. Click "+ New Announcement"<br>2. Fill title, category, content, image URL<br>3. Check "Urgent"<br>4. Publish | Announcement inserted into DB; queue trigger creates email notifications; feed updates. |
| **TC-ADM-ANN-002** | Edit Announcement | Update existing announcement post | Announcement exists | 1. Click Edit on an announcement<br>2. Modify title/content<br>3. Save | Record updated in DB; changes reflected immediately across public feed. |
| **TC-ADM-ANN-003** | Delete Announcement | Remove announcement post | Announcement exists | 1. Click Delete on an announcement<br>2. Confirm deletion | Record removed from DB; removed from public feed. |

---

## 16. Admin Registration & Event Manager

| Test Case ID | Feature / Component | Test Objective | Preconditions | Execution Steps | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-ADM-REG-001** | Create Event | Publish new student event | Role: `devcom_head` or `comm_registration` | 1. Click "+ Create Event"<br>2. Fill title, date, venue, total slots, category<br>3. Submit | Event published to public catalog. |
| **TC-ADM-REG-002** | View Attendees | Inspect registered student list per event | Event has registrants | 1. Click "View Attendees" on an event card | Modal displays table of registrants (Name, Student No, Program, Ticket Code, Check-in status). |
| **TC-ADM-REG-003** | Export Attendees | Export attendee list to CSV | Event has registrants | 1. Click "Export CSV" | CSV file containing attendee records downloads to local device. |
| **TC-ADM-REG-004** | Cancel Registration | Void a student's event registration | Registrant exists | 1. Click "Cancel Ticket" on a student entry<br>2. Confirm | Registration record updated/deleted; available event slot increments by 1. |

---

## 17. Admin Ticket QR Scanner

| Test Case ID | Feature / Component | Test Objective | Preconditions | Execution Steps | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-ADM-SCN-001** | Camera QR Scan | Scan valid student QR ticket code | Camera active, ticket valid | 1. Point camera at student ticket QR code | Scanner reads code; displays "VALID TICKET", student name, and event; plays success chime; marks ticket `scanned = true`. |
| **TC-ADM-SCN-002** | Re-scan Ticket | Reject already scanned ticket | Ticket already scanned | 1. Scan the same ticket QR code again | Displays warning "ALREADY SCANNED" with previous scan timestamp; plays warning sound. |
| **TC-ADM-SCN-003** | Manual Code Search | Validate ticket via manual code input | Scanner active | 1. Type ticket UUID code into manual input<br>2. Click "Verify Ticket" | Validates ticket code identically to camera scan. |

---

## 18. Admin Officers & Committee Manager

| Test Case ID | Feature / Component | Test Objective | Preconditions | Execution Steps | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-ADM-OFF-001** | Add Officer | Register new council officer | Role: `devcom_head` | 1. Click "+ Add Officer"<br>2. Fill name, position, committee, bio, photo URL<br>3. Save | Officer added to directory and rendered in Info Hub. |
| **TC-ADM-OFF-002** | Edit Officer | Update officer details & position | Officer exists | 1. Click Edit on officer card<br>2. Modify position/bio<br>3. Save | Updated info saved to DB. |
| **TC-ADM-OFF-003** | Reorder Officers | Rearrange officer display hierarchy | Officers exist | 1. Click move up/down arrows on officer entries | Officers reordered according to updated display order index. |

---

## 19. Admin Helpdesk Messages Inbox

| Test Case ID | Feature / Component | Test Objective | Preconditions | Execution Steps | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-ADM-MSG-001** | Ticket Queue Filter | Filter support tickets by status | Tickets exist | 1. Select "Pending", "In Progress", or "Resolved" tabs | Message list updates to show matching support conversations. |
| **TC-ADM-MSG-002** | Reply to Inquiry | Send response to student ticket | Ticket selected | 1. Type reply message in thread<br>2. Click "Send Reply" | Message delivered to student chat thread; email notification queued for student. |
| **TC-ADM-MSG-003** | Resolve Ticket | Mark ticket as resolved | Ticket open | 1. Click "Mark as Resolved" | Ticket status updated to `resolved`; status badge updates in student view. |

---

## 20. Admin Academic Calendar Manager

| Test Case ID | Feature / Component | Test Objective | Preconditions | Execution Steps | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-ADM-CAL-001** | Add Calendar Event | Post academic milestone or assembly | Role: `devcom_head` or `comm_content` | 1. Select date on calendar<br>2. Input event title, category, priority<br>3. Save | Event appears on public home page calendar timetable. |
| **TC-ADM-CAL-002** | Delete Calendar Event | Remove calendar milestone | Event exists | 1. Click event entry<br>2. Click "Delete Event" | Event removed from DB and calendar grid. |

---

## 21. Admin Student Verification Manager

| Test Case ID | Feature / Component | Test Objective | Preconditions | Execution Steps | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-ADM-VER-001** | Approve Student | Approve pending student account | Student in `status = 'pending'` | 1. Review student credentials<br>2. Click "Approve Student" | Student status updated to `approved`; unverified warning banner removed from student session. |
| **TC-ADM-VER-002** | Reject Student | Reject student registration | Student in `status = 'pending'` | 1. Click "Reject Student"<br>2. Enter rejection reason note<br>3. Confirm | Student status set to `rejected`; rejection reason displayed to student on login. |
| **TC-ADM-VER-003** | Unlock Profile | Allow student to edit & re-submit | Student rejected/locked | 1. Click "Unlock Profile" | Profile unlocks (`profile_complete = false`), allowing student to fix credentials. |

---

## 22. Admin User Accounts Manager

| Test Case ID | Feature / Component | Test Objective | Preconditions | Execution Steps | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-ADM-USR-001** | Search & Filter Users | Search master student directory | Users exist | 1. Type name, email, or student number into search bar | User directory table dynamically filters matching records. |
| **TC-ADM-USR-002** | Modify Role | Change user role permissions | Role: `devcom_head` | 1. Select user<br>2. Change role to `officer`, `comm_registration`, etc.<br>3. Save | User role updated in DB; new permissions take effect on next user login. |
| **TC-ADM-USR-003** | Ban Account | Apply temporary or permanent ban | User active | 1. Click "Ban User"<br>2. Select duration (24h, 7 days, or Permanent)<br>3. Confirm | User `banned` set to `true`; `banned_until` timestamp set; user force-logged out. |
| **TC-ADM-USR-004** | Unban Account | Restore suspended user account | User banned | 1. Click "Unban User" | User `banned` reset to `false`; `banned_until` set to `NULL`; user can log in again. |

---

## 23. Admin FAQ Manager

| Test Case ID | Feature / Component | Test Objective | Preconditions | Execution Steps | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-ADM-FAQ-001** | Add FAQ | Publish new frequently asked question | Role: `devcom_head` or `comm_content` | 1. Click "+ Add FAQ"<br>2. Fill question, answer, category<br>3. Submit | FAQ added to DB and rendered in Home & Support widget accordion. |
| **TC-ADM-FAQ-002** | Reorder FAQs | Move FAQ position up or down | FAQs exist | 1. Use move up/down arrows | FAQ display sequence reordered. |

---

## 24. Admin Roles & System Settings

| Test Case ID | Feature / Component | Test Objective | Preconditions | Execution Steps | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-ADM-SET-001** | View Role Matrix | Inspect role permission mappings | Role: `devcom_head` | 1. Navigate to Settings & Roles section | Displays detailed matrix of permissions per role (`devcom_head`, `officer`, `comm_content`, etc.). |
| **TC-ADM-SET-002** | Maintenance Mode | Toggle site maintenance mode | Role: `devcom_head` | 1. Toggle "Maintenance Mode" switch | System config updated; non-admin visitors see maintenance screen if enabled. |

---

## 25. Background Email Queue Worker

| Test Case ID | Feature / Component | Test Objective | Preconditions | Execution Steps | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-WRK-001** | Dequeue & Dispatch | Process queued emails via SMTP | `email_worker.js` active, queued emails exist in DB | 1. Trigger an announcement or ticket response<br>2. Observe email worker console | Worker invokes `public.dequeue_emails(5)`; dispatches email via SMTP; marks queue record `status = 'sent'`. |
| **TC-WRK-002** | Failed Retry Handling | Retry failed email dispatch up to 3 attempts | Queue item failed | 1. Simulate SMTP connection failure | Worker increments `attempts`; sets status `failed`; retries on next poll until `attempts = 3`. |
| **TC-WRK-003** | Service Role Auth | Verify worker operates with valid database credentials | `SUPABASE_SERVICE_ROLE_KEY` set or function granted `EXECUTE` | 1. Run `node email_worker.js` | Worker executes `dequeue_emails` without permission errors. |

---

## 26. Security, RLS & Content Filtering Tests

| Test Case ID | Feature / Component | Test Objective | Preconditions | Execution Steps | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-SEC-001** | Row Level Security (RLS) | Prevent unauthorized reading of another student's messages | Logged in as Student A | 1. Open browser console<br>2. Query `messages` table filtering by Student B conversation ID | Supabase returns empty result array `[]` (RLS blocks unauthorized read access). |
| **TC-SEC-002** | XSS Script Prevention | Sanitize HTML/Script tags in user inputs | Logged in as Student | 1. Enter `<script>alert('xss')</script>` in chat or profile name<br>2. Save | Input is rendered as plain escaped text string; script execution is prevented. |
| **TC-SEC-003** | Profanity Filter | Mask explicit words in public inquiries | Logged in as Student | 1. Enter offensive words in Support Widget or Transparency inquiry | Profanity filter interceptor masks forbidden words with asterisks `***` before submission. |
| **TC-SEC-004** | Anti-Spam Guard | Throttle rapid message submissions | Logged in as Student | 1. Click "Send Message" 10 times consecutively within 2 seconds | UI disables submit button and alerts "Please wait before sending another message." |
| **TC-SEC-005** | Unauthorized RPC Call | Block execution of administrative RPCs | Anonymous / Student role | 1. Call `supabase.rpc('dequeue_emails')` from browser console using anon key | Database returns `permission denied for function dequeue_emails` unless service role key is used. |

---

## 27. Cross-Browser, Mobile & Hardware Device Tests

| Test Case ID | Feature / Component | Test Objective | Preconditions | Execution Steps | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-DEV-001** | Responsive Viewport | Verify layout on narrow mobile screens (320px–375px) | Mobile emulator or iPhone SE | 1. Open home, event catalog, and admin views at 320px width | No horizontal scrollbars appear; UI elements reflow cleanly into single column cards. |
| **TC-DEV-002** | Camera Hardware Prompt | Request and handle camera permissions for Ticket Scanner | Mobile device or laptop with webcam | 1. Open Admin Ticket Scanner (`activeTab = 'admin'` -> Scanner)<br>2. Allow camera access | Browser camera prompt triggers; camera stream renders in video viewport upon grant. |
| **TC-DEV-003** | Audio Feedback Policy | Play chime sound on ticket scan after user interaction | Ticket scanner open | 1. Click scan viewport<br>2. Scan valid QR code | Web Audio API / chime sound plays without browser gesture block warnings. |
| **TC-DEV-004** | Touch Gestures | Swipe and tap responsiveness on mobile drawer & lightbox | Touchscreen device | 1. Swipe photo lightbox images<br>2. Tap backdrop to dismiss modals | Lightbox navigates photos on swipe; modal backdrop taps dismiss cleanly. |

---

## 28. Performance, Network & Edge-Case Resilience Tests

| Test Case ID | Feature / Component | Test Objective | Preconditions | Execution Steps | Expected Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-PERF-001** | Slow 3G Network | Render skeleton loaders during slow data fetch | Network throttled to Slow 3G | 1. Navigate to Announcements or Event Catalog | Skeleton loading placeholders display smoothly until data resolves. |
| **TC-PERF-002** | Network Disconnection | Handle internet disconnection gracefully | App loaded | 1. Disconnect Wi-Fi / Enable Offline Mode<br>2. Attempt submitting registration | App displays toast: "Network disconnected. Please check your internet connection." |
| **TC-PERF-003** | Double-Click Guard | Prevent duplicate records on double click | User on Event Registration form | 1. Rapidly double-click "Confirm Registration" | Submit button disables immediately on first click; exactly 1 registration record is created. |
| **TC-PERF-004** | Large Dataset Rendering | Render 100+ attendee rows efficiently | 100+ registrants in DB | 1. Open "View Attendees" modal in Registration Manager | Table renders using pagination/virtual scrolling without browser lag or freeze. |

---

## 29. Test Environment Setup & Data Seeding Guide

To execute all test cases efficiently, set up test accounts with varying roles in your local or staging environment:

### Step 1: Create Test Accounts
1. **Regular Student Account**: `student.test@umak.edu.ph` (Role: `student`, `status = 'approved'`)
2. **Unverified Student Account**: `pending.test@umak.edu.ph` (Role: `student`, `status = 'pending'`)
3. **Banned Student Account**: `banned.test@umak.edu.ph` (Role: `student`, `banned = true`)
4. **Registration Officer Account**: `reg.officer@umak.edu.ph` (Role: `comm_registration`)
5. **DevCom Head Admin Account**: `ggiojoshua2006@gmail.com` (Role: `devcom_head`)

### Step 2: Seed Test Data Script
Run the following SQL snippet in your **Supabase SQL Editor** to create test events and announcements:

```sql
-- Seed Test Event
INSERT INTO public.events (id, title, description, event_date, venue, total_slots, remaining_slots, category, created_at)
VALUES (
  gen_random_uuid(),
  'CCIS Tech Assembly 2026',
  'Annual student assembly and technology showcase.',
  NOW() + INTERVAL '7 days',
  'Grand Auditorium, UMak',
  100,
  100,
  'General',
  NOW()
) ON CONFLICT DO NOTHING;

-- Seed Test Announcement
INSERT INTO public.announcements (id, title, content, category, urgent, created_at)
VALUES (
  gen_random_uuid(),
  'Welcome to Academic Year 2025-2026',
  'Official announcements feed for all CCIS students.',
  'General',
  true,
  NOW()
) ON CONFLICT DO NOTHING;
```

---

## 30. Quality Assurance Test Execution & Sign-Off Record Sheet

*Use this execution log sheet to record test runs prior to production deployment.*

| Test Run ID | Date Executed | Environment | Tester Name | Role | Total Passed | Total Failed | Status | Approval Signature |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| **TR-20260807-01** | Aug 07, 2026 | Local / Staging | Gio Joshua Gonzales | DevCom Lead | __ / 107 | __ / 107 | ⏳ In Progress | ____________________ |
| **TR-20260807-02** | Aug 07, 2026 | Production Pre-Flight | CCIS QA Team | QA Specialist | __ / 107 | __ / 107 | ⏳ Pending | ____________________ |

---

## 📊 Complete Summary Matrix

| Module Category | Test Case Range | Count | Coverage Target |
| :--- | :--- | :---: | :--- |
| **Public Student Portal** | `TC-AUTH-001` to `TC-WGT-003` | 56 | Auth, Navigation, Pages, Modals, Support |
| **Administrative Portal** | `TC-ADM-AUTH-001` to `TC-ADM-SET-002` | 35 | Role Verification, CRUD Managers, Scanner, Settings |
| **Background Services** | `TC-WRK-001` to `TC-WRK-003` | 3 | Node Worker, SMTP Dispatch, Retries |
| **Security & RLS Policies** | `TC-SEC-001` to `TC-SEC-005` | 5 | RLS Guards, XSS, Profanity, Anti-Spam, RPC Auth |
| **Cross-Browser & Hardware** | `TC-DEV-001` to `TC-DEV-004` | 4 | Responsive Reflow, Camera Hardware, Audio, Touch |
| **Performance & Resilience** | `TC-PERF-001` to `TC-PERF-004` | 4 | Network Throttle, Offline Toast, Double-Click Guard |
| **TOTAL TEST CASES** | | **107** | **100% Comprehensive Enterprise Quality Coverage** |
