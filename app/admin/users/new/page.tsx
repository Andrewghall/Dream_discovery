'use client';

import { useState, useEffect } from 'react';
import { LoadingButton } from '@/components/ui/loading-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

interface Organization {
  id: string;
  name: string;
  maxSeats: number;
}

interface SessionInfo {
  role: string;
  organizationId: string | null;
  email: string;
}

export default function NewUserPage() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'TENANT_ADMIN',
    organizationId: '',
  });
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [seatInfo, setSeatInfo] = useState<{ used: number; max: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [emailSent, setEmailSent] = useState<boolean | null>(null);
  const [emailErrorMsg, setEmailErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()),
      fetch('/api/admin/organizations').then(r => r.json()),
    ]).then(([me, orgsData]) => {
      const sessionInfo: SessionInfo = { role: me.role, organizationId: me.organizationId, email: me.email };
      setSession(sessionInfo);

      const orgs: Organization[] = orgsData.organizations || [];
      setOrganizations(orgs);

      // For tenant admins, lock the org to their own
      if (me.role === 'TENANT_ADMIN' && me.organizationId) {
        setFormData(prev => ({ ...prev, organizationId: me.organizationId }));

        // Fetch seat usage from seat-info endpoint
        fetch('/api/admin/users/seat-info').then(r => r.json()).then(data => {
          if (data.used !== undefined && data.max !== undefined) {
            setSeatInfo({ used: data.used, max: data.max });
          }
        }).catch(() => null);
      }

      setPageLoading(false);
    }).catch(() => setPageLoading(false));
  }, []);

  const isPlatformAdmin = session?.role === 'PLATFORM_ADMIN';
  const isTenantAdmin = session?.role === 'TENANT_ADMIN';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setTemporaryPassword(data.temporaryPassword);
        setEmailSent(data.emailSent ?? null);
        setEmailErrorMsg(data.emailError ?? null);
      } else {
        setError(data.error || 'Failed to create user');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-500 rounded-full mx-auto flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">User Created!</h2>
            {emailSent === true && (
              <p className="text-gray-600 mb-4">
                Welcome email sent to <strong>{formData.email}</strong> ✓
              </p>
            )}
            {emailSent === false && (
              <div className="bg-orange-50 border border-orange-200 text-orange-800 rounded-lg p-3 mb-4 text-sm text-left">
                <strong>Email failed to send.</strong> Share the temporary password manually.<br/>
                {emailErrorMsg && <span className="text-xs mt-1 block opacity-75">{emailErrorMsg}</span>}
              </div>
            )}
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-sm font-medium text-yellow-800 mb-2">Temporary Password:</p>
            <p className="font-mono text-lg text-yellow-900 bg-white p-2 rounded border border-yellow-300">
              {temporaryPassword}
            </p>
            <p className="text-xs text-yellow-700 mt-2">
              Save this — it won&apos;t be shown again. The user should change it after first login.
            </p>
          </div>

          <div className="flex gap-3">
            <Link href="/admin/users" className="flex-1">
              <Button className="w-full" variant="outline">Back to Users</Button>
            </Link>
            <Button
              className="flex-1 bg-indigo-600 hover:bg-indigo-700"
              onClick={() => {
                setSuccess(false);
                setFormData({
                  email: '',
                  name: '',
                  role: 'TENANT_ADMIN',
                  organizationId: isTenantAdmin ? (session?.organizationId || '') : '',
                });
                setTemporaryPassword('');
              }}
            >
              Create Another
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
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
          <h1 className="text-3xl font-bold text-gray-900 mt-4">Create New User</h1>
          <p className="text-gray-600 mt-2">
            {isTenantAdmin
              ? 'Add a new user to your organisation'
              : 'Create a new platform or tenant administrator account'}
          </p>
        </div>

        {/* Seat usage banner for tenant admins */}
        {isTenantAdmin && seatInfo && (
          <div className={`mb-6 rounded-lg border px-4 py-3 text-sm flex items-center gap-2 ${
            seatInfo.used >= seatInfo.max
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-blue-50 border-blue-200 text-blue-700'
          }`}>
            <span>
              <strong>{seatInfo.used}</strong> of <strong>{seatInfo.max}</strong> seats used
              {seatInfo.used >= seatInfo.max && ' — seat limit reached. Contact admin@ethenta.com to increase your limit.'}
            </span>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Doe"
                required
                className="w-full"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
                required
                className="w-full"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
                disabled={loading}
              >
                <option value="TENANT_ADMIN">Tenant Admin — manages org, users &amp; workshops</option>
                <option value="TENANT_USER">Tenant User — runs workshops only</option>
                {isPlatformAdmin && (
                  <option value="PLATFORM_ADMIN">Platform Admin — full platform access</option>
                )}
              </select>
              <p className="text-sm text-gray-500">
                {formData.role === 'PLATFORM_ADMIN'
                  ? 'Can manage all tenants and platform settings'
                  : formData.role === 'TENANT_ADMIN'
                  ? 'Can manage their org, create users, and run workshops'
                  : 'Can run workshops but cannot manage users or settings'}
              </p>
            </div>

            {/* Org picker — only for platform admins */}
            {isPlatformAdmin && (formData.role === 'TENANT_ADMIN' || formData.role === 'TENANT_USER') && (
              <div className="space-y-2">
                <Label htmlFor="organizationId">Organization</Label>
                <select
                  id="organizationId"
                  value={formData.organizationId}
                  onChange={(e) => setFormData({ ...formData, organizationId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                  disabled={loading}
                >
                  <option value="">Select an organization</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* For tenant admins, show their org as read-only */}
            {isTenantAdmin && (
              <div className="space-y-2">
                <Label>Organisation</Label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-700 text-sm">
                  {organizations.find(o => o.id === session?.organizationId)?.name || 'Your organisation'}
                </div>
                <p className="text-xs text-gray-400">Users are always created in your organisation</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> A temporary password will be generated and sent to the user via email.
                They will be prompted to change it on first login.
              </p>
            </div>

            <div className="flex gap-3">
              <Link href="/admin/users" className="flex-1">
                <Button type="button" variant="outline" className="w-full" disabled={loading}>
                  Cancel
                </Button>
              </Link>
              <LoadingButton
                type="submit"
                className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                loading={loading}
                loadingText="Creating User..."
                disabled={isTenantAdmin && !!seatInfo && seatInfo.used >= seatInfo.max}
              >
                Create User
              </LoadingButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
