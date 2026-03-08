'use client';

import { use, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Save, Eye, Lock, Download, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAutoSave, type SaveStatus } from '@/hooks/useAutoSave';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StrategicTable } from '@/components/scratchpad/StrategicTable';
import { DesignPrinciples } from '@/components/scratchpad/DesignPrinciples';
import { LinkedIntelligence } from '@/components/scratchpad/LinkedIntelligence';
import { ScoreIndicator } from '@/components/scratchpad/ScoreIndicator';
import { ThreeHousesFramework } from '@/components/scratchpad/ThreeHousesFramework';
import { ThreeHousesFrameworkCompact } from '@/components/scratchpad/ThreeHousesFrameworkCompact';
import { ClientLogoUpload } from '@/components/scratchpad/ClientLogoUpload';
import { ExecutiveSummaryTab } from '@/components/scratchpad/ExecutiveSummaryTab';
import { DiscoveryOutputTab } from '@/components/scratchpad/DiscoveryOutputTab';
import { ReimaginOutputTab } from '@/components/scratchpad/ReimaginOutputTab';
import { ConstraintsTab } from '@/components/scratchpad/ConstraintsTab';
import { CommercialTab } from '@/components/scratchpad/CommercialTab';
import { PotentialSolutionTab } from '@/components/scratchpad/PotentialSolutionTab';
import { CustomerJourneyTab } from '@/components/scratchpad/CustomerJourneyTab';
import { SummaryTab } from '@/components/scratchpad/SummaryTab';
import { HemisphereOutputTab } from '@/components/scratchpad/HemisphereOutputTab';
import { WorkshopContextBanner } from '@/components/scratchpad/WorkshopContextBanner';
import { ScratchpadInquiryBar } from '@/components/scratchpad/ScratchpadInquiryBar';
import { composeActiveSections, buildSectionContext, type SectionDefinition } from '@/lib/output/section-registry';
import type { WorkshopArchetype } from '@/lib/output/archetype-classifier';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

interface ScratchpadData {
  id: string;
  workshopId: string;
  version: number;
  execSummary: any;
  discoveryOutput: any;
  reimagineContent: any;
  constraintsContent: any;
  potentialSolution: any;
  commercialContent: any;
  customerJourney: any;
  summaryContent: any;
  outputAssessment?: {
    primaryArchetype: WorkshopArchetype;
    secondaryArchetypes: WorkshopArchetype[];
    confidence: number;
    rationale: string;
    requiredSections: string[];
  } | null;
  solutionImageUrl?: string | null;
  clientLogoUrl?: string | null;
  status: 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED';
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

interface Workshop {
  id: string;
  name: string;
  status: string;
  description?: string | null;
  businessContext?: string | null;
  organization?: {
    id: string;
    name: string;
    logoUrl: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
  };
}

export default function ScratchpadPage({ params }: PageProps) {
  const { id: workshopId } = use(params);
  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [scratchpad, setScratchpad] = useState<ScratchpadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('exec-summary');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [commercialPassword, setCommercialPassword] = useState('');
  const [commercialUnlocked, setCommercialUnlocked] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showSetPasswordDialog, setShowSetPasswordDialog] = useState(false);
  const [newCommercialPassword, setNewCommercialPassword] = useState('');
  const [confirmCommercialPassword, setConfirmCommercialPassword] = useState('');
  const [saveVersion, setSaveVersion] = useState(0);

