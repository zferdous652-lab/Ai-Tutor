import pdfParse from "pdf-parse";

export interface ParsedChapter {
  order: number;
  title: string;
  content: string;
}

const MAX_CHAPTERS = 12;
const MIN_CHAPTER_CHARS = 1500;

/**
 * Naive chapter splitter for the MVP: looks for lines that read like "Chapter N" / "Bab N"
 * headings; falls back to splitting the raw text into equal-sized chunks if no headings are
 * found. Good enough for a single textbook PDF; replace with a real structure-aware parser
 * once more than one document format needs to be supported.
 */
export function splitIntoChapters(rawText: string): ParsedChapter[] {
  const headingPattern = /^\s*(chapter|bab)\s+\d+/im;
  const lines = rawText.split(/\r?\n/);
  const headingIndexes: number[] = [];
  lines.forEach((line, i) => {
    if (headingPattern.test(line)) headingIndexes.push(i);
  });

  if (headingIndexes.length >= 2) {
    const chapters: ParsedChapter[] = [];
    for (let i = 0; i < headingIndexes.length && chapters.length < MAX_CHAPTERS; i++) {
      const start = headingIndexes[i];
      const end = i + 1 < headingIndexes.length ? headingIndexes[i + 1] : lines.length;
      const content = lines.slice(start, end).join("\n").trim();
      if (content.length < MIN_CHAPTER_CHARS) continue;
      chapters.push({
        order: chapters.length + 1,
        title: lines[start].trim().slice(0, 120),
        content,
      });
    }
    if (chapters.length > 0) return chapters;
  }

  // Fallback: split into roughly equal chunks.
  const chunkSize = Math.max(MIN_CHAPTER_CHARS, Math.ceil(rawText.length / MAX_CHAPTERS));
  const chapters: ParsedChapter[] = [];
  for (let i = 0; i * chunkSize < rawText.length && chapters.length < MAX_CHAPTERS; i++) {
    const content = rawText.slice(i * chunkSize, (i + 1) * chunkSize).trim();
    if (!content) continue;
    chapters.push({
      order: chapters.length + 1,
      title: `Section ${chapters.length + 1}`,
      content,
    });
  }
  return chapters;
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const parsed = await pdfParse(buffer);
  return parsed.text;
}
