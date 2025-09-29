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

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v18 or higher)
- **Yarn** package manager
- **Diablo II: Resurrected** installed

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/hyperremix/d2r-arcane-tracker.git
   cd d2r-arcane-tracker
   ```

2. **Install dependencies**

   ```bash
   yarn install
   ```

3. **Start development server**

   ```bash
   yarn dev
   ```

The application will launch automatically with hot-reload enabled for development.

## 📦 Building

### Development Build

```bash
yarn build
```

### Production Build

```bash
yarn build
```

Built applications will be available in the `dist/` directory.

## 📚 Technology Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS v4
- **Desktop**: Electron 30
- **Build Tool**: Vite + electron-vite
- **UI Components**: shadcn/ui (Radix UI primitives)
- **State Management**: Zustand
- **Database**: SQLite with better-sqlite3
- **Internationalization**: i18next
- **Code Quality**: Biome (linting, formatting, type checking)
- **Testing**: Vitest + Testing Library

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

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for detailed information on:

- Development setup and workflow
- Code quality standards and guidelines
- Testing requirements
- Pull request process
- Issue reporting
- Community guidelines

Quick start for contributors:

```bash
git clone https://github.com/YOUR_USERNAME/d2r-arcane-tracker.git
cd d2r-arcane-tracker
yarn install
yarn dev
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/hyperremix/d2r-arcane-tracker/issues)
- **Discussions**: [GitHub Discussions](https://github.com/hyperremix/d2r-arcane-tracker/discussions)

## 📊 Project Status

![GitHub last commit](https://img.shields.io/github/last-commit/hyperremix/d2r-arcane-tracker)
![GitHub issues](https://img.shields.io/github/issues/hyperremix/d2r-arcane-tracker)
![GitHub pull requests](https://img.shields.io/github/issues-pr/hyperremix/d2r-arcane-tracker)

---

**Made with ❤️ for the Diablo II: Resurrected community**

*Happy farming! 🏆*
