import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Calculator,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  PackageSearch,
  Settings,
  Timer,
  Trophy,
} from 'lucide-react';
import type { ComponentType, RefObject, SVGProps } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router';
import { buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { translations } from '@/i18n/translations';
import { cn } from '@/lib/utils';
import logoUrl from '/logo.png';
import { NotificationButton } from './grail/NotificationButton';
import { TitleBarFrame } from './TitleBarFrame';
import { TerrorZoneIcon } from './terror-zone/TerrorZoneIcon';
import { useTitleBarOverflow } from './titleBarOverflow';

/**
 * Describes a single top-level destination in the title bar navigation.
 */
interface NavigationItem {
  to: string;
  labelKey: string;
  icon: LucideIcon | ComponentType<SVGProps<SVGSVGElement>>;
}

/**
 * Destinations shown with their label in the title bar navigation, from the highest to the lowest
 * priority. When the window is too narrow, the last ones move into the More menu first.
 * The farming advisor uses `Crosshair`, for picking a target to hunt.
 * Terror Zones uses `TerrorZoneIcon`, a recreation of the in-game D2R terror zone emblem.
 */
const NAVIGATION_ITEMS: NavigationItem[] = [
  { to: '/', labelKey: translations.titleBar.grail, icon: Trophy },
  { to: '/statistics', labelKey: translations.titleBar.statistics, icon: BarChart3 },
  { to: '/runs', labelKey: translations.titleBar.runs, icon: Timer },
  { to: '/runewords', labelKey: translations.titleBar.runewords, icon: Calculator },
  {
    to: '/inventory-browser',
    labelKey: translations.titleBar.inventoryBrowser,
    icon: PackageSearch,
  },
  { to: '/farming', labelKey: translations.titleBar.farming, icon: Crosshair },
  { to: '/terror-zones', labelKey: translations.titleBar.terrorZones, icon: TerrorZoneIcon },
];

/** Settings is a utility: an icon-only link next to the notifications, never in the More menu. */
const SETTINGS_ITEM: NavigationItem = {
  to: '/settings',
  labelKey: translations.titleBar.settings,
  icon: Settings,
};

/** Shape shared by the navigation links, the More trigger and their invisible measuring copies. */
const NAV_ITEM_CLASS =
  'relative inline-flex h-8 shrink-0 items-center rounded-md font-medium text-sm outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50';

/** Spacing of the navigation entries that show a label. */
const LABELED_NAV_ITEM_CLASS = 'gap-1.5 whitespace-nowrap px-2';

/** Classes of the app name, shared with its invisible measuring copy. */
const APP_NAME_CLASS =
  'shrink-0 whitespace-nowrap font-display font-semibold text-sm tracking-wide';

/**
 * Colors of a navigation entry; the active one also gets an underline.
 */
function navItemStateClass(isActive: boolean): string {
  return isActive
    ? 'bg-accent text-accent-foreground after:absolute after:inset-x-1.5 after:bottom-0.5 after:h-0.5 after:rounded-full after:bg-foreground'
    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground';
}

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
 * Navigation link with an icon and a visible label.
 */
function NavigationLink({ item, isActive }: { item: NavigationItem; isActive: boolean }) {
  const { t } = useTranslation();
  const Icon = item.icon;

  return (
    <Link
      to={item.to}
      aria-current={isActive ? 'page' : undefined}
      className={cn(NAV_ITEM_CLASS, LABELED_NAV_ITEM_CLASS, navItemStateClass(isActive))}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{t(item.labelKey)}</span>
    </Link>
  );
}

/**
 * Icon-only navigation link. Its label is shown in a tooltip and stays available to assistive
 * technology as visually hidden text.
 */
function IconNavigationLink({ item, isActive }: { item: NavigationItem; isActive: boolean }) {
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
            className={cn(NAV_ITEM_CLASS, 'w-8 justify-center', navItemStateClass(isActive))}
          />
        }
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * More menu holding the destinations that do not fit in the title bar. When the current page is
 * one of them, the trigger shows the active state and the menu marks the page as current.
 */
function MoreMenu({ items, pathname }: { items: NavigationItem[]; pathname: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const hasActiveItem = items.some((item) => isRouteActive(pathname, item.to));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-current={hasActiveItem ? 'page' : undefined}
        className={cn(NAV_ITEM_CLASS, LABELED_NAV_ITEM_CLASS, navItemStateClass(hasActiveItem))}
      >
        {t(translations.titleBar.more)}
        <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="[-webkit-app-region:no-drag] [app-region:no-drag]"
      >
        {items.map((item) => {
          const isActive = isRouteActive(pathname, item.to);
          const Icon = item.icon;
          return (
            <DropdownMenuItem
              key={item.to}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'whitespace-nowrap',
                isActive &&
                  'font-medium before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-foreground',
              )}
              onClick={() => navigate(item.to)}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {t(item.labelKey)}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Invisible copy of the app name, every destination and the More trigger, at their natural
 * widths, so the title bar can decide what fits without rendering it first.
 */
function OverflowMeasurements({ measureRef }: { measureRef: RefObject<HTMLDivElement> }) {
  const { t } = useTranslation();

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none invisible absolute inset-0 overflow-hidden"
    >
      <div ref={measureRef} className="flex w-max">
        <span data-overflow-part="name" className={APP_NAME_CLASS}>
          {t(translations.app.title)}
        </span>
        {NAVIGATION_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <span
              key={item.to}
              data-overflow-part="item"
              className={cn(NAV_ITEM_CLASS, LABELED_NAV_ITEM_CLASS)}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{t(item.labelKey)}</span>
            </span>
          );
        })}
        <span data-overflow-part="more" className={cn(NAV_ITEM_CLASS, LABELED_NAV_ITEM_CLASS)}>
          {t(translations.titleBar.more)}
          <ChevronDown className="h-4 w-4 shrink-0" />
        </span>
      </div>
    </div>
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

  const { regionRef, measureRef, overflow } = useTitleBarOverflow(NAVIGATION_ITEMS.length);
  const visibleItems = NAVIGATION_ITEMS.slice(0, overflow.visibleCount);
  const overflowItems = NAVIGATION_ITEMS.slice(overflow.visibleCount);

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

      {/* Brand and navigation. The logo is always shown; the app name only while every
          destination fits next to it. Destinations that still do not fit move into the More menu.
          Empty space between the brand and the navigation stays draggable. */}
      <div ref={regionRef} className="relative ml-1 flex min-w-0 flex-1 items-center gap-2">
        <img data-overflow-part="logo" src={logoUrl} alt="" className="h-5 w-5 shrink-0" />
        {overflow.showName && <span className={APP_NAME_CLASS}>{t(translations.app.title)}</span>}

        {/* Right section - navigation and notifications */}
        <div data-overflow-part="nav" className="ml-auto flex shrink-0 items-center gap-1">
          <nav aria-label={t(translations.titleBar.mainNavigation)} className="flex items-center">
            <ul data-overflow-part="list" className="flex items-center gap-1">
              {visibleItems.map((item) => (
                <li key={item.to}>
                  <NavigationLink
                    item={item}
                    isActive={isRouteActive(location.pathname, item.to)}
                  />
                </li>
              ))}
              {overflowItems.length > 0 && (
                <li>
                  <MoreMenu items={overflowItems} pathname={location.pathname} />
                </li>
              )}
            </ul>
            <div aria-hidden="true" className="mx-2 h-5 w-px bg-border" />
            <ul className="flex items-center">
              <li>
                <IconNavigationLink
                  item={SETTINGS_ITEM}
                  isActive={isRouteActive(location.pathname, SETTINGS_ITEM.to)}
                />
              </li>
            </ul>
          </nav>
          <NotificationButton />
        </div>

        <OverflowMeasurements measureRef={measureRef} />
      </div>
    </TitleBarFrame>
  );
}
