'use client';

import { use, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Save, Eye, Lock, Download } from 'lucide-react';
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
  solutionImageUrl?: string | null;
  status: 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED';
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

interface Workshop {
  id: string;
  name: string;
  status: string;
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
  const [exporting, setExporting] = useState(false);
  const [showSetPasswordDialog, setShowSetPasswordDialog] = useState(false);
  const [newCommercialPassword, setNewCommercialPassword] = useState('');
  const [confirmCommercialPassword, setConfirmCommercialPassword] = useState('');

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
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditItem = (sectionIndex: number, itemIndex: number, newText: string) => {
    if (!scratchpad?.discoveryOutput) return;

    const updated = { ...scratchpad };
    updated.discoveryOutput.sections[sectionIndex].content[itemIndex].text = newText;
    setScratchpad(updated);
  };

  const handleDeleteItem = (sectionIndex: number, itemIndex: number) => {
    if (!scratchpad?.discoveryOutput) return;
    if (!confirm('Delete this item?')) return;

    const updated = { ...scratchpad };
    updated.discoveryOutput.sections[sectionIndex].content.splice(itemIndex, 1);
    setScratchpad(updated);
  };

  const handleAddItem = (sectionIndex: number, newItem: any) => {
    if (!scratchpad?.discoveryOutput) return;

    const updated = { ...scratchpad };
    updated.discoveryOutput.sections[sectionIndex].content.push(newItem);
    setScratchpad(updated);
  };

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
        alert('Scratchpad saved successfully!');
        await fetchData();
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      console.error('Failed to save scratchpad:', error);
      alert('Failed to save scratchpad');
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
        alert('Scratchpad published successfully!');
        await fetchData();
      } else {
        throw new Error('Failed to publish');
      }
    } catch (error) {
      console.error('Failed to publish scratchpad:', error);
      alert('Failed to publish scratchpad');
    }
  };

  const handleExportHTML = async () => {
    try {
      setExporting(true);

      const response = await fetch(`/api/admin/workshops/${workshopId}/export-html`);

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

      alert('Report exported successfully! Upload the ZIP contents to your client\'s domain.');
    } catch (error) {
      console.error('Failed to export HTML:', error);
      alert(`Failed to export: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
        alert('Incorrect password');
      }
    } catch (error) {
      console.error('Failed to verify password:', error);
      alert('Failed to verify password');
    }
  };

  const setCommercialPasswordHandler = async () => {
    if (newCommercialPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    if (newCommercialPassword !== confirmCommercialPassword) {
      alert('Passwords do not match');
      return;
    }

    try {
      const response = await fetch(`/api/admin/workshops/${workshopId}/scratchpad/set-commercial-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newCommercialPassword }),
      });

      if (response.ok) {
        alert('Commercial password set successfully');
        setShowSetPasswordDialog(false);
        setNewCommercialPassword('');
        setConfirmCommercialPassword('');
        setCommercialUnlocked(true); // Auto-unlock after setting
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to set password');
      }
    } catch (error) {
      console.error('Failed to set password:', error);
      alert('Failed to set password');
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
          <Link href={`/admin/workshops/${workshopId}`}>
            <Button variant="ghost" className="mb-6">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Workshop
            </Button>
          </Link>

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
                    alert(`Error: ${errorData.error || 'Failed to create scratchpad'}`);
                  }
                } catch (error) {
                  console.error('Failed to create demo scratchpad:', error);
                  alert('Failed to create demo scratchpad. Check console for details.');
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
          <div className="flex items-center gap-6">
            <Link href={`/admin/workshops/${workshopId}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <img
              src="/upstreamworks-logo.png"
              alt="Upstream Works"
              className="h-10 w-auto"
            />
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
                    alert('📋 Empty template loaded with 5 DREAM lenses: Customer, Regulator, Client, Technology, Organisation');
                    await fetchData();
                  } else {
                    alert('Failed to load template');
                  }
                } catch (error) {
                  console.error('Failed to load template:', error);
                  alert('Error loading template');
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
                    alert('✅ Demo data loaded! TravelWise Contact Centre transformation example.');
                    await fetchData();
                  } else {
                    alert('Failed to load demo data');
                  }
                } catch (error) {
                  console.error('Failed to load demo data:', error);
                  alert('Error loading demo data');
                }
              }}
            >
              🎯 Load Demo Data
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowSetPasswordDialog(true)}
            >
              <Lock className="h-4 w-4 mr-2" />
              Set Commercial Password
            </Button>
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

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-8 mb-8">
            <TabsTrigger value="exec-summary" className="text-xs">Exec Summary</TabsTrigger>
            <TabsTrigger value="discovery" className="text-xs">Discovery</TabsTrigger>
            <TabsTrigger value="reimagine" className="text-xs">Reimagine</TabsTrigger>
            <TabsTrigger value="constraints" className="text-xs">Constraints</TabsTrigger>
            <TabsTrigger value="solution" className="text-xs">Solution</TabsTrigger>
            <TabsTrigger
              value="commercial"
              className="text-xs"
              onClick={(e) => {
                if (!commercialUnlocked) {
                  e.preventDefault();
                  handleCommercialAccess();
                }
              }}
            >
              <Lock className="h-3 w-3 mr-1" />
              Commercial
            </TabsTrigger>
            <TabsTrigger value="customer-journey" className="text-xs">Journey Map</TabsTrigger>
            <TabsTrigger value="summary" className="text-xs">Summary</TabsTrigger>
          </TabsList>

          <TabsContent value="exec-summary">
            <ExecutiveSummaryTab data={scratchpad.execSummary} />
          </TabsContent>

          <TabsContent value="discovery">
            <DiscoveryOutputTab data={scratchpad.discoveryOutput} />
          </TabsContent>

          <TabsContent value="reimagine">
            <ReimaginOutputTab data={scratchpad.reimagineContent} />
          </TabsContent>

          <TabsContent value="constraints">
            <ConstraintsTab data={scratchpad.constraintsContent} />
          </TabsContent>

          <TabsContent value="solution">
            <PotentialSolutionTab
              data={scratchpad.potentialSolution}
              onChange={(updated) => {
                setScratchpad((prev) => prev ? { ...prev, potentialSolution: updated } : prev);
              }}
            />
          </TabsContent>

          <TabsContent value="commercial">
            {commercialUnlocked ? (
              <CommercialTab data={scratchpad.commercialContent} />
            ) : (
              <Card className="p-8 text-center">
                <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h2 className="text-2xl font-bold mb-2">Password Protected</h2>
                <p className="text-muted-foreground">
                  This section requires a password to access.
                </p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="customer-journey">
            <CustomerJourneyTab
              data={scratchpad.customerJourney}
              onChange={(updated) => {
                setScratchpad((prev) => prev ? { ...prev, customerJourney: updated } : prev);
              }}
            />
          </TabsContent>

          <TabsContent value="summary">
            <SummaryTab data={scratchpad.summaryContent} />
          </TabsContent>
        </Tabs>
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
