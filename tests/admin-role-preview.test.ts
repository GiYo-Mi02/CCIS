import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ADMIN_SECTIONS, canAccessAdminSection, canManagePublicPage, canPreviewRoles } from '../src/admin/roleAccess';
import type { UserRole } from '../src/types/database';

const allowedSections: Record<UserRole, string[]> = {
  student: [],
  devcom_head: [...ADMIN_SECTIONS],
  officer: ['dashboard', 'messages'],
  comm_content: ['dashboard', 'announcements', 'calendar', 'faqs'],
  comm_registration: ['dashboard', 'registration', 'scanner', 'verification'],
  comm_photobooth: ['dashboard'],
};

test('admin sections match the role access matrix', () => {
  for (const [role, allowed] of Object.entries(allowedSections) as [UserRole, string[]][]) {
    for (const section of ADMIN_SECTIONS) {
      assert.equal(canAccessAdminSection(role, section), allowed.includes(section), `${role} access to ${section}`);
    }
  }
});

test('only DevCom Head can start a role preview', () => {
  for (const role of Object.keys(allowedSections) as UserRole[]) {
    assert.equal(canPreviewRoles(role), role === 'devcom_head');
  }
  assert.equal(canPreviewRoles(null), false);
});

test('public management matches the role access matrix', () => {
  assert.equal(canManagePublicPage('comm_photobooth', 'gallery'), true);
  assert.equal(canManagePublicPage('officer', 'transparency'), true);
  assert.equal(canManagePublicPage('comm_content', 'patch'), true);
  assert.equal(canManagePublicPage('comm_content', 'gallery'), false);
  assert.equal(canManagePublicPage('student', 'patch'), false);
});

test('preview blocks UI interaction and inbox mutations', () => {
  const adminApp = readFileSync('src/admin/AdminApp.tsx', 'utf8');
  const messagesInbox = readFileSync('src/admin/sections/MessagesInbox.tsx', 'utf8');

  assert.match(adminApp, /inert=\{isRolePreviewing\}/);
  assert.match(adminApp, /onClickCapture=\{blockPreviewInteraction\}/);
  assert.match(adminApp, /onKeyDownCapture=\{blockPreviewInteraction\}/);
  assert.match(adminApp, /onSubmitCapture=\{blockPreviewInteraction\}/);
  assert.match(adminApp, /effectiveRole !== 'student' && !canAccessAdminSection\(effectiveRole, activeSection\)/);
  assert.match(messagesInbox, /!isRolePreviewingRef\.current && unreadStudentMsgIds\.length > 0/);
  assert.match(messagesInbox, /if \(isRolePreviewingRef\.current\) return;/);
  assert.match(messagesInbox, /pendingReadRequestsRef\.current\.forEach\(controller => controller\.abort\(\)\)/);
  const publicApp = readFileSync('src/App.tsx', 'utf8');
  assert.match(publicApp, /id="public-role-preview"/);
  assert.match(publicApp, /startRolePreview\(role\)/);
  assert.match(messagesInbox, /if \(isRolePreviewing \|\| !profile/);
});
