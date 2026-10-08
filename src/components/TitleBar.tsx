import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Calculator,
  ChevronLeft,
  ChevronRight,
  MapPinned,
  Settings,
  Timer,
  Trophy,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router';
import { buttonVariants } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { translations } from '@/i18n/translations';
import { cn } from '@/lib/utils';
import logoUrl from '/logo.png';
import { NotificationButton } from './grail/NotificationButton';

/**
 * Describes a single top-level destination in the title bar navigation.
 */
interface NavigationItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
}

/**
 * Top-level destinations shown in the title bar navigation, in display order.
 * Terror Zones uses `MapPinned` (a marked area on a map) rather than a warning
 * icon so it does not read as an error state.
 */
const NAVIGATION_ITEMS: NavigationItem[] = [
  { to: '/', labelKey: translations.titleBar.grail, icon: Trophy },
  { to: '/statistics', labelKey: translations.titleBar.statistics, icon: BarChart3 },
  { to: '/runs', labelKey: translations.titleBar.runs, icon: Timer },
  { to: '/runewords', labelKey: translations.titleBar.runewords, icon: Calculator },
  { to: '/terror-zones', labelKey: translations.titleBar.terrorZones, icon: MapPinned },
  { to: '/settings', labelKey: translations.titleBar.settings, icon: Settings },
];

/**
 * Determines whether a navigation destination matches the current pathname.
 * The root route only matches exactly; other routes also match nested paths.
 */
function isRouteActive(pathname: string, to: string): boolean {
  if (to === '/') {
    return pathname === '/';
  }
  return pathname === to || pathname.startsWith(`${to}/`);
}

/**
 * Navigation link with an icon and a text label.
 * The label is visible from the `lg` breakpoint; below it the link collapses to
 * icon-only, the label is shown in a tooltip and stays available to assistive
 * technology as visually hidden text.
 */
function NavigationLink({ item, isActive }: { item: NavigationItem; isActive: boolean }) {
  const { t } = useTranslation();
  const label = t(item.labelKey);
  const Icon = item.icon;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            to={item.to}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 font-medium text-sm outline-none transition-colors',
              'focus-visible:ring-[3px] focus-visible:ring-ring/50',
              isActive
                ? 'bg-accent text-accent-foreground after:absolute after:inset-x-1.5 after:bottom-0.5 after:h-0.5 after:rounded-full after:bg-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            )}
          />
        }
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="sr-only lg:not-sr-only">{label}</span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="lg:hidden">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Icon-only history button (back/forward) with an accessible name and tooltip.
 */
function HistoryButton({
  label,
  icon: Icon,
  disabled,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        // Render the native button directly so `disabled` reaches the DOM element
        render={<button type="button" disabled={disabled} />}
        onClick={onClick}
        aria-label={label}
        className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'h-7 w-7')}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * TitleBar component that provides a custom draggable title bar for the Electron app.
 * Works across macOS, Linux, and Windows with platform-specific styling.
 * Interactive elements (buttons and links) are excluded from the drag region by the
 * `.titlebar` rules in `index.css`; all remaining empty space stays draggable.
 * Follows Electron best practices from: https://www.electronjs.org/docs/latest/tutorial/custom-title-bar
 * @returns {JSX.Element} A custom title bar with history controls, app name and navigation
 */
export function TitleBar() {
  const { t } = useTranslation();
  const [platform, setPlatform] = useState<'darwin' | 'win32' | 'linux'>('darwin');
  const [historyIndex, setHistoryIndex] = useState(0);
  const [historyLength, setHistoryLength] = useState(1);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Get platform from Electron API (will be 'darwin', 'win32', or 'linux')
    if (window.electronAPI) {
      setPlatform(window.electronAPI.platform);
    }
  }, []);

  // Track navigation history position
  // biome-ignore lint/correctness/useExhaustiveDependencies: location is used as a trigger dependency
  useEffect(() => {
    // Update history tracking when location changes
    const currentIndex = window.history.state?.idx ?? 0;
    setHistoryIndex(currentIndex);
    setHistoryLength(window.history.length);
  }, [location]);

  const isMac = platform === 'darwin';
  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < historyLength - 1;

  const handleBack = () => {
    if (canGoBack) {
      navigate(-1);
    }
  };

  const handleForward = () => {
    if (canGoForward) {
      navigate(1);
    }
  };

  return (
    <header
      className={cn(
        'flex h-12 min-h-12 w-full select-none items-center gap-2 border-border border-b px-4',
        'titlebar', // Custom class for Electron dragging
      )}
      style={
        {
          // Make the entire title bar draggable (Electron-specific CSS property)
          WebkitAppRegion: 'drag',
          appRegion: 'drag',
        } as React.CSSProperties
      }
    >
      {/* Left section - macOS traffic lights spacing */}
      {isMac && <div className="w-20 shrink-0" />}

      {/* History buttons */}
      <div className="flex shrink-0 items-center gap-1">
        <HistoryButton
          label={t(translations.titleBar.goBack)}
          icon={ChevronLeft}
          disabled={!canGoBack}
          onClick={handleBack}
        />
        <HistoryButton
          label={t(translations.titleBar.goForward)}
          icon={ChevronRight}
          disabled={!canGoForward}
          onClick={handleForward}
        />
      </div>

      {/* Center section - App title (hidden at narrow widths; the area stays draggable) */}
      <div className="flex min-w-0 flex-1 items-center justify-center">
        <div className="hidden min-w-0 items-center gap-2 min-[1180px]:flex">
          <img src={logoUrl} alt="" className="h-5 w-5 shrink-0" />
          <span className="truncate font-display font-semibold text-sm tracking-wide">
            {t(translations.app.title)}
          </span>
        </div>
      </div>

      {/* Right section - Notifications and primary navigation */}
      <div className="flex shrink-0 items-center gap-2">
        <NotificationButton />
        <nav aria-label={t(translations.titleBar.mainNavigation)}>
          <ul className="flex items-center gap-1">
            {NAVIGATION_ITEMS.map((item) => (
              <li key={item.to}>
                <NavigationLink item={item} isActive={isRouteActive(location.pathname, item.to)} />
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Spacing for Windows/Linux native controls overlay */}
      {!isMac && <div className="w-36 shrink-0" />}
    </header>
  );
}
