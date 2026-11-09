import { OrbitIcon } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode } from 'react';
import { SidebarNav } from './sidebar-nav';
import { ThemeToggle } from './theme-toggle';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-4 md:flex">
        <Link href="/" className="mb-6 flex items-center gap-2 px-2 text-sidebar-foreground">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <OrbitIcon className="size-4" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">Orbital Labs</span>
            <span className="text-xs text-sidebar-foreground/60">Voice assistant</span>
          </span>
        </Link>
        <SidebarNav />
        <div className="mt-auto flex items-center justify-between px-2 pt-4 text-xs text-sidebar-foreground/60">
          <span>v0.1</span>
          <ThemeToggle />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 items-center justify-between border-b px-4 md:hidden">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
            <OrbitIcon className="size-4" /> Orbital Labs
          </Link>
          <ThemeToggle />
        </header>
        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
