import { Activity, BookOpen, ClipboardCheck, HeartPulse, LogOut, ShieldAlert } from 'lucide-react';
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Knowledge from './features/knowledge/Knowledge';
import { Agents, Conversations, Dashboard, Health, RagQuality, Search } from './pages/AdminPages';
import Facilities from './pages/Facilities';
import Schemes from './pages/Schemes';
import SyntheticPatients from './pages/SyntheticPatients';
import Medications from './pages/Medications';
import Prescriptions from './pages/Prescriptions';
import ClinicalEscalations from './pages/ClinicalEscalations';
import { getOpenClinicalEscalationCount, listPrescriptionWorklist } from './api/vda';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { AdminLogin } from './pages/AdminLogin';

function EscalationNav() {
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    void getOpenClinicalEscalationCount()
      .then((result) => {
        if (active) setOpen(result.open);
      })
      .catch(() => {
        if (active) setOpen(null);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <NavLink to="/admin/escalations">
      <ShieldAlert />
      Escalations {open !== null && open > 0 && <span className="nav-badge">{open}</span>}
    </NavLink>
  );
}

function PrescriptionNav() {
  const [pendingCount, setPendingCount] = useState<number>(0);
  useEffect(() => {
    let active = true;
    const poll = () => {
      void listPrescriptionWorklist(undefined)
        .then((rows) => {
          if (!active || !Array.isArray(rows)) return;
          const pending = rows.filter(
            (r) => r?.verificationStatus === 'PENDING_VERIFICATION' || r?.verificationStatus === 'UNVERIFIED',
          ).length;
          setPendingCount(pending);
        })
        .catch(() => {});
    };
    poll();
    const timer = window.setInterval(poll, 10000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);
  return (
    <NavLink to="/admin/prescriptions">
      <ClipboardCheck />
      Prescription Review {pendingCount > 0 && <span className="nav-badge">{pendingCount}</span>}
    </NavLink>
  );
}

function Admin() {
  const { user, logout, hasFullAdminAccess } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return <AdminLogin />;
  }

  return (
    <main className="admin">
      <aside className="admin-sidebar">
        <div>
          <h2>Sehat Saathi</h2>
          <div className="sidebar-user-card">
            <strong>{user.displayName}</strong>
            <small>{user.role === 'ADMIN' ? 'Administrator' : 'Medical Officer'}</small>
          </div>
          <nav className="sidebar-nav-links">
            {hasFullAdminAccess && (
              <>
                <NavLink to="/admin/dashboard">
                  <Activity />
                  Dashboard
                </NavLink>
                <NavLink to="/admin/knowledge">
                  <BookOpen />
                  Knowledge
                </NavLink>
                <NavLink to="/admin/patients">
                  <HeartPulse />
                  Test Patients
                </NavLink>
              </>
            )}
            <PrescriptionNav />
            {hasFullAdminAccess && (
              <>
                <EscalationNav />
                <NavLink to="/admin/rag-quality">
                  <Activity />
                  RAG Quality
                </NavLink>
              </>
            )}
          </nav>
        </div>

        <button
          type="button"
          className="sidebar-logout-btn"
          onClick={() => {
            logout();
            navigate('/admin/login', { replace: true });
          }}
        >
          <LogOut size={15} />
          <span>Sign Out</span>
        </button>
      </aside>

      <section className="admin-main">
        {hasFullAdminAccess ? (
          <Routes>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="knowledge" element={<Knowledge />} />
            <Route path="knowledge/:id" element={<Knowledge />} />
            <Route path="knowledge/search" element={<Search />} />
            <Route path="rag-quality" element={<RagQuality />} />
            <Route path="agents" element={<Agents />} />
            <Route path="patients" element={<SyntheticPatients />} />
            <Route path="escalations" element={<ClinicalEscalations />} />
            <Route path="prescriptions" element={<Prescriptions />} />
            <Route path="medications" element={<Medications />} />
            <Route path="adherence" element={<Medications />} />
            <Route path="facilities" element={<Facilities />} />
            <Route path="schemes" element={<Schemes />} />
            <Route path="conversations" element={<Conversations />} />
            <Route path="health" element={<Health />} />
            <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
          </Routes>
        ) : (
          <Routes>
            <Route path="prescriptions" element={<Prescriptions />} />
            <Route path="*" element={<Navigate to="/admin/prescriptions" replace />} />
          </Routes>
        )}
      </section>
    </main>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/admin/*" element={<Admin />} />
      </Routes>
    </AuthProvider>
  );
}
