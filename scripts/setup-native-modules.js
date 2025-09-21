#!/usr/bin/env node

/**
 * Setup script for native modules compatibility
 * This script ensures better-sqlite3 works in both Node.js and Electron environments
 */

import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODULE_NAME = 'better-sqlite3';
const _MODULE_PATH = path.join(__dirname, '..', 'node_modules', MODULE_NAME);

console.log('🔧 Setting up native modules for compatibility...');

function runCommand(command, description) {
  console.log(`📦 ${description}...`);
  try {
    execSync(command, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    console.log(`✅ ${description} completed`);
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    process.exit(1);
  }
}

function getNodeVersion() {
  return process.version;
}

function getElectronVersion() {
  try {
    const result = execSync('npx electron --version', { encoding: 'utf8' });
    return result.trim();
  } catch {
    return null;
  }
}

function main() {
  const nodeVersion = getNodeVersion();
  const electronVersion = getElectronVersion();

  console.log(`🟢 Node.js version: ${nodeVersion}`);
  if (electronVersion) {
    console.log(`⚡ Electron version: ${electronVersion}`);
  }

  // Check if we're in an Electron environment
  const isElectron = process.versions.electron !== undefined;

  if (isElectron) {
    console.log('🔍 Detected Electron environment');
    runCommand(
      `npx electron-rebuild --force --module-dir . --which-module ${MODULE_NAME}`,
      'Rebuilding for Electron',
    );
  } else {
    console.log('🔍 Detected Node.js environment');
    runCommand(`npm rebuild ${MODULE_NAME}`, 'Rebuilding for Node.js');
  }

  console.log('🎉 Native modules setup completed!');
  console.log('\n💡 Tip: If you switch between Node.js and Electron environments,');
  console.log('   run this script again to ensure compatibility.');
}

// Run main function if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main };
