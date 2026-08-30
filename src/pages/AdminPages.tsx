import { useEffect, useState } from 'react';
import { dashboardSummary, health, ragQuality, runControlledEvaluation, searchKnowledge } from '../api/vda';

const percent = (value: unknown) =>
  typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : 'N/A';

export function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const summary = await dashboardSummary();
      setData(summary);
    } catch (e: any) {
      setError('Unable to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const value = (key: string) => (data && data[key] !== undefined ? data[key] : 'Unavailable');

  return (
    <>
      <h1>Dashboard</h1>
      {loading && (
        <section className="panel">
          <p>Loading dashboard...</p>
        </section>
      )}
      {error && (
        <section className="panel">
          <p style={{ color: '#ef4444' }}>{error}</p>
          <button className="secondary" onClick={load}>Retry</button>
        </section>
      )}
      {data && !loading && (
        <>
          <div className="tiles">
            <b>Knowledge Documents<br /><small>{value('knowledgeDocuments')}</small></b>
            <b>Active Documents<br /><small>{value('activeKnowledgeDocuments')}</small></b>
            <b>Embeddings<br /><small>{value('embeddings')}</small></b>
            <b>Synthetic Patients<br /><small>{value('syntheticPatients')}</small></b>
            <b>Active Sessions<br /><small>{value('activeSessions')}</small></b>
            <b>RAG Queries<br /><small>{value('ragQueries')}</small></b>
            <b>Safety Escalations<br /><small>{value('safetyEscalations')}</small></b>
            <b>Facilities<br /><small>{value('facilities')}</small></b>
          </div>
          <section className="panel">
            <p>All totals are derived live from local backend databases. Missing data is never estimated.</p>
          </section>
        </>
      )}
    </>
  );
}

export function Search() {
  const [q, setQ] = useState('');
  const [r, setR] = useState<any>(null);
  const [e, setE] = useState('');

  return (
    <>
      <h1>Knowledge Search</h1>
      <section className="panel">
        <form
          onSubmit={async (x) => {
            x.preventDefault();
            try {
              setR(await searchKnowledge(undefined, q));
              setE('');
            } catch (z: any) {
              setE('Search failed. Please try again.');
            }
          }}
        >
          <input
            placeholder="What does HbA1c indicate?"
            value={q}
            onChange={(x) => setQ(x.target.value)}
            required
          />
          <button>Search pgvector</button>
        </form>
        {e && <p style={{ color: '#ef4444' }}>{e}</p>}
      </section>
      {r && (
        <section className="panel">
          <p><b>Provider:</b> {r.providerType || 'Unavailable'}</p>
          {(r.matchedChunks || []).map((x: any) => (
            <article key={x.chunkId}>
              <b>{x.title}</b>
              <p>{x.content}</p>
              <small>{x.domain} • {x.language} • {x.documentVersion} • relevance {x.relevanceScore} • {x.source}</small>
            </article>
          ))}
        </section>
      )}
    </>
  );
}

export const Agents = () => {
  const agents = [
    ['LabReportAgent', 'Laboratory / diagnostic education', 'Clinical knowledge sources', 'Active'],
    ['MedicationAgent', 'Medication education', 'Structured ClinicalContext and medication data', 'Active'],
    ['DiagnosisAgent', 'Disease / clinical guidelines', 'Clinical knowledge sources', 'Active'],
    ['AdherenceAgent', 'Medication adherence', 'Structured ClinicalContext and medication data', 'Active'],
    ['SchemeAgent', 'Government schemes', 'Active knowledge sources when available', 'Active'],
    ['FacilityAgent', 'Healthcare facilities', 'Structured PostgreSQL facility data (not RAG)', 'Active'],
    ['ReferralAgent', 'Referral protocols', 'Referral knowledge sources', 'Active'],
    ['TeleconsultationAgent', 'Teleconsultation', 'N/A', 'Active'],
    ['GeneralHealthAgent', 'Preventive health / lifestyle', 'Clinical knowledge sources', 'Active'],
  ];
  return (
    <>
      <h1>Agents</h1>
      <section className="panel">
        <p>Read-only registry of registered domain agents in the VDA Orchestrator.</p>
        <table>
          <thead>
            <tr>
              <th>Agent</th>
              <th>Domain</th>
              <th>Knowledge availability</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <tr key={agent[0]}>
                {agent.map((value, index) => (
                  <td key={index}>{value}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
};

export const Conversations = () => (
  <>
    <h1>Conversations</h1>
    <section className="panel">
      <p>Conversation monitoring API active in development mode.</p>
    </section>
  </>
);

const ScoreCard = ({ label, value }: { label: string; value: string }) => (
  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
    <span style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>{label}</span>
    <strong style={{ fontSize: '1.4rem', color: '#38bdf8' }}>{value}</strong>
  </div>
);

export function RagQuality() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [evalNotice, setEvalNotice] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await ragQuality();
      setData(res);
    } catch (e: any) {
      setError('Unable to load RAG evaluation metrics.');
    } finally {
      setLoading(false);
    }
  };

  const handleRunEvaluation = async () => {
    setEvaluating(true);
    setEvalNotice('Running evaluation against 20 controlled dataset cases...');
    try {
      await runControlledEvaluation();
      setEvalNotice('Evaluation completed.');
      await load();
    } catch (e: any) {
      setEvalNotice('Evaluation could not be completed. Please try again.');
    } finally {
      setEvaluating(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const evalData = data?.evaluation;
  const operational = data?.operational;

  return (
    <>
      <h1>RAG Quality & Evaluation</h1>
      {loading && (
        <section className="panel">
          <p>Loading evaluation metrics...</p>
        </section>
      )}
      {error && (
        <section className="panel">
          <p style={{ color: '#ef4444' }}>{error}</p>
          <button className="secondary" onClick={load}>Retry</button>
        </section>
      )}
      {data && !loading && (
        <>
          {/* SECTION A — DEVELOPMENT RAG EVALUATION */}
          <section className="panel" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Development RAG Evaluation</h2>
                <small style={{ color: '#94a3b8' }}>Calculated from the controlled 20-case evaluation dataset.</small>
              </div>
              <button onClick={handleRunEvaluation} disabled={evaluating}>
                {evaluating ? 'Running evaluation...' : 'Run Evaluation'}
              </button>
            </div>

            {evalNotice && (
              <p style={{ padding: '8px 12px', background: 'rgba(56, 189, 248, 0.1)', borderRadius: '6px', border: '1px solid rgba(56,189,248,0.2)', marginBottom: '16px' }}>
                {evalNotice}
              </p>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <ScoreCard label="Context Precision" value={percent(evalData?.contextPrecision)} />
              <ScoreCard label="Context Recall" value={percent(evalData?.contextRecall)} />
              <ScoreCard label="Faithfulness" value={percent(evalData?.faithfulness)} />
              <ScoreCard label="Answer Relevancy" value={evalData?.answerRelevancy !== null && evalData?.answerRelevancy !== undefined ? percent(evalData?.answerRelevancy) : 'N/A — ground truth unavailable'} />
              <ScoreCard label="Escalation Recall" value={evalData?.escalationRecall !== null && evalData?.escalationRecall !== undefined ? percent(evalData?.escalationRecall) : 'N/A — no escalation cases'} />
            </div>

            <div className="tiles" style={{ marginBottom: '12px' }}>
              <b>Evaluation Cases<br /><small>{evalData?.totalCases || 20}</small></b>
              <b>Executed Cases<br /><small>{evalData?.executedCases ?? '0'}</small></b>
              <b>Successful<br /><small>{evalData?.successfulCases ?? '0'}</small></b>
              <b>Failed<br /><small>{evalData?.failedCases ?? '0'}</small></b>
              <b>Last Run<br /><small>{evalData?.lastRunAt ? new Date(evalData.lastRunAt).toLocaleTimeString() : 'Never'}</small></b>
            </div>

            <small style={{ color: '#64748b', display: 'block' }}>
              Deterministic evaluation against the controlled development dataset. These metrics are not official RAGAS judge scores.
            </small>
          </section>

          {/* SECTION B — OPERATIONAL RAG METRICS */}
          <section className="panel">
            <h2 style={{ fontSize: '1.25rem', marginBottom: '12px' }}>Operational RAG Metrics</h2>
            <div className="tiles" style={{ marginBottom: '16px' }}>
              <b>Total RAG Queries<br /><small>{operational?.totalEvaluationCases ?? data.evaluationCount}</small></b>
              <b>Retrieval Rate<br /><small>{percent(operational?.successfulRetrievalRate)}</small></b>
              <b>Citation Rate<br /><small>{percent(operational?.citationCoverageRate)}</small></b>
              <b>Avg Retrieval Latency<br /><small>{operational?.averageRetrievalLatencyMs ?? 'N/A'} ms</small></b>
              <b>Avg Retrieved Chunks<br /><small>{operational?.averageRetrievedChunks ?? 'N/A'}</small></b>
              <b>No-result Queries<br /><small>{operational?.failedCaseCount ?? 0}</small></b>
            </div>

            <h3>Recent privacy-minimized traces</h3>
            {!data.traces?.length ? (
              <p>No evaluations recorded yet.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Query</th>
                    <th>Intent / Domain</th>
                    <th>Chunks</th>
                    <th>Latency</th>
                    <th>Sources</th>
                  </tr>
                </thead>
                <tbody>
                  {data.traces.map((t: any) => (
                    <tr key={t.id}>
                      <td>{t.query}</td>
                      <td>{t.intent || 'N/A'} / {t.domain || 'N/A'}</td>
                      <td>{t.retrievedChunkCount}</td>
                      <td>{t.retrievalLatencyMs} ms</td>
                      <td>{(t.sources || []).map((s: any) => s.title).join(', ') || 'None'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </>
  );
}

export function Health() {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState('');
  return (
    <>
      <h1>System Health</h1>
      <section className="panel">
        <button
          onClick={async () => {
            try {
              setData({
                liveness: await health(undefined, 'liveness'),
                readiness: await health(undefined, 'readiness'),
              });
              setErr('');
            } catch (e: any) {
              setErr('Health check failed.');
            }
          }}
        >
          Check health
        </button>
        {err && <p style={{ color: '#ef4444' }}>{err}</p>}
        {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
      </section>
    </>
  );
}
