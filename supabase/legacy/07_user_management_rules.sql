-- ============================================================
-- CCIS PLATFORM BACKEND: USER MANAGEMENT & ACCESS CONTROLS
-- ============================================================
-- Run this script in your Supabase SQL Editor to apply database
-- changes required for Banning, Ban Timers, and safe Cascading Deletes.

-- 1. ADD BAN AND BAN TIMEOUT COLUMNS TO PROFILES TABLE
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ DEFAULT NULL;

-- 2. DYNAMICALLY CONVERT FOREIGN KEYS TO ON DELETE CASCADE / SET NULL
-- This PL/pgSQL block scans the schema catalog for all tables referencing public.profiles(id),
-- drops the existing foreign key constraint, and rebuilds it with CASCADE or SET NULL
-- delete actions. This prevents deletion failures due to constraint violations.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT
            tc.table_name,
            tc.constraint_name,
            kcu.column_name
        FROM
            information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
        WHERE
            tc.constraint_type = 'FOREIGN KEY'
            AND ccu.table_name = 'profiles'
            AND ccu.table_schema = 'public'
    LOOP
        -- Announcements should be retained when an author is deleted (set author_id to null)
        -- All other tables (registrations, messages, etc.) should be cascading deleted
        IF r.table_name = 'announcements' THEN
            EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.table_name, r.constraint_name);
            EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.profiles(id) ON DELETE SET NULL',
                r.table_name, r.constraint_name, r.column_name);
        ELSE
            EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.table_name, r.constraint_name);
            EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.profiles(id) ON DELETE CASCADE',
                r.table_name, r.constraint_name, r.column_name);
        END IF;
    END LOOP;
END $$;
