#!/usr/bin/env node

/**
 * Development script that starts the app and automatically updates Cursor debug settings
 * This script runs the dev server and then updates Cursor with the CDP URL
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEBUG_UPDATE_DELAY = 5000; // Wait 5 seconds after dev server starts

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`🚀 Running: ${command} ${args.join(' ')}`);

    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options,
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

async function updateCursorSettings() {
  try {
    console.log('⏳ Waiting for dev server to start...');
    await new Promise((resolve) => setTimeout(resolve, DEBUG_UPDATE_DELAY));

    console.log('🔧 Updating Cursor debug settings...');
    await runCommand('node', [path.join(__dirname, 'update-cursor-debug.js')]);
    console.log('✅ Cursor debug settings updated successfully!');
  } catch (_error) {
    // This is expected if the app hasn't fully started yet
    console.log(
      '💡 Debug settings update skipped (app may not be fully started yet - this is normal)',
    );
    console.log('💡 You can manually run: bun run debug:update after the app is running');
  }
}

async function main() {
  try {
    // Start the dev server in the background
    console.log('🎯 Starting D2R Arcane Tracker development server...');

    const devProcess = spawn('bun', ['run', 'dev'], {
      stdio: 'inherit',
      shell: true,
      detached: false,
    });

    // Update Cursor settings after a delay
    updateCursorSettings();

    // Handle process termination
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down development server...');
      devProcess.kill('SIGINT');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Shutting down development server...');
      devProcess.kill('SIGTERM');
      process.exit(0);
    });

    // Wait for the dev process to exit
    devProcess.on('close', (code) => {
      process.exit(code);
    });
  } catch (error) {
    console.error('❌ Error starting development server:', error.message);
    process.exit(1);
  }
}

main();
