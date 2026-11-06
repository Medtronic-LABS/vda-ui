import { FormEvent, ReactNode, useEffect, useState } from 'react';
import {
  createSyntheticPatient,
  deleteSyntheticPatient,
  listPatientAdherence,
  listPatientMedications,
  listPrescriptions,
  listSyntheticPatients,
  updateSyntheticPatient,
} from '../api/vda';

type PatientForm = {
  name: string;
  age: string;
  dateOfBirth: string;
  gender: string;
  state: string;
  district: string;
  city: string;
  locality: string;
  language: string;
  clinicalProfile: string;
};

const exampleProfile = {
  diagnoses: [{ name: 'Type 2 Diabetes' }, { name: 'Hypertension' }],
  medications: [
    { name: 'Metformin', dosage: '500 mg', frequency: 'Twice daily', instructions: 'Take with meals.' },
    { name: 'Telmisartan', dosage: '40 mg', frequency: 'Once daily', instructions: 'Take in morning.' },
  ],
  allergies: [],
  labResults: [{ name: 'HbA1c', value: '7.2', unit: '%' }],
  prescriptions: [],
  encounters: [],
};

const emptyForm = (): PatientForm => ({
  name: '',
  age: '',
  dateOfBirth: '',
  gender: 'Male',
  state: '',
  district: '',
  city: '',
  locality: '',
  language: 'hi',
  clinicalProfile: JSON.stringify(exampleProfile, null, 2),
});

