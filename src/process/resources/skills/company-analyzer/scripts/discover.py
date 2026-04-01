"""
Workspace discovery script for Company Document Analyzer.
Scans the current directory and outputs a structured inventory of all
company documents, organized by company and time period.

Usage: python discover.py [directory]
If no directory given, scans the current working directory.
"""

import os
import sys
import re
import json
from collections import defaultdict

SUPPORTED_EXTENSIONS = {'.xlsx', '.pdf', '.docx', '.doc', '.pptx', '.txt', '.csv', '.md'}
QUARTER_PATTERN = re.compile(r'Q([1-4])', re.IGNORECASE)
YEAR_PATTERN = re.compile(r'(20\d{2})')
MONTH_MAP = {
    'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
    'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
}


def detect_period(path_parts):
    """Extract year and quarter from folder path components."""
    year = None
    quarter = None
    for part in path_parts:
        ym = YEAR_PATTERN.search(part)
        if ym:
            year = int(ym.group(1))
        qm = QUARTER_PATTERN.search(part)
        if qm:
            quarter = int(qm.group(1))
        for month_name, month_num in MONTH_MAP.items():
            if month_name in part.lower():
                if not quarter:
                    quarter = (month_num - 1) // 3 + 1
    return year, quarter


def scan_directory(root_dir):
    """Scan directory tree and build structured inventory."""
    companies = defaultdict(lambda: defaultdict(list))
    all_files = []

    for dirpath, dirnames, filenames in os.walk(root_dir):
        # Skip hidden dirs and lock files
        dirnames[:] = [d for d in dirnames if not d.startswith('.')]

        for filename in filenames:
            if filename.startswith('.') or filename.startswith('~'):
                continue

            ext = os.path.splitext(filename)[1].lower()
            if ext not in SUPPORTED_EXTENSIONS:
                continue

            filepath = os.path.join(dirpath, filename)
            rel_path = os.path.relpath(filepath, root_dir)
            parts = rel_path.replace('\\', '/').split('/')

            # First folder level is usually the company name
            company = parts[0] if len(parts) > 1 else '_root'

            # Detect time period from path
            year, quarter = detect_period(parts)

            period = None
            if year and quarter:
                period = f"{year}-Q{quarter}"
            elif year:
                period = str(year)

            size_kb = os.path.getsize(filepath) / 1024

            entry = {
                'company': company,
                'period': period,
                'file': filename,
                'type': ext,
                'path': rel_path,
                'size_kb': round(size_kb, 1),
            }

            companies[company][period or '_unperioded'].append(entry)
            all_files.append(entry)

    return companies, all_files


def print_report(companies, all_files, root_dir):
    """Print a human-readable inventory report."""
    print(f"=== Workspace: {root_dir} ===")
    print(f"Total files: {len(all_files)}")
    print(f"Companies found: {len(companies)}")
    print()

    for company in sorted(companies.keys()):
        periods = companies[company]
        file_count = sum(len(files) for files in periods.values())
        period_list = sorted([p for p in periods.keys() if p != '_unperioded'])

        print(f"## {company} ({file_count} files)")

        if period_list:
            print(f"   Periods: {', '.join(period_list)}")
            print(f"   Latest:  {period_list[-1]}")

        for period in sorted(periods.keys()):
            if period == '_unperioded':
                label = '  (no period)'
            else:
                label = f'  {period}'

            files = periods[period]
            types = [f['type'] for f in files]
            print(f"   {label}: {', '.join(f['file'] for f in files)}")

        print()

    # Summary table
    print("=== Quick Reference ===")
    print(f"{'Company':<20} {'Periods':<30} {'File Types':<30}")
    print("-" * 80)

    for company in sorted(companies.keys()):
        periods = companies[company]
        period_list = sorted([p for p in periods.keys() if p != '_unperioded'])
        all_types = set()
        for files in periods.values():
            for f in files:
                all_types.add(f['type'])

        periods_str = ', '.join(period_list) if period_list else '(none)'
        types_str = ', '.join(sorted(all_types))
        print(f"{company:<20} {periods_str:<30} {types_str:<30}")


def main():
    root_dir = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()

    if not os.path.isdir(root_dir):
        print(f"Error: '{root_dir}' is not a directory")
        sys.exit(1)

    companies, all_files = scan_directory(root_dir)

    if not all_files:
        print(f"No supported files found in {root_dir}")
        print(f"Supported types: {', '.join(sorted(SUPPORTED_EXTENSIONS))}")
        sys.exit(0)

    print_report(companies, all_files, root_dir)


if __name__ == '__main__':
    main()
