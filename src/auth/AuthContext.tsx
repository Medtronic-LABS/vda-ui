import React, { createContext, useContext, useEffect, useState } from 'react';
import { base, getDevToken } from '../api/client';

export type AdminRole = 'ADMIN' | 'MEDICAL_OFFICER';

export interface AdminUserProfile {
  id: string;
  role: AdminRole;
  roleLabel: string;
  displayName: string;
  email: string;
  token: string;
}

interface AuthContextValue {
  user: AdminUserProfile | null;
  login: (identifier: string, password: string) => Promise<AdminUserProfile>;
  logout: () => void;
  hasFullAdminAccess: boolean;
}

const SESSION_KEY = 'vda_admin_portal_session_v1';

const LOCAL_ACCOUNTS: Array<{
  identifiers: string[];
  password: string;
  role: AdminRole;
  roleLabel: string;
  displayName: string;
  email: string;
  tokenSuffix: string;
}> = [
  {
    identifiers: ['admin', 'admin@vdahealth.org'],
    password: 'Admin@Vda2026',
    role: 'ADMIN',
    roleLabel: 'System Administrator',
    displayName: 'VDA System Administrator',
    email: 'admin@vdahealth.org',
    tokenSuffix: 'admin',
  },
  {
    identifiers: ['doctor', 'medical', 'doctor@vdahealth.org'],
    password: 'Doctor@Vda2026',
    role: 'MEDICAL_OFFICER',
    roleLabel: 'Medical Officer (Prescription Reviewer)',
    displayName: 'Dr. Ananya Sharma (CHO / Medical Officer)',
    email: 'doctor@vdahealth.org',
    tokenSuffix: 'medical-officer',
  },
];

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AdminUserProfile | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as AdminUserProfile;
      if (parsed?.token && parsed?.role) {
        window.sessionStorage.setItem('vdaToken', parsed.token);
        return parsed;
      }
    } catch {
      // Ignore invalid session storage state
    }
    return null;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (user) {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
      window.sessionStorage.setItem('vdaToken', user.token);
    } else {
      window.sessionStorage.removeItem(SESSION_KEY);
      window.sessionStorage.removeItem('vdaToken');
    }
  }, [user]);

  const login = async (identifier: string, password: string): Promise<AdminUserProfile> => {
    const normalizedId = identifier.trim().toLowerCase();
    const trimmedPassword = password;

    // 1. Try server-side admin login endpoint first
    try {
      const response = await fetch(`${base}/dev/auth/admin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: normalizedId, password: trimmedPassword }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data?.token && data?.user) {
          const profile: AdminUserProfile = {
            id: data.user.id,
            role: data.user.role,
            roleLabel: data.user.roleLabel,
            displayName: data.user.displayName,
            email: data.user.email,
            token: data.token,
          };
          setUser(profile);
          return profile;
        }
      } else if (response.status === 401) {
        throw new Error('Invalid User ID or Password. Please verify your credentials.');
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('Invalid User ID')) {
        throw err;
      }
      // Fall through to local account verification if server route is not reachable
    }

    // 2. Fallback credential check
    const matched = LOCAL_ACCOUNTS.find(
      (account) => account.identifiers.includes(normalizedId) && account.password === trimmedPassword,
    );
    if (!matched) {
      throw new Error('Invalid User ID or Password. Please verify your credentials.');
    }

    const fallbackDevToken = (await getDevToken()) || 'dev-token';
    const cleanBaseToken = fallbackDevToken.replace(/:(admin|medical-officer)$/, '');
    const profile: AdminUserProfile = {
      id: matched.email,
      role: matched.role,
      roleLabel: matched.roleLabel,
      displayName: matched.displayName,
      email: matched.email,
      token: `${cleanBaseToken}:${matched.tokenSuffix}`,
    };
    setUser(profile);
    return profile;
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        hasFullAdminAccess: user?.role === 'ADMIN',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

