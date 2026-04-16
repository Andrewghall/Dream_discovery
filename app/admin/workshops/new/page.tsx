'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Building2, Globe, Target, Compass, Briefcase } from 'lucide-react';
import Link from 'next/link';
import { listEngagementTypes } from '@/lib/domain-packs';
import { INDUSTRY_OPTIONS } from '@/lib/cognition/industry-actor-model';

const ENGAGEMENT_TYPE_OPTIONS = listEngagementTypes();

type OrgOption = { id: string; name: string };

export default function NewWorkshopPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    businessContext: '',
    workshopType: 'CUSTOM',
    scheduledDate: '',
    responseDeadline: '',
    includeRegulation: true,
    // DREAM prep fields
    clientName: '',
    industry: '',
    companyWebsite: '',
    dreamTrack: 'ENTERPRISE' as 'ENTERPRISE' | 'DOMAIN',
    targetDomain: '',
    // Field Discovery / Diagnostic extension
    engagementType: '',
  });

  const isDream = formData.workshopType !== 'SALES';
  const isPlatformAdmin = userRole === 'PLATFORM_ADMIN';

  // Fetch user role + available orgs for PLATFORM_ADMIN
  useEffect(() => {
    (async () => {
      try {
        const meRes = await fetch('/api/auth/me');
        if (!meRes.ok) return;
        const me = await meRes.json();
        setUserRole(me.role || null);
        if (me.role === 'PLATFORM_ADMIN') {
          const orgRes = await fetch('/api/admin/organizations');
          if (orgRes.ok) {
            const orgData = await orgRes.json();
            const orgList = (orgData.organizations || orgData || []) as OrgOption[];
            setOrgs(orgList);
            if (orgList.length === 1) setSelectedOrgId(orgList[0].id);
          }
        }
      } catch { /* ignore */ }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/admin/workshops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          // PLATFORM_ADMIN must select an org for the workshop
          ...(isPlatformAdmin && selectedOrgId ? { organizationId: selectedOrgId } : {}),
          // Only send DREAM fields for DREAM workshops
          clientName: isDream ? formData.clientName || undefined : undefined,
          industry: isDream ? formData.industry || undefined : undefined,
          companyWebsite: isDream ? formData.companyWebsite || undefined : undefined,
          dreamTrack: isDream ? formData.dreamTrack : undefined,
          targetDomain: isDream && formData.dreamTrack === 'DOMAIN' ? formData.targetDomain || undefined : undefined,
          // Field Discovery / Diagnostic extension
          // domainPack is resolved server-side from industry + engagementType + dreamTrack
          engagementType: isDream && formData.engagementType ? formData.engagementType : undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (formData.workshopType === 'SALES') {
          router.push(`/sales/${data.workshop.id}/plan`);
        } else if (isDream && formData.clientName) {
          // DREAM workshop with client details → go straight to prep page
          router.push(`/admin/workshops/${data.workshop.id}/prep`);
        } else {
          router.push(`/admin/workshops/${data.workshop.id}`);
        }
      } else {
        const data = await response.json().catch(() => null);
        const detailsMessage =
          data?.details?.message ||
          (typeof data?.details === 'string' ? data.details : null) ||
          data?.error ||
          'Failed to create workshop';
        alert(detailsMessage);
      }
    } catch (error) {
      console.error('Error creating workshop:', error);
      alert('Failed to create workshop');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent">
      <div className="container max-w-3xl mx-auto px-4 py-8">
        <Link href="/admin">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>Create New Workshop</CardTitle>
            <CardDescription>
              Set up a new discovery workshop to gather insights from participants
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Workshop Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Q1 Strategic Planning Workshop"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>


              {/* ── Organization selector (PLATFORM_ADMIN only) ──── */}
              {isPlatformAdmin && orgs.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="organizationId">Organization *</Label>
                  <Select
                    value={selectedOrgId}
                    onValueChange={(value) => setSelectedOrgId(value)}
                  >
                    <SelectTrigger id="organizationId">
                      <SelectValue placeholder="Select organization..." />
                    </SelectTrigger>
                    <SelectContent>
                      {orgs.map((org) => (
                        <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Which organization should own this workshop?
                  </p>
                </div>
              )}

              {/* ── DREAM-specific prep fields ───────────────────── */}
              {isDream && (
                <div className="space-y-4 rounded-lg border border-blue-200 bg-blue-50/30 dark:border-blue-900 dark:bg-blue-950/20 p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="h-4 w-4 text-blue-600" />
                    <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-400">Client Intelligence</h3>
                  </div>
                  <p className="text-xs text-muted-foreground -mt-2 mb-3">
                    Provide client details so the AI agents can research the business and tailor Discovery questions
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="clientName">Client Name</Label>
                      <Input
                        id="clientName"
                        placeholder="e.g., Tesco, Barclays"
                        value={formData.clientName}
                        onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="industry">Industry</Label>
                      <Select
                        value={formData.industry}
                        onValueChange={(value) => setFormData({ ...formData, industry: value })}
                      >
                        <SelectTrigger id="industry">
                          <SelectValue placeholder="Select industry..." />
                        </SelectTrigger>
                        <SelectContent>
                          {INDUSTRY_OPTIONS.map((ind) => (
                            <SelectItem key={ind} value={ind}>
                              {ind}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="companyWebsite">
                      <span className="flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5" />
                        Company Website
                      </span>
                    </Label>
                    <Input
                      id="companyWebsite"
                      type="url"
                      placeholder="https://www.example.com"
                      value={formData.companyWebsite}
                      onChange={(e) => setFormData({ ...formData, companyWebsite: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      The Research Agent will use this to gather public context about the company
                    </p>
                  </div>

                  {/* DREAM Track */}
                  <div className="space-y-3">
                    <Label>
                      <span className="flex items-center gap-1.5">
                        <Target className="h-3.5 w-3.5" />
                        DREAM Track
                      </span>
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, dreamTrack: 'ENTERPRISE' })}
                        className={`text-left rounded-lg border-2 p-4 transition-all ${
                          formData.dreamTrack === 'ENTERPRISE'
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                            : 'border-gray-200 hover:border-gray-300 dark:border-gray-700'
                        }`}
                      >
                        <div className="text-sm font-semibold">Enterprise</div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Full end-to-end assessment across all 5 lenses. Rethink the entire business operation.
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, dreamTrack: 'DOMAIN' })}
                        className={`text-left rounded-lg border-2 p-4 transition-all ${
                          formData.dreamTrack === 'DOMAIN'
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                            : 'border-gray-200 hover:border-gray-300 dark:border-gray-700'
                        }`}
                      >
                        <div className="text-sm font-semibold">Domain</div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Focused on a specific business unit or function within the organisation.
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Target Domain -- only for DOMAIN track */}
                  {formData.dreamTrack === 'DOMAIN' && (
                    <div className="space-y-2">
                      <Label htmlFor="targetDomain">Target Domain</Label>
                      <Input
                        id="targetDomain"
                        placeholder="e.g., Customer Operations, Supply Chain, Digital Banking"
                        value={formData.targetDomain}
                        onChange={(e) => setFormData({ ...formData, targetDomain: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        The specific business unit or function this workshop will focus on
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* -- Diagnostic / Field Discovery Config (DREAM only) ---- */}
              {isDream && (
                <div className="space-y-4 rounded-lg border border-blue-200 bg-blue-50/30 dark:border-blue-900 dark:bg-blue-950/20 p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <Compass className="h-4 w-4 text-blue-600" />
                    <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-400">Diagnostic Configuration</h3>
                  </div>
                  <p className="text-xs text-muted-foreground -mt-2 mb-3">
                    Optional: configure for structured diagnostic mode with field discovery capture
                  </p>

                  <div className="space-y-2">
                    <Label htmlFor="engagementType">
                      <span className="flex items-center gap-1.5">
                        <Briefcase className="h-3.5 w-3.5" />
                        Engagement Type
                      </span>
                    </Label>
                    <Select
                      value={formData.engagementType}
                      onValueChange={(value) => setFormData({ ...formData, engagementType: value })}
                    >
                      <SelectTrigger id="engagementType">
                        <SelectValue placeholder="Select engagement type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {ENGAGEMENT_TYPE_OPTIONS.map((et) => (
                          <SelectItem key={et.key} value={et.key}>
                            {et.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Domain pack is resolved automatically from the selected industry and engagement type
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of the workshop goals..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessContext">Business Context</Label>
                <Textarea
                  id="businessContext"
                  placeholder="What business challenges or opportunities is this workshop addressing?"
                  value={formData.businessContext}
                  onChange={(e) => setFormData({ ...formData, businessContext: e.target.value })}
                  rows={4}
                />
                <p className="text-sm text-muted-foreground">
                  This context helps the AI facilitator ask more relevant questions
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="scheduledDate">Workshop Date</Label>
                  <Input
                    id="scheduledDate"
                    type="datetime-local"
                    value={formData.scheduledDate}
                    onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="responseDeadline">Response Deadline</Label>
                  <Input
                    id="responseDeadline"
                    type="datetime-local"
                    value={formData.responseDeadline}
                    onChange={(e) =>
                      setFormData({ ...formData, responseDeadline: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    When participants should complete discovery
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Optional Sections</Label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.includeRegulation}
                    onChange={(e) => setFormData({ ...formData, includeRegulation: e.target.checked })}
                  />
                  Include Regulation / Risk questions
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={loading || !formData.name}>
                  {loading ? 'Creating...' : 'Create Workshop'}
                </Button>
                <Link href="/admin">
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
