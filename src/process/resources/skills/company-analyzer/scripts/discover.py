"""
Workspace discovery script for Company Document Analyzer.
Scans the current directory and outputs a structured inventory of all
company documents, organized by company and time period.

Improvements over discover.py:
  - Skips _extracted/ folder -- avoids listing pre-extracted .txt duplicates
  - Uses os.scandir() recursively for faster stat (size without extra syscall)
  - detect_period now uses the EARLIEST year found in the path (most specific
    folder beats a parent folder name), stops at first match per level
  - Adds --company filter to show only one company
  - Adds --single-company NAME: treats the root directory as one named company
    (use when workspace = one company's folder, not a multi-company root)
  - Shows total size per company in the summary table

Usage:
  python discover.py [directory] [--company NAME]
  python discover.py [directory] --single-company NAME
"""

import os
import sys
import re
import argparse
from collections import defaultdict

SUPPORTED_EXTENSIONS = {'.xlsx', '.xlsm', '.pdf', '.docx', '.doc', '.pptx', '.txt', '.csv', '.md'}

# Folders to always skip during traversal
SKIP_DIRS = {'_extracted', '.git', '__pycache__', 'node_modules', '.venv', 'venv'}

QUARTER_PATTERN = re.compile(r'Q([1-4])', re.IGNORECASE)
YEAR_PATTERN = re.compile(r'(20\d{2})')
MONTH_MAP = {
    'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
    'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12,
}


def detect_period(path_parts):
    """Extract year and quarter from folder path components.

    Scans parts in order and takes the FIRST year found (most specific
    subfolder wins over parent). This avoids a path like:
      CompanyA/2025/archive/2024/file.xlsx  -> period 2025, not 2024
    """
    year = None
    quarter = None

    for part in path_parts:
        part_lower = part.lower()

        if year is None:
            ym = YEAR_PATTERN.search(part)
            if ym:
                year = int(ym.group(1))

        if quarter is None:
            qm = QUARTER_PATTERN.search(part)
            if qm:
                quarter = int(qm.group(1))
            else:
                for month_name, month_num in MONTH_MAP.items():
                    if month_name in part_lower:
                        quarter = (month_num - 1) // 3 + 1
                        break

        if year and quarter:
            break  # both found -- stop early

    return year, quarter


def _walk(root_dir):
    """Yield (DirEntry, relative_parts) using os.scandir() for efficient stat."""
    def _recurse(current_dir, rel_parts):
        try:
            entries = list(os.scandir(current_dir))
        except PermissionError:
            return
        for entry in entries:
            if entry.name.startswith('.') or entry.name.startswith('~'):
                continue
            if entry.is_dir(follow_symlinks=False):
                if entry.name in SKIP_DIRS:
                    continue
                yield from _recurse(entry.path, rel_parts + [entry.name])
            elif entry.is_file(follow_symlinks=False):
                yield entry, rel_parts

    yield from _recurse(root_dir, [])


def detect_workspace_mode(root_dir):
    """Auto-detect whether the workspace root is a multi-company or single-company folder.

    Returns (mode, company_name):
      ('multi', None)        -- first-level dirs look like company names
      ('single', name)       -- first-level dirs look like year/quarter folders
                               (workspace root IS a single company folder)
    """
    year_re = re.compile(r'^20\d{2}$')
    quarter_re = re.compile(r'^Q[1-4]', re.IGNORECASE)
    month_re = re.compile(
        r'jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec', re.IGNORECASE
    )

    try:
        first_level_dirs = [
            e.name for e in os.scandir(root_dir)
            if e.is_dir(follow_symlinks=False)
            and not e.name.startswith('.')
            and e.name not in SKIP_DIRS
        ]
    except PermissionError:
        return 'multi', None

    if not first_level_dirs:
        return 'multi', None

    period_like = sum(
        1 for d in first_level_dirs
        if year_re.match(d) or quarter_re.match(d) or month_re.search(d)
    )

    # If more than half the first-level dirs look like time periods -> single company
    if period_like / len(first_level_dirs) >= 0.5:
        company_name = os.path.basename(os.path.abspath(root_dir))
        return 'single', company_name

    return 'multi', None


