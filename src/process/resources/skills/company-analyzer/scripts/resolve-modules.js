/**
 * Shared module resolver for company-analyzer scripts.
 * Finds and adds AionUI's node_modules to the require path so bundled
 * packages (xlsx-republish, mammoth, officeparser, etc.) can be loaded.
 */
const fs = require('fs');
const path = require('path');
const Module = require('module');

function findNodeModulesUp(startDir) {
  let d = startDir;
  while (d !== path.dirname(d)) {
    const nm = path.join(d, 'node_modules');
    if (fs.existsSync(path.join(nm, 'xlsx-republish')) || fs.existsSync(path.join(nm, 'mammoth'))) {
      return nm;
    }
    d = path.dirname(d);
  }
  return null;
}

// Search from multiple starting points
const searchPaths = [
  __dirname,                                    // Script location
  process.cwd(),                                // Current working directory
  process.env.AIONUI_APP_PATH || '',           // Explicit app path if set
  process.resourcesPath || '',                  // Electron resources path
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'AionUi'),
  path.join(process.env.PROGRAMFILES || '', 'AionUi'),
];

let found = false;
for (const searchPath of searchPaths) {
  if (!searchPath) continue;
  const nm = findNodeModulesUp(searchPath);
  if (nm) {
    Module.globalPaths.unshift(nm);
    found = true;
    break;
  }
}

if (!found) {
  // Last resort: try common Electron paths
  const electronPaths = [
    path.join(__dirname, '..', '..', '..', '..', 'node_modules'),
    path.join(__dirname, '..', '..', '..', '..', '..', 'node_modules'),
    path.join(__dirname, '..', '..', '..', '..', '..', '..', 'node_modules'),
  ];
  for (const ep of electronPaths) {
    if (fs.existsSync(ep)) {
      Module.globalPaths.unshift(path.resolve(ep));
      break;
    }
  }
}

module.exports = { resolved: found };
