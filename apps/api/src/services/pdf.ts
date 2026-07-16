import { execFile } from "child_process";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export interface ParsedChapter {
  order: number;
  title: string;
  content: string;
}

const MAX_CHAPTERS = 60;
// Headings are structure-detected (font size), so we trust them more than the blind fallback
// chunker below and only drop chapters short enough to be a stray heading match.
const MIN_HEADING_CHAPTER_CHARS = 200;
// No headings found at all — split into equal chunks. Keep chunks reasonably sized so we don't
// produce hundreds of slivers out of a very large document.
const MIN_FALLBACK_CHUNK_CHARS = 3000;

interface Heading {
  level: number;
  lineIndex: number;
  text: string;
}

function findHeadings(lines: string[]): Heading[] {
  const headings: Heading[] = [];
  lines.forEach((line, lineIndex) => {
    const match = /^(#{1,6})\s+(.+)/.exec(line.trim());
    if (match) {
      headings.push({ level: match[1].length, lineIndex, text: match[2].trim() });
    }
  });
  return headings;
}

function chaptersFromHeadings(lines: string[], headings: Heading[]): ParsedChapter[] {
  const chapters: ParsedChapter[] = [];
  for (let i = 0; i < headings.length && chapters.length < MAX_CHAPTERS; i++) {
    const start = headings[i].lineIndex;
    const end = i + 1 < headings.length ? headings[i + 1].lineIndex : lines.length;
    const content = lines.slice(start, end).join("\n").trim();
    if (content.length < MIN_HEADING_CHAPTER_CHARS) continue;
    chapters.push({
      order: chapters.length + 1,
      title: headings[i].text.slice(0, 120),
      content,
    });
  }
  return chapters;
}

function chunkEqually(markdown: string): ParsedChapter[] {
  const chunkSize = Math.max(MIN_FALLBACK_CHUNK_CHARS, Math.ceil(markdown.length / MAX_CHAPTERS));
  const chapters: ParsedChapter[] = [];
  for (let i = 0; i * chunkSize < markdown.length && chapters.length < MAX_CHAPTERS; i++) {
    const content = markdown.slice(i * chunkSize, (i + 1) * chunkSize).trim();
    if (!content) continue;
    chapters.push({
      order: chapters.length + 1,
      title: `Section ${chapters.length + 1}`,
      content,
    });
  }
  return chapters;
}

/**
 * Splits a Markdown document (produced by extractPdfMarkdown) into chapters using real
 * heading structure rather than guessing at literal words like "Chapter"/"Bab" — headings are
 * detected from font size, so this works regardless of a textbook's heading vocabulary (BAB,
 * TOPIK, UNIT, numbered, ...). Prefers H1 boundaries; falls back to H2 if there's only one (or
 * zero) H1; falls back to equal-sized chunks if there's no usable heading structure at all
 * (e.g. a scanned/flattened PDF with no font-size variation).
 */
export function splitIntoChapters(markdown: string): ParsedChapter[] {
  const lines = markdown.split(/\r?\n/);
  const headings = findHeadings(lines);

  for (const level of [1, 2]) {
    const atLevel = headings.filter((h) => h.level === level);
    if (atLevel.length >= 2) {
      const chapters = chaptersFromHeadings(lines, atLevel);
      if (chapters.length > 0) return chapters;
    }
  }

  return chunkEqually(markdown);
}

const SCRIPT_PATH = path.join(__dirname, "..", "..", "scripts", "pdf_to_markdown.py");
// Kept under the outer 5-minute processUpload guard (routes/admin.ts) so this subprocess-level
// kill fires first, with a clearer error, rather than racing the JS-level timeout.
const SUBPROCESS_TIMEOUT_MS = 4 * 60 * 1000;

/**
 * Shells out to a Python script (pdfplumber-based) rather than using a JS/pdf.js-based
 * library — swapped in after @opendocsg/pdf2md (also pdf.js-based) hung indefinitely on a
 * real course PDF in production, confirmed via near-zero CPU usage (i.e. genuinely stuck
 * awaiting something, not just slow). Unlike an abandoned JS Promise, execFile's `timeout`
 * actually kills the subprocess if it hangs.
 */
export async function extractPdfMarkdown(buffer: Buffer): Promise<string> {
  const tmpFile = path.join(os.tmpdir(), `upload-${randomUUID()}.pdf`);
  await fs.writeFile(tmpFile, buffer);
  try {
    const { stdout } = await execFileAsync("python3", [SCRIPT_PATH, tmpFile], {
      timeout: SUBPROCESS_TIMEOUT_MS,
      maxBuffer: 50 * 1024 * 1024, // a large textbook produces a lot of markdown
    });
    return stdout;
  } finally {
    await fs.unlink(tmpFile).catch(() => {});
  }
}