def scan_directory(root_dir, company_filter=None, single_company=None):
    """Scan directory tree and build structured inventory.

    single_company: if set, all files are assigned to this company name
                    regardless of directory structure. Use when the workspace
                    root IS a single company folder (not a multi-company root).
    """
    companies = defaultdict(lambda: defaultdict(list))
    all_files = []

    for entry, dir_parts in _walk(root_dir):
        ext = os.path.splitext(entry.name)[1].lower()
        if ext not in SUPPORTED_EXTENSIONS:
            continue

        parts = dir_parts + [entry.name]

        if single_company:
            # Workspace root = one company; all files belong to it
            company = single_company
        else:
            # First folder level is the company name; files at root go to '_root'
            company = parts[0] if len(parts) > 1 else '_root'

        if company_filter and company.lower() != company_filter.lower():
            continue

        year, quarter = detect_period(parts[:-1])  # exclude filename itself

        if year and quarter:
            period = f"{year}-Q{quarter}"
        elif year:
            period = str(year)
        else:
            period = None

        # entry.stat() reuses the cached stat from scandir -- no extra syscall
        try:
            size_kb = round(entry.stat().st_size / 1024, 1)
        except OSError:
            size_kb = 0.0

        rel_path = os.path.join(*parts) if len(parts) > 1 else parts[0]

        file_entry = {
            'company': company,
            'period': period,
            'file': entry.name,
            'type': ext,
            'path': rel_path,
            'size_kb': size_kb,
        }

        companies[company][period or '_unperioded'].append(file_entry)
        all_files.append(file_entry)

    return companies, all_files


def print_report(companies, all_files, root_dir):
    """Print a human-readable inventory report."""
    total_size = sum(f['size_kb'] for f in all_files)
    print(f"=== Workspace: {root_dir} ===")
    print(f"Total files: {len(all_files)}  |  Total size: {total_size / 1024:.1f} MB")
    print(f"Companies found: {len(companies)}")
    print()

    for company in sorted(companies.keys()):
        periods = companies[company]
        file_count = sum(len(files) for files in periods.values())
        company_size = sum(f['size_kb'] for files in periods.values() for f in files)
        period_list = sorted(p for p in periods if p != '_unperioded')

        print(f"## {company}  ({file_count} files, {company_size / 1024:.1f} MB)")

        if period_list:
            print(f"   Periods: {', '.join(period_list)}")
            print(f"   Latest:  {period_list[-1]}")

        for period in sorted(periods):
            label = '(no period)' if period == '_unperioded' else period
            files = periods[period]
            print(f"   {label}:")
            for f in files:
                print(f"     {f['file']}  ({f['size_kb']} KB)")

        print()

    # Summary table
    print("=== Quick Reference ===")
    print(f"{'Company':<20} {'Periods':<30} {'Types':<25} {'Size (MB)':<10}")
    print("-" * 90)

    for company in sorted(companies.keys()):
        periods = companies[company]
        period_list = sorted(p for p in periods if p != '_unperioded')
        all_types = sorted({f['type'] for files in periods.values() for f in files})
        company_size = sum(f['size_kb'] for files in periods.values() for f in files)

        periods_str = ', '.join(period_list) if period_list else '(none)'
        types_str = ', '.join(all_types)
        print(f"{company:<20} {periods_str:<30} {types_str:<25} {company_size / 1024:<10.1f}")


def main():
    parser = argparse.ArgumentParser(description='Discover company documents in a workspace.')
    parser.add_argument('directory', nargs='?', default=os.getcwd(),
                        help='Directory to scan (default: current working directory)')
    parser.add_argument('--company', metavar='NAME',
                        help='Filter output to a single company (multi-company workspace)')
    parser.add_argument('--single-company', metavar='NAME', dest='single_company',
                        help='Override: treat workspace root as one named company '
                             '(auto-detected by default, only use to override)')
    args = parser.parse_args()

    root_dir = args.directory

    if not os.path.isdir(root_dir):
        print(f"Error: '{root_dir}' is not a directory")
        sys.exit(1)

    single_company = args.single_company
    if not single_company:
        mode, auto_name = detect_workspace_mode(root_dir)
        if mode == 'single':
            single_company = auto_name
            print(f"[Auto-detected: single-company workspace -> '{single_company}']")
        else:
            print("[Auto-detected: multi-company workspace]")

    companies, all_files = scan_directory(
        root_dir,
        company_filter=args.company,
        single_company=single_company,
    )

    if not all_files:
        msg = f"No supported files found in {root_dir}"
        if args.company:
            msg += f" (company filter: '{args.company}')"
        print(msg)
        print(f"Supported types: {', '.join(sorted(SUPPORTED_EXTENSIONS))}")
        sys.exit(0)

    print_report(companies, all_files, root_dir)


if __name__ == '__main__':
    main()
