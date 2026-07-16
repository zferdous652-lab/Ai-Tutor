#!/usr/bin/env python3
"""
Converts a PDF to Markdown, reconstructing heading levels from font size rather than
looking for specific words (so it works regardless of a textbook's heading vocabulary --
BAB, TOPIK, UNIT, "Chapter N", numbered sections, ...).

Usage: pdf_to_markdown.py <path-to-pdf>   (prints Markdown to stdout)

Uses pdfplumber (built on pdfminer.six) rather than a JS/pdf.js-based parser -- swapped in
after a real-world course PDF caused the previous pdf.js-based extractor (@opendocsg/pdf2md)
to hang indefinitely in production. See docs/MVP_PLAN.md.
"""
import sys
from collections import Counter

import pdfplumber

LINE_GROUPING_TOLERANCE = 2.0  # points; chars within this vertical distance are one line
HEADING_SIZE_RATIO = 1.15  # a line must be at least this much larger than body text to be a heading
MAX_HEADING_LEVELS = 3


def group_chars_into_lines(chars):
    """Groups a page's chars into lines by vertical position, tolerant of sub-pixel jitter."""
    lines = []
    current = []
    current_top = None
    for c in sorted(chars, key=lambda c: (c["top"], c["x0"])):
        if current_top is None or abs(c["top"] - current_top) <= LINE_GROUPING_TOLERANCE:
            current.append(c)
            current_top = c["top"] if current_top is None else current_top
        else:
            lines.append(current)
            current = [c]
            current_top = c["top"]
    if current:
        lines.append(current)
    return lines


def line_text_and_size(line_chars):
    text = "".join(c["text"] for c in line_chars).strip()
    size = round(Counter(round(c["size"], 1) for c in line_chars).most_common(1)[0][0], 1)
    return text, size


def convert(path: str) -> str:
    all_lines = []  # (text, size) across the whole document, in order
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            for line_chars in group_chars_into_lines(page.chars):
                text, size = line_text_and_size(line_chars)
                if text:
                    all_lines.append((text, size))

    if not all_lines:
        return ""

    body_size = Counter(size for _, size in all_lines).most_common(1)[0][0]
    heading_sizes = sorted(
        {size for _, size in all_lines if size >= body_size * HEADING_SIZE_RATIO}, reverse=True
    )[:MAX_HEADING_LEVELS]
    heading_level = {size: i + 1 for i, size in enumerate(heading_sizes)}

    out = []
    paragraph_buffer = []

    def flush_paragraph():
        if paragraph_buffer:
            out.append(" ".join(paragraph_buffer))
            paragraph_buffer.clear()

    for text, size in all_lines:
        level = heading_level.get(size)
        if level:
            flush_paragraph()
            out.append(f"{'#' * level} {text}")
        else:
            paragraph_buffer.append(text)
    flush_paragraph()

    return "\n\n".join(out) + "\n"


def main():
    if len(sys.argv) != 2:
        print("Usage: pdf_to_markdown.py <path-to-pdf>", file=sys.stderr)
        sys.exit(1)
    sys.stdout.write(convert(sys.argv[1]))


if __name__ == "__main__":
    main()
