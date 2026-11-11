// Module 3: how a PDF page is cut into passages for the doc index.
// Each passage is a few sentences and starts with its document title, page
// and section, so the passage still makes sense on its own when searched.

/** Aim for passages about this long (characters). */
const TARGET = 450;

/**
 * Cuts one page's text into passages. The first three lines of every page
 * are the running header (title, document number, copyright), so they're
 * dropped; the section heading is kept as context.
 */
export function cutPage(title: string, page: number, text: string): string[] {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const header = lines[0] ?? "";
  const body = lines.filter(
    (line, i) =>
      !(i === 0 && line.startsWith(title)) &&
      !/^CSL-[A-Z]+-\d+/.test(line) &&
      !line.startsWith("©"),
  );
  // "Copper Home User Guide Troubleshooting and error codes" → the section.
  const section = header.startsWith(title)
    ? header.slice(title.length).trim()
    : "";
  const prefix = `${title}, page ${page}${section ? ` (${section})` : ""}:`;

  const sentences = body
    .join(" ")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?:])\s+(?=[A-Z0-9"•])/);

  const passages: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (current && current.length + sentence.length > TARGET) {
      passages.push(current);
      current = "";
    }
    current = current ? `${current} ${sentence}` : sentence;
  }
  if (current) passages.push(current);
  return passages.map((p) => `${prefix} ${p}`);
}
