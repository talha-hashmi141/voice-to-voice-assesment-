'use client';

import { BookOpenIcon, HistoryIcon, MicIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export const NAV_ITEMS = [
  { href: '/', label: 'Voice agent', icon: MicIcon, exact: true },
  { href: '/knowledge', label: 'Knowledge base', icon: BookOpenIcon, exact: false },
  { href: '/conversations', label: 'Conversations', icon: HistoryIcon, exact: false },
] as const;

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
