# D2RLoader plugin

`d2rl-arcane-tracker.dll` is an optional [D2RLoader](https://d2rloader.net/) plugin that connects the
game to D2R Arcane Tracker running on the same PC. The tracker works without it; with it, players
who launch D2R through D2RLoader get:

- **Holy Grail status on ground items**: the name of a unique, set item or rune lying on the ground
  shows whether the grail still misses it (gold) or already has it (gray), for the normal or the
  ethereal version. It works on D2R 3.3.0 (build 93847) only; see [Ground labels](#ground-labels).
- **Instant pickup alerts**: the tracker hears about a grail item the moment it lands in your
  inventory, belt or cursor, before the game saves.
- **Run tracking from the game itself**: game joins, game exits and area changes.
- **An overlay** with the lines the tracker sends (run timer, grail progress).
- Two actions in D2R's Controls menu (category *Arcane Tracker*, no default key):
  *Show/Hide Arcane Tracker overlay* and *Start/End Arcane Tracker session*.

The plugin reads game state through D2RLoader's SDK services and changes no items. The only game
code it touches is the item name code, for the ground labels (it is a `Client` plugin with
`NativeHooks`), and it talks only to the tracker on `127.0.0.1`. [PROTOCOL.md](PROTOCOL.md)
describes the connection.

## Install and connect

The tracker installs the plugin into `<game>/d2rloader/plugins/` and connects it. The plugin is also
published on the [D2RLoader hub](https://d2rloader.net/hub); the hub package only contains
`plugins/d2rl-arcane-tracker.dll`, so installing it never replaces a connected config.

D2RLoader writes the default config to `<game>/d2rloader/config/arcane-tracker.toml` the first time
the plugin loads (the defaults are in [arcane-tracker.toml](arcane-tracker.toml)). Connecting the
plugin in the tracker edits that file in place: it only replaces the values of `port = <number>`
and `token = "<64 hex characters>"` in the `[arcane-tracker]` table, adding the keys after the
table header when they're missing, and keeps every other line. When the file doesn't exist yet, the
tracker writes only:

```toml
[arcane-tracker]
port = 41733
token = "..."
```

Every key missing from the file keeps its default. The plugin reads the file again every five
seconds, so a new token or setting applies while the game runs. With an empty token it sends
nothing.

Type `arcane-tracker` in the D2RLoader console to see whether the plugin is connected, its last
error, and how many grail items and queued events it has. Problems are logged to the plugin's log
file in the D2RLoader logs folder.

## How it works

Everything that talks to the game runs on D2R's UI thread: the gameplay events (game joined and
left, local player ready, area changed), the input actions and a small task that
queues itself again on every UI update (the pump). The pump reloads the config, compares the
player's items with the items they owned when the player became ready (every `scan_interval_ms`),
and starts the HTTP requests that are due. A UI-thread pump is used instead of a game-thread one
because TCP/IP clients have no local game thread. The pump can't start while D2R loads, so every
overlay frame tries again until it runs, which connects the plugin to the tracker at the main menu.

HTTP responses arrive on a worker thread and the overlay draws on the render thread. Both only use
the state in `bridge_client.cpp` and `tracker_state.cpp`, which is locked. Requests go through
D2RLoader's HTTP service. D2RLoader 1.3.1-beta (SDK 0.3.0) only allows HTTPS there and answers
`Unsupported` to the tracker's plain `http://127.0.0.1` requests, so the plugin then sends them
through WinHTTP (`local_http.cpp`) on a worker thread of its own. Events are queued (at
most 200; the oldest are dropped) while the tracker can't be reached, and the plugin retries the
connection with a growing delay, up to 30 seconds. An event that waited longer than 30 seconds is
dropped instead of sent, and so is the whole queue when the port or token changes, so a tracker that
comes back only sees events that are less than 30 seconds old (a short outage can still replay
recent events).

| File | Purpose |
| --- | --- |
| `src/plugin.cpp` | Entry points, services, listeners, pump, overlay, actions, console command |
| `src/bridge_client.cpp` | HTTP client: hello, event batches, state polling, reconnecting |
| `src/local_http.cpp` | WinHTTP requests to the tracker, for D2RLoader versions that refuse local HTTP |
| `src/tracker_state.cpp` | The grail status table and overlay lines from `GET /v1/state` |
| `src/pickups.cpp` | Finds picked-up items by comparing the player's items |
| `src/grail_item.cpp` | Recognizes uniques, sets and runes and builds their grail keys |
| `src/ground_label.cpp` | The text that goes into the name of a ground item: color marker and the tracker's line |
| `src/ground_hooks.cpp`, `src/ground_hook_stub.asm` | The two hooks into D2R's item name code (MSVC builds only) |
| `src/config.cpp` | Reads the `[arcane-tracker]` table of the config file |

## Ground labels

D2R builds the name of an item on the ground in two places, one for the labels shown while holding
Alt and one for the label under the mouse. `ground_hooks.cpp` hooks both through D2RLoader's inline
hook API. A hook reads the item (it must be on the ground, a unique, set item or rune), finds its
base item code in the game's item table through the data table service, and appends the line from
`ground_label.cpp` to the name. The addresses, the layout of the game's item unit and the item
flags come from build 93847 of D2R 3.3.0, so the hooks are only installed on that build and when the
game still has the bytes they expect; on any other build the plugin logs a line and shows no
labels, and everything else keeps working. A new D2R patch needs new addresses. The labels follow
the game's Reign of the Warlock item table. Set `ground_labels = false` in the config file to turn
them off.
## Build

The build fetches the [D2RLoader Plugin SDK](https://github.com/D2RLoader/PluginSDK) (MIT) at a
pinned commit. It needs CMake 3.29 or later.

With Visual Studio 2022 (MSVC), from the repository root:

```powershell
cmake -S plugin -B plugin/build -A x64
cmake --build plugin/build --config Release
```

The DLL is `plugin/build/Release/d2rl-arcane-tracker.dll`. To bundle it with a local Windows build
of the app, copy it to `plugin/dist/`.

MinGW-w64 also builds it, for example on macOS or Linux with Docker:

```sh
docker run --rm -v "$PWD/plugin":/src:ro ubuntu:24.04 bash -c '
  apt-get update && apt-get install -y --no-install-recommends \
    g++-mingw-w64-x86-64-posix binutils-mingw-w64-x86-64 git ninja-build python3-pip ca-certificates &&
  pip3 install --break-system-packages "cmake>=3.29,<4" &&
  cmake -S /src -B /tmp/build -G Ninja -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_TOOLCHAIN_FILE=/src/cmake/mingw-w64-x86_64.cmake &&
  cmake --build /tmp/build'
```

CI builds the plugin with MSVC on every pull request, and the Windows release of the app builds it
and bundles it from `plugin/dist/`.

## Tests

`tests/plugin_tests.cpp` checks the config parser (`config.cpp`), the state parser
(`tracker_state.cpp`), the ground label text (`ground_label.cpp`) and the WinHTTP client
(`local_http.cpp`, against a one-connection server on 127.0.0.1), which need neither the game nor
D2RLoader. Add `-DARCANE_TRACKER_BUILD_TESTS=ON` to the configure command above and run `ctest --test-dir plugin/build -C Release --output-on-failure`;
CI does this in the *plugin* job. The bridge client (`bridge_client.cpp`: retries, event batches,
dropping old events) and the game hooks need D2RLoader's services and have no automated tests;
[PROTOCOL.md](PROTOCOL.md) is the contract between the plugin and the tracker, and the tracker's
side of it is covered by the app's tests.

## Release on the D2RLoader hub

The plugin has its own version, `project(ArcaneTrackerPlugin VERSION ...)` in
[CMakeLists.txt](CMakeLists.txt). Its releases go to the hub only; they create no GitHub release,
because the app's auto-updater reads this repository's GitHub releases.

The first release is made by hand:

1. Build the package: push a tag (below) without the hub settings, and download the
   `d2rl-arcane-tracker-<version>` artifact of the *Plugin release* workflow run.
2. In the [hub dashboard](https://d2rloader.net/hub/dashboard), create the extension with that zip.
3. Copy the extension's ID into the repository variable `D2RLOADER_PLUGIN_ID`.
4. Create an API token under *Profile → API tokens* and store it as the repository secret
   `D2RLOADER_TOKEN`.

Every later release:

1. Bump the version in `plugin/CMakeLists.txt` and merge it.
2. Push an annotated tag `plugin-vX.Y.Z` with that version; the tag message is the changelog:
   `git tag -a plugin-v1.0.1 -m "Fixes ..." && git push origin plugin-v1.0.1`.

The *Plugin release* workflow checks that the tag matches the version, builds the DLL with MSVC,
packages it as `plugins/d2rl-arcane-tracker.dll` in a zip and uploads it to the hub. The hub scans
it with VirusTotal and may hold it for a moderator before it is published.
