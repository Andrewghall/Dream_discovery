'use client';

import { useState, useEffect, useCallback } from 'react';

interface Licence {
  id: string;
  email: string;
  name: string;
  title: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export function ExecLicenceManager({ orgId }: { orgId: string }) {
  const [licences, setLicences] = useState<Licence[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}/exec-licences`);
      if (res.ok) {
        const data = await res.json() as { licences: Licence[] };
        setLicences(data.licences);
      }
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setTempPassword('');
    setCreating(true);
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}/exec-licences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, title: title || undefined }),
      });
      const data = await res.json() as { error?: string; tempPassword?: string };
      if (!res.ok) { setCreateError(data.error ?? 'Failed to create licence'); return; }
      setTempPassword(data.tempPassword ?? '');
      setName(''); setEmail(''); setTitle('');
      void load();
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (licenceId: string) => {
    await fetch(`/api/admin/organizations/${orgId}/exec-licences/${licenceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'revoke' }),
    });
    void load();
  };

  const handleReactivate = async (licenceId: string) => {
    await fetch(`/api/admin/organizations/${orgId}/exec-licences/${licenceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reactivate' }),
    });
    void load();
  };

  const copyPassword = async () => {
    await navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold text-gray-900">Executive Licences</h3>

      {/* Temp password display */}
      {tempPassword && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-green-800 mb-2">Licence created — copy this password now. It will not be shown again.</p>
          <div className="flex items-center gap-3">
            <code className="flex-1 text-sm font-mono bg-white border border-green-200 rounded-lg px-3 py-2 text-green-900">{tempPassword}</code>
            <button
              onClick={copyPassword}
              className="px-3 py-2 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {/* Existing licences */}
      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : licences.length === 0 ? (
        <p className="text-sm text-gray-400">No executive licences yet.</p>
      ) : (
        <div className="space-y-2">
          {licences.map(l => (
            <div key={l.id} className="flex items-center justify-between gap-4 border border-gray-100 rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{l.name}</p>
                <p className="text-xs text-gray-400">{l.email}{l.title ? ` · ${l.title}` : ''}</p>
                {l.lastLoginAt && (
                  <p className="text-[11px] text-gray-300 mt-0.5">
                    Last login: {new Date(l.lastLoginAt).toLocaleDateString('en-GB')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  l.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                }`}>
                  {l.isActive ? 'Active' : 'Revoked'}
                </span>
                {l.isActive ? (
                  <button
                    onClick={() => handleRevoke(l.id)}
                    className="text-xs text-red-500 hover:text-red-700 transition-colors"
                  >
                    Revoke
                  </button>
                ) : (
                  <button
                    onClick={() => handleReactivate(l.id)}
                    className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
                  >
                    Reactivate
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create form */}
      <div className="border border-gray-100 rounded-xl p-5">
        <p className="text-xs font-semibold text-gray-700 mb-4">Add Executive Licence</p>
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Full Name *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                placeholder="Jane Smith"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Email *</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                placeholder="jane@company.com"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Job Title (optional)</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              placeholder="Chief Operating Officer"
            />
          </div>
          {createError && <p className="text-xs text-red-500">{createError}</p>}
          <button
            type="submit"
            disabled={creating}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {creating ? 'Creating…' : 'Create Licence'}
          </button>
        </form>
      </div>
    </div>
  );
}
