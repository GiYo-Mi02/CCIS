import React from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Database,
  Eye,
  FileText,
  LockKeyhole,
  Mail,
  Scale,
  ShieldCheck,
  UserRoundCheck,
} from 'lucide-react';

interface PrivacyPolicyPageProps {
  onNavigate: (tab: string) => void;
}

const sections = [
  ['scope', 'Scope of this notice'],
  ['collection', 'Information we collect'],
  ['purpose', 'How information is used'],
  ['sharing', 'Access and disclosure'],
  ['retention', 'Retention and security'],
  ['rights', 'Your privacy rights'],
  ['contact', 'Questions and requests'],
] as const;

export default function PrivacyPolicyPage({ onNavigate }: PrivacyPolicyPageProps) {
  return (
    <div className="bg-[#FAF7EA] text-stone-900">
      <header className="relative overflow-hidden bg-[#123524] text-[#FAF7EA] border-b-2 border-[#FFBC00]">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,#FFBC00_0,transparent_38%)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-20">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#FAF7EA]/80 hover:text-[#FFBC00] transition-colors mb-8"
          >
            <ArrowLeft size={15} /> Back to CCIS Portal
          </button>

          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FFBC00]/50 bg-[#FFBC00]/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#FFBC00] mb-5">
              <ShieldCheck size={14} /> Privacy and data protection
            </div>
            <h1 className="font-marcellus text-4xl md:text-6xl leading-tight text-white">
              Privacy Policy
            </h1>
            <p className="mt-5 max-w-2xl text-sm md:text-base leading-relaxed text-[#FAF7EA]/80">
              This notice explains how the CCIS Student Council Centralized Portal collects, uses, protects, and manages personal information in support of student services and council operations.
            </p>
            <p className="mt-5 font-mono text-[10px] uppercase tracking-wider text-[#FAF7EA]/60">
              Effective and last updated: August 24, 2026
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          <aside className="lg:col-span-3 lg:sticky lg:top-24">
            <nav aria-label="Privacy policy contents" className="bg-white border border-[#123524]/25 rounded-2xl p-5 shadow-xs">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#5E6E64] mb-4">On this page</p>
              <ol className="space-y-1.5">
                {sections.map(([id, label], index) => (
                  <li key={id}>
                    <a href={`#${id}`} className="flex gap-3 rounded-lg px-2 py-2 text-xs text-stone-600 hover:bg-[#123524]/5 hover:text-[#123524] transition-colors">
                      <span className="font-mono text-[#123524]/55">{String(index + 1).padStart(2, '0')}</span>
                      <span className="font-semibold">{label}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>

          <article className="lg:col-span-9 bg-white border border-[#123524]/25 rounded-3xl shadow-xs overflow-hidden">
            <div className="p-6 md:p-10 lg:p-12 space-y-12">
              <section className="rounded-2xl bg-[#123524]/[0.045] border border-[#123524]/20 p-5 md:p-6">
                <div className="flex gap-4 items-start">
                  <Scale className="text-[#123524] shrink-0 mt-0.5" size={22} />
                  <div>
                    <h2 className="font-marcellus text-xl text-[#123524]">Our privacy commitment</h2>
                    <p className="mt-2 text-sm leading-7 text-stone-600">
                      The College of Computing and Information Sciences Student Council respects the privacy of students, officers, administrators, and portal visitors. Personal data is processed in accordance with Republic Act No. 10173, or the Data Privacy Act of 2012, its implementing rules, relevant National Privacy Commission issuances, and applicable University of Makati policies.
                    </p>
                  </div>
                </div>
              </section>

              <PolicySection id="scope" icon={FileText} title="1. Scope of this notice">
                <p>This policy applies to the CCIS Student Council Centralized Portal and its public pages, authenticated student account area, event registration and attendance services, messaging and concern channels, gallery submissions, and authorized administrative tools.</p>
                <p>The portal-specific notice supplements the University of Makati privacy framework. University systems or third-party pages reached through external links are governed by their own notices.</p>
              </PolicySection>

              <PolicySection id="collection" icon={Database} title="2. Information we collect">
                <p>We collect only information reasonably necessary to provide and secure portal services. Depending on how you use the portal, this may include:</p>
                <ul>
                  <li><strong>Account and identity data:</strong> institutional email address, name, profile photo, student number, program, year level, section, and contact number.</li>
                  <li><strong>Verification and consent records:</strong> profile status, submission and approval details, privacy acknowledgment date, and administrative review records.</li>
                  <li><strong>Event data:</strong> registrations, ticket identifiers, universal attendance QR credentials, attendance timestamps, and registrant or walk-in status.</li>
                  <li><strong>Communications:</strong> support messages, concerns, replies, announcement preferences, and related timestamps.</li>
                  <li><strong>Submitted content:</strong> gallery images, captions, and other materials you intentionally provide through available portal features.</li>
                  <li><strong>Technical and security data:</strong> authentication records, device or browser information made available during normal web requests, timestamps, and security or rate-limit records needed to protect accounts and services.</li>
                </ul>
                <p>Google sign-in is used to authenticate institutional accounts. The portal does not ask for or store your Google password.</p>
              </PolicySection>

              <PolicySection id="purpose" icon={UserRoundCheck} title="3. How information is used">
                <p>Information is processed for specific, legitimate student-service and administrative purposes:</p>
                <ul>
                  <li>authenticate users and verify eligibility for CCIS portal services;</li>
                  <li>maintain student profiles and administer role-based access;</li>
                  <li>manage event registrations, issue tickets, validate universal QR passes, and record attendance;</li>
                  <li>deliver requested announcements, event notices, verification updates, and ticket emails;</li>
                  <li>operate support messaging, concerns, gallery, transparency, and council information features;</li>
                  <li>detect misuse, enforce account restrictions, investigate errors, and maintain service security; and</li>
                  <li>produce necessary operational summaries using the minimum information appropriate for council administration.</li>
                </ul>
                <p>We do not sell personal information or use it for unrelated commercial advertising.</p>
              </PolicySection>

              <PolicySection id="sharing" icon={Eye} title="4. Access and disclosure">
                <p>Access is limited according to assigned responsibilities. Authorized CCIS Student Council officers and administrators may access only the information needed for content management, account verification, event registration and attendance, support, or other approved portal duties.</p>
                <p>The portal uses service providers necessary to operate its technical functions, including Supabase for authentication, database, and storage services, and configured email-delivery infrastructure for transactional notices. These providers process information only to deliver the relevant service and are subject to their applicable safeguards and terms.</p>
                <p>Information may also be disclosed to authorized University of Makati offices, regulators, or law-enforcement authorities when required by law, necessary to protect rights and safety, or properly authorized under university policy. Public content—such as published announcements or approved gallery materials—is visible by design.</p>
              </PolicySection>

              <PolicySection id="retention" icon={LockKeyhole} title="5. Retention and security">
                <p>Records are retained only for as long as needed for the purpose for which they were collected, legitimate council and university operations, dispute resolution, security, and applicable legal or records-management requirements. Retention and disposal may therefore vary by record type.</p>
                <p>The portal applies organizational and technical safeguards such as institutional authentication, role-based permissions, row-level database controls, restricted administrative functions, secure transport, audit-related timestamps, and protected server-side workflows. No online system can guarantee absolute security, so suspected unauthorized access should be reported promptly.</p>
              </PolicySection>

              <PolicySection id="rights" icon={CheckCircle2} title="6. Your privacy rights">
                <p>Subject to the conditions and exceptions provided by law, data subjects may exercise the rights to be informed, access personal data, object to certain processing, correct inaccurate information, request erasure or blocking, obtain data portability where applicable, claim damages, and lodge a complaint with the National Privacy Commission.</p>
                <p>Requests must contain enough information to verify identity and locate the relevant record. Some information may need to be retained where processing remains required by law, university policy, security needs, or an ongoing administrative matter.</p>
              </PolicySection>

              <PolicySection id="contact" icon={Mail} title="7. Questions and privacy requests">
                <p>For questions about this portal or to request assistance with your CCIS Student Council account, contact:</p>
                <div className="grid sm:grid-cols-2 gap-4 mt-5">
                  <ContactCard title="CCIS Student Council" email="umakccissc@umak.edu.ph" detail="CCIS portal and council-service concerns" />
                  <ContactCard title="UMak Data Protection Office" email="dprms@umak.edu.ph" detail="Formal privacy and data-subject concerns" />
                </div>
                <p className="mt-5">You may also review the <a className="font-bold text-[#123524] underline decoration-[#FFBC00] decoration-2 underline-offset-4" href="https://www.umak.edu.ph/privacy/" target="_blank" rel="noreferrer">University of Makati Privacy Policy</a> for the university-wide privacy framework.</p>
              </PolicySection>

              <section className="border-t border-[#123524]/20 pt-8 text-xs leading-6 text-stone-500">
                <h2 className="font-marcellus text-lg text-[#123524]">Changes to this policy</h2>
                <p className="mt-2">This notice may be updated when portal functions, legal requirements, or University policies change. Material revisions will be reflected by the updated date shown at the top of this page.</p>
              </section>
            </div>
          </article>
        </div>
      </main>
    </div>
  );
}

function PolicySection({ id, icon: Icon, title, children }: {
  id: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="flex items-center gap-3 mb-4">
        <span className="w-9 h-9 rounded-xl bg-[#123524] text-[#FFBC00] flex items-center justify-center shrink-0">
          <Icon size={18} />
        </span>
        <h2 className="font-marcellus text-2xl text-[#123524]">{title}</h2>
      </div>
      <div className="space-y-4 text-sm leading-7 text-stone-600 [&_strong]:text-stone-800 [&_ul]:space-y-2 [&_ul]:pl-5 [&_li]:list-disc [&_li]:marker:text-[#FFBC00]">
        {children}
      </div>
    </section>
  );
}

function ContactCard({ title, email, detail }: { title: string; email: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-[#123524]/25 bg-[#FAF7EA] p-4">
      <p className="font-bold text-[#123524]">{title}</p>
      <p className="text-xs text-stone-500 mt-1">{detail}</p>
      <a className="inline-flex mt-3 font-mono text-xs font-bold text-[#123524] hover:underline" href={`mailto:${email}`}>{email}</a>
    </div>
  );
}
