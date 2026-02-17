'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

export function ClearLogsButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleClear = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setLoading(true);
    await fetch('/api/admin/audit-logs', { method: 'DELETE' });
    setLoading(false);
    setConfirming(false);
    router.refresh();
  };

  return (
    <Button
      variant="outline"
      className={confirming ? 'border-red-500 text-red-600 hover:bg-red-50' : ''}
      onClick={handleClear}
      disabled={loading}
    >
      <Trash2 className="h-4 w-4 mr-2" />
      {loading ? 'Clearing...' : confirming ? 'Confirm clear all?' : 'Clear Logs'}
    </Button>
  );
}
