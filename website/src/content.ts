import type { LucideIcon } from 'lucide-react';
import { BarChart3, Calculator, PackageSearch, Timer, Trophy } from 'lucide-react';
import inventoryBrowserUrl from '../../docs/screenshots/inventory-browser.webp';
import itemDialogUrl from '../../docs/screenshots/item-dialog.webp';
import runTrackerUrl from '../../docs/screenshots/run-tracker.webp';
import runewordCalculatorUrl from '../../docs/screenshots/runeword-calculator.webp';
import statisticsUrl from '../../docs/screenshots/statistics.webp';

const REPOSITORY_URL = 'https://github.com/hyperremix/d2r-arcane-tracker';

export const links = {
  repository: REPOSITORY_URL,
  latestRelease: `${REPOSITORY_URL}/releases/latest`,
  releases: `${REPOSITORY_URL}/releases`,
  issues: `${REPOSITORY_URL}/issues`,
  discussions: `${REPOSITORY_URL}/discussions`,
  license: `${REPOSITORY_URL}/blob/main/LICENSE`,
  thirdPartyLicenses: `${REPOSITORY_URL}/blob/main/docs/THIRD_PARTY_LICENSES.md`,
};

/** Links to a guide in the repository's docs/ folder, rendered by GitHub. */
export function guideUrl(file: string): string {
  return `${REPOSITORY_URL}/blob/main/docs/${file}`;
}

export type FeatureId = 'grail' | 'statistics' | 'runs' | 'runewords' | 'inventory';

export interface Feature {
  id: FeatureId;
  /** Same label and icon as the app's title bar navigation */
  label: string;
  icon: LucideIcon;
  title: string;
  description: string;
  points: string[];
  screenshot: string;
  screenshotAlt: string;
  /** Link to the matching guide; `label` is the full link text */
  guide: { label: string; file: string };
}

export const features: Feature[] = [
  {
    id: 'grail',
    label: 'Grail',
    icon: Trophy,
    title: 'Holy Grail',
    description:
      'Every unique, set item, rune and runeword on one wall. Found items light up in their item color; missing ones stay dim.',
    points: [
      'Detects finds from characters and shared stashes, including the v105+ stash',
      'Tracks normal and ethereal versions, for softcore, hardcore or both',
      'Search by name, base or set, filter by type and bookmark what you are hunting',
    ],
    screenshot: itemDialogUrl,
    screenshotAlt:
      "Item details for Mara's Kaleidoscope: found, with type, category and the characters that found it",
    guide: { label: 'Read the Holy Grail guide', file: 'HOLY_GRAIL_GUIDE.md' },
  },
  {
    id: 'statistics',
    label: 'Statistics',
    icon: BarChart3,
    title: 'Statistics',
    description:
      'See how far you are, what you found last, which set is closest to complete and which runes you still need.',
    points: [
      'Grail progress over time and finds per week',
      'Progress by category and a comparison between characters',
      'Run statistics: session time, run durations and items per run',
    ],
    screenshot: statisticsUrl,
    screenshotAlt:
      'Statistics page with total progress, last find, closest set, runes missing and a grail progress chart',
    guide: { label: 'Read about the statistics', file: 'HOLY_GRAIL_GUIDE.md#statistics' },
  },
  {
    id: 'runs',
    label: 'Runs',
    icon: Timer,
    title: 'Run Tracker',
    description:
      'Time your farming sessions run by run. Items you find are added to the run they dropped in.',
    points: [
      'Auto mode starts and ends runs as you join and leave games',
      'Keyboard shortcuts and global hotkeys for manual runs',
      'Export sessions as CSV, JSON or text',
    ],
    screenshot: runTrackerUrl,
    screenshotAlt: 'Run Tracker page with the live session card and a list of previous sessions',
    guide: { label: 'Read the Run Tracker guide', file: 'RUN_TRACKER.md' },
  },
  {
    id: 'runewords',
    label: 'Runewords',
    icon: Calculator,
    title: 'Runeword Calculator',
    description:
      'Reads the runes in your save files and shows which runewords you can make right now.',
    points: [
      'Craftable now, missing one rune, or every runeword',
      'Filter by the runes you want to use',
      'Shows how many of each rune you have',
    ],
    screenshot: runewordCalculatorUrl,
    screenshotAlt:
      'Runeword Calculator with rune counts in the sidebar and craftable runewords as cards',
    guide: {
      label: 'Read about the Runeword Calculator',
      file: 'HOLY_GRAIL_GUIDE.md#runeword-calculator',
    },
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: PackageSearch,
    title: 'Inventory Browser',
    description:
      'Look inside every character and shared stash without starting the game, and move items between them.',
    points: [
      'Drag items between characters and stashes',
      'Keep items in the vault, outside your save files',
      'Backs up each save file before it changes it',
    ],
    screenshot: inventoryBrowserUrl,
    screenshotAlt: 'Inventory Browser listing characters and shared stashes with their item counts',
    guide: { label: 'Read the Inventory Browser guide', file: 'INVENTORY_BROWSER_GUIDE.md' },
  },
];

export interface Guide {
  title: string;
  description: string;
  file: string;
}

export const guides: Guide[] = [
  {
    title: 'Holy Grail Guide',
    description: 'The challenge, setup, tracking options and how detection works',
    file: 'HOLY_GRAIL_GUIDE.md',
  },
  {
    title: 'Inventory Browser',
    description: 'Moving and vaulting items, and the safety rules',
    file: 'INVENTORY_BROWSER_GUIDE.md',
  },
  {
    title: 'Run Tracker',
    description: 'Sessions, runs, auto mode, shortcuts and exports',
    file: 'RUN_TRACKER.md',
  },
  {
    title: 'Terror Zone Configuration',
    description: 'Changing which zones the game rotates through',
    file: 'TERROR_ZONE_CONFIGURATION.md',
  },
  {
    title: 'Extracting Game Files',
    description: 'Needed for item icons and terror zones',
    file: 'EXTRACTING_GAME_FILES.md',
  },
  {
    title: 'Tracker Comparison',
    description: 'How this app compares to other grail trackers',
    file: 'COMPARISON.md',
  },
];
