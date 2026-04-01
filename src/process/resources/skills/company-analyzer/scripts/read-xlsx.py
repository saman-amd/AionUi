"""Read any spreadsheet file and output all sheets as plain text.
Supports: .xlsx, .xls, .xlsm, .xlsb, .csv, .tsv, .ods
Usage: python read-xlsx.py <file_path>
"""
import sys, os
if len(sys.argv) < 2: print("Usage: python read-xlsx.py <file_path>"); sys.exit(1)
path = sys.argv[1]
ext = os.path.splitext(path)[1].lower()

if ext in ('.csv', '.tsv'):
    import csv
    delimiter = '\t' if ext == '.tsv' else ','
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        for row in csv.reader(f, delimiter=delimiter):
            print('\t'.join(row))
elif ext in ('.xlsx', '.xlsm'):
    try:
        import openpyxl
        wb = openpyxl.load_workbook(path, data_only=True)
        for name in wb.sheetnames:
            ws = wb[name]
            print(f"=== Sheet: {name} ===")
            for row in ws.iter_rows(values_only=True):
                vals = [str(v) if v is not None else "" for v in row]
                if any(v.strip() for v in vals):
                    print("\t".join(vals))
            # Extract chart info if present
            if ws._charts:
                for ci, chart in enumerate(ws._charts):
                    title = chart.title or "Untitled"
                    print(f"\n[Chart {ci+1}: {title}]")
                    try:
                        for series in chart.series:
                            ref = str(series.val.numRef.f) if hasattr(series, 'val') and series.val and hasattr(series.val, 'numRef') else 'N/A'
                            print(f"  Series data ref: {ref}")
                    except Exception:
                        print("  (chart series data in cell range above)")
            print()
    except Exception as e:
        print(f"openpyxl failed ({e}), trying pandas...")
        import pandas as pd
        for sheet in pd.ExcelFile(path).sheet_names:
            print(f"=== Sheet: {sheet} ===")
            print(pd.read_excel(path, sheet_name=sheet).to_string(index=False))
            print()
else:
    # .xls, .xlsb, .ods and any other format — use pandas
    try:
        import pandas as pd
        xls = pd.ExcelFile(path)
        for sheet in xls.sheet_names:
            print(f"=== Sheet: {sheet} ===")
            print(pd.read_excel(xls, sheet_name=sheet).to_string(index=False))
            print()
    except Exception as e:
        print(f"Error reading {path}: {e}")
        sys.exit(1)
