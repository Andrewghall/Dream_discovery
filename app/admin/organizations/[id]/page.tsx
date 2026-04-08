import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ExecLicenceManager } from '@/components/executive/ExecLicenceManager';

export default async function OrgDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'PLATFORM_ADMIN') redirect('/admin');

  const { id } = await params;

  const org = await prisma.organization.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      maxSeats: true,
      billingEmail: true,
      primaryColor: true,
    },
  });

  if (!org) notFound();

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      {/* Back link */}
      <Link
        href="/admin/organizations"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-900 transition-colors"
      >
        ← Organizations
      </Link>

      {/* Org summary */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          {org.primaryColor && (
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: org.primaryColor }}
            />
          )}
          <h1 className="text-xl font-bold text-gray-900">{org.name}</h1>
        </div>
        <dl className="grid sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-gray-400 mb-0.5">Max Seats</dt>
            <dd className="font-medium text-gray-900">{org.maxSeats}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 mb-0.5">Billing Email</dt>
            <dd className="font-medium text-gray-900">{org.billingEmail ?? '—'}</dd>
          </div>
        </dl>
        <Link
          href="/admin/organizations"
          className="inline-block text-xs text-blue-500 hover:text-blue-700 transition-colors"
        >
          Edit organisation →
        </Link>
      </div>

      {/* Executive licences */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6">
        <ExecLicenceManager orgId={id} />
      </div>
    </div>
  );
}
