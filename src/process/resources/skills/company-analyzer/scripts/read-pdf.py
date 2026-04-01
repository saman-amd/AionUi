"""Read a PDF file and output text content. Usage: python read-pdf.py <file_path>"""
import sys
if len(sys.argv) < 2: print("Usage: python read-pdf.py <file_path>"); sys.exit(1)
from pypdf import PdfReader
reader = PdfReader(sys.argv[1])
for i, page in enumerate(reader.pages):
    text = page.extract_text()
    if text and text.strip():
        print(f"--- Page {i+1} ---")
        print(text.strip())
        print()
