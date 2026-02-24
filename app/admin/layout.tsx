import Image from 'next/image';
import { Toaster } from 'sonner';
import { AdminHeader } from '@/components/admin/AdminHeader';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-background">
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
        <AdminHeader section="admin" />
        {children}
      </div>
      <Toaster position="top-right" richColors closeButton />
    </div>
  );
}
