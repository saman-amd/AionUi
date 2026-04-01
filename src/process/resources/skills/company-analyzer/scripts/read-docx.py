"""Read a Word document and output text content.
Supports: .docx, .doc, .rtf, .odt
Usage: python read-docx.py <file_path>
"""
import sys, os, subprocess
if len(sys.argv) < 2: print("Usage: python read-docx.py <file_path>"); sys.exit(1)
path = sys.argv[1]
ext = os.path.splitext(path)[1].lower()

if ext == '.docx':
    from docx import Document
    doc = Document(path)
    for para in doc.paragraphs:
        if para.text.strip():
            print(para.text)
    for i, table in enumerate(doc.tables):
        print(f"\n[Table {i+1}]")
        for row in table.rows:
            print("\t".join(cell.text.strip() for cell in row.cells))
elif ext == '.doc':
    # Try antiword first, then LibreOffice conversion
    try:
        result = subprocess.run(['antiword', path], capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            print(result.stdout)
        else:
            raise Exception("antiword failed")
    except Exception:
        # Fallback: use python-docx2txt or textract if available
        try:
            import docx2txt
            print(docx2txt.process(path))
        except ImportError:
            # Last resort: try reading as raw text
            try:
                with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    # Filter out binary garbage, keep printable text
                    clean = ''.join(c for c in content if c.isprintable() or c in '\n\r\t')
                    print(clean)
            except Exception as e:
                print(f"Cannot read .doc file: {e}")
                print("Install python-docx2txt: pip install docx2txt")
                sys.exit(1)
elif ext == '.rtf':
    try:
        from striprtf.striprtf import rtf_to_text
        with open(path, 'r', errors='ignore') as f:
            print(rtf_to_text(f.read()))
    except ImportError:
        with open(path, 'r', errors='ignore') as f:
            print(f.read())
else:
    # .odt and others — try reading as text
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        print(f.read())
