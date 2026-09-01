import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { type UserRole } from '../types/database';
import { canPreviewRoles } from '../admin/roleAccess';
import { useAuth } from './AuthContext';

interface RolePreviewContextType {
  previewRole: UserRole | null;
  effectiveRole: UserRole | null;
  isRolePreviewing: boolean;
  startRolePreview: (role: UserRole) => void;
  exitRolePreview: () => void;
}

const RolePreviewContext = createContext<RolePreviewContextType | undefined>(undefined);

export function useRolePreview(): RolePreviewContextType {
  const context = useContext(RolePreviewContext);
  if (!context) throw new Error('useRolePreview must be used within RolePreviewProvider');
  return context;
}

export function RolePreviewProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [previewRole, setPreviewRole] = useState<UserRole | null>(null);
  const [previewUserId, setPreviewUserId] = useState<string | null>(null);

  useEffect(() => {
    if (previewUserId !== (profile?.id ?? null) || profile?.role !== 'devcom_head') {
      setPreviewRole(null);
      setPreviewUserId(null);
    }
  }, [previewUserId, profile?.id, profile?.role]);

  const startRolePreview = useCallback((role: UserRole) => {
    if (profile?.role !== 'devcom_head') return;
    setPreviewRole(role);
    setPreviewUserId(profile.id);
  }, [profile?.id, profile?.role]);

  const exitRolePreview = useCallback(() => {
    setPreviewRole(null);
    setPreviewUserId(null);
  }, []);

  const isRolePreviewing = previewRole !== null
    && previewUserId === profile?.id
    && canPreviewRoles(profile?.role);
  const effectiveRole = isRolePreviewing ? previewRole : profile?.role ?? null;

  const value = useMemo(() => ({
    previewRole: isRolePreviewing ? previewRole : null,
    effectiveRole,
    isRolePreviewing,
    startRolePreview,
    exitRolePreview,
  }), [previewRole, effectiveRole, isRolePreviewing, startRolePreview, exitRolePreview]);

  return <RolePreviewContext.Provider value={value}>{children}</RolePreviewContext.Provider>;
}
