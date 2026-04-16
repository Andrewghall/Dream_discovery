'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function ActorJourneyPage({ params }: PageProps) {
  const { id: workshopId } = use(params);

  return (
    <div className="min-h-screen bg-transparent">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
          <Link
            href={`/admin/workshops/${workshopId}`}
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Workshop
          </Link>
        </div>
        <div className="rounded-lg border bg-card p-8 text-center">
          <h1 className="text-xl font-semibold mb-2">Actor Journey Map</h1>
          <p className="text-muted-foreground">
            The Actor Journey Map feature has been removed from this version.
          </p>
        </div>
      </div>
    </div>
  );
}
