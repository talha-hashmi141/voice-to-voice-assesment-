import { describe, expect, it } from 'vitest';
import {
  AudioSubmitMetaSchema,
  ClientEvents,
  DEMO_PERSONAS,
  ReindexQuerySchema,
  SearchRequestSchema,
  ServerEvents,
  TOOL_ARG_SCHEMAS,
  TOOL_NAMES,
  TurnRequestSchema,
  UserContextSchema,
} from './index';

describe('contracts', () => {
  it('applies defaults and limits for search requests', () => {
    expect(SearchRequestSchema.parse({ query: '  holidays  ' })).toEqual({
      query: 'holidays',
      topK: 5,
      mode: 'hybrid',
    });
    expect(SearchRequestSchema.safeParse({ query: '' }).success).toBe(false);
    expect(SearchRequestSchema.safeParse({ query: 'x', topK: 50 }).success).toBe(false);
  });

  it('coerces the reindex force flag from a query string', () => {
    expect(ReindexQuerySchema.parse({})).toEqual({ force: false });
    expect(ReindexQuerySchema.parse({ force: 'true' })).toEqual({ force: true });
  });

  it('has an argument schema for every tool and the schemas reject bad input', () => {
    expect(Object.keys(TOOL_ARG_SCHEMAS).sort()).toEqual([...TOOL_NAMES].sort());
    expect(TOOL_ARG_SCHEMAS.search_knowledge_base.safeParse({ queries: [] }).success).toBe(false);
    expect(TOOL_ARG_SCHEMAS.search_knowledge_base.parse({ queries: ['a', 'b'] })).toEqual({
      queries: ['a', 'b'],
    });
    expect(
      TOOL_ARG_SCHEMAS.create_support_ticket.parse({
        title: 'Broken laptop',
        description: 'Screen cracked',
      }).priority,
    ).toBe('medium');
  });

  it('validates personas, turn requests and audio metadata', () => {
    for (const persona of DEMO_PERSONAS) expect(UserContextSchema.parse(persona)).toEqual(persona);
    expect(
      UserContextSchema.parse({ personaId: 'x', name: 'X', employeeId: 'E-1', department: 'D' })
        .timezone,
    ).toBe('UTC');
    expect(TurnRequestSchema.safeParse({ text: 'hi', conversationId: 'not-a-uuid' }).success).toBe(
      false,
    );
    expect(
      AudioSubmitMetaSchema.safeParse({ mimeType: 'audio/wav', sampleRate: 16000 }).success,
    ).toBe(true);
  });

  it('keeps client and server event names distinct', () => {
    const names = [...Object.values(ClientEvents), ...Object.values(ServerEvents)];
    expect(new Set(names).size).toBe(names.length);
  });
});
