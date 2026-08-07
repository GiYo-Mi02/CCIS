-- ============================================================
-- CCIS PLATFORM BACKEND: RESTORE DEQUEUE_EMAILS PERMISSIONS
-- ============================================================
-- Grants EXECUTE permission on public.dequeue_emails(integer) to anon, 
-- authenticated, and service_role so the email queue worker can run.

GRANT EXECUTE ON FUNCTION public.dequeue_emails(INTEGER) TO anon, authenticated, service_role;
