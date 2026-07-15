import { getDocumentProxy, renderPageAsImage } from "unpdf";
import { describePageDiagrams, VisualNote } from "./llm";

// One-time, admin-triggered cost amortized across every enrolled student — see
// docs/MVP_PLAN.md. Still bounded so a single huge upload can't run away:
const BATCH_SIZE = 15; // page images per vision call
const MAX_PAGES = 200; // safety cap on total pages analyzed for one Tutor Pack
const RENDER_SCALE = 1.5;

/**
 * Renders each page of the PDF to an image and asks a vision-capable model to describe any
 * diagrams/maps/photos/charts it finds — the parts of a course PDF that plain text extraction
 * (services/pdf.ts) discards entirely. Batched to keep each vision call's image count
 * reasonable; capped at MAX_PAGES for very large documents.
 */
export async function generateVisualNotes(
  buffer: Buffer,
  language: string
): Promise<VisualNote[]> {
  // Parse once and reuse the resulting proxy for every page render below — pdf.js transfers
  // (not copies) a raw buffer to its worker on first use, so passing the same Uint8Array
  // again for a later page throws "Cannot transfer object of unsupported type".
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const totalPages = Math.min(pdf.numPages, MAX_PAGES);
  if (pdf.numPages > MAX_PAGES) {
    console.warn(
      `[visual-notes] document has ${pdf.numPages} pages, only analyzing the first ${MAX_PAGES}`
    );
  }

  const notes: VisualNote[] = [];
  for (let start = 1; start <= totalPages; start += BATCH_SIZE) {
    const end = Math.min(start + BATCH_SIZE - 1, totalPages);
    const pageNumbers = Array.from({ length: end - start + 1 }, (_, i) => start + i);

    const images = await Promise.all(
      pageNumbers.map(async (page) => {
        const imageBuffer = await renderPageAsImage(pdf, page, {
          canvasImport: () => import("@napi-rs/canvas"),
          scale: RENDER_SCALE,
        });
        return { page, base64: Buffer.from(imageBuffer).toString("base64") };
      })
    );

    const batchNotes = await describePageDiagrams(images, language);
    notes.push(...batchNotes);
  }
  return notes;
}
