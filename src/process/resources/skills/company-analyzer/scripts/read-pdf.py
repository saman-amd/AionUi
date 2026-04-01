"""Read a PDF file and output text content.
Tries pdfplumber first (better table/column layout), falls back to pypdf.

Improvements over read-pdf.py:
  - pdfplumber as primary: preserves tables and multi-column layouts correctly
  - pypdf as fallback (same as original)
  - Handles password-protected PDFs gracefully
  - Optional --pages N-M argument for partial extraction

Usage:
  python read-pdf.py <file_path>
  python read-pdf.py <file_path> --pages 1-10
"""
import sys
import os

if len(sys.argv) < 2:
    print("Usage: python read-pdf.py <file_path> [--pages N-M]")
    sys.exit(1)

path = sys.argv[1]

# Parse optional --pages N-M argument
page_range = None
if '--pages' in sys.argv:
    idx = sys.argv.index('--pages')
    if idx + 1 < len(sys.argv):
        parts = sys.argv[idx + 1].split('-')
        try:
            start = int(parts[0]) - 1  # convert to 0-based
            end = int(parts[1]) if len(parts) > 1 else None
            page_range = (start, end)
        except ValueError:
            pass  # ignore invalid range, extract all


def extract_with_pdfplumber(path, page_range):
    import pdfplumber
    output = []
    with pdfplumber.open(path) as pdf:
        pages = pdf.pages
        if page_range:
            start, end = page_range
            pages = pages[start:end]
        for i, page in enumerate(pages):
            page_num = (page_range[0] if page_range else 0) + i + 1
            # Extract structured tables first
            tables = page.extract_tables()
            text = page.extract_text(x_tolerance=2, y_tolerance=2)
            if not text and not tables:
                continue
            output.append(f"--- Page {page_num} ---")
            if tables:
                for t_idx, table in enumerate(tables):
                    output.append(f"[Table {t_idx + 1}]")
                    for row in table:
                        cells = [str(c).strip() if c is not None else "" for c in row]
                        output.append("\t".join(cells))
                    output.append("")
            if text and text.strip():
                output.append(text.strip())
            output.append("")
    return "\n".join(output) if output else "[No text content found in PDF]"


def extract_with_pypdf(path, page_range):
    from pypdf import PdfReader
    reader = PdfReader(path)
    if reader.is_encrypted:
        try:
            reader.decrypt("")
        except Exception:
            return "[ERROR] PDF is password-protected -- cannot extract text"
    pages = reader.pages
    if page_range:
        start, end = page_range
        pages = pages[start:end]
    output = []
    for i, page in enumerate(pages):
        page_num = (page_range[0] if page_range else 0) + i + 1
        text = page.extract_text()
        if text and text.strip():
            output.append(f"--- Page {page_num} ---")
            output.append(text.strip())
            output.append("")
    return "\n".join(output) if output else "[No text content found in PDF]"


# Try pdfplumber first (best quality for complex layouts and tables)
try:
    result = extract_with_pdfplumber(path, page_range)
    print(result)
    sys.exit(0)
except ImportError:
    sys.stderr.write("[info] pdfplumber not installed, trying pypdf...\n")
except Exception as e:
    sys.stderr.write(f"[info] pdfplumber failed ({e}), trying pypdf...\n")

# Fall back to pypdf
try:
    result = extract_with_pypdf(path, page_range)
    print(result)
    sys.exit(0)
except ImportError:
    print("[ERROR] Cannot read PDF: install pdfplumber or pypdf\n  pip install pdfplumber pypdf")
    sys.exit(1)
except Exception as e:
    print(f"[ERROR] Failed to read PDF: {e}")
    sys.exit(1)
