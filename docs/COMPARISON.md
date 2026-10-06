# Holy Grail Tracker Comparison

This compares D2R Arcane Tracker with other popular Holy Grail trackers. The other tools change over time, so check their sites for current details. For what the challenge is, see the [Holy Grail Guide](HOLY_GRAIL_GUIDE.md).

| | D2R Arcane Tracker | [d2grail.com](https://d2grail.com/) | [diablo2.io](https://diablo2.io/holygrailtracker.php) | [holygrail.link](https://holygrail.link/) | [Nasicus/d2-holy-grail](https://github.com/Nasicus/d2-holy-grail) |
| --- | --- | --- | --- | --- | --- |
| Type | Desktop (Windows) | Web | Web | Desktop (Windows, macOS, Linux) | Web, self-hostable |
| Automatic save import | ✅ Continuous | ❌ | ⚠️ Manual upload | ✅ Continuous | ❌ |
| Works offline | ✅ | ❌ | ❌ | ✅ | ⚠️ Self-hosted |
| Open source | ✅ MIT | ❌ | ❌ | ✅ | ✅ |
| Uniques and sets | ✅ | ✅ | ✅ | ✅ | ✅ |
| Runes | ✅ | ✅ | ✅ | ✅ | ❌ |
| Runewords | ✅ | ✅ | ❌ | ✅ | ❌ |
| Ethereal tracking | ✅ | ✅ | ✅ | ✅ | ✅ |
| Run tracker | ✅ | ❌ | ❌ | ✅ | ❌ |
| Streaming | Overlay widget, notifications | ❌ | ❌ | OBS web feed | ❌ |
| Terror zone configuration | ✅ | ❌ | ❌ | ❌ | ❌ |
| Classic D2 (LoD / PlugY) | ⚠️ Basic | ❌ | ❌ | ✅ | ✅ |
| Account required | No | Yes | Yes | No | Optional |
| Data storage | Local SQLite | Cloud | Cloud | Local | Cloud or self-hosted |

All of them are free. [maxroll.gg](https://maxroll.gg/d2/) is a good reference for builds and farming routes, but it isn't a grail tracker.

## Where each one fits

- **D2R Arcane Tracker** is for offline, hands-off tracking on Windows. Items are recorded as soon as they're detected, so you can sell or drop them afterward and don't need mule characters. It also has a run tracker with exports and a terror zone editor. The trade-offs: it's Windows-only, classic D2 support is limited, and it has no OBS feed.
- **holygrail.link** supports more versions (D2R, LoD, PlugY), runs on more operating systems, and can feed OBS. It's the better pick for classic D2 players and for streamers who want an OBS overlay.
- **d2grail.com** is an established web tracker with a good item database. You mark items by hand and can keep separate grails for ladder, non-ladder, softcore and hardcore.
- **diablo2.io** fits players already using its trading community. You can upload `.d2s` and `.d2i` files to import items once, record drop details, and share your progress by URL.
- **Nasicus/d2-holy-grail** is an open-source web tracker you can host yourself. You enter items by hand, and it only tracks uniques and sets.

## Quick picks

| If you want… | Use |
| --- | --- |
| Automatic offline tracking, no mules, run tracking or terror zones | D2R Arcane Tracker |
| Classic D2 or PlugY, macOS or Linux, or an OBS feed | holygrail.link |
| A web tracker you can use on any device | d2grail.com or diablo2.io |
| Full control over a self-hosted web app | Nasicus/d2-holy-grail |