  useEffect(() => {
    fetchData();
  }, [workshopId]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch workshop details
      const workshopRes = await fetch(`/api/admin/workshops/${workshopId}`);
      if (workshopRes.ok) {
        const workshopData = await workshopRes.json();
        setWorkshop(workshopData.workshop);
      }

      // Fetch scratchpad data
      const scratchpadRes = await fetch(`/api/admin/workshops/${workshopId}/scratchpad`);
      if (scratchpadRes.ok) {
        const data = await scratchpadRes.json();
        setScratchpad(data.scratchpad);
        setHasPassword(!!data.hasCommercialPassword);
        // Auto-unlock commercial tab if no password has been set
        if (!data.hasCommercialPassword) {
          setCommercialUnlocked(true);
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-save: debounced save when any tab changes
  const autoSaveFn = useCallback(async () => {
    if (!scratchpad) return;
    const response = await fetch(`/api/admin/workshops/${workshopId}/scratchpad`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scratchpad),
    });
    if (!response.ok) throw new Error('Auto-save failed');
  }, [scratchpad, workshopId]);

  const saveStatus = useAutoSave(saveVersion, autoSaveFn);

  // Generic tab change handler — updates scratchpad state and bumps save version
  const handleTabChange = useCallback((field: keyof ScratchpadData) => (updated: any) => {
    setScratchpad((prev) => prev ? { ...prev, [field]: updated } : prev);
    setSaveVersion((v) => v + 1);
  }, []);

  const handleSave = async () => {
    if (!scratchpad) return;

    try {
      setSaving(true);
      const response = await fetch(`/api/admin/workshops/${workshopId}/scratchpad`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scratchpad),
      });

      if (response.ok) {
        toast.success('Scratchpad saved successfully');
        await fetchData();
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      console.error('Failed to save scratchpad:', error);
      toast.error('Failed to save scratchpad');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!confirm('Publish this scratchpad? This will make it viewable to stakeholders.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/workshops/${workshopId}/scratchpad/publish`, {
        method: 'POST',
      });

      if (response.ok) {
        toast.success('Scratchpad published successfully');
        await fetchData();
      } else {
        throw new Error('Failed to publish');
      }
    } catch (error) {
      console.error('Failed to publish scratchpad:', error);
      toast.error('Failed to publish scratchpad');
    }
  };

  const handleExportHTML = async () => {
    try {
      setExporting(true);

      const response = await fetch(`/api/admin/workshops/${workshopId}/export-html`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commercialPassword: commercialPassword || undefined }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to export');
      }

      // Get the blob
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${workshop?.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-report.zip` || 'workshop-report.zip';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Report exported! Upload the ZIP contents to your client\'s domain.');
    } catch (error) {
      console.error('Failed to export HTML:', error);
      toast.error(`Failed to export: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setExporting(false);
    }
  };

  const handleCommercialAccess = () => {
    setShowPasswordDialog(true);
  };

  const verifyCommercialPassword = async () => {
    try {
      const response = await fetch(`/api/admin/workshops/${workshopId}/scratchpad/verify-commercial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: commercialPassword }),
      });

      if (response.ok) {
        setCommercialUnlocked(true);
        setShowPasswordDialog(false);
        setActiveTab('commercial');
      } else {
        toast.error('Incorrect password');
      }
    } catch (error) {
      console.error('Failed to verify password:', error);
      toast.error('Failed to verify password');
    }
  };

  const setCommercialPasswordHandler = async () => {
    if (newCommercialPassword.length < 6) {
      toast.warning('Password must be at least 6 characters');
      return;
    }

    if (newCommercialPassword !== confirmCommercialPassword) {
      toast.warning('Passwords do not match');
      return;
    }

    try {
      const response = await fetch(`/api/admin/workshops/${workshopId}/scratchpad/set-commercial-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newCommercialPassword }),
      });

      if (response.ok) {
        toast.success('Commercial password set successfully');
        setShowSetPasswordDialog(false);
        setNewCommercialPassword('');
        setConfirmCommercialPassword('');
        setHasPassword(true);
        setCommercialUnlocked(true); // Auto-unlock after setting
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to set password');
      }
    } catch (error) {
      console.error('Failed to set password:', error);
      toast.error('Failed to set password');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading scratchpad...</p>
        </div>
      </div>
    );
  }

  if (!scratchpad) {
    // Auto-create a demo scratchpad for testing
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Card className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">No Scratchpad Found</h2>
            <p className="text-muted-foreground mb-6">
              This workshop doesn't have a scratchpad yet. Click below to create a demo scratchpad.
            </p>
            <Button
              onClick={async () => {
                try {
                  console.log('Creating demo scratchpad...');
                  // Create demo scratchpad
                  const response = await fetch(`/api/admin/workshops/${workshopId}/scratchpad`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      execSummary: { title: 'Demo Executive Summary' },
                      discoveryOutput: { sections: [] },
                    }),
                  });
                  console.log('Response:', response.status);
                  if (response.ok) {
                    const data = await response.json();
                    console.log('Scratchpad created:', data);
                    await fetchData();
                  } else {
                    const errorData = await response.json();
                    console.error('Error response:', errorData);
                    toast.error(errorData.error || 'Failed to create scratchpad');
                  }
                } catch (error) {
                  console.error('Failed to create demo scratchpad:', error);
                  toast.error('Failed to create demo scratchpad');
                }
              }}
            >
              Create Demo Scratchpad
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {(scratchpad?.clientLogoUrl || workshop?.organization?.logoUrl) && (
              <img
                src={scratchpad?.clientLogoUrl || workshop?.organization?.logoUrl || ''}
                alt={workshop?.organization?.name || 'Organization'}
                className="h-8 w-auto"
              />
            )}
            <div>
              <h1 className="text-lg font-bold tracking-tight">Download Report</h1>
              <p className="text-xs text-muted-foreground">
                {workshop?.organization?.name || workshop?.name || 'Workshop'} — editable output ready to export
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  const response = await fetch(`/api/admin/workshops/${workshopId}/scratchpad/load-demo`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ loadDemoData: false }),
                  });
                  if (response.ok) {
                    toast.success('Empty template loaded with 5 DREAM lenses');
                    await fetchData();
                  } else {
                    toast.error('Failed to load template');
                  }
                } catch (error) {
                  console.error('Failed to load template:', error);
                  toast.error('Error loading template');
                }
              }}
            >
              📋 Load Empty Template
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  const response = await fetch(`/api/admin/workshops/${workshopId}/scratchpad/load-demo`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ loadDemoData: true }),
                  });
                  if (response.ok) {
                    toast.success('Demo data loaded — TravelWise Contact Centre transformation');
                    await fetchData();
                  } else {
                    toast.error('Failed to load demo data');
                  }
                } catch (error) {
                  console.error('Failed to load demo data:', error);
                  toast.error('Error loading demo data');
                }
              }}
            >
              🎯 Load Demo Data
            </Button>
            {/* Auto-save status indicator */}
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1.5 text-xs text-blue-600 px-3 py-1.5 bg-blue-50 rounded-full">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving...
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1.5 text-xs text-green-600 px-3 py-1.5 bg-green-50 rounded-full">
                <CheckCircle2 className="h-3 w-3" />
                Saved
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="flex items-center gap-1.5 text-xs text-red-600 px-3 py-1.5 bg-red-50 rounded-full">
                <AlertCircle className="h-3 w-3" />
                Save failed
              </span>
            )}
            <Button variant="outline" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Draft'}
            </Button>
            <Button onClick={handlePublish} disabled={scratchpad.status === 'PUBLISHED'}>
              <Eye className="h-4 w-4 mr-2" />
              {scratchpad.status === 'PUBLISHED' ? 'Published' : 'Publish'}
            </Button>
            <Button
              onClick={handleExportHTML}
              disabled={exporting || !scratchpad}
              variant="default"
              className="bg-green-600 hover:bg-green-700"
            >
              <Download className="h-4 w-4 mr-2" />
              {exporting ? 'Exporting...' : 'Download for Client'}
            </Button>
          </div>
        </div>

        {/* Workshop Context Banner */}
        <WorkshopContextBanner
          workshopPurpose={workshop?.description}
          desiredOutcomes={workshop?.businessContext}
          archetype={scratchpad.outputAssessment?.primaryArchetype}
          confidence={scratchpad.outputAssessment?.confidence}
          rationale={scratchpad.outputAssessment?.rationale}
        />

        {/* Inquiry Bar */}
        <ScratchpadInquiryBar
          workshopId={workshopId}
          hasScratchpad={!!scratchpad}
          workshopPurpose={workshop?.description}
          desiredOutcomes={workshop?.businessContext}
        />

        {/* Dynamic Tabs */}
        <DynamicScratchpadTabs
          scratchpad={scratchpad}
          workshopId={workshopId}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          handleTabChange={handleTabChange}
          hasPassword={hasPassword}
          commercialUnlocked={commercialUnlocked}
          handleCommercialAccess={handleCommercialAccess}
        />
      </div>

      {/* Password Verification Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>Commercial Section Access</DialogTitle>
            <DialogDescription>
              Enter the password to access the commercial section.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={commercialPassword}
                onChange={(e) => setCommercialPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    verifyCommercialPassword();
                  }
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
                Cancel
              </Button>
              <Button onClick={verifyCommercialPassword}>
                Unlock
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Set Password Dialog */}
      <Dialog open={showSetPasswordDialog} onOpenChange={setShowSetPasswordDialog}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>Set Commercial Password</DialogTitle>
            <DialogDescription>
              Create or update the password to protect the commercial section. This password is required to view sensitive commercial information.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="At least 6 characters"
                value={newCommercialPassword}
                onChange={(e) => setNewCommercialPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Re-enter password"
                value={confirmCommercialPassword}
                onChange={(e) => setConfirmCommercialPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setCommercialPasswordHandler();
                  }
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setShowSetPasswordDialog(false);
                setNewCommercialPassword('');
                setConfirmCommercialPassword('');
              }}>
                Cancel
              </Button>
              <Button onClick={setCommercialPasswordHandler}>
                Set Password
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ================================================================
// Dynamic Tab Renderer
// ================================================================

