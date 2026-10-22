# D2RLoader Plugin

[D2RLoader](https://d2rloader.net/) is a mod loader that you start instead of D2R. The Arcane Tracker plugin for it connects the game to the app. Everything in the app works the same without it; with it, you also get:

- **Grail status on items on the ground**: the name of a unique, set item or rune lying on the ground gets a line, *Holy Grail: not found yet* in gold or *Holy Grail: already found* in gray, both on the labels you get while holding Alt and when you point at the item. An ethereal item shows the status of the ethereal version. Versions your [grail settings](HOLY_GRAIL_GUIDE.md) don't track show nothing. This works on D2R 3.3.0 (build 93847) only.
- **Instant pickup alerts**: the moment you pick up a unique, set item or rune your grail is missing, the app plays its sound and adds a notification marked *Picked up in game*. The app records the find once the game saves, the same way as without the plugin, and the notification then turns into a regular find without a second sound.
- **Runs that start when you leave town**: with [auto mode](RUN_TRACKER.md#auto-mode-windows-only) on, a run starts when you first leave town in a game and ends when you leave the game, so time spent in town before a run isn't counted. This works even when memory reading doesn't support your D2R version yet.
- **An overlay in the game**: the current run and its time (or the session's run count between runs), your grail progress, and the last missing grail item you picked up in this game.
- **Keybinds in D2R's Controls menu** (category *Arcane Tracker*, no key by default): *Show/Hide Arcane Tracker overlay* and *Start/End Arcane Tracker session*.

D2RLoader plugins only run in offline and TCP/IP games, so the plugin does nothing on Battle.net.

## Setting it up

1. Install D2RLoader into your D2R folder (see [d2rloader.net](https://d2rloader.net/)).
2. In the app, set your D2R folder in **Settings → General → D2R installation**.
3. In **Settings → General → D2RLoader plugin**, turn on **Connect with the plugin**.
4. Select **Install plugin**. D2R is often installed under `Program Files`, where Windows asks for administrator rights before the app can write the plugin into the D2R folder. If you decline, nothing is changed.
5. Restart D2R through D2RLoader. The settings then show *Connected to plugin* and the plugin version.

The plugin is also on the [D2RLoader hub](https://d2rloader.net/hub). If you install it from there, select **Connect plugin** in the app afterwards, so the plugin gets the app's connection settings.

After an app update that ships a new plugin version, the settings offer **Update plugin**. **Remove plugin** deletes the plugin and its config file from the D2R folder. Restart D2R after installing, updating or removing the plugin. **Connect plugin** needs no restart: the plugin reads its config file again every few seconds.

## How the connection works

The app listens on `127.0.0.1` (port 41733 by default), so only programs on your computer can reach it, and only the plugin knows the secret key the app writes into the plugin's config file (`d2rloader/config/arcane-tracker.toml` in your D2R folder). The plugin only reads the game: it changes no items and patches no game code.

If another program uses the port, the settings say so. Enter another port, then select **Connect plugin** so the plugin uses it too.

The plugin's config file also has its options: `overlay` (on or off), `overlay_x` and `overlay_y` (the overlay position as a fraction of the screen), `ground_labels` (on or off) and `scan_interval_ms` (how often your items are checked for pickups, 100 to 5000 milliseconds). Connecting the plugin keeps your changes to them. In the D2RLoader console, `arcane-tracker` shows whether the plugin is connected.

## Importing Run Counter history

If you used the [Run Counter](https://d2rloader.net/hub) plugin, select **Import Run Counter history** in the same settings card. The app reads Run Counter's `runs.csv` and `drops.csv` (from `d2rloader/run-counter` in your D2R folder, or the `data_folder` in Run Counter's config) and adds them to the [Run Tracker](RUN_TRACKER.md):

- A run that starts no more than 30 minutes after the previous run ended joins its session; a longer gap starts a new one.
- Each run keeps its time and duration, and its character if the app knows a character with that name.
- Uniques, set items and runes Run Counter recorded become the run's items. Other drops aren't imported.

Importing again only adds the runs that are new since the last import.

## Limitations

- Runewords show no grail status and aren't announced when made; the save file detection finds them as before.
- The status shows on items on the ground only, not in your inventory, stash or vendors' windows. It needs D2R 3.3.0 (build 93847); after a game patch it stays off until the plugin is updated. The plugin writes a line to its log when it leaves it out.
- The plugin doesn't know which character picked an item up, so pickup notifications name no character until the save confirms them.
- Auto mode stays Windows-only.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| The settings keep showing *Waiting for the plugin* | Start D2R through D2RLoader, in an offline or TCP/IP game. Check that the plugin is installed and up to date, and select **Connect plugin** if the settings offer it. Restart D2R after installing the plugin. |
| *Port … is used by another program* | Enter another port, then select **Connect plugin**. |
| *Nothing was changed* when installing | Windows asked for administrator rights and the request was declined or failed. Try again and accept the prompt, or install the plugin from the D2RLoader hub. |
| Runs don't start | Turn on auto mode in the Run Tracker and start a session. Runs start when you leave town, not when you join a game. |
