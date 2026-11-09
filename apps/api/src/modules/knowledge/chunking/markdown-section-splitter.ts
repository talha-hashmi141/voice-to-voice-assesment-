export interface MarkdownSection {
  /** Heading hierarchy, e.g. ["PTO and Leave Policy", "Carryover of unused PTO"]. */
  path: string[];
  level: number;
  content: string;
}

const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/u;

/**
 * Splits markdown into sections by heading, keeping the heading hierarchy as the section path.
 * Fenced code blocks and tables stay intact inside their section. Text before the first heading
 * becomes a preamble section with the document title as its path.
 */
export function splitMarkdownSections(markdown: string, documentTitle: string): MarkdownSection[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const sections: MarkdownSection[] = [];
  const stack: { level: number; title: string }[] = [];
  let buffer: string[] = [];
  let currentLevel = 0;
  let inFence = false;

  const flush = () => {
    const content = buffer.join('\n').trim();
    buffer = [];
    if (!content) return;
    const path = stack.length ? stack.map((item) => item.title) : [documentTitle];
    sections.push({ path, level: currentLevel, content });
  };

  for (const line of lines) {
    if (/^\s*```/u.test(line)) inFence = !inFence;
    const match = inFence ? null : HEADING.exec(line);
    if (!match) {
      buffer.push(line);
      continue;
    }
    flush();
    const level = match[1]!.length;
    const title = match[2]!.trim();
    while (stack.length && stack[stack.length - 1]!.level >= level) stack.pop();
    stack.push({ level, title });
    currentLevel = level;
  }
  flush();

  // An H1 that merely repeats the document title adds no information to the path.
  return sections.map((section) => ({
    ...section,
    path:
      section.path.length > 1 && section.path[0]?.toLowerCase() === documentTitle.toLowerCase()
        ? section.path.slice(1)
        : section.path,
  }));
}
