-- ============================================
-- SEED DATA — Run AFTER all tables, functions,
-- triggers, and RLS policies are created.
-- ============================================

-- ============================================
-- COMMITTEES (8 committees matching the current site)
-- ============================================
insert into public.committees (name, slug, description, icon, responsibilities, display_order) values
  ('Logistics Committee', 'logistics',
   'Coordinates all logistical aspects of council events — paperwork, planning, venue arrangements, and execution.',
   'clipboard-list',
   array['Manage venue arrangements and event setup/teardown', 'Handle event-related paperwork and permits', 'Ensure smooth execution from planning to post-event wrap-up'],
   1),

  ('Finance Committee', 'finance',
   'Reviews financial documents in the Treasurer''s absence, keeps records of event purchases (prizes, tokens, supplies), and assists with supply procurement.',
   'coins',
   array['Review and verify financial documents for accuracy', 'Maintain records of items purchased for events', 'Assist with supply procurement alongside the Inventory Committee'],
   2),

  ('Inventory Committee', 'inventory',
   'Works with the Treasurer and Auditor to track all council equipment, supplies, and resources.',
   'archive',
   array['Track and maintain records of all council equipment and supplies', 'Organize storage and conduct regular inventory checks', 'Ensure resources are accounted for and ready when needed'],
   3),

  ('Technical Committee', 'technical',
   'Oversees all technical aspects of council events — implementing new technologies, providing technical support, and handling livestreaming.',
   'cpu',
   array['Provide technical support during council events', 'Manage livestreaming and broadcast quality', 'Implement and maintain event-related technology setups'],
   4),

  ('External Affairs Committee', 'external-affairs',
   'Builds and maintains connections within and outside the university — reaching out to potential partners, sponsors, and speaker engagements.',
   'globe',
   array['Reach out to and coordinate with potential sponsors and partners', 'Source speakers and external collaborators for council events', 'Assist and accommodate sponsors before, during, and after events'],
   5),

  ('Advertising Committee', 'advertising',
   'The creative arm of CCIS SC, composed of Publicity, Creatives, and Documentation sub-teams.',
   'megaphone',
   array['Publicity Team — Captions, announcements, and storylines', 'Creatives Team — Graphics, posters, and designs', 'Documentation Team — Photography and videography coverage'],
   6),

  ('Developers Committee', 'developers',
   'Builds and maintains CCIS SC''s digital systems — central website, registration, and photobooth.',
   'code',
   array['Maintain CCIS SC website', 'Support event registration systems', 'Coordinate branding across digital platforms'],
   7),

  ('Welfare Committee', 'welfare',
   'Focuses on student services and member welfare — looking after wellbeing and coordination with the Executive Board.',
   'heart',
   array['Organize student welfare programs and initiatives', 'Serve as point of contact for member concerns', 'Coordinate with the Executive Board on welfare policies'],
   8);

-- ============================================
-- ADVERTISING COMMITTEE SUB-TEAMS
-- ============================================
insert into public.committee_subteams (committee_id, name, description, display_order)
select
  c.id,
  sub.name,
  sub.description,
  sub.display_order
from public.committees c
cross join (
  values
    ('Publicity Team', 'Writes captions, formal announcements, taglines, and storylines for council communications and films.', 1),
    ('Creatives Team', 'Produces graphics, digital art, posters, illustrations, layouts, and multimedia motion designs.', 2),
    ('Documentation Team', 'Handles photography, videography, coverage operations, and post-event video reel editing.', 3)
) as sub(name, description, display_order)
where c.slug = 'advertising';

-- ============================================
-- EVENTS (sample upcoming events)
-- ============================================
insert into public.events (title, description, category, event_date, event_time, location, registration_required, registration_cap) values
  ('CCIS Council Innovation Challenge 2026',
   '48-hour competitive design & program marathon centering Smart community prototypes. Teams of 3-5 CCIS students compete for massive prizes.',
   'priority', '2026-07-15', '09:00', 'CCIS Innovation Laboratory (Room 402)',
   true, 60),

  ('Python Programming Peer Tutorial Boot',
   'Peer-led introductory tutorial covering NumPy, Pandas, and fundamentals. Open to all CCIS students.',
   'general', '2026-06-28', '13:00', 'CCIS Lecture Hall 1',
   true, 40),

  ('General Assembly — Oath-Taking & Budgets',
   'The supreme CCIS Student Council assembly. All year representative structures will review administrative reports, budget targets, and open concerns.',
   'priority', '2026-06-20', '10:00', 'CCIS Dome Assembly Auditorium',
   true, 150),

  ('Web Dev Workshop — Week 3',
   'React state management and API integration workshop. Third installment of the Web Development Workshop Series.',
   'general', '2026-06-20', '14:00', 'Lab 301',
   true, 40),

  ('Sportsfest 2026',
   'Annual inter-year sports competition at University Gym. Calling all CCIS Tigers!',
   'priority', '2026-07-25', '07:00', 'University Gym',
   true, 200),

  ('Midterm Examination Period Starts',
   'Full week course assessment period. Study hall strict silence guidelines active.',
   'priority', '2026-06-18', null, null,
   false, null),

  ('Scholarship Deadline',
   'Last day to submit CCIS Merit Scholarship applications through the student portal.',
   'priority', '2026-06-15', null, null,
   false, null);

