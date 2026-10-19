import type { LucideIcon } from 'lucide-react';
import { BarChart3, Calculator, PackageSearch, Timer, Trophy } from 'lucide-react';
import inventoryBrowserUrl from '../../docs/screenshots/inventory-browser.webp';
import itemDialogUrl from '../../docs/screenshots/item-dialog.webp';
import runTrackerUrl from '../../docs/screenshots/run-tracker.webp';
import runewordCalculatorUrl from '../../docs/screenshots/runeword-calculator.webp';
import statisticsUrl from '../../docs/screenshots/statistics.webp';

const REPOSITORY_URL = 'https://github.com/hyperremix/d2r-arcane-tracker';

/** Where the site is published (GitHub Pages); canonical and sitemap URLs start with it. */
export const SITE_URL = 'https://d2rarcanetracker.com/';

export const links = {
  repository: REPOSITORY_URL,
  latestRelease: `${REPOSITORY_URL}/releases/latest`,
  releases: `${REPOSITORY_URL}/releases`,
  issues: `${REPOSITORY_URL}/issues`,
  discussions: `${REPOSITORY_URL}/discussions`,
  license: `${REPOSITORY_URL}/blob/main/LICENSE`,
  thirdPartyLicenses: `${REPOSITORY_URL}/blob/main/docs/THIRD_PARTY_LICENSES.md`,
};

/**
 * Links to a guide's page on this site. `file` is the guide's file in docs/ and `hash` an optional
 * heading id (without the `#`): the pages give their headings the same ids as GitHub does. Other
 * files in docs/ aren't published on the site, so they link to the file on GitHub.
 */
export function guideUrl(file: string, hash?: string): string {
  const fragment = hash ? `#${hash}` : '';
  const guide = guides.find((candidate) => candidate.file === file);
  if (!guide) return `${repositoryFileUrl(`docs/${file}`)}${fragment}`;
  return `${import.meta.env.BASE_URL}${guidePagePath(guide)}${fragment}`;
}

/** Path of a guide's page relative to the site root, e.g. `guides/holy-grail/` */
export function guidePagePath(guide: Guide): string {
  return `guides/${guide.slug}/`;
}

/** Links to a file in the repository on GitHub; `repoPath` is relative to the repository root. */
export function repositoryFileUrl(repoPath: string): string {
  return `${REPOSITORY_URL}/blob/main/${repoPath}`;
}

/** The raw file in the repository, e.g. for images in the guides */
export function repositoryRawUrl(repoPath: string): string {
  return `https://raw.githubusercontent.com/hyperremix/d2r-arcane-tracker/main/${repoPath}`;
}

/** Doubles as the feature's anchor on the page (`#run-tracker`), so keep these stable. */
export type FeatureId =
  | 'holy-grail'
  | 'statistics'
  | 'run-tracker'
  | 'runeword-calculator'
  | 'inventory-browser';

export interface Feature {
  id: FeatureId;
  /** Same label and icon as the app's title bar navigation */
  label: string;
  icon: LucideIcon;
  title: string;
  /** One sentence for the always-visible feature overview */
  summary: string;
  description: string;
  points: string[];
  screenshot: string;
  screenshotAlt: string;
  /** Link to the matching guide, optionally to one of its headings; `label` is the full link text */
  guide: { label: string; file: string; hash?: string };
}