export default function SyntheticPatients() {
  const [patients, setPatients] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [selected, setSelected] = useState<any | null>(null);
  const [details, setDetails] = useState<{ medications: any[]; prescriptions: any[]; adherence: any[] } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const load = () => {
    setLoading(true);
    listSyntheticPatients()
      .then(setPatients)
      .catch((e) => setError('Unable to load synthetic patients.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const field = (key: keyof PatientForm) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const edit = (patient: any) => {
    setEditing(patient.id);
    setForm({
      name: patient.name || '',
      age: String(patient.age || ''),
      dateOfBirth: patient.dateOfBirth || '',
      gender: patient.gender || 'Male',
      state: patient.state || '',
      district: patient.district || '',
      city: patient.city || '',
      locality: patient.locality || '',
      language: patient.language || 'hi',
      clinicalProfile: JSON.stringify(patient.clinicalProfile || {}, null, 2),
    });
  };

  const view = async (patient: any) => {
    setSelected(patient);
    setDetails(null);
    setLoadingDetails(true);
    try {
      const [medications, prescriptions, adherence] = await Promise.all([
        listPatientMedications(undefined, patient.id),
        listPrescriptions(undefined, patient.id),
        listPatientAdherence(undefined, patient.id),
      ]);
      setDetails({ medications, prescriptions, adherence });
      setError('');
    } catch (e: any) {
      setError('Unable to load patient details.');
    } finally {
      setLoadingDetails(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    try {
      const clinicalProfile = JSON.parse(form.clinicalProfile);
      const body = {
        ...form,
        age: Number(form.age),
        dateOfBirth: form.dateOfBirth || null,
        city: form.city || null,
        locality: form.locality || null,
        clinicalProfile,
      };
      const request = editing
        ? updateSyntheticPatient(undefined, editing, body)
        : createSyntheticPatient(undefined, body);
      request
        .then(() => {
          setEditing(null);
          setForm(emptyForm());
          load();
        })
        .catch((e) => setError('Failed to save synthetic patient profile.'));
    } catch {
      setError('Clinical profile must be valid JSON.');
    }
  };

  const recordList = (items: any[], empty: string, render: (item: any, index: number) => ReactNode) =>
    items.length ? <ul>{items.map(render)}</ul> : <p>{empty}</p>;

  const patientSummary = (patient: any) => {
    const profile = patient.clinicalProfile || {};
    const conditions = (profile.diagnoses || []).map((item: any) => item.name).filter(Boolean);
    const medications = (profile.medications || []).map((item: any) => [item.name, item.dosage].filter(Boolean).join(' ')).filter(Boolean);
    const latestLab = (profile.labResults || [])[0];
    return { conditions, medications, latestLab };
  };

  const selectedProfile = selected?.clinicalProfile || {};
  const selectedDetails = !selected ? null : (
    <section className="panel">
      <h2>{selected.name}</h2>
      {loadingDetails ? (
        <p>Loading patient records...</p>
      ) : (
        <>
          <h3>Demographics</h3>
          <p>
            {selected.name} • {selected.dateOfBirth || `${selected.age || 'Age unavailable'} years`} • {selected.gender || 'Gender unavailable'} • {[selected.locality, selected.city, selected.district, selected.state].filter(Boolean).join(', ') || 'Location unavailable'}
          </p>
          <h3>Conditions</h3>
          {recordList(selectedProfile.diagnoses || [], 'No conditions recorded.', (item, index) => <li key={index}>{item.name || 'Unnamed condition'}</li>)}
          <h3>Medications</h3>
          {recordList(details?.medications || [], 'No active or confirmed medications recorded.', (item, index) => <li key={item.id || index}>{item.name || 'Unnamed medication'}{item.strength ? ` ${item.strength}` : ''}{item.dosage ? ` • ${item.dosage}` : ''}{item.frequency ? ` • ${item.frequency}` : ''}{item.timing ? ` • ${item.timing}` : ''}{item.status ? ` • ${item.status}` : ''}</li>)}
          <h3>Labs</h3>
          {recordList(selectedProfile.labResults || [], 'No lab results recorded.', (item, index) => <li key={index}>{item.name || 'Unnamed result'}: {[item.value, item.unit].filter(Boolean).join(' ') || 'Value unavailable'}</li>)}
          <h3>Allergies</h3>
          {recordList(selectedProfile.allergies || [], 'No recorded allergies.', (item, index) => <li key={index}>{item.name || item}</li>)}
          <h3>Prescriptions</h3>
          {recordList(details?.prescriptions || [], 'No prescription records.', (item, index) => <li key={item.id || index}>{item.prescriptionId || item.id || 'Reference unavailable'} • {item.extractionStatus || 'Status unavailable'} • {item.prescriptionDate || item.createdAt || 'Date unavailable'} • {item.filename || item.sourceDocumentId || 'Source unavailable'}</li>)}
        </>
      )}
    </section>
  );

  return (
    <>
      {selectedDetails}
      <h1>Test Patients</h1>
      <p style={{ marginTop: 0, color: '#5b7066' }}>Test data only, not real patients.</p>
      {error && <p role="alert" style={{ color: '#ef4444' }}>{error}</p>}

      <section className="panel">
        <h2>{editing ? 'Edit test patient' : 'New test patient'}</h2>
        <form onSubmit={submit}>
          <input required placeholder="Name" value={form.name} onChange={(e) => field('name')(e.target.value)} />
          <input required type="number" min="0" placeholder="Age" value={form.age} onChange={(e) => field('age')(e.target.value)} />
          <input type="date" value={form.dateOfBirth} onChange={(e) => field('dateOfBirth')(e.target.value)} />
          <input required placeholder="Sex" value={form.gender} onChange={(e) => field('gender')(e.target.value)} />
          <input required placeholder="State" value={form.state} onChange={(e) => field('state')(e.target.value)} />
          <input required placeholder="District" value={form.district} onChange={(e) => field('district')(e.target.value)} />
          <input placeholder="City" value={form.city} onChange={(e) => field('city')(e.target.value)} />
          <input placeholder="Locality" value={form.locality} onChange={(e) => field('locality')(e.target.value)} />
          <select value={form.language} onChange={(e) => field('language')(e.target.value)}>
            <option value="hi">Hindi</option>
            <option value="en">English</option>
          </select>
          <textarea aria-label="Clinical profile JSON" value={form.clinicalProfile} onChange={(e) => field('clinicalProfile')(e.target.value)} rows={10} />
          <button type="submit">{editing ? 'Save changes' : 'Create patient'}</button>
          {editing && (
            <button type="button" className="secondary" onClick={() => { setEditing(null); setForm(emptyForm()); }}>
              Cancel
            </button>
          )}
        </form>
      </section>

      <section className="panel">
        <h2>Profiles</h2>
        {loading ? (
          <p>Loading patient profiles...</p>
        ) : (
          <div className="patient-cards">
            {patients.map((p) => {
              const summary = patientSummary(p);
              return (
                <article key={p.id}>
                  <h3 style={{ margin: 0 }}>{p.name}</h3>
                  <p className="patient-card-meta" style={{ marginTop: '8px' }}>
                    Age: {p.age || 'Not recorded'} • {[p.district, p.state].filter(Boolean).join(', ') || 'Location unavailable'}
                  </p>
                  <p>
                    <b>Conditions:</b> {summary.conditions.join(', ') || 'No conditions recorded.'}
                  </p>
                  <p>
                    <b>Medications:</b> {summary.medications.join(', ') || 'No medications recorded.'}
                  </p>
                  <p>
                    <b>Latest lab:</b> {summary.latestLab ? `${summary.latestLab.name}: ${[summary.latestLab.value, summary.latestLab.unit].filter(Boolean).join(' ')}` : 'No lab results recorded.'}
                  </p>
                  <div className="patient-card-actions">
                    {/* Temporarily disabled: Admin/frontend VDA chat UI.
                        Implementation retained for future use. */}
                    <button className="secondary" onClick={() => view(p)}>
                      View
                    </button>
                    <button className="secondary" onClick={() => edit(p)}>
                      Edit
                    </button>
                    <button
                      className="secondary"
                      onClick={() =>
                        deleteSyntheticPatient(undefined, p.id)
                          .then(() => {
                            if (selected?.id === p.id) {
                              setSelected(null);
                              setDetails(null);
                            }
                            load();
                          })
                          .catch((e) => setError('Could not delete patient profile.'))
                      }
                    >
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
