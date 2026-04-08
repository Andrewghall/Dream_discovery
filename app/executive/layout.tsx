// Thin shell — just provides dark background for the login page.
// Authenticated portal pages live in app/executive/(portal)/ with their own layout.
export default function ExecRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e5e7eb]">
      {children}
    </div>
  );
}
