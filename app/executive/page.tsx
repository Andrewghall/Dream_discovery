import { ExecLoginForm } from '@/components/executive/ExecLoginForm';

export default function ExecLoginPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-6">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(92,242,142,0.06), transparent)' }} />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <img src="/ethenta-logo.png" alt="DREAM" style={{ height: 20, opacity: 0.6, filter: 'invert(1) brightness(0.9)' }} />
        </div>

        {/* Heading */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-white tracking-tight mb-2">Executive Portal</h1>
          <p className="text-white/35 text-sm">Your DREAM Discovery insights, always available.</p>
        </div>

        <ExecLoginForm />

        <p className="text-center text-white/20 text-xs mt-8">
          Access is provided by your Ethenta consultant.
        </p>
      </div>
    </div>
  );
}
