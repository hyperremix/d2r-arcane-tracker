# Release Guide

This document provides comprehensive instructions for building and distributing D2R Arcane Tracker across different platforms.

## Prerequisites

### Development Environment

- **Node.js** v22.15.0 or higher
- **Yarn** package manager
- **Git** for version control

### Platform-Specific Requirements

#### Windows Builds (from macOS/Linux)

- **Wine** (optional, for testing Windows installers)
- **Cross-platform compilation** requires proper native module handling

#### Code Signing (Optional but Recommended)

- **Windows**: Code signing certificate (EV certificate recommended)
- **macOS**: Apple Developer account and certificates
- **Linux**: No signing required for most distributions

## Building for Release

### Platform-Specific Builds

```bash
# Build for Windows only
yarn build:win

# Build for macOS only
yarn build:mac

# Build for Linux only
yarn build:linux

# Build for all platforms
yarn build
```

### Build Outputs

Built applications will be available in `release/${version}/`:

- **Windows**: `D2R Arcane Tracker-Windows-${version}-Setup.exe`
- **macOS**: `D2R Arcane Tracker-Mac-${version}-Installer.dmg`
- **Linux**: `D2R Arcane Tracker-Linux-${version}.AppImage`

**Current Version**: 0.1.0

## Native Module Considerations

This application uses several native modules that require special handling during packaging:

### Critical Native Dependencies

1. **better-sqlite3** - SQLite database engine
2. **@dschu012/d2s** - Diablo II save file parser

### Configuration

The `electron-builder.json5` configuration includes:

```json5
"asarUnpack": [
  "**/node_modules/better-sqlite3/**/*",
  "**/node_modules/@dschu012/**/*"
]
```

This ensures native `.node` binaries are unpacked from the ASAR archive and remain accessible at runtime.

### Troubleshooting Native Modules

If you encounter issues with native modules:

1. **Rebuild for target platform**:

   ```bash
   # For Electron (production)
   yarn dev  # This runs electron-rebuild automatically
   
   # Manual rebuild
   npx electron-rebuild --force --module-dir . --which-module better-sqlite3
   ```

2. **Check Node.js version compatibility**:
   - Development: Node.js v22.15.0 (NODE_MODULE_VERSION 127)
   - Production: Electron v30.0.1 (NODE_MODULE_VERSION 123)

## Windows Distribution

### Building Windows Installer from macOS

Cross-platform builds for Windows from macOS are supported but require attention to native modules:

1. **Ensure proper native module configuration**:

   ```bash
   # The asarUnpack configuration in electron-builder.json5 handles this
   yarn build:win
   ```

2. **Test the installer** (if Wine is available):

   ```bash
   # Install Wine on macOS
   brew install --cask wine-stable
   
   # Test the installer
   wine "release/0.0.1/D2R Arcane Tracker-Windows-0.0.1-Setup.exe"
   ```

### Windows-Specific Configuration

#### Icon Format

- Uses `build/icon.png`
- Must be in ICO format for proper Windows integration
- Supports multiple resolutions in single ICO file

#### Installer Behavior

- **NSIS installer** with custom configuration
- **Per-user installation** (not system-wide)
- **Custom installation directory** allowed
- **App data preserved** on uninstall

#### Windows Defender / Antivirus

- Unsigned applications may trigger warnings
- Users may need to click "More info" → "Run anyway"
- Code signing eliminates these warnings

## Code Signing Setup

### Windows Code Signing

#### Prerequisites

- Code signing certificate (EV certificate recommended)
- Certificate must be installed in Windows Certificate Store
- Access to Windows machine or Wine for signing

#### Configuration

Add to `electron-builder.json5`:

```json5
"win": {
  "certificateFile": "path/to/certificate.p12",
  "certificatePassword": "password",
  "signingHashAlgorithms": ["sha256"],
  "sign": "path/to/sign-tool.exe"
}
```

#### Signing Process

```bash
# Sign the installer after build
yarn build:win
# Signing happens automatically if configured
```

### macOS Code Signing

#### Prerequisites

- Apple Developer account
- Developer certificates installed in Keychain
- App Store Connect app record (for notarization)

#### Configuration

```json5
"mac": {
  "identity": "Developer ID Application: Your Name (TEAM_ID)",
  "hardenedRuntime": true,
  "notarize": {
    "teamId": "TEAM_ID"
  }
}
```

## Testing Releases

### Pre-Release Testing Checklist

