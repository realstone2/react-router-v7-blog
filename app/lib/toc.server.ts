export interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

/**
 * Extract h2/h3 headings from HTML string for table of contents.
 * Matches headings that have an id attribute (added by our custom marked renderer).
 */
export function extractToc(html: string): TocItem[] {
  const items: TocItem[] = [];
  const regex = /<h([23])\s+id="([^"]+)"[^>]*>(.*?)<\/h[23]>/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const level = parseInt(match[1], 10) as 2 | 3;
    const id = match[2];
    // Strip HTML tags from heading text
    const text = match[3].replace(/<[^>]*>/g, "");
    items.push({ id, text, level });
  }

  return items;
}
