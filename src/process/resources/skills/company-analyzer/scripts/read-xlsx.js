#!/usr/bin/env node
/**
 * Read any spreadsheet file and output all sheets as plain text.
 * Delegates to read-xlsx.py (merged cells, no row cap).
 * Falls back to PowerShell XML extraction if Python is unavailable.
 * Usage: node read-xlsx.js <file_path>
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

if (process.argv.length < 3) {
  console.log('Usage: node read-xlsx.js <file_path>');
  process.exit(1);
}

const filePath = path.resolve(process.argv[2]);
const ext = path.extname(filePath).toLowerCase();

// CSV/TSV — read directly, no parsing needed
if (ext === '.csv' || ext === '.tsv') {
  console.log(fs.readFileSync(filePath, 'utf-8'));
  process.exit(0);
}

// Primary: Python (merged cells, public .charts API, no row cap)
const pyScript = path.join(__dirname, 'read-xlsx.py');
if (fs.existsSync(pyScript)) {
  try {
    const result = execSync(`python "${pyScript}" "${filePath}"`, {
      encoding: 'utf-8', timeout: 60000, maxBuffer: 20 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (result.trim()) { console.log(result); process.exit(0); }
  } catch (_) { /* fall through */ }
}

// Fallback: PowerShell COM object — no row cap (removed the 200-row limit)
try {
  const escapedPath = filePath.replace(/'/g, "''");
  const tmpPs = path.join(os.tmpdir(), 'aionui-read-xlsx-opt.ps1');
  const psScript = [
    "$ErrorActionPreference = 'SilentlyContinue'",
    'try {',
    '  $excel = New-Object -ComObject Excel.Application',
    '  $excel.Visible = $false',
    '  $excel.DisplayAlerts = $false',
    `  $wb = $excel.Workbooks.Open('${escapedPath}', 0, $true)`,
    '  foreach ($ws in $wb.Worksheets) {',
    '    Write-Output ("=== Sheet: " + $ws.Name + " ===")',
    '    $range = $ws.UsedRange',
    '    if ($range) {',
    '      for ($r = 1; $r -le $range.Rows.Count; $r++) {',  // no cap
    '        $row = @()',
    '        for ($c = 1; $c -le $range.Columns.Count; $c++) {',
    '          $row += $range.Cells.Item($r, $c).Text',
    '        }',
    '        if (($row | Where-Object { $_ -ne \'\' }).Count -gt 0) {',
    '          Write-Output ($row -join "`t")',
    '        }',
    '      }',
    '    }',
    "    Write-Output ''",
    '  }',
    '  $wb.Close($false)',
    '  $excel.Quit()',
    '  [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null',
    '} catch {',
    '  Write-Error "Excel COM failed: $_"',
    '  exit 1',
    '}',
  ].join('\n');
  fs.writeFileSync(tmpPs, psScript, 'utf-8');
  const result = execSync(`powershell -ExecutionPolicy Bypass -File "${tmpPs}"`, {
    encoding: 'utf-8', timeout: 120000, maxBuffer: 20 * 1024 * 1024,
  });
  if (result.trim()) { console.log(result); process.exit(0); }
} catch (_) { /* fall through */ }

// Last resort: XLSX is a ZIP — extract shared strings + sheet XML
try {
  const escapedPath = filePath.replace(/'/g, "''");
  const cmd = `powershell -Command "Add-Type -A 'System.IO.Compression.FileSystem'; $z = [IO.Compression.ZipFile]::OpenRead('${escapedPath}'); $sheets = $z.Entries | Where-Object { $_.FullName -match 'xl/worksheets/sheet[0-9]+\\.xml$' } | Sort-Object FullName; foreach ($s in $sheets) { $r = New-Object IO.StreamReader($s.Open()); $xml = $r.ReadToEnd(); $r.Close(); $xml = $xml -replace '<[^>]+>', ' '; $xml = $xml.Trim() -replace '\\s+', '\\t'; Write-Output $xml }; $z.Dispose()"`;
  const result = execSync(cmd, { encoding: 'utf-8', timeout: 30000, maxBuffer: 20 * 1024 * 1024 });
  console.log(result.trim() ? result : '[Could not extract spreadsheet data]');
} catch (e) {
  console.error(`Error reading ${filePath}: ${e.message}`);
  process.exit(1);
}
