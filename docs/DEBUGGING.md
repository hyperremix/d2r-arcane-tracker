# Debugging

In development (`bun run dev`), Electron exposes the Chrome DevTools Protocol (CDP) on port **9222** (see `electron/main.ts`). Packaged builds don't open the port.

## Attach from VS Code or Cursor

Add this configuration to `.vscode/launch.json` (the folder is gitignored, so each contributor keeps their own copy):

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Attach to renderer",
      "type": "chrome",
      "request": "attach",
      "port": 9222,
      "webRoot": "${workspaceFolder}"
    }
  ]
}
```

1. Run `bun run dev` and wait for the window to open.
2. Start **Attach to renderer** from the Run and Debug view.

By default the debugger attaches to every open app window (the main window, the widget, ...). To choose one window instead, add `"targetSelection": "pick"` to the configuration.

The port is fixed, so the configuration keeps working across app restarts.

## Other ways to debug

- **DevTools**: press `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (macOS) in the main window. This also works in packaged builds.
- **Chrome**: open `chrome://inspect`, add `localhost:9222` under **Configure…**, and inspect the "D2R Arcane Tracker" page.
- **Targets**: `curl -s http://localhost:9222/json` lists the targets with their `webSocketDebuggerUrl`.

## Troubleshooting

- **Debugger won't attach**: the app must be running via `bun run dev`, and nothing else may use port 9222. Wait until the window has opened before attaching.