-- ============================================
-- ANNOUNCEMENTS (sample published content)
-- ============================================
insert into public.announcements (title, content, category, status, pinned, banner_url, published_at) values
  ('CCIS Council Innovation Challenge 2026: Registration Now Open!',
   'Get ready to code, innovate, and compete for massive prizes! The CCIS Student Council is hosting the CCIS Council Innovation Challenge 2026. This year''s theme centers around "Smart Infrastructures for Community Empowerment." Form a team of 3-5 member computer science and IT students, brainstorm local challenges, and turn them into digital solutions within a 48-hour continuous cycle.',
   'event', 'published', true, null,
   now() - interval '3 days'),

  ('Midterm Examination Advisory & Quiet Study Hall Guidelines',
   'CCIS Students, please be advised that the Midterm Examination period begins on June 18, 2026. The Student Council Lab Lounge and central study halls will implement standard strict "Quiet Hours" starting June 15. Free coffee, review printouts, and peer tutoring will be accessible at the student hub daily from 9:00 AM to 5:00 PM.',
   'deadline', 'published', true, null,
   now() - interval '5 days'),

  ('First Semester General Assembly & Representative Elections Results',
   'We thank everyone who participated and cast their votes during yesterday''s General Representative Elections. The newly appointed year-level student leaders who will assist our council committees are announced! Full resolution outlines are posted on the digital notice boards.',
   'result', 'published', false, null,
   now() - interval '7 days'),

  ('CCIS Annual Sportsfest Prep & Volunteer Call-outs',
   'The major annual Sportsfest returns this coming July! We are looking for talented photographers, visual artists, sport coordinators, and support staff volunteers. Earn student credits and certified service citations for helping lead our CCIS tigers to victory!',
   'general', 'published', false, null,
   now() - interval '10 days'),

  ('Web Development Workshop Series — Week 3 Schedule',
   'Join us for the third installment of our Web Development Workshop Series. This week covers React state management and API integration. Open to all CCIS students.',
   'event', 'draft', false, null,
   null),

  ('Scholarship Application Deadline Reminder',
   'Final reminder: The CCIS Merit Scholarship application closes on June 15. Ensure all documents are submitted through the student portal.',
   'deadline', 'published', false, null,
   now() - interval '14 days');

-- ============================================
-- FAQS (dynamic FAQ content)
-- ============================================
insert into public.faqs (question, answer, display_order, is_active) values
  ('What is the CCIS Student Council?',
   'The CCIS Student Council (SC) is the supreme student governing body for the College of Computing and Information Sciences. We represent the student body, organize events, and advocate for student welfare across all CCIS programs.',
   1, true),

  ('How can I register for an event?',
   'Navigate to the Registration page, browse the list of upcoming events, and click on the event you want to join. Fill in your student details and submit the form. You''ll receive a digital boarding pass ticket instantly.',
   2, true),

  ('How do I submit a concern or suggestion?',
   'Go to the Information Hub and scroll down to the Concerns Desk section. Sign in with your Google account, then fill out the secure concern form with your category, subject, and detailed message. Our officers triage submissions daily.',
   3, true),

  ('Who are the current council officers?',
   'Visit the Information Hub page to see the complete Officer Directory with all Executive Board members and Year Level Representatives, along with their contact details and responsibilities.',
   4, true),

  ('How does the Photobooth work?',
   'Open the Photobooth page, enable your camera (or use the built-in simulator), select one of our branded frames (Classic CCIS, Innovation Challenge, or Tiger Sportsfest), and click the capture button. A 3-second timer will count down before snapping your portrait!',
   5, true),

  ('Can I change my event registration?',
   'Currently, you can view your registration status on your Account page. To cancel or modify a registration, please submit a concern ticket through the Concerns Desk and our registration committee will assist you.',
   6, true),

  ('How do I become a council officer or committee member?',
   'Council officers are elected during the General Assembly each semester. Committee members are recruited through open call-outs posted in our Announcements section. Watch for volunteer drives and application periods!',
   7, true),

  ('Is my data secure on this platform?',
   'Yes. This platform uses Supabase with Row-Level Security (RLS) policies, ensuring your profile data, registrations, and concerns are only visible to you and authorized council administrators. Authentication is handled via Google OAuth.',
   8, true);

-- ============================================
-- THEME SETTINGS (default active theme)
-- ============================================
insert into public.theme_settings (preset_name, primary_color, accent_color, canvas_color, is_active) values
  ('Default CCIS SC', '#1A3C2E', '#F5B400', '#FAF7EA', true),
  ('Cyber Tiger Tech', '#0F172A', '#38BDF8', '#F8FAFC', false),
  ('Sportsfest Tiger Blood', '#7F1D1D', '#F5B400', '#FFFBEB', false),
  ('CCIS Innovate Hackathon', '#3B0764', '#22C55E', '#F5F3FF', false),
  ('Retro Terminal', '#090D16', '#39FF14', '#121824', false);
