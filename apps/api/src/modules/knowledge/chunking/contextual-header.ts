/**
 * Contextual chunk header: the text that is embedded is prefixed with the document title and
 * section path, so a chunk such as "Up to 5 unused days may be carried over" also carries
 * "PTO and Leave Policy > Carryover" semantics. Only `content` is shown to users.
 */
export function buildEmbeddedText(
  documentTitle: string,
  sectionPath: string,
  content: string,
): string {
  const header = [`Document: ${documentTitle}`, sectionPath ? `Section: ${sectionPath}` : null]
    .filter(Boolean)
    .join('\n');
  return `${header}\n\n${content}`;
}

export const joinSectionPath = (path: string[]): string => path.join(' > ');