/** Maps section IDs to their tab content components */
function renderSectionContent(
  sectionId: string,
  scratchpad: ScratchpadData,
  workshopId: string,
  handleTabChange: (field: keyof ScratchpadData) => (updated: any) => void,
  commercialUnlocked: boolean,
  handleCommercialAccess: () => void,
): React.ReactNode {
  switch (sectionId) {
    case 'exec-summary':
      return <ExecutiveSummaryTab data={scratchpad.execSummary} onChange={handleTabChange('execSummary')} />;
    case 'discovery':
      return <DiscoveryOutputTab data={scratchpad.discoveryOutput} onChange={handleTabChange('discoveryOutput')} />;
    case 'reimagine':
      return <ReimaginOutputTab data={scratchpad.reimagineContent} customerJourney={scratchpad.customerJourney} onChange={handleTabChange('reimagineContent')} />;
    case 'constraints':
      return <ConstraintsTab data={scratchpad.constraintsContent} onChange={handleTabChange('constraintsContent')} />;
    case 'solution':
      return <PotentialSolutionTab data={scratchpad.potentialSolution} onChange={handleTabChange('potentialSolution')} />;
    case 'commercial':
      return commercialUnlocked ? (
        <CommercialTab data={scratchpad.commercialContent} onChange={handleTabChange('commercialContent')} />
      ) : (
        <Card className="p-8 text-center">
          <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Password Protected</h2>
          <p className="text-muted-foreground">
            This section requires a password to access.
          </p>
          <Button className="mt-4" onClick={handleCommercialAccess}>
            Enter Password
          </Button>
        </Card>
      );
    case 'customer-journey':
      return <CustomerJourneyTab data={scratchpad.customerJourney} onChange={handleTabChange('customerJourney')} />;
    case 'hemisphere':
      return <HemisphereOutputTab workshopId={workshopId} />;
    case 'summary':
      return <SummaryTab data={scratchpad.summaryContent} onChange={handleTabChange('summaryContent')} />;
    default:
      return <Card className="p-8 text-center text-muted-foreground">Section not found: {sectionId}</Card>;
  }
}

