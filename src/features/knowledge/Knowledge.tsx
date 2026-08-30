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
      .then(setSelected)
      .catch((e) => setError('Unable to load document detail.'));

  return (
    <>
      <h1>Knowledge Base</h1>
      {error && (
        <section className="panel">
          <p style={{ color: '#ef4444' }}>{error}</p>
        </section>
      )}

      <section className="panel">
        <h2>Upload knowledge for governed review</h2>
        <form onSubmit={upload}>
          <input
            required
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            required
            placeholder="Source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
          <input
            required
            placeholder="Domain"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
          />
          <input
            required
            placeholder="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <input
            required
            type="file"
            accept=".pdf,.docx,.txt,.md,.json,.csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <button disabled={!file}>Upload & process review</button>
        </form>
        <p>Uploads remain lifecycle-controlled and are never activated automatically.</p>
      </section>

      <section className="panel">
        <h2>Lifecycle-controlled documents</h2>
        {loading ? (
          <p>Loading knowledge documents...</p>
        ) : !docs.length ? (
          <p>No knowledge documents yet.</p>
        ) : (
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
                    <button className="secondary" onClick={() => detail(identifier(d))}>
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
        )}
      </section>

      {selected && (
        <section className="panel">
          <h2>Document processing detail</h2>
          <p>
            <b>{selected.title}</b> • {selected.status}
          </p>
          <p>
            Checksum: {selected.checksum || 'Not available'} • Chunks: {selected.chunks?.length ?? 0} • Embeddings:{' '}
            {(selected.chunks || []).filter((chunk: any) => Boolean(chunk.embedding)).length}
          </p>
          <p>
            Embedding status:{' '}
            {(selected.chunks || []).length === 0
              ? 'Not processed'
              : (selected.chunks || []).every((chunk: any) => chunk.embedding)
              ? 'Complete'
              : 'Incomplete'}
          </p>
        </section>
      )}
    </>
  );
}
