'use client';

import type { UserContext } from '@voice-agent/contracts';
import { DEMO_PERSONAS } from '@voice-agent/contracts';
import { UserRoundIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ITEMS = DEMO_PERSONAS.map((persona) => ({ value: persona.personaId, label: `${persona.name} · ${persona.department}` }));

export function PersonaSelect({ value, onChange, disabled }: { value: UserContext; onChange: (persona: UserContext) => void; disabled?: boolean }) {
  return (
    <Select
      items={ITEMS}
      value={value.personaId}
      onValueChange={(personaId) => {
        const persona = DEMO_PERSONAS.find((p) => p.personaId === personaId);
        if (persona) onChange(persona);
      }}
      disabled={disabled}
    >
      <SelectTrigger size="sm" aria-label="Who is talking" className="max-w-56">
        <UserRoundIcon className="size-3.5 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ITEMS.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
