import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export const AdminLogin: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!identifier.trim() || !password) {
      setError('Please enter both User ID and Password.');
      return;
    }
    setSubmitting(true);
    try {
      const profile = await login(identifier, password);
      if (profile.role === 'MEDICAL_OFFICER') {
        navigate('/admin/prescriptions', { replace: true });
      } else {
        navigate('/admin/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemoRole = (role: 'ADMIN' | 'MEDICAL_OFFICER') => {
    setError('');
    if (role === 'ADMIN') {
      setIdentifier('admin@vdahealth.org');
      setPassword('Admin@Vda2026');
    } else {
      setIdentifier('doctor@vdahealth.org');
      setPassword('Doctor@Vda2026');
    }
  };

  return (
    <main className="admin-login-shell">
      <div className="admin-login-card">
        <div className="admin-login-brand">
          <span className="admin-login-badge">VDA CLINICAL & GOVERNANCE PORTAL</span>
          <h1>Sign in to VDA Portal</h1>
          <p>Role-based access for System Administration and Clinical Prescription Verification.</p>
        </div>

        <form onSubmit={handleSubmit} className="admin-login-form">
          <label>
            <span>User ID / Email</span>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="e.g. doctor@vdahealth.org or admin@vdahealth.org"
              autoComplete="username"
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
            />
          </label>

          {error && <div className="clinical-alert error">{error}</div>}

          <button type="submit" className="admin-login-submit" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign In to Portal'}
          </button>
        </form>

        <div className="admin-login-roles-box">
          <div className="admin-login-roles-title">Configured Portal Roles (Click to Auto-Fill)</div>
          <div className="admin-login-role-cards">
            <button
              type="button"
              className="admin-role-preset"
              onClick={() => fillDemoRole('ADMIN')}
            >
              <div>
                <strong>System Administrator</strong>
                <span className="role-pill role-pill-admin">FULL ACCESS</span>
              </div>
              <small>ID: <code>admin@vdahealth.org</code> (or <code>admin</code>)</small>
              <small>PW: <code>Admin@Vda2026</code></small>
              <em>Access to all governance, knowledge, patients, escalations & prescriptions</em>
            </button>

            <button
              type="button"
              className="admin-role-preset"
              onClick={() => fillDemoRole('MEDICAL_OFFICER')}
            >
              <div>
                <strong>Medical Officer / Clinical Reviewer</strong>
                <span className="role-pill role-pill-medical">PRESCRIPTIONS ONLY</span>
              </div>
              <small>ID: <code>doctor@vdahealth.org</code> (or <code>doctor</code>)</small>
              <small>PW: <code>Doctor@Vda2026</code></small>
              <em>Restricted exclusively to Patient Prescription Review & Approval</em>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
};

