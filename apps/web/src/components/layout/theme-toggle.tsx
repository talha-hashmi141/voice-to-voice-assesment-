'use client';

import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const ORDER = ['light', 'dark', 'system'] as const;
type ThemeName = (typeof ORDER)[number];

const ICONS: Record<ThemeName, typeof SunIcon> = {
  light: SunIcon,
  dark: MoonIcon,
  system: MonitorIcon,
};

const subscribeNoop = () => () => {};
/** True after hydration on the client, false during SSR – without a setState-in-effect. */
const useMounted = () =>
  useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );

/** Cycles light → dark → system. Shows the neutral "system" icon until mounted to avoid hydration mismatch. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  const current: ThemeName =
    mounted && ORDER.includes(theme as ThemeName) ? (theme as ThemeName) : 'system';
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length] ?? 'system';
  const Icon = ICONS[current];

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Theme: ${current}. Switch to ${next}`}
            onClick={() => setTheme(next)}
          />
        }
      >
        <Icon className="size-4" />
      </TooltipTrigger>
      <TooltipContent>Theme: {current}</TooltipContent>
    </Tooltip>
  );
}
