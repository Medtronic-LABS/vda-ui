import { FormEvent, useEffect, useState } from 'react';
import { getKnowledgeDocument, lifecycle, listDocs, uploadKnowledgeDocument } from '../../api/vda';

export default function Knowledge() {
  const [docs, setDocs] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [source, setSource] = useState('Admin Upload');
  const [domain, setDomain] = useState('clinical');
  const [category, setCategory] = useState('general_education');
  const [selected, setSelected] = useState<any>(null);

  const load = () => {
    setLoading(true);
    listDocs()
      .then(setDocs)
      .catch((e) => setError('Unable to load knowledge documents.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const identifier = (doc: any) => doc.id || doc.documentId;

  const upload = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) return;
    try {
      await uploadKnowledgeDocument(undefined, { title, source, domain, category, language: 'en' }, file);
      setFile(null);
      setTitle('');
      setError('');
      load();
    } catch (e: any) {
      setError(e.message || 'Upload failed.');
    }
  };

  const detail = (id: string) =>
    getKnowledgeDocument(undefined, id)
      .then((doc) => {
        setSelected(doc);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      })
      .catch((e) => setError('Unable to load document detail.'));

  return (
    <>
      <h1>Knowledge</h1>
      {error && (
        <p className="clinical-alert error" role="alert">{error}</p>
      )}

      <section className="panel">
        <h2>Upload</h2>
        <form onSubmit={upload} className="upload-form">
          <label>
            <span>Title</span>
            <input required value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            <span>Source</span>
            <input required value={source} onChange={(e) => setSource(e.target.value)} />
          </label>
          <label>
            <span>Domain</span>
            <input required value={domain} onChange={(e) => setDomain(e.target.value)} />
          </label>
          <label>
            <span>Category</span>
            <input required value={category} onChange={(e) => setCategory(e.target.value)} />
          </label>
          <label className="upload-file">
            <span>File</span>
            <input
              required
              type="file"
              accept=".pdf,.docx,.txt,.md,.json,.csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
          <button disabled={!file}>Upload</button>
        </form>
        <p className="panel-note">New documents are used only after you approve them.</p>
      </section>

      {selected && (
        <section className="panel">
          <div className="panel-heading">
            <h2>{selected.title}</h2>
            <button type="button" className="secondary" onClick={() => setSelected(null)}>Close</button>
          </div>
          <dl className="detail-list">
            <dt>Status</dt>
            <dd>{selected.status}</dd>
            <dt>Chunks</dt>
            <dd>{selected.chunks?.length ?? 0}</dd>
            <dt>Embeddings</dt>
            <dd>
              {(selected.chunks || []).length === 0
                ? 'Not processed'
                : (selected.chunks || []).every((chunk: any) => chunk.embedding)
                ? 'Complete'
                : `Incomplete (${(selected.chunks || []).filter((chunk: any) => Boolean(chunk.embedding)).length})`}
            </dd>
            <dt>Checksum</dt>
            <dd className="technical-id">{selected.checksum || 'Not available'}</dd>
          </dl>
        </section>
      )}

      <section className="panel">
        <h2>Documents</h2>
        {loading ? (
          <p>Loading knowledge documents...</p>
        ) : !docs.length ? (
          <p>No knowledge documents yet.</p>
        ) : (
          <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Document</th>
                <th>Domain</th>
                <th>Language</th>
                <th>Version</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={identifier(d)}>
                  <td>
                    <button type="button" className="link-button" onClick={() => detail(identifier(d))}>
                      {d.title}
                    </button>
                  </td>
                  <td>{d.domain}</td>
                  <td>{d.language}</td>
                  <td>{d.version}</td>
                  <td>
                    <span className="badge">{d.status}</span>
                  </td>
                  <td>
                    {d.status === 'UPLOADED' && (
                      <button onClick={() => lifecycle(undefined, identifier(d), 'process').then(load)}>
                        Process
                      </button>
                    )}
                    {d.status === 'REVIEW_REQUIRED' && (
                      <button onClick={() => lifecycle(undefined, identifier(d), 'approve').then(load)}>
                        Approve
                      </button>
                    )}
                    {d.status === 'APPROVED' && (
                      <button onClick={() => lifecycle(undefined, identifier(d), 'publish').then(load)}>
                        Publish
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </section>
    </>
  );
}
