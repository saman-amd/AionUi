#!/usr/bin/env node
/**
 * Read any spreadsheet file and output all sheets as plain text.
 * Supports: .xlsx, .xls, .xlsm, .csv, .tsv
 * Uses PowerShell COM (no npm dependencies needed).
 * Usage: node read-xlsx.js <file_path>
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

if (process.argv.length < 3) { console.log('Usage: node read-xlsx.js <file_path>'); process.exit(1); }

const filePath = path.resolve(process.argv[2]);
const ext = path.extname(filePath).toLowerCase();

// CSV/TSV — just read directly
if (ext === '.csv' || ext === '.tsv') {
  console.log(fs.readFileSync(filePath, 'utf-8'));
  process.exit(0);
}

// Try Python openpyxl/pandas first (best quality)
const pyScript = path.join(__dirname, 'read-xlsx.py');
if (fs.existsSync(pyScript)) {
  try {
    const result = execSync(`python "${pyScript}" "${filePath}"`, {
      encoding: 'utf-8', timeout: 30000, maxBuffer: 10 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (result.trim()) { console.log(result); process.exit(0); }
  } catch (_) { /* fall through */ }
}

// Fallback: PowerShell with Excel COM object
try {
  const escapedPath = filePath.replace(/'/g, "''");
  // Write PowerShell script to temp file to avoid escaping issues
  const os = require('os');
  const tmpPs = path.join(os.tmpdir(), 'aionui-read-xlsx.ps1');
  const psScript = [
    "$ErrorActionPreference = 'SilentlyContinue'",
    "try {",
    "  $excel = New-Object -ComObject Excel.Application",
    "  $excel.Visible = $false",
    "  $excel.DisplayAlerts = $false",
    `  $wb = $excel.Workbooks.Open('${escapedPath}', 0, $true)`,
    "  foreach ($ws in $wb.Worksheets) {",
    '    Write-Output ("=== Sheet: " + $ws.Name + " ===")',
    "    $range = $ws.UsedRange",
    "    if ($range) {",
    "      for ($r = 1; $r -le [Math]::Min($range.Rows.Count, 200); $r++) {",
    "        $row = @()",
    "        for ($c = 1; $c -le $range.Columns.Count; $c++) {",
    "          $row += $range.Cells.Item($r, $c).Text",
    "        }",
    "        if (($row | Where-Object { $_ -ne '' }).Count -gt 0) {",
    "          Write-Output ($row -join \"`t\")",
    "        }",
    "      }",
    "    }",
    "    Write-Output ''",
    "  }",
    "  $wb.Close($false)",
    "  $excel.Quit()",
    "  [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null",
    "} catch {",
    "  Write-Error \"Excel COM failed: $_\"",
    "  exit 1",
    "}",
  ].join('\n');
  fs.writeFileSync(tmpPs, psScript, 'utf-8');
  const result = execSync(`powershell -ExecutionPolicy Bypass -File "${tmpPs}"`, {
    encoding: 'utf-8', timeout: 60000, maxBuffer: 10 * 1024 * 1024,
  });
  if (result.trim()) { console.log(result); process.exit(0); }
} catch (_) { /* fall through */ }

// Last fallback: XLSX is a ZIP with XML — extract manually
try {
  const escapedPath2 = filePath.replace(/'/g, "''");
  const cmd = `powershell -Command "Add-Type -A 'System.IO.Compression.FileSystem'; $z = [IO.Compression.ZipFile]::OpenRead('${escapedPath2}'); $sheets = $z.Entries | Where-Object { $_.FullName -match 'xl/worksheets/sheet[0-9]+\\.xml$' } | Sort-Object FullName; foreach ($s in $sheets) { Write-Output ('=== ' + $s.Name + ' ==='); $r = New-Object IO.StreamReader($s.Open()); $xml = $r.ReadToEnd(); $r.Close(); $matches = [regex]::Matches($xml, '<v>([^<]*)</v>'); $vals = $matches | ForEach-Object { $_.Groups[1].Value }; Write-Output ($vals -join [char]9); Write-Output '' }; $z.Dispose()"`;
  const result = execSync(cmd, { encoding: 'utf-8', timeout: 15000, maxBuffer: 10 * 1024 * 1024 });
  console.log(result.trim() ? result : '[Could not extract spreadsheet data]');
} catch (e) {
  console.error(`Error reading ${filePath}: ${e.message}`);
  process.exit(1);
}
