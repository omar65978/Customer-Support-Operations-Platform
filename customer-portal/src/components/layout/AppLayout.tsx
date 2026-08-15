import type { ReactNode } from "react";
import { Navbar } from "./Navbar";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 animate-fade-in">
        {children}
      </main>
    </div>
  );
}
