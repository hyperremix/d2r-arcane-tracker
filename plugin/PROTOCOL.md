# Arcane Tracker bridge protocol (version 1)

The D2RLoader plugin (`d2rl-arcane-tracker.dll`) and D2R Arcane Tracker talk over HTTP on the
loopback interface. The tracker runs the server; the plugin is the only client. Everything the
plugin sends is untrusted input for the tracker and is validated like IPC input.

## Connection

- The tracker listens on `127.0.0.1:<port>`. The default port is **41733**.
- The plugin reads `port` and `token` from its config file
  (`<game>/d2rloader/config/arcane-tracker.toml`, table `[arcane-tracker]`). The tracker writes both
  when the user connects the plugin. With an empty token the plugin sends nothing.
- Every request carries `Authorization: Bearer <token>`. The tracker answers `401` without it.
- The tracker answers `403` to any request with an `Origin` header (browsers always send one) and
  to a `Host` header other than `127.0.0.1:<port>` or `localhost:<port>` (DNS rebinding).
- Request bodies are JSON (`Content-Type: application/json`), at most 64 KiB.
- Unknown paths answer `404`, wrong methods `405`, invalid bodies `400`. A body over the limit
  answers `413` as soon as the limit is passed; the tracker doesn't read the rest of it and closes
  the connection.

## Endpoints

### `POST /v1/hello`

Sent when the plugin loads, and again after a request failed and the tracker is reachable again.

```json
{ "protocol": 1, "pluginVersion": "1.0.0" }
```

`200` with `{ "protocol": 1 }`. `409` when the tracker doesn't speak the plugin's protocol version;
the plugin then logs it and stops sending.

### `POST /v1/events`

Sends up to 50 events, oldest first. `204` on success. `400` and `413` mean the tracker won't
accept the batch however often it is sent, so the plugin drops it; any other failure counts as a lost
connection and the plugin sends the batch again after the next hello.

The plugin keeps events (at most 200, the oldest dropped first) while the tracker can't be reached,
but only sends events that are less than 30 seconds old. It drops older events, and the whole queue
when its port or token changes. The tracker therefore only sees events that are less than 30 seconds
old after an outage (a short outage can still replay recent events). It applies the events of a
request in order, as they arrive.

```json
{ "events": [ { "type": "game-joined" } ] }
```

| `type` | Fields | When |
| --- | --- | --- |
| `game-joined` | none | `GameJoined` |
| `game-left` | none | `GameLeft` |
| `level-changed` | `levelId` (int, Levels.txt row), `previousLevelId` (int, -1 for the first level of a game) | `LevelChanged` |
| `item-picked-up` | `item` (see below) | An item appears in the inventory, belt or cursor that the player didn't own when the game started |
| `command` | `action`: `"toggle-session"` | The player pressed the plugin's *Start/End Arcane Tracker session* keybind |

`item` describes a grail-relevant item. The plugin sends only uniques, sets and runes. Runewords are
made, not picked up, and the save file detection finds them:

```json
{ "kind": "unique", "recordId": 123, "code": "uap", "ethereal": false }
```

- `kind`: `"unique"`, `"set"` or `"rune"`.
- `recordId`: zero-based row in UniqueItems.txt (`unique`) or SetItems.txt (`set`). `-1` for runes.
- `code`: the item code from the item tables, without padding spaces (for example `r08`).
- `ethereal`: whether the item is ethereal.

### `GET /v1/state?revision=<revision>`

Polled about once per second while the plugin runs. `revision` is the grail revision the plugin
already has (empty on the first request). `200` with a `text/plain; charset=utf-8` body: one record
per line, fields separated by a tab. Values never contain tabs or line breaks. Unknown record types
are ignored, so later tracker versions can add records.

```
revision	<revision>
text	missing	Holy Grail: not found yet
text	found	Holy Grail: already found
text	missing-ethereal	Holy Grail: ethereal not found yet
text	found-ethereal	Holy Grail: ethereal already found
item	u:123:uap	1	2
overlay	Run 12 · 03:21
overlay	Grail 412/1032 (39.9%)
```

- `revision`: identifies the grail status below. Always the first line.
- `text` and `item` records are only sent when the plugin's revision differs from the tracker's;
  they replace everything the plugin had. Without them, the plugin keeps its grail status.
- `text <id> <text>`: label line for each status, already translated.
- `item <key> <normal> <ethereal>`: grail status of an item. Keys are `u:<UniqueItems row>:<code>`,
  `s:<SetItems row>:<code>` and `r:<rune code>`, where `<code>` is the item
  code without padding spaces (for example `u:123:uap`). The code makes a unique or set row that
  doesn't match the item (a mod or a game patch that shifted the rows) show nothing instead of the
  wrong status. Each status is `0` (not tracked), `1` (missing) or `2` (found). The plugin uses the `ethereal` status for ethereal items and the
  `normal` status otherwise, and adds no label line for `0` or unknown keys.
- `overlay <text>`: the overlay lines, top to bottom, already translated and formatted. No
  `overlay` records means the overlay draws nothing.