export const features: Feature[] = [
  {
    id: 'holy-grail',
    label: 'Grail',
    icon: Trophy,
    title: 'Holy Grail',
    summary:
      'Checks off every unique, set item, rune and runeword you find, straight from your save files.',
    description:
      'Every unique, set item, rune and runeword in Diablo 2 Resurrected on one wall. Found items light up in their item color; missing ones stay dim.',
    points: [
      'Detects finds from characters and shared stashes, including the v105+ stash and its Chronicle',
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
    summary: 'Sums up your grail progress, latest finds, closest set and the runes you still need.',
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
    guide: {
      label: 'Read about the statistics',
      file: 'HOLY_GRAIL_GUIDE.md',
      hash: 'statistics',
    },
  },
  {
    id: 'run-tracker',
    label: 'Runs',
    icon: Timer,
    title: 'Run Tracker',
    summary: 'Times your farming runs and adds each find to the run it dropped in.',
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
    id: 'runeword-calculator',
    label: 'Runewords',
    icon: Calculator,
    title: 'Runeword Calculator',
    summary: 'Shows which runewords you can make with the runes you have.',
    description:
      'Reads the runes in your save files and shows which runewords you can make right now.',
    points: [
      'Runes only, runes and base, up to one rune missing, or every runeword',
      'Filter by the runes you want to use',
      'Shows how many of each rune you have',
    ],
    screenshot: runewordCalculatorUrl,
    screenshotAlt:
      'Runeword Calculator with rune counts in the sidebar and craftable runewords as cards',
    guide: {
      label: 'Read about the Runeword Calculator',
      file: 'HOLY_GRAIL_GUIDE.md',
      hash: 'runeword-calculator',
    },
  },
  {
    id: 'inventory-browser',
    label: 'Inventory',
    icon: PackageSearch,
    title: 'Inventory Browser',
    summary:
      'Opens your characters and shared stashes outside the game and moves items between them.',
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
  /** The guide's heading: the h1 of its Markdown file (checked by a test), also used by the breadcrumb */
  title: string;
  description: string;
  /** The guide's Markdown file in docs/, rendered into the guide's page when the site is built */
  file: string;
  /** Last segment of the page's URL: `guides/<slug>/` */
  slug: string;
  /** The page's title in search results and link previews, before the site name */
  pageTitle: string;
  /** The page's description in search results and link previews */
  metaDescription: string;
}

export const guides: Guide[] = [
  {
    title: 'Holy Grail Guide',
    description: 'The challenge, setup, tracking options and how detection works',
    file: 'HOLY_GRAIL_GUIDE.md',
    slug: 'holy-grail',
    pageTitle: 'Holy Grail Guide',
    metaDescription:
      'How the Diablo II: Resurrected Holy Grail challenge works and how to track it: setup, what to track, item detection, statistics and the runeword calculator.',
  },
  {
    title: 'Inventory Browser',
    description: 'Moving and vaulting items, and the safety rules',
    file: 'INVENTORY_BROWSER_GUIDE.md',
    slug: 'inventory-browser',
    pageTitle: 'Inventory Browser Guide',
    metaDescription:
      'See the items in every D2R character and shared stash without starting the game, move items between them, keep items in the vault, and the safety rules.',
  },
  {
    title: 'Run Tracker Guide',
    description: 'Sessions, runs, auto mode, shortcuts and exports',
    file: 'RUN_TRACKER.md',
    slug: 'run-tracker',
    pageTitle: 'Run Tracker Guide',
    metaDescription:
      'Time your D2R farming runs and see what dropped in each: sessions, auto mode, keyboard shortcuts, global hotkeys, and exports as CSV, JSON or text.',
  },
  {
    title: 'Terror Zone Configuration',
    description: 'The offline schedule and which zones the game rotates through',
    file: 'TERROR_ZONE_CONFIGURATION.md',
    slug: 'terror-zone-configuration',
    pageTitle: 'Terror Zone Schedule and Configuration Guide',
    metaDescription:
      'See the offline D2R terror zone schedule and choose which zones the game rotates through: requirements, the schedule, toggling zones and troubleshooting.',
  },
  {
    title: 'Extracting Game Files',
    description: 'Needed for item icons and terror zones',
    file: 'EXTRACTING_GAME_FILES.md',
    slug: 'extracting-game-files',
    pageTitle: 'Extracting D2R Game Files',
    metaDescription:
      "Extract the Diablo II: Resurrected game files with Ladik's CASC Viewer for item icons and terror zone configuration, and start D2R with -direct -txt.",
  },
  {
    title: 'Holy Grail Tracker Comparison',
    description: 'How this app compares to other grail trackers',
    file: 'COMPARISON.md',
    slug: 'holy-grail-tracker-comparison',
    pageTitle: 'Holy Grail Tracker Comparison',
    metaDescription:
      'D2R Arcane Tracker compared with d2grail.com, diablo2.io, holygrail.link and Nasicus/d2-holy-grail: save import, offline use, runewords, run tracking and more.',
  },
];

/** The guide with this slug; throws if there is none. */
export function requireGuide(slug: string): Guide {
  const guide = guides.find((candidate) => candidate.slug === slug);
  if (!guide) throw new Error(`Unknown guide: ${slug}`);
  return guide;
}
