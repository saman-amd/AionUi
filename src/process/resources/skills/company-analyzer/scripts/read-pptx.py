"""Read a PowerPoint file and output text content.
Supports: .pptx, .ppt
Usage: python read-pptx.py <file_path>
"""
import sys, os, subprocess
if len(sys.argv) < 2: print("Usage: python read-pptx.py <file_path>"); sys.exit(1)
path = sys.argv[1]
ext = os.path.splitext(path)[1].lower()

if ext == '.pptx':
    from pptx import Presentation
    from pptx.enum.shapes import MSO_SHAPE_TYPE
    prs = Presentation(path)
    for i, slide in enumerate(prs.slides):
        texts = []
        for shape in slide.shapes:
            if shape.has_text_frame:
                for para in shape.text_frame.paragraphs:
                    if para.text.strip():
                        texts.append(para.text.strip())
            if shape.has_table:
                for row in shape.table.rows:
                    texts.append("\t".join(cell.text.strip() for cell in row.cells))
            # Extract chart data
            if shape.has_chart:
                chart = shape.chart
                texts.append(f"\n[Chart: {chart.chart_title.text_frame.text if chart.has_title else 'Untitled'}]")
                try:
                    for series in chart.series:
                        name = series.name if hasattr(series, 'name') else 'Series'
                        vals = [str(v) for v in series.values] if series.values else []
                        texts.append(f"  {name}: {', '.join(vals)}")
                    # Try to get category labels
                    try:
                        cats = [str(c) for c in chart.category_axis.categories]
                        if cats:
                            texts.append(f"  Categories: {', '.join(cats)}")
                    except Exception:
                        pass
                except Exception as e:
                    texts.append(f"  (chart data extraction failed: {e})")
        if texts:
            print(f"--- Slide {i+1} ---")
            print("\n".join(texts))
            print()
elif ext == '.ppt':
    # Old .ppt format — try catppt or LibreOffice
    try:
        result = subprocess.run(['catppt', path], capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            print(result.stdout)
        else:
            raise Exception("catppt failed")
    except Exception:
        try:
            with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                clean = ''.join(c for c in content if c.isprintable() or c in '\n\r\t')
                print(clean)
        except Exception as e:
            print(f"Cannot read .ppt file: {e}")
            sys.exit(1)
else:
    print(f"Unsupported format: {ext}")
    sys.exit(1)
