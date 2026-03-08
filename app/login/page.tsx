'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingButton } from '@/components/ui/loading-button';
import { Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(null);
  const [orgPrimaryColor, setOrgPrimaryColor] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Show welcome message using the name from the response
        const name = data.user?.name || data.user?.email?.split('@')[0] || 'back';
        setWelcomeMessage(`Welcome ${name} to DREAM`);
        setOrgLogoUrl(data.user?.organization?.logoUrl || null);
        setOrgPrimaryColor(data.user?.organization?.primaryColor || null);
        setLoading(false);

        // Redirect after 1.5 seconds
        setTimeout(() => {
          router.push(data.redirectTo || '/admin');
          router.refresh();
        }, 1500);
      } else {
        setError(data.error || 'Invalid credentials');
        setLoading(false);
      }
    } catch {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  // Show welcome screen while redirecting
  const accentHex = orgPrimaryColor?.replace('#', '') || '5cf28e';
  const accentR = parseInt(accentHex.slice(0, 2), 16) || 92;
  const accentG = parseInt(accentHex.slice(2, 4), 16) || 242;
  const accentB = parseInt(accentHex.slice(4, 6), 16) || 142;

  if (welcomeMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d0d0d] relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 60% 50% at 50% 50%, rgba(${accentR}, ${accentG}, ${accentB}, 0.08), transparent)`,
          }}
        />
        <div className="relative z-10 text-center">
          {orgLogoUrl && (
            <div className="mb-6 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={orgLogoUrl} alt="Organisation" className="h-16 w-auto object-contain" />
            </div>
          )}
          <h1 className="text-4xl font-bold text-white mb-3">{welcomeMessage}</h1>
          <p className="text-white/50">Taking you to your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0d0d] relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(92, 242, 142, 0.06), transparent)',
        }}
      />

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
          <div className="text-center mb-8">
            <div className="mb-4">
              <Image src="/ethenta-logo.png" alt="Ethenta" width={64} height={64} className="mx-auto" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">DREAM Discovery</h1>
            <p className="text-white/50 text-sm">Sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/80">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="w-full bg-white/[0.06] border-white/10 text-white placeholder:text-white/30 focus:border-[#5cf28e]/50 focus:ring-[#5cf28e]/20"
                autoComplete="email"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-white/80">Password</Label>
                <Link href="/forgot-password" className="text-sm text-[#5cf28e]/70 hover:text-[#5cf28e] transition-colors">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full pr-10 bg-white/[0.06] border-white/10 text-white placeholder:text-white/30 focus:border-[#5cf28e]/50 focus:ring-[#5cf28e]/20"
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <LoadingButton
              type="submit"
              className="w-full bg-[#5cf28e] hover:bg-[#50c878] text-[#0d0d0d] py-6 text-lg font-semibold transition-colors"
              loading={loading}
              loadingText="Signing in..."
            >
              Sign In
            </LoadingButton>
          </form>

          <div className="mt-8 text-center text-sm text-white/30 flex items-center justify-center gap-4">
            <p>&copy; {new Date().getFullYear()} Ethenta Ltd.</p>
            <Link href="/terms" className="hover:text-white/60 transition-colors underline underline-offset-2">
              Terms &amp; Conditions
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
