"""
Pre-extract all company documents into plain text files.
Creates a _extracted/ folder with readable .txt versions of every document.
The AI model can then just READ these files instead of writing code to parse them.

Usage: python extract-all.py [directory]
"""

import os
import sys
import traceback

def extract_xlsx(filepath):
    """Extract Excel file to readable text."""
    try:
        import openpyxl
        wb = openpyxl.load_workbook(filepath, data_only=True)
        output = []
        for sheet_name in wb.sheetnames:
            ws = wb[sheet_name]
            output.append(f"=== Sheet: {sheet_name} ===")
            for row in ws.iter_rows(values_only=False):
                cells = []
                for cell in row:
                    val = cell.value
                    if val is None:
                        cells.append("")
                    else:
                        cells.append(str(val))
                if any(c.strip() for c in cells):
                    output.append("\t".join(cells))
            output.append("")
        return "\n".join(output)
    except ImportError:
        try:
            import pandas as pd
            xls = pd.ExcelFile(filepath)
            output = []
            for sheet in xls.sheet_names:
                df = pd.read_excel(xls, sheet_name=sheet)
                output.append(f"=== Sheet: {sheet} ===")
                output.append(df.to_string(index=False))
                output.append("")
            return "\n".join(output)
        except ImportError:
            return f"[ERROR] Cannot read XLSX: install openpyxl or pandas"


def extract_pdf(filepath):
    """Extract PDF to text."""
    try:
        from pypdf import PdfReader
        reader = PdfReader(filepath)
        output = []
        for i, page in enumerate(reader.pages):
            text = page.extract_text()
            if text and text.strip():
                output.append(f"--- Page {i+1} ---")
                output.append(text.strip())
                output.append("")
        return "\n".join(output) if output else "[No text content found in PDF]"
    except ImportError:
        return "[ERROR] Cannot read PDF: install pypdf"


def extract_docx(filepath):
    """Extract DOCX to text."""
    try:
        from docx import Document
        doc = Document(filepath)
        output = []

        for para in doc.paragraphs:
            if para.text.strip():
                output.append(para.text)

        for i, table in enumerate(doc.tables):
            output.append(f"\n[Table {i+1}]")
            for row in table.rows:
                cells = [cell.text.strip() for cell in row.cells]
                output.append("\t".join(cells))

        return "\n".join(output) if output else "[No text content found]"
    except ImportError:
        return "[ERROR] Cannot read DOCX: install python-docx"


def extract_pptx(filepath):
    """Extract PPTX to text."""
    try:
        from pptx import Presentation
        prs = Presentation(filepath)
        output = []
        for i, slide in enumerate(prs.slides):
            slide_text = []
            for shape in slide.shapes:
                if shape.has_text_frame:
                    for para in shape.text_frame.paragraphs:
                        if para.text.strip():
                            slide_text.append(para.text.strip())
                if shape.has_table:
                    for row in shape.table.rows:
                        cells = [cell.text.strip() for cell in row.cells]
                        slide_text.append("\t".join(cells))
            if slide_text:
                output.append(f"--- Slide {i+1} ---")
                output.extend(slide_text)
                output.append("")
        return "\n".join(output) if output else "[No text content found]"
    except ImportError:
        return "[ERROR] Cannot read PPTX: install python-pptx"


def extract_txt(filepath):
    """Read plain text file."""
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        return f.read()


EXTRACTORS = {
    '.xlsx': extract_xlsx,
    '.pdf': extract_pdf,
    '.docx': extract_docx,
    '.doc': extract_docx,
    '.pptx': extract_pptx,
    '.txt': extract_txt,
    '.csv': extract_txt,
    '.md': extract_txt,
}


def main():
    root_dir = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()

    if not os.path.isdir(root_dir):
        print(f"Error: '{root_dir}' is not a directory")
        sys.exit(1)

    extracted_dir = os.path.join(root_dir, '_extracted')
    os.makedirs(extracted_dir, exist_ok=True)

    success = 0
    failed = 0

    for dirpath, dirnames, filenames in os.walk(root_dir):
        # Skip hidden dirs, lock files, and our output dir
        dirnames[:] = [d for d in dirnames if not d.startswith('.') and d != '_extracted']

        for filename in filenames:
            if filename.startswith('.') or filename.startswith('~'):
                continue

            ext = os.path.splitext(filename)[1].lower()
            if ext not in EXTRACTORS:
                continue

            filepath = os.path.join(dirpath, filename)
            rel_path = os.path.relpath(filepath, root_dir)

            # Create output path: _extracted/Company_A/2026/Q1_Jan/Financial_Summary.xlsx.txt
            out_path = os.path.join(extracted_dir, rel_path + '.txt')
            os.makedirs(os.path.dirname(out_path), exist_ok=True)

            try:
                extractor = EXTRACTORS[ext]
                content = extractor(filepath)

                # Add header with source info
                header = f"SOURCE: {rel_path}\nTYPE: {ext}\n{'=' * 60}\n\n"

                with open(out_path, 'w', encoding='utf-8') as f:
                    f.write(header + content)

                print(f"  OK: {rel_path}")
                success += 1
            except Exception as e:
                print(f"  FAIL: {rel_path} -> {e}")
                failed += 1

    print(f"\nDone! {success} files extracted, {failed} failed.")
    print(f"Output: {extracted_dir}")

    # Create an index file
    index_path = os.path.join(extracted_dir, '_INDEX.md')
    with open(index_path, 'w', encoding='utf-8') as f:
        f.write("# Extracted Documents Index\n\n")
        f.write(f"Source: {root_dir}\n")
        f.write(f"Files extracted: {success}\n\n")

        for dirpath, dirnames, filenames in os.walk(extracted_dir):
            dirnames[:] = [d for d in dirnames if not d.startswith('.')]
            for filename in sorted(filenames):
                if filename == '_INDEX.md':
                    continue
                rel = os.path.relpath(os.path.join(dirpath, filename), extracted_dir)
                f.write(f"- {rel}\n")

    print(f"Index: {index_path}")


if __name__ == '__main__':
    main()
