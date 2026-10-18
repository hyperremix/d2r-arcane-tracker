import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  PackageSearch,
  Settings,
  Skull,
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
import { isMacPlatform, TitleBarFrame } from './TitleBarFrame';

/**
 * Describes a single top-level destination in the title bar navigation.
 */
interface NavigationItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
}

/**
 * Daily destinations shown in the primary title bar navigation, in display order.
 * Their labels collapse to icon-only below the `lg` breakpoint.
 */
const PRIMARY_NAVIGATION_ITEMS: NavigationItem[] = [
  { to: '/', labelKey: translations.titleBar.grail, icon: Trophy },
  { to: '/statistics', labelKey: translations.titleBar.statistics, icon: BarChart3 },
  { to: '/runs', labelKey: translations.titleBar.runs, icon: Timer },
  { to: '/runewords', labelKey: translations.titleBar.runewords, icon: Calculator },
  {
    to: '/inventory-browser',
    labelKey: translations.titleBar.inventoryBrowser,
    icon: PackageSearch,
  },
];

/**
 * Secondary destinations (Farming advisor, Terror zones and Settings) shown as icon-only links
 * after the primary navigation.
 * The farming advisor uses `Crosshair`, for picking a target to hunt.
 * Terror Zones uses `Skull`, which reads as the dangerous, empowered zones of D2R. A map pin
 * reads as a profile avatar at icon size, and a warning icon would read as an error state.
 */
const SECONDARY_NAVIGATION_ITEMS: NavigationItem[] = [
  { to: '/farming', labelKey: translations.titleBar.farming, icon: Crosshair },
  { to: '/terror-zones', labelKey: translations.titleBar.terrorZones, icon: Skull },
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
 * Navigation link with an icon and a label.
 * Primary links show their label from the `lg` breakpoint; below it, and always for icon-only
 * (secondary) links, the label is shown in a tooltip and stays available to assistive
 * technology as visually hidden text.
 */
function NavigationLink({
  item,
  isActive,
  iconOnly = false,
}: {
  item: NavigationItem;
  isActive: boolean;
  iconOnly?: boolean;
}) {
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
              'relative inline-flex h-8 shrink-0 items-center rounded-md font-medium text-sm outline-none transition-colors',
              'focus-visible:ring-[3px] focus-visible:ring-ring/50',
              iconOnly ? 'w-8 justify-center' : 'gap-1.5 px-2',
              isActive
                ? 'bg-accent text-accent-foreground after:absolute after:inset-x-1.5 after:bottom-0.5 after:h-0.5 after:rounded-full after:bg-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            )}
          />
        }
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className={iconOnly ? 'sr-only' : 'sr-only lg:not-sr-only'}>{label}</span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className={iconOnly ? undefined : 'lg:hidden'}>
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
 * TitleBar component that provides a custom draggable title bar for the main window.
 * The draggable frame and the platform-specific spacing come from {@link TitleBarFrame}; all
 * empty space stays draggable.
 * @returns {JSX.Element} A custom title bar with history controls, brand, navigation and notifications
 */
export function TitleBar() {
  const { t } = useTranslation();
  const [historyIndex, setHistoryIndex] = useState(0);
  const [historyLength, setHistoryLength] = useState(1);
  const navigate = useNavigate();
  const location = useLocation();
  const isMac = isMacPlatform();

  // Track navigation history position
  // biome-ignore lint/correctness/useExhaustiveDependencies: location is used as a trigger dependency
  useEffect(() => {
    // Update history tracking when location changes
    const currentIndex = window.history.state?.idx ?? 0;
    setHistoryIndex(currentIndex);
    setHistoryLength(window.history.length);
  }, [location]);

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
    <TitleBarFrame className="gap-2">
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

      {/* Brand - the logo is always shown; the name joins it once the navigation labels fit.
          On Windows/Linux the native controls overlay takes more room, so the name needs a
          wider window there. */}
      <div className="ml-1 flex min-w-0 items-center gap-2">
        <img src={logoUrl} alt="" className="h-5 w-5 shrink-0" />
        <span
          className={cn(
            'hidden truncate font-display font-semibold text-sm tracking-wide',
            isMac ? 'lg:block' : 'xl:block',
          )}
        >
          {t(translations.app.title)}
        </span>
      </div>

      {/* Empty space between the brand and the navigation stays draggable */}
      <div className="min-w-0 flex-1" />

      {/* Right section - navigation and notifications */}
      <div className="flex shrink-0 items-center gap-1">
        <nav aria-label={t(translations.titleBar.mainNavigation)} className="flex items-center">
          <ul className="flex items-center gap-1">
            {PRIMARY_NAVIGATION_ITEMS.map((item) => (
              <li key={item.to}>
                <NavigationLink item={item} isActive={isRouteActive(location.pathname, item.to)} />
              </li>
            ))}
          </ul>
          <div aria-hidden="true" className="mx-2 h-5 w-px bg-border" />
          <ul className="flex items-center gap-0.5">
            {SECONDARY_NAVIGATION_ITEMS.map((item) => (
              <li key={item.to}>
                <NavigationLink
                  item={item}
                  isActive={isRouteActive(location.pathname, item.to)}
                  iconOnly
                />
              </li>
            ))}
          </ul>
        </nav>
        <NotificationButton />
      </div>
    </TitleBarFrame>
  );
}
