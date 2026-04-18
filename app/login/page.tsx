'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingButton } from '@/components/ui/loading-button';
import { Eye, EyeOff, ShieldCheck, ScanLine } from 'lucide-react';
import Image from 'next/image';
import QRCode from 'react-qr-code';

type LoginStep = 'credentials' | 'totp' | 'enrolment';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<LoginStep>('credentials');

  // Credentials step
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // TOTP challenge step (existing users)
  const [mfaToken, setMfaToken] = useState('');
  const [totpCode, setTotpCode] = useState('');

  // Enrolment step (first-time setup)
  const [enrolmentToken, setEnrolmentToken] = useState('');
  const [enrolSecret, setEnrolSecret] = useState('');
  const [enrolUri, setEnrolUri] = useState('');
  const [enrolCode, setEnrolCode] = useState('');
  const [loadingSecret, setLoadingSecret] = useState(false);

  // Shared
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(null);
  const [orgPrimaryColor, setOrgPrimaryColor] = useState<string | null>(null);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
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
        if (data.mfaRequired && data.mfaEnrolmentRequired) {
          // First-time enrolment — fetch TOTP secret and show QR code
          setEnrolmentToken(data.enrolmentToken || '');
          setLoadingSecret(true);
          setLoading(false);
          try {
            const secretRes = await fetch('/api/auth/mfa', {
              headers: { Authorization: `Bearer ${data.enrolmentToken}` },
            });
            const secretData = await secretRes.json() as { secret?: string; uri?: string };
            if (secretRes.ok && secretData.secret) {
              setEnrolSecret(secretData.secret);
              setEnrolUri(secretData.uri || '');
              setStep('enrolment');
            } else {
              setError('Failed to initialise MFA setup. Please try again.');
            }
          } catch {
            setError('Failed to initialise MFA setup. Please try again.');
          } finally {
            setLoadingSecret(false);
          }
          return;
        }

        if (data.mfaRequired) {
          // Existing user — TOTP challenge
          setMfaToken(data.mfaToken || '');
          setStep('totp');
          setLoading(false);
          return;
        }

        // Full login success - no MFA required
        showWelcome(data);
      } else {
        setError(data.error || 'Invalid credentials');
        setLoading(false);
      }
    } catch {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  const handleTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/mfa-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mfaToken, totpCode }),
      });

      const data = await response.json();

      if (response.ok) {
        showWelcome(data);
      } else {
        setError(data.error || 'Invalid authentication code.');
        setLoading(false);
      }
    } catch {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  const handleEnrolmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: enrolCode, secret: enrolSecret, enrolmentToken }),
      });

      const data = await response.json();

      if (response.ok && data.enrolled) {
        showWelcome(data);
      } else {
        setError(data.error || 'Invalid code. Please try again.');
        setLoading(false);
      }
    } catch {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  const showWelcome = (data: Record<string, unknown>) => {
    const user = data.user as Record<string, unknown> | undefined;
    const org = user?.organization as Record<string, unknown> | undefined;
    const name = (user?.name as string) || (user?.email as string | undefined)?.split('@')[0] || 'back';
    setWelcomeMessage(`Welcome ${name} to DREAM`);
    setOrgLogoUrl((org?.logoUrl as string) || null);
    setOrgPrimaryColor((org?.primaryColor as string) || null);
    setLoading(false);
    setTimeout(() => {
      router.push((data.redirectTo as string) || '/admin');
      router.refresh();
    }, 1500);
  };

  // Welcome screen
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

  const cardClasses = "bg-white/[0.03] border border-white/10 rounded-2xl p-8 backdrop-blur-sm";
  const inputClasses = "w-full bg-white/[0.06] border-white/10 text-white placeholder:text-white/30 focus:border-[#5cf28e]/50 focus:ring-[#5cf28e]/20";

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
        <div className={cardClasses}>
          <div className="text-center mb-8">
            <div className="mb-4">
              <Image src="/ethenta-logo.png" alt="Ethenta" width={64} height={64} className="mx-auto" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">DREAM Discovery</h1>
            {step === 'credentials' && (
              <p className="text-white/50 text-sm">Sign in to your account</p>
            )}
            {step === 'totp' && (
              <p className="text-white/50 text-sm">Two-factor authentication</p>
            )}
            {step === 'enrolment' && (
              <p className="text-white/50 text-sm">Set up authenticator app</p>
            )}
          </div>

          {step === 'credentials' && (
            <form onSubmit={handleCredentialsSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/80">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className={inputClasses}
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
                    className={`${inputClasses} pr-10`}
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
          )}

          {step === 'totp' && (
            <form onSubmit={handleTotpSubmit} className="space-y-6">
              <div className="flex items-center gap-3 bg-[#5cf28e]/5 border border-[#5cf28e]/20 rounded-lg px-4 py-3">
                <ShieldCheck className="h-5 w-5 text-[#5cf28e] shrink-0" />
                <p className="text-white/70 text-sm">
                  Open your authenticator app and enter the 6-digit code.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="totpCode" className="text-white/80">Authentication code</Label>
                <Input
                  id="totpCode"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  required
                  className={`${inputClasses} text-center text-2xl tracking-[0.5em] font-mono`}
                  autoComplete="one-time-code"
                  autoFocus
                  disabled={loading}
                />
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
                loadingText="Verifying..."
              >
                Verify
              </LoadingButton>

              <button
                type="button"
                onClick={() => { setStep('credentials'); setError(''); setTotpCode(''); }}
                className="w-full text-sm text-white/30 hover:text-white/60 transition-colors"
              >
                Back to sign in
              </button>
            </form>
          )}

          {step === 'enrolment' && (
            <form onSubmit={handleEnrolmentSubmit} className="space-y-6">
              <div className="flex items-center gap-3 bg-[#5cf28e]/5 border border-[#5cf28e]/20 rounded-lg px-4 py-3">
                <ScanLine className="h-5 w-5 text-[#5cf28e] shrink-0" />
                <p className="text-white/70 text-sm">
                  MFA is required for your account. Scan the QR code with your authenticator app to get started.
                </p>
              </div>

              {loadingSecret ? (
                <div className="flex justify-center py-6">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#5cf28e] border-t-transparent" />
                </div>
              ) : enrolUri ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="bg-white p-3 rounded-xl">
                    <QRCode value={enrolUri} size={160} />
                  </div>
                  <details className="w-full">
                    <summary className="text-xs text-white/30 cursor-pointer hover:text-white/60 text-center">
                      Can&apos;t scan? Enter manually
                    </summary>
                    <p className="mt-2 text-xs text-white/50 font-mono break-all bg-white/5 rounded px-3 py-2 text-center">
                      {enrolSecret}
                    </p>
                  </details>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="enrolCode" className="text-white/80">Code from your app</Label>
                <Input
                  id="enrolCode"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  value={enrolCode}
                  onChange={(e) => setEnrolCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  required
                  className={`${inputClasses} text-center text-2xl tracking-[0.5em] font-mono`}
                  autoComplete="one-time-code"
                  autoFocus
                  disabled={loading || loadingSecret}
                />
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
                loadingText="Activating..."
                disabled={loadingSecret}
              >
                Activate &amp; Sign In
              </LoadingButton>

              <button
                type="button"
                onClick={() => { setStep('credentials'); setError(''); setEnrolCode(''); }}
                className="w-full text-sm text-white/30 hover:text-white/60 transition-colors"
              >
                Back to sign in
              </button>
            </form>
          )}

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
