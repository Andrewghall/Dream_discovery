import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, MessageSquare, TrendingUp } from 'lucide-react';
import Image from 'next/image';
import { getSession } from '@/lib/auth/session';

export default async function TenantDashboardPage() {
  const session = await getSession();

  if (!session || !session.organizationId) {
    redirect('/login');
  }

  const isTenantAdmin = session.role === 'TENANT_ADMIN';

  // Fetch org branding + workshops in parallel
  const [org, workshops] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { name: true, logoUrl: true },
    }),
    prisma.workshop.findMany({
      where: isTenantAdmin
        ? { organizationId: session.organizationId }
        : { organizationId: session.organizationId, createdById: session.userId },
      include: {
        participants: {
          select: { id: true, responseCompletedAt: true },
        },
        _count: { select: { participants: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const totalParticipants = workshops.reduce((sum, w) => sum + w._count.participants, 0);
  const completedResponses = workshops.reduce(
    (sum, w) => sum + w.participants.filter(p => p.responseCompletedAt).length,
    0
  );
  const completionRate =
    totalParticipants > 0 ? Math.round((completedResponses / totalParticipants) * 100) : 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-500';
      case 'IN_PROGRESS': return 'bg-blue-500';
      case 'DISCOVERY_SENT': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'Not scheduled';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  const orgLogoUrl = org?.logoUrl || process.env.NEXT_PUBLIC_PLATFORM_LOGO || null;
  const orgName = org?.name || 'DREAM Discovery';

  return (
    <div className="min-h-screen bg-transparent">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{orgName}</h1>
            </div>
            <p className="text-muted-foreground mt-1">Manage workshops and discovery conversations</p>
          </div>
          <div className="flex gap-2">
            <Link href="/tenant/workshops/new">
              <Button size="lg" className="btn-org-primary">
                <Plus className="h-4 w-4 mr-2" />
                New Workshop
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Workshops</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{workshops.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {workshops.filter(w => w.status === 'IN_PROGRESS').length} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Participants</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalParticipants}</div>
              <p className="text-xs text-muted-foreground mt-1">{completedResponses} completed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completionRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">Across all workshops</p>
            </CardContent>
          </Card>
        </div>

        {/* Workshops List */}
        <Card>
          <CardHeader>
            <CardTitle>Workshops</CardTitle>
            <CardDescription>View and manage your discovery workshops</CardDescription>
          </CardHeader>
          <CardContent>
            {workshops.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No workshops yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first workshop to start gathering insights
                </p>
                <Link href="/tenant/workshops/new">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Workshop
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {workshops.map((workshop) => (
                  <Link key={workshop.id} href={workshop.workshopType === 'SALES' ? `/sales/${workshop.id}` : `/admin/workshops/${workshop.id}`} className="block">
                    <div className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">{workshop.name}</h3>
                            <Badge variant="outline" className="capitalize">
                              {workshop.workshopType.toLowerCase()}
                            </Badge>
                            <div className="flex items-center gap-2">
                              <div className={`h-2 w-2 rounded-full ${getStatusColor(workshop.status)}`} />
                              <span className="text-sm text-muted-foreground capitalize">
                                {workshop.status.toLowerCase().replace('_', ' ')}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-6 text-sm text-muted-foreground">
                            <span>📅 {formatDate(workshop.scheduledDate)}</span>
                            <span>
                              👥 {workshop.participants.filter(p => p.responseCompletedAt).length}/
                              {workshop._count.participants} completed
                            </span>
                            <span>
                              {workshop._count.participants > 0
                                ? Math.round(
                                    (workshop.participants.filter(p => p.responseCompletedAt).length /
                                      workshop._count.participants) * 100
                                  )
                                : 0}% completion
                            </span>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">View →</Button>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
