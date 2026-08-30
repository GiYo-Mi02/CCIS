select cron.schedule_in_database('ccis-email-worker', '* * * * *', 'SELECT internal.invoke_email_worker();', 'postgres', null, true);
