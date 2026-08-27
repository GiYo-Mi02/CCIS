import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const calendar = readFileSync(
  new URL('../src/components/PublicEventCalendar.tsx', import.meta.url),
  'utf8',
);
const hero = readFileSync(new URL('../src/components/Hero.tsx', import.meta.url), 'utf8');
const infoHub = readFileSync(new URL('../src/components/InfoHub.tsx', import.meta.url), 'utf8');
const developerDedication = readFileSync(
  new URL('../src/components/DeveloperDedication.tsx', import.meta.url),
  'utf8',
);
const faq = readFileSync(new URL('../src/components/FaqSection.tsx', import.meta.url), 'utf8');

test('public calendar uses solid semantic category blocks', () => {
  assert.match(app, /General Event Activity/);
  assert.match(app, /bg-\[#123524\] p-4 rounded-2xl/);
  assert.match(app, /Priority Academic \/ Deadline Event/);
  assert.match(app, /bg-\[#FFBC00\] p-4 rounded-2xl/);
  assert.match(calendar, /bg-\[#FFBC00\] text-\[#123524\] border-\[#FFBC00\]/);
  assert.match(calendar, /bg-\[#123524\] text-white border-\[#123524\]/);
});

test('landing hero scales against the usable viewport height', () => {
  assert.match(hero, /calc\(100svh - 4rem\)/);
  assert.match(hero, /paddingBlock: 'clamp\(2\.5rem, 8svh, 6rem\)'/);
  assert.match(hero, /fontSize: 'clamp\(3rem, min\(7\.5vw, 11svh\), 6rem\)'/);
  assert.doesNotMatch(hero, /min-h-\[90vh\]/);
});

test('Info Hub exposes a branded More Orgs menu with official logos', () => {
  assert.match(infoHub, />More Orgs</);
  assert.match(infoHub, /aria-haspopup="menu"/);
  assert.match(infoHub, /role="menu"/);
  assert.match(infoHub, /\/images\/ccis_logo\.jpg/);
  assert.match(infoHub, /\/images\/Computer-Society\.png/);
  assert.match(infoHub, /\/images\/SIC_logo\.jpg/);
  assert.match(infoHub, /UMak Society of Innovative Computing/);
  assert.match(infoHub, /primary: '#10B982'/);
  assert.match(infoHub, /accent: '#00FFFF'/);
  assert.match(infoHub, /title: 'Social Responsibility'/);
  assert.match(infoHub, /Choose an official CCIS organization/);
});

test('developer cards retain their modal and the modal uses a responsive photo-content split', () => {
  assert.match(developerDedication, /setSelectedDev\(LEAD_DEVELOPER\)/);
  assert.match(developerDedication, /setSelectedDev\(QA_DEVELOPER\)/);
  assert.match(developerDedication, /Click to view details/);
  assert.match(developerDedication, /createPortal/);
  assert.match(
    developerDedication,
    /grid-cols-1[^\n]*md:grid-cols-\[minmax\(17rem,0\.8fr\)_minmax\(0,1\.7fr\)\]/,
  );
  assert.match(developerDedication, /selectedDev\.photoUrl[\s\S]*selectedDev\.bio[\s\S]*Key Contributions/);
  assert.match(developerDedication, /min-h-\[17rem\][^\n]*sm:min-h-\[22rem\] md:min-h-full/);
});

test('organization navigation wraps without category labels or left accent borders', () => {
  assert.match(infoHub, /flex max-w-full flex-wrap items-center/);
  assert.doesNotMatch(infoHub, /overflow-x-auto/);
  assert.doesNotMatch(infoHub, /borderLeftColor|borderLeftWidth/);
  assert.doesNotMatch(infoHub, /Mother Organization|Local Academic Organization/);
});

test('FAQ cards omit the right edge and keep mobile controls compact', () => {
  assert.match(faq, /border-y border-l-4 border-r-0/);
  assert.match(faq, /p-4[^\n]*sm:p-5/);
  assert.doesNotMatch(faq, /border-r-zinc/);
});
