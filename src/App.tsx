import { Activity, BookOpen, HeartPulse, ShieldAlert } from 'lucide-react';
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Patient from './features/patient-vda/Patient';
import Knowledge from './features/knowledge/Knowledge';
import { Agents, Conversations, Dashboard, Health, RagQuality, Search } from './pages/AdminPages';
import Facilities from './pages/Facilities';
import Schemes from './pages/Schemes';
import SyntheticPatients from './pages/SyntheticPatients';
import Medications from './pages/Medications';
import Prescriptions from './pages/Prescriptions';
import ClinicalEscalations from './pages/ClinicalEscalations';
import { getOpenClinicalEscalationCount } from './api/vda';

const Landing = () => { const navigate = useNavigate(); return <main className="landing"><HeartPulse size={45}/><h1>VDA Health</h1><p>Choose a local development experience.</p><button onClick={() => navigate('/vda')}>Open Patient VDA</button><button className="secondary" onClick={() => navigate('/admin/dashboard')}>Open Admin Dashboard</button></main>; };
function EscalationNav(){const [open,setOpen]=useState<number | null>(null); useEffect(()=>{void getOpenClinicalEscalationCount().then((result)=>setOpen(result.open)).catch(()=>setOpen(null));},[]); return <NavLink to="/admin/escalations"><ShieldAlert/>Clinical Escalations {open !== null && <span className="nav-badge">{open}</span>}</NavLink>}
function Admin(){return <main className="admin"><aside><h2>VDA <small>ADMIN</small></h2><NavLink to="/admin/dashboard"><Activity/>Dashboard</NavLink><NavLink to="/admin/knowledge"><BookOpen/>Knowledge</NavLink><NavLink to="/admin/patients"><HeartPulse/>Synthetic Patients</NavLink><EscalationNav/><NavLink to="/admin/rag-quality"><Activity/>RAG Quality</NavLink></aside><section className="admin-main"><Routes><Route path="dashboard" element={<Dashboard/>}/><Route path="knowledge" element={<Knowledge/>}/><Route path="knowledge/:id" element={<Knowledge/>}/><Route path="knowledge/search" element={<Search/>}/><Route path="rag-quality" element={<RagQuality/>}/><Route path="agents" element={<Agents/>}/><Route path="patients" element={<SyntheticPatients/>}/><Route path="escalations" element={<ClinicalEscalations/>}/><Route path="prescriptions" element={<Prescriptions/>}/><Route path="medications" element={<Medications/>}/><Route path="adherence" element={<Medications/>}/><Route path="facilities" element={<Facilities/>}/><Route path="schemes" element={<Schemes/>}/><Route path="conversations" element={<Conversations/>}/><Route path="health" element={<Health/>}/></Routes></section></main>}
export default function App(){return <Routes><Route path="/" element={<Landing/>}/><Route path="/vda" element={<Patient/>}/><Route path="/vda/chat" element={<Patient/>}/><Route path="/vda/session/:sessionId" element={<Patient/>}/><Route path="/admin/*" element={<Admin/>}/></Routes>}
