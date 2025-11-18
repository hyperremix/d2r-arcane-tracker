#!/usr/bin/env node

/**
 * Script to get the current CDP URL for the D2R Arcane Tracker renderer process
 * Usage: node scripts/get-cdp-url.js
 */

import http from 'node:http';

const DEBUG_PORT = 9222;
const APP_TITLE = 'D2R Arcane Tracker';

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

// Run the script
getCDPUrl()
  .then((url) => {
    console.log(url);
  })
  .catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
  });
