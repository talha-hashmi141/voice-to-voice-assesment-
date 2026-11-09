import { z } from 'zod';

/**
 * Who is talking to the agent. Injected into the system prompt and used as the
 * default identity for tools such as `get_leave_balance`, so the agent never has
 * to ask the user for information the session already knows.
 */
export const UserContextSchema = z.object({
  personaId: z.string().min(1),
  name: z.string().min(1),
  employeeId: z.string().min(1),
  department: z.string().min(1),
  timezone: z.string().min(1).default('UTC'),
});
export type UserContext = z.infer<typeof UserContextSchema>;

/** Demo personas available in the UI. Balances live in the API's mock HR system. */
export const DEMO_PERSONAS: readonly UserContext[] = [
  {
    personaId: 'alice',
    name: 'Alice Nguyen',
    employeeId: 'E-1042',
    department: 'Engineering',
    timezone: 'America/New_York',
  },
  {
    personaId: 'bob',
    name: 'Bob Okafor',
    employeeId: 'E-2077',
    department: 'Sales',
    timezone: 'Europe/London',
  },
  {
    personaId: 'carla',
    name: 'Carla Mendes',
    employeeId: 'E-3311',
    department: 'People Operations',
    timezone: 'Asia/Karachi',
  },
] as const;

export const DEFAULT_PERSONA: UserContext = DEMO_PERSONAS[0]!;
