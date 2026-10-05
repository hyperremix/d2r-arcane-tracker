# Debugging

In development (`bun run dev`), Electron exposes the Chrome DevTools Protocol on port **9222**. The scripts below find the renderer's CDP URL and write it into your editor's debug config.

## Setup

```bash
bun run dev:debug   # start the app, wait ~5 s, then update the debug configs
```

To do it in two steps instead, run `bun run dev`, then `bun run debug:update` in a second terminal once the window is open.

| Script | Purpose |
| --- | --- |
| `bun run dev:debug` | Run `dev`, then `debug:update` |
| `bun run debug:url` | Print the current CDP WebSocket URL |
| `bun run debug:update` | Write the URL into Cursor and VS Code configs |

`debug:update` writes to:

- **VS Code**: `.vscode/launch.json` in the project.
- **Cursor**: the browser-extension setting in Cursor's `state.vscdb` (under `User/globalStorage`; the path is picked per OS).

## Troubleshooting

- **No CDP URL found**: the app must be running via `bun run dev`. Wait a few seconds after the window opens, and check that nothing else is using port 9222.
- **Debugger won't attach**: restart the editor after `debug:update`, and check the URL with `bun run debug:url`. The URL changes every time the app restarts. In Cursor, make sure the browser extension is enabled.
- **Without the scripts**: `curl -s http://localhost:9222/json` lists the targets. Use the `webSocketDebuggerUrl` of the page titled "D2R Arcane Tracker". You can also open DevTools from the app window.
