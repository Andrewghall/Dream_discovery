'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewWorkshopPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    businessContext: '',
    workshopType: 'CUSTOM',
    scheduledDate: '',
    responseDeadline: '',
    includeRegulation: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/admin/workshops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        router.push(`/admin/workshops/${data.workshop.id}`);
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
    <div className="min-h-screen bg-background">
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

              <div className="space-y-2">
                <Label htmlFor="workshopType">Workshop Type *</Label>
                <Select
                  value={formData.workshopType}
                  onValueChange={(value) => setFormData({ ...formData, workshopType: value })}
                >
                  <SelectTrigger id="workshopType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STRATEGY">Strategic Planning</SelectItem>
                    <SelectItem value="PROCESS">Process Improvement</SelectItem>
                    <SelectItem value="CHANGE">Organizational Change</SelectItem>
                    <SelectItem value="TEAM">Team Effectiveness</SelectItem>
                    <SelectItem value="CUSTOMER">Customer Experience</SelectItem>
                    <SelectItem value="INNOVATION">Innovation</SelectItem>
                    <SelectItem value="CULTURE">Culture & Values</SelectItem>
                    <SelectItem value="CUSTOM">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

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
