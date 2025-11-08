# Terror Zone Configuration Guide

A comprehensive guide to using D2R Arcane Tracker's Terror Zone Configuration feature to customize which terror zones are active in your Diablo II: Resurrected installation.

## Table of Contents

- [Introduction](#introduction)
  - [What are Terror Zones?](#what-are-terror-zones)
  - [Why Customize Terror Zones?](#why-customize-terror-zones)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Accessing the Feature](#accessing-the-feature)
  - [Initial Setup](#initial-setup)
- [Using Terror Zone Configuration](#using-terror-zone-configuration)
  - [Zone Management Interface](#zone-management-interface)
  - [Individual Zone Controls](#individual-zone-controls)
  - [Global Controls](#global-controls)
  - [Search and Filtering](#search-and-filtering)
  - [Zone Details](#zone-details)
- [Safety Features](#safety-features)
  - [Automatic Backup](#automatic-backup)
  - [Restore Functionality](#restore-functionality)
  - [Validation System](#validation-system)
- [Best Practices](#best-practices)
  - [Before Making Changes](#before-making-changes)
  - [After Making Changes](#after-making-changes)
  - [Troubleshooting](#troubleshooting)
- [Technical Details](#technical-details)
  - [File Structure](#file-structure)
  - [Configuration Storage](#configuration-storage)
  - [Zone Information](#zone-information)

---

## Introduction

### What are Terror Zones?

Terror Zones are special areas in Diablo II: Resurrected that rotate on a schedule, providing enhanced monster levels and better loot drops. The terror zone system includes 36 different zones across all acts of the game, each containing multiple levels and waypoints.

**Key Characteristics:**

- **Enhanced Monster Levels**: Monsters in terror zones are scaled to your character level
- **Better Loot Drops**: Increased chance for high-quality items and runes
- **Rotating Schedule**: Different zones become active on a rotating basis
- **All Acts Covered**: Terror zones span all five acts of the game

### Why Customize Terror Zones?

Customizing terror zones allows you to:

**Focus Your Farming:**

- Enable only zones that drop items you're hunting for
- Disable zones that don't interest you
- Create custom terror zone rotations

**Optimize Your Experience:**

- Avoid zones you find boring or inefficient
- Focus on areas with better monster density
- Target specific item types or runes

**Content Creation:**

- Create predictable schedules for streaming
- Focus on specific areas for content
- Customize the experience for your audience

**Testing and Experimentation:**

- Try different zone combinations
- Test specific farming strategies
- Experiment with zone preferences

---

## Getting Started

### Prerequisites

Before using the Terror Zone Configuration feature, ensure you have:

1. **Diablo II: Resurrected Installed**: The feature requires a valid D2R installation
2. **D2R Installation Path Configured**: Set your D2R installation path in the app settings
3. **All Game Files Extracted**: D2R stores files in CASC (Content Addressable Storage Container) format. **All game files must be extracted** for this feature to work (not just individual folders).

   **Detailed Extraction Steps:**
   1. Download [Ladik's CASC Viewer](https://www.zezula.net/en/casc/main.html)
   2. Open the x64 version (or appropriate version for your OS)
   3. In CASC Viewer, click "Open Storage"
   4. Select your D2R folder (e.g., `C:\Program Files (x86)\Diablo II Resurrected`)
   5. Click "data" on the left side of the screen
   6. Click "data" again from the newly opened options, then click "Extract" at the top
   7. Wait for extraction to complete (~40GB of data: global, hd, and local folders will be extracted to a work folder in CascView.exe's current location)
   8. Once finished, move these 3 folders (global, hd, local) to `C:\Program Files (x86)\Diablo II Resurrected\Data`
   9. **Important**: Place these folders in the top-most Data folder (there's another data folder inside, but use the top-most one)
4. **Launch D2R with `-txt` Flag**: For D2R to use the extracted files:
   - Create a shortcut to your D2R executable (`D2R.exe`)
   - Right-click the shortcut and select "Properties"
   - In the "Target" field, add `-txt` at the end (e.g., `"C:\Program Files (x86)\Diablo II Resurrected\D2R.exe" -txt`)
   - Always launch D2R using this shortcut for terror zone modifications to take effect
   - Without the `-txt` flag, D2R will ignore the extracted files and use CASC archives
5. **Write Permissions**: The app needs to modify files in your D2R installation directory
6. **D2R Closed**: Always ensure D2R is completely closed before making changes

### Accessing the Feature

Navigate to the Terror Zone Configuration by:

1. **Click the Alert Triangle Icon**: Located in the top navigation bar between Runeword Calculator and Settings
2. **Direct Navigation**: The feature is accessible at `/terror-zones` in the app

### Initial Setup

When you first access the Terror Zone Configuration:

1. **Path Validation**: The app will check if your D2R installation path is correct
2. **File Verification**: It will verify that the `desecratedzones.json` file exists
3. **Backup Creation**: On first use, an automatic backup of the original file is created
4. **Zone Loading**: All 36 terror zones are loaded and displayed

---

## Using Terror Zone Configuration

### Zone Management Interface

The main interface provides:

**Header Section:**

- **Warning Alert**: Clear information about game file modification
- **Validation Status**: Shows whether your D2R path is valid
- **Error Display**: Shows any issues that need attention

**Control Section:**

- **Search Bar**: Find specific zones by name
- **Progress Counter**: Shows how many zones are enabled
- **Global Buttons**: Enable All, Disable All, and Restore Original

**Zone List:**

- **Individual Zone Cards**: Each zone with its own controls
- **Zone Information**: Name, ID, and included levels
- **Toggle Controls**: Enable/disable and "Only" buttons

### Individual Zone Controls

Each terror zone has:

**Zone Information:**

- **Zone Name**: Human-readable name (e.g., "Burial Grounds, Crypt, and Mausoleum")
- **Zone ID**: Numeric identifier
- **Level Details**: Expandable list of included levels and waypoints

**Control Buttons:**

- **Toggle Switch**: Enable or disable the zone
- **"Only" Button**: Enable only this zone while disabling all others

**Visual Indicators:**

- **Enabled Zones**: Highlighted or marked with checkmarks
- **Disabled Zones**: Shown in a different style
- **Loading States**: Visual feedback during operations

### Global Controls

**Enable All:**

- Enables all 36 terror zones
- Useful for returning to the default state
- Confirms the action before applying

**Disable All:**

- Disables all terror zones
- Creates a custom rotation with no active zones
- Useful for testing or specific scenarios

**Restore Original:**

- Restores the original `desecratedzones.json` file from backup
- Clears all custom configurations
- Requires confirmation before proceeding

### Search and Filtering

**Search Functionality:**

- **Real-time Search**: Filter zones as you type
- **Case-insensitive**: Works regardless of capitalization
- **Partial Matching**: Find zones with partial name matches

**Search Examples:**

- Search "burial" to find "Burial Grounds, Crypt, and Mausoleum"
- Search "tomb" to find "Tal Rasha's Tombs"
- Search "chaos" to find "Chaos Sanctuary"

### Zone Details

Click "Show Levels" to see:

**Level Information:**

- **Level IDs**: Internal game level identifiers
- **Waypoint Information**: Which waypoints are associated with each level
- **Level Structure**: How levels are organized within the zone

**Example Zone Details:**

```
Burial Grounds, Crypt, and Mausoleum
├── Level 17 (Burial Grounds) - WP: Cold Plains (3)
├── Level 18 (The Crypt)
└── Level 19 (Mausoleum)
```

---

## Safety Features

### Automatic Backup

**Backup Creation:**

- **First Use**: Backup is created automatically when you first modify zones
- **Immutable Backup**: The backup file is never modified
- **User Data Storage**: Backup is stored in the app's user data directory
- **File Naming**: Backup is named `desecratedzones.json.bak`

**Backup Location:**

- **Windows**: `%APPDATA%/d2r-arcane-tracker/desecratedzones.json.bak`
- **macOS**: `~/Library/Application Support/d2r-arcane-tracker/desecratedzones.json.bak`
- **Linux**: `~/.config/d2r-arcane-tracker/desecratedzones.json.bak`

### Restore Functionality

**Restore Process:**

1. **Confirmation Dialog**: Asks for confirmation before restoring
2. **File Replacement**: Replaces the current file with the backup
3. **Configuration Reset**: Clears your custom zone preferences
4. **Database Update**: Updates the app's database to reflect the restore

**When to Restore:**

- **Issues with Game**: If D2R doesn't launch or has problems
- **Want to Reset**: If you want to return to the default configuration
- **Testing Complete**: After experimenting with different configurations

### Validation System

**Path Validation:**

- **Installation Check**: Verifies D2R installation path exists
- **File Verification**: Checks that `desecratedzones.json` exists
- **Structure Validation**: Ensures the file has the correct format
- **Permission Check**: Verifies write access to the game directory

**Error Handling:**

- **Clear Error Messages**: User-friendly error descriptions
- **Recovery Suggestions**: Guidance on how to fix issues
- **Status Indicators**: Visual feedback on validation status

---

## Best Practices

### Before Making Changes

**Essential Preparations:**

1. **Close D2R Completely**: Ensure the game is not running
2. **Verify Installation Path**: Check that your D2R path is correct in settings
3. **Backup Save Files**: Consider backing up your save files as extra precaution
4. **Check Permissions**: Ensure you have write access to the game directory

**Verification Steps:**

- Use the validation status in the app to confirm everything is ready
- Check that the D2R installation path points to the correct directory
- Verify that the `desecratedzones.json` file exists and is accessible

### After Making Changes

**Immediate Actions:**

1. **Restart D2R**: Changes only take effect after restarting the game
2. **Test Game Launch**: Ensure D2R starts normally
3. **Verify Changes**: Check that your selected terror zones are active
4. **Monitor for Issues**: Watch for any problems during gameplay

**Verification Methods:**

- **In-Game Check**: Look for terror zone indicators in the game
- **Zone Rotation**: Observe if the terror zone schedule matches your configuration
- **Game Stability**: Ensure the game runs without crashes or errors

### Troubleshooting

**Common Issues and Solutions:**

**"D2R installation path is not configured":**

- Go to Settings and configure your D2R installation path
- Ensure the path points to the main D2R directory (not a subdirectory)

**"desecratedzones.json not found":**

- The file is stored in CASC format and must be extracted first
- **Important**: You must extract all game files using the detailed steps in the [Prerequisites](#prerequisites) section
- After extraction, check that the file exists at `{D2R Path}/Data/hd/global/excel/desecratedzones.json`
- Verify your D2R installation is complete
- Reinstall D2R if the file is missing after extraction

**"Game files are in CASC format and not accessible":**

- D2R stores game files in CASC (Content Addressable Storage Container) format by default
- These files cannot be accessed directly without extraction
- Use [Ladik's CASC Viewer](https://www.zezula.net/en/casc/main.html) to extract all game files
- Follow the step-by-step instructions in the [Prerequisites](#prerequisites) section
- After extraction, the files will be accessible as regular files on disk

**"Changes not taking effect in game":**

- Ensure you've extracted **all game files**, not just individual folders
- Verify you're launching D2R with the `-txt` flag (see [Prerequisites](#prerequisites))
- Without the `-txt` flag, D2R ignores extracted files and uses CASC archives
- Create a shortcut with the `-txt` flag and always launch D2R using that shortcut
- Restart D2R completely after making changes

**"Invalid desecratedzones.json file structure":**

- The game file may be corrupted
- Use the "Restore Original" button to fix the file
- If issues persist, verify your D2R installation

**Game won't start after changes:**

- Use the "Restore Original" button immediately
- Check that D2R is completely closed before making changes
- Verify you have write permissions to the game directory

**Changes not taking effect:**

- Ensure you restarted D2R after making changes
- Check that the game file was actually modified
- Verify your zone selections are saved in the app

---

## Technical Details

### File Structure

**Game File Location:**

```
{D2R Installation Path}/Data/hd/global/excel/desecratedzones.json
```

**File Format:**

- **JSON Structure**: Contains an array of terror zone configurations
- **Zone Objects**: Each zone has an ID, name, and level array
- **Level Details**: Each level includes level_id and optional waypoint_level_id

**Example Structure:**

```json
{
  "desecrated_zones": [
    {
      "zones": [
        {
          "id": 1,
          "levels": [
            {
              "level_id": 17,
              "waypoint_level_id": 3
            }
          ]
        }
      ]
    }
  ]
}
```

### Configuration Storage

**Database Storage:**

- **Settings Table**: Zone preferences stored in the app's SQLite database
- **JSON Format**: Configuration stored as JSON string
- **Persistence**: Settings persist between app restarts
- **Automatic Application**: Configuration applied when the app starts

**Storage Format:**

```json
{
  "1": true,   // Zone 1 enabled
  "2": false,  // Zone 2 disabled
  "3": true    // Zone 3 enabled
}
```

### Zone Information

**Total Zones**: 36 terror zones across all acts

**Zone Categories:**

- **Act I**: Burial Grounds, Cathedral, Cold Plains, Dark Wood, Blood Moor, etc.
- **Act II**: Lut Gholein Sewers, Stony Tomb, Dry Hills, Far Oasis, etc.
- **Act III**: Spider Forest, Great Marsh, Flayer Jungle, Kurast Bazaar, etc.
- **Act IV**: Outer Steppes, City of the Damned, Chaos Sanctuary
- **Act V**: Bloody Foothills, Arreat Plateau, Crystalline Passage, etc.

**Zone Properties:**

- **Unique IDs**: Each zone has a unique numeric identifier (1-36)
- **Human-Readable Names**: Descriptive names for easy identification
- **Level Arrays**: Each zone contains multiple game levels
- **Waypoint Information**: Associated waypoints for navigation

---

## Conclusion

The Terror Zone Configuration feature in D2R Arcane Tracker provides unprecedented control over your Diablo II: Resurrected experience. Whether you're focused on efficient farming, creating content, or experimenting with different configurations, this feature allows you to customize the terror zone system to match your preferences.

**Key Benefits:**

- **Complete Control**: Enable or disable any of the 36 terror zones
- **Safety First**: Automatic backup and restore functionality
- **User-Friendly**: Intuitive interface with clear warnings and guidance
- **Flexible**: Support for any zone combination you can imagine

**Remember:**

- Always ensure D2R is closed before making changes
- Restart the game after modifying zone configurations
- Use the restore functionality if you encounter any issues
- Experiment with different configurations to find what works best for you

Happy farming, and may your custom terror zone rotations bring you the items you seek!

---

*For more information about D2R Arcane Tracker, see the [Holy Grail Guide](HOLY_GRAIL_GUIDE.md) and [README](../README.md).*
