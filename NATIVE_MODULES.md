# Native Modules Compatibility

This project uses `better-sqlite3`, a native Node.js module that needs to be compiled for specific Node.js versions. Since this is an Electron app, we need to ensure compatibility between:

- **Node.js environment** (for development scripts like `yarn seed:test`)
- **Electron environment** (for the actual application)

## The Problem

`better-sqlite3` is compiled with different NODE_MODULE_VERSION values:
- Node.js v22.15.0 uses NODE_MODULE_VERSION 127
- Electron v30.5.1 uses NODE_MODULE_VERSION 123

When you run `electron-builder install-app-deps`, it compiles the module for Electron, making it incompatible with Node.js scripts.

## The Solution

We've implemented an automated setup script that:

1. **Detects the current environment** (Node.js vs Electron)
2. **Automatically rebuilds** `better-sqlite3` for the correct environment
3. **Integrates seamlessly** with existing scripts

### Available Scripts

```bash
# Automatically rebuilds for the current environment
yarn setup:native

# Rebuilds specifically for Electron
yarn rebuild:electron

# Rebuilds specifically for Node.js
yarn rebuild:node

# Seeds test data (automatically handles native modules)
yarn seed:test
```

### How It Works

The `scripts/setup-native-modules.js` script:

1. Detects if running in Electron or Node.js environment
2. Shows current versions of both Node.js and Electron
3. Runs the appropriate rebuild command
4. Provides helpful feedback and tips

### When to Use

You should run the setup script when:

- **After installing dependencies** (`yarn install` or `npm install`)
- **After switching between Node.js and Electron environments**
- **When you get NODE_MODULE_VERSION errors**
- **Before running development scripts** (already integrated into `yarn seed:test`)

### Manual Commands

If you need to manually rebuild:

```bash
# For Node.js environment
npm rebuild better-sqlite3

# For Electron environment
npx electron-rebuild --force --module-dir . --which-module better-sqlite3
```

### Troubleshooting

If you encounter NODE_MODULE_VERSION errors:

1. Run `yarn setup:native` to automatically fix the issue
2. Check that you're using the correct Node.js version (v22.15.0)
3. Ensure Electron is properly installed (`npx electron --version` should show v30.5.1)

### Integration

The setup script is automatically integrated into:

- `yarn seed:test` - Runs setup before seeding test data
- `yarn postinstall` - Runs setup after installing dependencies
- `yarn rebuild:native` - Alias for the setup script

This ensures that native modules are always compatible with the current environment.
