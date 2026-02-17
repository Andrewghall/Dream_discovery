'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Home, ArrowLeft, ShieldAlert } from 'lucide-react';

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-gray-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-orange-100 rounded-full mb-6">
            <ShieldAlert className="h-10 w-10 text-orange-600" />
          </div>
          <h1 className="text-9xl font-bold text-gray-300">403</h1>
          <h2 className="text-3xl font-bold text-gray-900 mt-4">Access Forbidden</h2>
          <p className="text-gray-600 mt-4">
            You don't have permission to access this resource. Please contact your administrator if you believe this is an error.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/">
            <Button variant="default" className="w-full sm:w-auto">
              <Home className="h-4 w-4 mr-2" />
              Go Home
            </Button>
          </Link>
          <Button variant="outline" onClick={() => window.history.back()} className="w-full sm:w-auto">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Need access? Contact your administrator or email{' '}
            <a href="mailto:support@ethenta.com" className="text-indigo-600 hover:text-indigo-700">
              support@ethenta.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
