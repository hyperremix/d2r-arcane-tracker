# Debugging Setup

This project includes automated debugging configuration for both Cursor and VS Code.

## Quick Start

### Option 1: Automated Setup (Recommended)

Use the automated dev script that starts the app and updates debug configurations:

```bash
yarn dev:debug
```

This will:
1. Start the development server
2. Wait for the app to initialize
3. Automatically update both Cursor and VS Code debug configurations with the current CDP URL

### Option 2: Manual Setup

If you prefer to run the dev server and update debug settings separately:

```bash
# Terminal 1: Start the dev server
yarn dev

# Terminal 2: Update debug configurations
yarn debug:update
```

## Available Scripts

- `yarn dev:debug` - Start dev server with automatic debug config updates
- `yarn debug:url` - Get the current CDP URL
- `yarn debug:update` - Update Cursor and VS Code debug configurations

## How It Works

1. **Remote Debugging**: The Electron app runs with `--remote-debugging-port=9222` in development mode
2. **CDP URL Discovery**: Scripts query `http://localhost:9222/json` to find the renderer process
3. **Auto-Update**: Debug configurations are automatically updated with the current CDP URL

## Debug Configurations

The scripts update debug configurations in:

- **Cursor**: Updates the browser extension configuration in the SQLite database at `~/Library/Application Support/Cursor/User/globalStorage/state.vscdb` (macOS)
- **VS Code**: `.vscode/launch.json` (project-local)

## Troubleshooting

### CDP URL Not Found
- Make sure the app is running in development mode (`yarn dev`)
- Wait a few seconds after starting the dev server
- Check that port 9222 is not blocked by firewall

### Debug Configuration Not Working
- Restart Cursor/VS Code after running `yarn debug:update`
- Check that the CDP URL is valid by running `yarn debug:url`
- Ensure the app is still running when debugging
- For Cursor: Make sure the browser extension is installed and enabled
- For Cursor: Check that the SQLite database exists at the expected location

### Manual CDP URL
If you need to manually get the CDP URL:

```bash
# Get current CDP URL
yarn debug:url

# Or use curl directly
curl -s http://localhost:9222/json | jq -r '.[] | select(.type == "page" and .title | contains("D2R Arcane Tracker")) | .webSocketDebuggerUrl'
```

## Platform Support

- ✅ macOS
- ✅ Windows
- ✅ Linux

The scripts automatically detect your platform and use the correct paths for Cursor settings.
