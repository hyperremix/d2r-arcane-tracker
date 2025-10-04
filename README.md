# D2R Arcane Tracker

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-blue.svg)](https://reactjs.org/)
[![Electron](https://img.shields.io/badge/Electron-30.0-blue.svg)](https://www.electronjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.1-purple.svg)](https://vitejs.dev/)

> **Automatic tracker for everything Diablo II: Resurrected related**

A modern Electron desktop application built to help Diablo II: Resurrected players track their Holy Grail progress, with more features on the way.

## ✨ Features

- **🏆 Holy Grail Tracking**: Comprehensive tracking of unique items, sets, and runes
- **📁 Save File Monitoring**: Automatic detection and parsing of D2R save files
- **📊 Progress Analytics**: Visual progress bars, statistics, and completion tracking
- **🎮 Multiple Game Modes**: Support for different game versions and modes
- **🔔 Smart Notifications**: Get notified when new items are found
- **🌐 Internationalization**: Multi-language support with i18next
- **💾 Local Database**: SQLite database for reliable data persistence
- **🎨 Modern UI**: Built with shadcn/ui components and Tailwind CSS

## 🚀 Download & Install

### System Requirements

- **Windows**: Windows 10 or later (64-bit)
- **macOS**: macOS 10.15 or later
- **Linux**: Ubuntu 18.04+ or equivalent
- **Diablo II: Resurrected** installed

### Installation

1. **Download the latest release** from the [Releases page](https://github.com/hyperremix/d2r-arcane-tracker/releases)
2. **Install the application** for your operating system:
   - **Windows**: Run the `D2R Arcane Tracker-Windows-*-Setup.exe` installer
   - **macOS**: Open the `.dmg` file and drag to Applications
   - **Linux**: Extract the `.AppImage` and run directly

3. **Launch the application** and follow the setup wizard

### Windows Installation Notes

- The installer will create a shortcut in your Start Menu
- The application installs to your user directory (no admin rights required)
- Windows may show a "Windows protected your PC" warning - click "More info" then "Run anyway"
- This warning appears because the app is not code-signed (we're working on this!)

## 🎮 Usage

1. **First Launch**: The app will guide you through initial setup
2. **Configure Save File Path**: Set your D2R save file directory in settings
3. **Select Game Mode**: Choose your preferred game version and mode
4. **Start Tracking**: The app will automatically monitor your save files
5. **View Progress**: Check your Holy Grail progress in the main dashboard

### Key Features Explained

- **Automatic Detection**: The app monitors your save files and automatically updates when new items are found
- **Progress Tracking**: Visual progress bars show completion percentages for different item categories
- **Advanced Search**: Filter and search through your tracked items
- **Statistics Dashboard**: View detailed statistics about your progress

## 🔧 Troubleshooting

### Common Issues

**App won't start:**
- Ensure you have the latest version installed
- Check that your system meets the minimum requirements
- Try running as administrator (Windows) or with sudo (Linux)
- **Windows**: If you see "Windows protected your PC", click "More info" then "Run anyway"

**Save files not detected:**
- Verify the save file path in Settings is correct
- Ensure D2R is installed and you have created at least one character
- Check that the save files are not corrupted
- **Windows**: Default save path is usually `%USERPROFILE%\Saved Games\Diablo II Resurrected`

**Items not updating:**
- Make sure the app has permission to read your save files
- Try restarting the application
- Check if D2R is running (some features require D2R to be closed)

**Windows-specific issues:**
- **Antivirus blocking**: Add the application to your antivirus exceptions
- **Firewall prompts**: Allow the application through Windows Firewall
- **Missing Visual C++ Redistributables**: Download and install from Microsoft
- **Permission denied**: Run as administrator if save file access is restricted

### Getting Help

If you're still having issues:
- Check the [GitHub Issues](https://github.com/hyperremix/d2r-arcane-tracker/issues) for known problems
- Join the [GitHub Discussions](https://github.com/hyperremix/d2r-arcane-tracker/discussions) for community support
- Create a new issue with detailed information about your problem

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for detailed information on how to get started.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/hyperremix/d2r-arcane-tracker/issues)
- **Discussions**: [GitHub Discussions](https://github.com/hyperremix/d2r-arcane-tracker/discussions)

## 📊 Project Status

![GitHub last commit](https://img.shields.io/github/last-commit/hyperremix/d2r-arcane-tracker)
![GitHub issues](https://img.shields.io/github/issues/hyperremix/d2r-arcane-tracker)
![GitHub pull requests](https://img.shields.io/github/issues-pr/hyperremix/d2r-arcane-tracker)
![GitHub release](https://img.shields.io/github/v/release/hyperremix/d2r-arcane-tracker)

---

**Made with ❤️ for the Diablo II: Resurrected community**

*Happy farming! 🏆*
