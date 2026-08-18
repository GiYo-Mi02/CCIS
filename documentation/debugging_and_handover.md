# 🛠️ Handover & Debugging Guide

This guide is designed for the incoming DevCom/Technical officers of the CCIS Student Council. It details local configuration steps, background worker maintenance, and step-by-step troubleshooting instructions.

---

## 💻 1. Local Development Setup

To replicate the development environment:

### Step 1: Install Node.js
Ensure you have **Node.js (v18 or higher)** installed on your machine.

### Step 2: Clone the Codebase & Install Dependencies
```bash
git clone https://github.com/GiYo-Mi02/CCIS.git
cd ccis_website
npm install
```

### Step 3: Set up Local Environment Variables
Create a file named [`.env.local`](file:///c:/Users/gio%20joshua%20gonzales/OneDrive/Desktop/ccis_website/.env.local) in the root of the project.
* **Schema Template**:
  ```env
  VITE_SUPABASE_URL=https://your-supabase-project-id.supabase.co
  VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
  
  # Credentials below are required for the background Email Worker (if run locally)
  SUPABASE_SECRET_KEY=your-supabase-secret-key
  RESEND_API_KEY=re_your_secret_resend_api_key
  SENDER_EMAIL=umakccissc@umak.edu.ph
  ```

### Step 4: Run the Development Server
```bash
npm run dev
```
This boots up the Vite development server (usually on `http://localhost:3000`) and concurrently starts the background email processing worker.

The browser uses only the publishable key. Never put `SUPABASE_SECRET_KEY` in a `VITE_*` variable or expose it to browser code. Before deploying, set `SUPABASE_SECRET_KEY` for the local worker and Edge Function, remove the old service-role variable from those environments, and set `VITE_SUPABASE_PUBLISHABLE_KEY` in the browser deployment. Existing Supabase secrets are not rotated by this repository change.

---

## ✉️ 2. Background Email Worker Maintenance

### How it Works
When a student registers, a database trigger inserts an email task queue record. 
1. **Edge Route**: If edge functions are active, Supabase processes the task immediately.
2. **Local Daemon Fallback**: The script `email-worker.js` (started by `npm run dev`) acts as a fallback checker. It polls the database every 10 seconds for unsent registrations, generates visual HTML tickets, dispatches them via the **Resend API**, and marks the database queue record as `sent`.

### Troubleshooting Email Delivery
If students report they are not receiving boarding passes:
1. **Verify Resend Key**: Test if the API key has expired or reached its free tier limit (3,000 emails/month).
2. **Verify Sender Address**: Resend requires verification for custom domains. Ensure `SENDER_EMAIL` matches your verified Resend identity.
3. **Inspect Console Logs**: Check the terminal running `npm run dev`. The background worker outputs detailed logs for every poll and dispatch failure.

---

## 🔧 3. Common Troubleshooting & Debugging Scopes

### A. The "Clock Skew" Auth Failure
* **Symptoms**: User login or database reads fail instantly on a specific computer with vague network errors.
* **Cause**: Supabase uses timed JWT signatures. If the developer's computer clock is out of sync with international UTC time servers by more than a couple of minutes, token validation fails on Supabase.
* **Resolution**:
  1. Open Windows settings $\rightarrow$ *Time & Language* $\rightarrow$ *Date & Time*.
  2. Click **Sync Now** to update the local computer clock.

### B. Giving a New Account Admin Permissions
To promote a user to administrator:
* **Option A (SQL Editor)**: Execute this SQL script in Supabase:
  ```sql
  UPDATE public.profiles 
  SET role = 'devcom_head' 
  WHERE email = 'student_email@umak.edu.ph';
  ```
* **Option B (Database Trigger)**: Simply complete registration. Any account updated to `devcom_head` automatically propagates structural administrative permissions to the user auth metadata.

### C. Altering Tables & Changing Column Values
If you add columns (such as the historical `term` column in the officers table):
1. Write and test your SQL patch in the Supabase SQL editor first.
2. Run `npm run build` locally after updating types.
3. Ensure TypeScript interfaces in [database.ts](file:///c:/Users/gio%20joshua%20gonzales/OneDrive/Desktop/ccis_website/src/types/database.ts) are updated to avoid build compilation errors.

---

## 🎓 4. Handover Recommendations
* **Database Backup**: Set up daily backups in the Supabase Console settings.
* **Github Repositories**: Grant access to incoming technical officers by inviting them as collaborators to the official CCIS Github organization.
* **Domain Policies**: Never remove the domain gate trigger `check_profile_email_domain` unless explicitly requested by the college dean, as it protects student database directories from external spam registrations.
