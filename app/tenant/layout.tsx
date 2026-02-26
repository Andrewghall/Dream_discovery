import Image from 'next/image';
import { Toaster } from 'sonner';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export default async function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const org = session?.organizationId
    ? await prisma.organization.findUnique({
        where: { id: session.organizationId },
        select: { primaryColor: true, secondaryColor: true },
      })
    : null;

  const brandStyle = {
    '--org-primary': org?.primaryColor || '#1E40AF',
    '--org-secondary': org?.secondaryColor || '#3B82F6',
  } as React.CSSProperties;

  return (
    <div className="relative min-h-screen bg-background" style={brandStyle}>
      <div className="fixed inset-0 pointer-events-none z-0 opacity-20">
        <div className="relative w-full h-full flex items-center justify-center">
          <Image
            src="/Dream.PNG"
            alt="DREAM"
            fill
            sizes="100vw"
            priority
            className="object-contain"
          />
        </div>
      </div>
      <div className="relative z-10">
        <AdminHeader section="tenant" />
        {children}
      </div>
      <Toaster position="top-right" richColors closeButton />
    </div>
  );
}
