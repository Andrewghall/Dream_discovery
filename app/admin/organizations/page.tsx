'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/ui/loading-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

interface Organization {
  id: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  maxSeats: number;
  billingEmail: string | null;
  adminName?: string | null;
}

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [availableLogos, setAvailableLogos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Organization | null>(null);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({ name: '', logoUrl: '', primaryColor: '', secondaryColor: '', maxSeats: '5', billingEmail: '', adminName: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<Organization | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const fetchOrgs = () => {
    setLoading(true);
    fetch('/api/admin/organizations')
      .then(res => res.json())
      .then(data => {
        setOrganizations(data.organizations || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrgs();
    fetch('/api/admin/public-assets')
      .then(res => res.json())
      .then(data => setAvailableLogos(data.images || []));
  }, []);

  const startEdit = (org: Organization) => {
    setEditing(org);
    setCreating(false);
    setFormData({
      name: org.name,
      logoUrl: org.logoUrl || '',
      primaryColor: org.primaryColor || '',
      secondaryColor: org.secondaryColor || '',
      maxSeats: String(org.maxSeats ?? 5),
      billingEmail: org.billingEmail || '',
      adminName: org.adminName || '',
    });
    setError('');
    setSuccess('');
  };

  const startCreate = () => {
    setCreating(true);
    setEditing(null);
    setFormData({ name: '', logoUrl: '', primaryColor: '', secondaryColor: '', maxSeats: '5', billingEmail: '', adminName: '' });
    setError('');
    setSuccess('');
  };

  const cancel = () => {
    // Revoke any blob preview URL
    if (pendingLogoFile && formData.logoUrl.startsWith('blob:')) {
      URL.revokeObjectURL(formData.logoUrl);
    }
    setPendingLogoFile(null);
    setEditing(null);
    setCreating(false);
    setError('');
    setSuccess('');
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const orgId = editing?.id;

    if (!orgId) {
      // Creating a new org — hold the file and show a local preview
      setPendingLogoFile(file);
      const previewUrl = URL.createObjectURL(file);
      setFormData(prev => ({ ...prev, logoUrl: previewUrl }));
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Editing an existing org — upload immediately
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('organizationId', orgId);
      const res = await fetch('/api/admin/organizations/upload-logo', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Upload failed');
      } else {
        setFormData(prev => ({ ...prev, logoUrl: data.logoUrl }));
      }
    } catch {
      setError('Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      const method = creating ? 'POST' : 'PATCH';
      // Strip blob: preview URLs before saving — the real URL comes after upload
      const saveData = { ...formData };
      if (saveData.logoUrl.startsWith('blob:')) {
        saveData.logoUrl = '';
      }
      const body = creating ? saveData : { id: editing!.id, ...saveData };

      const res = await fetch('/api/admin/organizations', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save');
      } else {
        // If we have a pending logo file, upload it now that the org exists
        if (creating && pendingLogoFile && data.organization?.id) {
          try {
            const fd = new FormData();
            fd.append('file', pendingLogoFile);
            fd.append('organizationId', data.organization.id);
            const uploadRes = await fetch('/api/admin/organizations/upload-logo', { method: 'POST', body: fd });
            const uploadData = await uploadRes.json();
            if (uploadRes.ok && uploadData.logoUrl) {
              // Update the org with the real logo URL
              await fetch('/api/admin/organizations', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: data.organization.id, logoUrl: uploadData.logoUrl }),
              });
            }
          } catch {
            // Non-fatal — org was created, logo upload just failed
            setError('Organisation created but logo upload failed. You can re-upload from the edit page.');
          } finally {
            setPendingLogoFile(null);
          }
        }

        if (creating) {
          if (data.emailSent) {
            setSuccess(`Organisation created! Welcome email with login credentials sent to ${formData.billingEmail} ✓`);
          } else if (data.emailError) {
            setError(`Organisation created but failed to send email: ${data.emailError}`);
          } else {
            setSuccess('Organisation created! (No admin email set — no email sent)');
          }
        } else {
          setSuccess('Organisation updated!');
        }
        setEditing(null);
        setCreating(false);
        fetchOrgs();
      }
    } catch {
      setError('An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || deleteConfirmName !== deleteTarget.name) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await fetch('/api/admin/organizations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteTarget.id }),
      });
      let data: { error?: string; success?: boolean } = {};
      try { data = await res.json(); } catch { /* non-JSON response */ }
      if (!res.ok) {
        setDeleteError(data.error || `Server error (${res.status})`);
      } else {
        setDeleteTarget(null);
        setDeleteConfirmName('');
        setSuccess(`"${deleteTarget.name}" has been deleted.`);
        fetchOrgs();
      }
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Network error — please retry');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Link href="/admin" className="text-indigo-600 hover:text-indigo-700 text-sm">← Back to Admin</Link>
            <h1 className="text-3xl font-bold text-gray-900 mt-4">Organizations</h1>
            <p className="text-gray-600 mt-1">Manage tenant organizations and their branding</p>
          </div>
          <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={startCreate}>
            + New Organization
          </Button>
        </div>

        {success && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
            {success}
          </div>
        )}

        {(creating || editing) && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{creating ? 'New Organization' : `Edit: ${editing!.name}`}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Organization Name *</Label>
                <Input
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. UpstreamWorks"
                />
              </div>

              <div className="space-y-2">
                <Label>Logo</Label>
                {availableLogos.length > 0 ? (
                  <div className="grid grid-cols-4 gap-3">
                    {availableLogos.map(logo => (
                      <button
                        key={logo}
                        type="button"
                        onClick={() => setFormData({ ...formData, logoUrl: logo })}
                        className={`border-2 rounded-lg p-2 flex flex-col items-center gap-1 hover:border-indigo-400 transition-colors ${
                          formData.logoUrl === logo ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 bg-white'
                        }`}
                      >
                        <img src={logo} alt={logo} className="h-8 w-auto object-contain" />
                        <span className="text-xs text-gray-500 truncate w-full text-center">{logo.replace('/', '')}</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, logoUrl: '' })}
                      className={`border-2 rounded-lg p-2 flex flex-col items-center justify-center gap-1 hover:border-gray-400 transition-colors ${
                        !formData.logoUrl ? 'border-gray-400 bg-gray-100' : 'border-gray-200 bg-white'
                      }`}
                    >
                      <span className="text-gray-400 text-xl">∅</span>
                      <span className="text-xs text-gray-500">None</span>
                    </button>
                  </div>
                ) : (
                  <Input
                    value={formData.logoUrl}
                    onChange={e => setFormData({ ...formData, logoUrl: e.target.value })}
                    placeholder="/logo.png"
                  />
                )}
                <div className="mt-2 flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                  <LoadingButton
                    type="button"
                    variant="outline"
                    size="sm"
                    loading={uploading}
                    loadingText="Uploading..."
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Upload from computer
                  </LoadingButton>
                </div>
                {formData.logoUrl && (
                  <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
                    <span>Selected:</span>
                    <img src={formData.logoUrl} alt="Selected logo" className="h-6 w-auto" />
                    <code className="text-xs bg-gray-100 px-1 rounded">{formData.logoUrl.startsWith('http') ? formData.logoUrl.split('/').pop() : formData.logoUrl}</code>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Primary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      value={formData.primaryColor}
                      onChange={e => setFormData({ ...formData, primaryColor: e.target.value })}
                      placeholder="#4a90a4"
                    />
                    {formData.primaryColor && (
                      <div className="w-10 h-10 rounded border flex-shrink-0" style={{ backgroundColor: formData.primaryColor }} />
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Secondary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      value={formData.secondaryColor}
                      onChange={e => setFormData({ ...formData, secondaryColor: e.target.value })}
                      placeholder="#1a1a2e"
                    />
                    {formData.secondaryColor && (
                      <div className="w-10 h-10 rounded border flex-shrink-0" style={{ backgroundColor: formData.secondaryColor }} />
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Admin Contact Name</Label>
                  <Input
                    type="text"
                    value={formData.adminName}
                    onChange={e => setFormData({ ...formData, adminName: e.target.value })}
                    placeholder="Andrew Hall"
                  />
                  <p className="text-xs text-gray-400">Used to personalise the onboarding email</p>
                </div>
                <div className="space-y-2">
                  <Label>Admin Email</Label>
                  <Input
                    type="email"
                    value={formData.billingEmail}
                    onChange={e => setFormData({ ...formData, billingEmail: e.target.value })}
                    placeholder="admin@company.com"
                  />
                  <p className="text-xs text-gray-400">Onboarding email will be sent here</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Seat Limit</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.maxSeats}
                    onChange={e => setFormData({ ...formData, maxSeats: e.target.value })}
                    placeholder="5"
                  />
                  <p className="text-xs text-gray-400">Max number of user accounts for this org</p>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={cancel}>Cancel</Button>
                <LoadingButton className="bg-indigo-600 hover:bg-indigo-700" onClick={handleSave} loading={saving} loadingText="Saving...">
                  Save Organization
                </LoadingButton>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="text-gray-500">Loading organizations...</div>
        ) : organizations.length === 0 ? (
          <div className="text-gray-500">No organizations yet. Create one above.</div>
        ) : (
          <div className="space-y-3">
            {organizations.map(org => (
              <Card key={org.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    {org.logoUrl ? (
                      <img src={org.logoUrl} alt={org.name} className="h-8 w-auto" onError={e => (e.currentTarget.style.display = 'none')} />
                    ) : (
                      <div className="h-8 w-8 bg-gray-200 rounded" />
                    )}
                    <div>
                      <div className="font-medium">{org.name}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-3 mt-1">
                        {org.primaryColor && (
                          <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded-full inline-block border" style={{ backgroundColor: org.primaryColor }} />
                            {org.primaryColor}
                          </span>
                        )}
                        <span>{org.maxSeats} seats</span>
                        {org.billingEmail && <span>{org.billingEmail}</span>}
                        {org.logoUrl && <span>Logo ✓</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => startEdit(org)}>Edit Branding</Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-400"
                      onClick={() => { setDeleteTarget(org); setDeleteConfirmName(''); setDeleteError(''); }}
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Delete Organisation</h2>
                <p className="text-sm text-gray-600 mt-1">
                  This will permanently delete <strong>{deleteTarget.name}</strong> and all its workshops and data.
                  Any users in this org will be unlinked but not deleted.
                </p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
              This action <strong>cannot be undone</strong>.
            </div>

            <div className="space-y-2 mb-5">
              <Label htmlFor="confirmName" className="text-sm font-medium text-gray-700">
                Type <span className="font-mono font-bold">{deleteTarget.name}</span> to confirm
              </Label>
              <Input
                id="confirmName"
                value={deleteConfirmName}
                onChange={e => setDeleteConfirmName(e.target.value)}
                placeholder={deleteTarget.name}
                className="font-mono"
                disabled={deleting}
              />
            </div>

            {deleteError && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                {deleteError}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setDeleteTarget(null); setDeleteConfirmName(''); setDeleteError(''); }}
                disabled={deleting}
              >
                Cancel
              </Button>
              <LoadingButton
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={handleDelete}
                loading={deleting}
                loadingText="Deleting..."
                disabled={deleteConfirmName !== deleteTarget.name}
              >
                Delete Organisation
              </LoadingButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