interface DynamicScratchpadTabsProps {
  scratchpad: ScratchpadData;
  workshopId: string;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  handleTabChange: (field: keyof ScratchpadData) => (updated: any) => void;
  hasPassword: boolean;
  commercialUnlocked: boolean;
  handleCommercialAccess: () => void;
}

function DynamicScratchpadTabs({
  scratchpad,
  workshopId,
  activeTab,
  setActiveTab,
  handleTabChange,
  hasPassword,
  commercialUnlocked,
  handleCommercialAccess,
}: DynamicScratchpadTabsProps) {
  // Build section context from current scratchpad data
  const assessment = scratchpad.outputAssessment;
  const archetype: WorkshopArchetype = assessment?.primaryArchetype || 'hybrid';

  // Build context to determine which sections are active
  const sectionContext = buildSectionContext(
    scratchpad as unknown as Record<string, unknown>,
    true, // hemisphere data is always potentially available if synthesis ran
    assessment ? 5 : 0, // Use a reasonable default; exact count is in the assessment
    assessment ? 3 : 0,
  );

  // Compute active sections
  // If no outputAssessment exists (backward compat), show all sections
  const activeSections: SectionDefinition[] = assessment
    ? composeActiveSections(archetype, sectionContext)
    : composeActiveSections('hybrid', {
        ...sectionContext,
        hasReimagineContent: true,
        hasConstraintsContent: true,
        hasPotentialSolution: true,
        hasCommercialContent: true,
        hasCustomerJourney: true,
        hasSummaryContent: true,
        hasHemisphereData: true,
        constraintCount: 5,
        enablerCount: 3,
      });

  // Determine grid columns based on active section count
  const colCount = Math.min(activeSections.length, 10);
  const gridClass = `grid w-full mb-8`;
  const gridStyle = { gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className={gridClass} style={gridStyle}>
        {activeSections.map((section) => {
          // Special handling for commercial tab lock
          if (section.id === 'commercial') {
            return (
              <TabsTrigger
                key={section.id}
                value={section.id}
                className="text-xs"
                onClick={(e) => {
                  if (hasPassword && !commercialUnlocked) {
                    e.preventDefault();
                    handleCommercialAccess();
                  }
                }}
              >
                {hasPassword && !commercialUnlocked && <Lock className="h-3 w-3 mr-1" />}
                {section.title}
              </TabsTrigger>
            );
          }
          return (
            <TabsTrigger key={section.id} value={section.id} className="text-xs">
              {section.title}
            </TabsTrigger>
          );
        })}
      </TabsList>

      {activeSections.map((section) => (
        <TabsContent key={section.id} value={section.id}>
          {renderSectionContent(
            section.id,
            scratchpad,
            workshopId,
            handleTabChange,
            commercialUnlocked,
            handleCommercialAccess,
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
