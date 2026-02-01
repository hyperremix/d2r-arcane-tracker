#!/usr/bin/env node

/**
 * Script to automatically update Cursor settings with the current CDP URL
 * This script finds the CDP URL and updates Cursor's settings.json
 */

import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

const DEBUG_PORT = 9222;
const APP_TITLE = 'D2R Arcane Tracker';

// Cursor SQLite database paths for different platforms
const CURSOR_DB_PATHS = {
  darwin: path.join(
    os.homedir(),
    'Library',
    'Application Support',
    'Cursor',
    'User',
    'globalStorage',
    'state.vscdb',
  ),
  win32: path.join(
    os.homedir(),
    'AppData',
    'Roaming',
    'Cursor',
    'User',
    'globalStorage',
    'state.vscdb',
  ),
  linux: path.join(os.homedir(), '.config', 'Cursor', 'User', 'globalStorage', 'state.vscdb'),
};

const BROWSER_EXTENSION_KEY = 'anysphere.cursor-browser-extension';

function getCDPUrl() {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:${DEBUG_PORT}/json`, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const targets = JSON.parse(data);
          const rendererTarget = targets.find(
            (target) => target.type === 'page' && target.title && target.title.includes(APP_TITLE),
          );

          if (rendererTarget?.webSocketDebuggerUrl) {
            resolve(rendererTarget.webSocketDebuggerUrl);
          } else {
            reject(
              new Error(
                `No renderer process found for "${APP_TITLE}". Make sure the app is running in development mode.`,
              ),
            );
          }
        } catch (error) {
          reject(new Error(`Failed to parse JSON response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Failed to connect to debug port ${DEBUG_PORT}: ${error.message}`));
    });

    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error(`Timeout connecting to debug port ${DEBUG_PORT}`));
    });
  });
}

function getCursorDbPath() {
  const platform = process.platform;
  const dbPath = CURSOR_DB_PATHS[platform];

  if (!dbPath) {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  return dbPath;
}

function updateCursorSettings(cdpUrl) {
  const dbPath = getCursorDbPath();

  // Check if database exists
  if (!fs.existsSync(dbPath)) {
    console.error(`❌ Cursor database not found at: ${dbPath}`);
    console.log('💡 Make sure Cursor is installed and has been run at least once.');
    return false;
  }

  try {
    const db = new Database(dbPath);

    // First, try to get existing configuration
    const stmt = db.prepare('SELECT value FROM ItemTable WHERE key = ?');
    const row = stmt.get(BROWSER_EXTENSION_KEY);

    let config = {};
    if (row?.value) {
      try {
        // Parse the BLOB as JSON
        const valueStr = row.value.toString('utf8');
        config = JSON.parse(valueStr);
      } catch (parseErr) {
        console.warn(
          `Warning: Could not parse existing browser extension config: ${parseErr.message}`,
        );
        config = {};
      }
    }

    // Update the configuration with new CDP URL
    if (!config.playwrightConfig) {
      config.playwrightConfig = {};
    }

    config.playwrightConfig.connectionType = 'cdp';
    config.playwrightConfig.cdpUrl = cdpUrl;

    // Convert back to BLOB
    const updatedValue = JSON.stringify(config);
    const buffer = Buffer.from(updatedValue, 'utf8');

    // Update or insert the configuration
    const updateStmt = db.prepare('INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)');
    updateStmt.run(BROWSER_EXTENSION_KEY, buffer);

    console.log(`✅ Updated Cursor browser extension config with CDP URL: ${cdpUrl}`);
    console.log(`📁 Database: ${dbPath}`);

    db.close();
    return true;
  } catch (error) {
    console.error(`❌ Failed to update Cursor database: ${error.message}`);
    return false;
  }
}

function updateVSCodeLaunchConfig(cdpUrl) {
  const launchPath = path.join(process.cwd(), '.vscode', 'launch.json');

  if (!fs.existsSync(launchPath)) {
    console.log('📝 Creating VS Code launch configuration...');
    const vscodeDir = path.dirname(launchPath);
    if (!fs.existsSync(vscodeDir)) {
      fs.mkdirSync(vscodeDir, { recursive: true });
    }
  }

  let launchConfig = {
    version: '0.2.0',
    configurations: [],
  };

  // Read existing launch config if it exists
  if (fs.existsSync(launchPath)) {
    try {
      const launchContent = fs.readFileSync(launchPath, 'utf8');
      launchConfig = JSON.parse(launchContent);
    } catch (error) {
      console.warn(`Warning: Could not parse existing VS Code launch config: ${error.message}`);
    }
  }

  // Find existing D2R Arcane Tracker configuration or create new one
  const configIndex = launchConfig.configurations.findIndex(
    (config) => config.name === 'D2R Arcane Tracker (CDP)',
  );

  const cdpConfig = {
    name: 'D2R Arcane Tracker (CDP)',
    type: 'node',
    request: 'attach',
    port: 9222,
    address: 'localhost',
    // biome-ignore lint/suspicious/noTemplateCurlyInString: VS Code variable placeholder, not a template literal
    localRoot: '${workspaceFolder}',
    // biome-ignore lint/suspicious/noTemplateCurlyInString: VS Code variable placeholder, not a template literal
    remoteRoot: '${workspaceFolder}',
    webSocketUrl: cdpUrl,
    skipFiles: ['<node_internals>/**'],
    console: 'integratedTerminal',
  };

  if (configIndex >= 0) {
    launchConfig.configurations[configIndex] = cdpConfig;
  } else {
    launchConfig.configurations.push(cdpConfig);
  }

  // Write the updated launch config
  try {
    fs.writeFileSync(launchPath, JSON.stringify(launchConfig, null, 2));
    console.log(`✅ Updated VS Code launch configuration with CDP URL: ${cdpUrl}`);
    console.log(`📁 Launch file: ${launchPath}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to write VS Code launch config: ${error.message}`);
    return false;
  }
}

async function main() {
  try {
    console.log('🔍 Looking for D2R Arcane Tracker CDP URL...');
    const cdpUrl = await getCDPUrl();
    console.log(`📡 Found CDP URL: ${cdpUrl}`);

    console.log('📝 Updating Cursor browser extension config...');
    const cursorSuccess = updateCursorSettings(cdpUrl);

    console.log('📝 Updating VS Code launch configuration...');
    const vscodeSuccess = updateVSCodeLaunchConfig(cdpUrl);

    if (cursorSuccess && vscodeSuccess) {
      console.log('🎉 Debug configurations updated successfully!');
      console.log('💡 You can now use the browser extension in Cursor with the updated CDP URL.');
      console.log('🔧 Both Cursor browser extension and VS Code configurations have been updated.');
    } else {
      console.warn('⚠️  Some configurations may not have been updated successfully.');
      console.log(
        '💡 This is usually fine - configurations will be updated once the app is running.',
      );
    }
  } catch (error) {
    console.warn(`⚠️  Could not update debug configurations: ${error.message}`);
    console.log('💡 This is expected if the app is not running yet.');
    console.log('💡 Debug configurations will be updated automatically once the app starts.');
    console.log('💡 You can manually run "bun run debug:update" after starting the app.');
    // Don't exit with error code - this is a non-critical warning
  }
}

// Run the script
main();
