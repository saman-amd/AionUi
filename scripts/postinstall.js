/**
 * Postinstall script for AionUi
 * Handles native module installation for different environments
 */

const { execSync } = require('child_process');

// Note: web-tree-sitter is now a direct dependency in package.json
// No need for symlinks or copying - npm will install it directly to node_modules

function runPostInstall() {
  try {
    // Check if we're in a CI environment
    const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
    const electronVersion = require('../package.json').devDependencies.electron.replace(/^[~^]/, '');

    console.log(`Environment: CI=${isCI}, Electron=${electronVersion}`);

    if (isCI) {
      // In CI, skip rebuilding to use prebuilt binaries for better compatibility
      // 在 CI 中跳过重建，使用预编译的二进制文件以获得更好的兼容性
      console.log('CI environment detected, skipping rebuild to use prebuilt binaries');
      console.log('Native modules will be handled by electron-forge during packaging');
    } else {
      // In local environment, use electron-builder to install dependencies
      console.log('Local environment, installing app deps');
      execSync('bunx electron-builder install-app-deps', {
        stdio: 'inherit',
        env: {
          ...process.env,
          npm_config_build_from_source: 'true',
        },
      });
    }
  } catch (e) {
    console.error('Postinstall failed:', e.message);
    // Don't exit with error code to avoid breaking installation
  }

  // Apply OpenAI tool schema fix for local model compatibility
  // aioncli-core reads func.parameters (empty) instead of func.parametersJsonSchema (has schema)
  try {
    const fs = require('fs');
    const path = require('path');
    const targetFile = path.join(__dirname, '..', 'node_modules', '@office-ai', 'aioncli-core', 'dist', 'src', 'core', 'openaiContentGenerator.js');
    if (fs.existsSync(targetFile)) {
      let content = fs.readFileSync(targetFile, 'utf-8');
      const buggy = 'this.convertGeminiParametersToOpenAI((func.parameters || {}))';
      const fixed = 'this.convertGeminiParametersToOpenAI((func.parametersJsonSchema || func.parameters || {}))';
      if (content.includes(buggy) && !content.includes('parametersJsonSchema')) {
        content = content.replace(buggy, fixed);
        fs.writeFileSync(targetFile, content, 'utf-8');
        console.log('[Postinstall] Applied OpenAI tool schema fix to aioncli-core');
      }
    }
  } catch (e) {
    console.warn('[Postinstall] Could not apply aioncli-core patch:', e.message);
  }
}

// Only run if this script is executed directly
if (require.main === module) {
  runPostInstall();
}

module.exports = runPostInstall;
