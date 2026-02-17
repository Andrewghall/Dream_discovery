'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/ui/loading-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

interface Organization {
  id: string;
  name: string;
}

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  organizationId: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  organization: Organization | null;
}

export default function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: '',
    organizationId: '',
    isActive: true,
  });

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/users/${id}`).then(r => r.json()),
      fetch('/api/admin/organizations').then(r => r.json()),
    ]).then(([userData, orgsData]) => {
      if (userData.user) {
        const u = userData.user as UserData;
        setUser(u);
        setFormData({
          name: u.name,
          email: u.email,
          role: u.role,
          organizationId: u.organizationId || '',
          isActive: u.isActive,
        });
      } else {
        setError('User not found');
      }
      setOrganizations(orgsData.organizations || []);
      setLoading(false);
    }).catch(() => {
      setError('Failed to load user');
      setLoading(false);
    });
  }, [id]);

  const handleSave = async () => {
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          role: formData.role,
          organizationId: (formData.role === 'TENANT_ADMIN' || formData.role === 'TENANT_USER')
            ? formData.organizationId || null
            : null,
          isActive: formData.isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save');
      } else {
        setSuccess('User updated successfully');
        setUser(data.user);
      }
    } catch {
      setError('An error occurred');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'User not found'}</p>
          <Link href="/admin/users"><Button variant="outline">Back to Users</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Link href="/admin/users" className="text-indigo-600 hover:text-indigo-700 text-sm">
            ← Back to Users
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-4">Edit User</h1>
          <p className="text-gray-500 text-sm mt-1">
            Created {new Date(user.createdAt).toLocaleDateString()} ·{' '}
            Last login: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
              {success}
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="Full name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@company.com"
            />
            <p className="text-xs text-gray-400">Changing email updates their login address. A notification is NOT automatically sent.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <select
              id="role"
              value={formData.role}
              onChange={e => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="TENANT_ADMIN">Tenant Admin — manages org, users, workshops</option>
              <option value="TENANT_USER">Tenant User — runs workshops only</option>
              <option value="PLATFORM_ADMIN">Platform Admin — full platform access</option>
            </select>
          </div>

          {(formData.role === 'TENANT_ADMIN' || formData.role === 'TENANT_USER') && (
            <div className="space-y-2">
              <Label htmlFor="organizationId">Organization</Label>
              <select
                id="organizationId"
                value={formData.organizationId}
                onChange={e => setFormData({ ...formData, organizationId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">— Select organization —</option>
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-3">
            <input
              id="isActive"
              type="checkbox"
              checked={formData.isActive}
              onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
              className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
            />
            <Label htmlFor="isActive" className="cursor-pointer">
              Account active — unchecking this prevents the user from logging in
            </Label>
          </div>

          <div className="flex gap-3 pt-2">
            <Link href="/admin/users" className="flex-1">
              <Button type="button" variant="outline" className="w-full">Cancel</Button>
            </Link>
            <LoadingButton
              className="flex-1 bg-indigo-600 hover:bg-indigo-700"
              onClick={handleSave}
              loading={saving}
              loadingText="Saving..."
            >
              Save Changes
            </LoadingButton>
          </div>
        </div>
      </div>
    </div>
  );
}