- [ ] **Installation Test**: Install on clean system
- [ ] **Functionality Test**: Core features work correctly
- [ ] **Save File Detection**: D2R save files are detected
- [ ] **Database Operations**: SQLite database works properly
- [ ] **Native Modules**: No module loading errors
- [ ] **Icon Display**: Application icon shows correctly
- [ ] **Auto-Update**: Update mechanism works (if configured)
- [ ] **Uninstall**: Clean removal of application

### Platform-Specific Testing

#### Windows Testing

- [ ] Installer runs without errors
- [ ] Application launches from Start Menu
- [ ] Icon displays in taskbar
- [ ] No antivirus false positives
- [ ] Save file monitoring works
- [ ] Database operations function

#### macOS Testing

- [ ] DMG mounts and installs correctly
- [ ] Application launches from Applications folder
- [ ] No Gatekeeper warnings (if signed)
- [ ] Native modules load properly

#### Linux Testing

- [ ] AppImage is executable
- [ ] Application launches correctly
- [ ] File permissions are correct
- [ ] Desktop integration works

## Distribution

### GitHub Releases

1. **Create Release**:
   - Tag version: `v0.0.1`
   - Title: `D2R Arcane Tracker v0.0.1`
   - Description: Include changelog and installation notes

2. **Upload Artifacts**:
   - Upload Windows installer
   - Upload macOS DMG
   - Upload Linux AppImage
   - Include SHA256 checksums

3. **Release Notes Template**:

   ```markdown
   ## D2R Arcane Tracker v0.0.1
   
   ### New Features
   - Initial release
   - Holy Grail tracking
   - Automatic save file monitoring
   
   ### Installation
   - **Windows**: Download and run the `.exe` installer
   - **macOS**: Download and open the `.dmg` file
   - **Linux**: Download and run the `.AppImage`
   
   ### System Requirements
   - Windows 10+, macOS 10.15+, or Linux
   - Diablo II: Resurrected installed
   ```

### Alternative Distribution

- **Direct Download**: Host files on project website
- **Package Managers**: Consider Windows Package Manager, Homebrew Cask
- **App Stores**: Future consideration for Microsoft Store, Mac App Store

## Troubleshooting

### Common Build Issues

#### Native Module Errors

```
Error: The module 'better-sqlite3' was compiled against a different Node.js version
```

**Solution**: Run `yarn dev` to rebuild native modules for Electron

#### Cross-Platform Build Issues

```
Error: Cannot find module 'better-sqlite3'
```

**Solution**: Ensure `asarUnpack` configuration includes all native modules

#### Icon Issues

```
Warning: Icon file not found or invalid format
```

**Solution**: Verify `build/icon.png` exists and is valid ICO format

### Platform-Specific Issues

#### Windows

- **"Unknown Publisher" Warning**: Normal for unsigned apps, document for users
- **Antivirus False Positive**: Common with Electron apps, consider code signing
- **Path Length Issues**: Ensure install path doesn't exceed Windows limits

#### macOS

- **Gatekeeper Warnings**: Expected for unsigned apps
- **Notarization Issues**: Required for distribution outside App Store

#### Linux

- **Permission Issues**: Ensure AppImage has execute permissions
- **Missing Dependencies**: AppImage should be self-contained

## Security Considerations

### Code Signing Benefits

- Eliminates "Unknown Publisher" warnings
- Prevents tampering with distributed files
- Improves user trust and adoption
- Required for some enterprise environments

### Unsigned Distribution

- Users will see security warnings
- May be blocked by enterprise firewalls
- Document the warnings and provide guidance
- Consider community-driven verification (GitHub releases with checksums)

## Future Improvements

### Automated Releases

- GitHub Actions for automated building
- Automated code signing (with secure secrets)
- Automated upload to GitHub Releases
- Automated testing across platforms

### Update Mechanism

- Implement electron-updater
- Host update server
- Configure automatic update checks
- Handle update rollback scenarios

### Enhanced Distribution

- Windows Package Manager integration
- Homebrew Cask for macOS
- Snap package for Linux
- Microsoft Store submission

---

## Quick Reference

### Build Commands

```bash
yarn build:win    # Windows installer
yarn build:mac    # macOS DMG
yarn build:linux  # Linux AppImage
yarn build        # All platforms
```

### Key Files

- `electron-builder.json5` - Build configuration
- `build/icon.png` - icon

### Release Checklist

- [ ] Version bump in package.json
- [ ] Update CHANGELOG.md
- [ ] Run tests: `yarn test`
- [ ] Build for all platforms
- [ ] Test installers
- [ ] Create GitHub release
- [ ] Upload artifacts
- [ ] Update documentation
