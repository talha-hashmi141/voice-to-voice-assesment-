import { DEFAULT_PERSONA } from '@voice-agent/contracts';
import { PromptBuilder } from './prompt-builder';

describe('PromptBuilder', () => {
  const builder = new PromptBuilder();

  it('includes the user context, grounding policy, tool policy and voice style', () => {
    const prompt = builder.buildSystemPrompt({ userContext: DEFAULT_PERSONA, summary: null });
    expect(prompt).toContain('Name: Alice Nguyen. Employee id: E-1042.');
    expect(prompt).toContain('search_knowledge_base');
    expect(prompt).toContain('"none"');
    expect(prompt).toContain('create_support_ticket');
    expect(prompt).toContain('no markdown');
    expect(prompt).not.toContain('Earlier in this conversation');
  });

  it('appends the rolling summary when present', () => {
    const prompt = builder.buildSystemPrompt({
      userContext: DEFAULT_PERSONA,
      summary: 'User asked about PTO.',
    });
    expect(prompt).toContain('## Earlier in this conversation\nUser asked about PTO.');
  });
});
