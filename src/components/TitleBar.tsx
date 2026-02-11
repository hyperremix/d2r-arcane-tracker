import {
  AlertTriangle,
  Archive,
  BarChart3,
  Calculator,
  ChevronLeft,
  ChevronRight,
  PackageSearch,
  Settings,
  Timer,
  Trophy,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { translations } from '@/i18n/translations';
import { cn } from '@/lib/utils';
import logoUrl from '/logo.png';
import { NotificationButton } from './grail/NotificationButton';

/**
 * Navigation button component
 */
function NavigationButton({
  to,
  title,
  icon: Icon,
  isActive,
  onClick,
}: {
  to: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  onClick: (to: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="relative">
      <div
        className={cn(
          'absolute -top-1.75 right-0 left-0',
          isActive && 'border-t-4 border-t-primary-500',
        )}
      />
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onClick(to)}
        title={t(title)}
        className={cn('relative hover:text-primary-500', isActive && 'text-primary-500')}
      >
        <Icon className="h-4 w-4" />
      </Button>
    </div>
  );
}

/**
 * Hook to get route active states
 */
function useRouteStates(pathname: string) {
  return {
    isTrackerActive: pathname === '/',
    isStatisticsActive: pathname === '/statistics',
    isRunsActive: pathname === '/runs',
    isRunewordsActive: pathname === '/runewords',
    isInventoryBrowserActive: pathname === '/inventory-browser',
    isVaultActive: pathname === '/vault',
    isTerrorZonesActive: pathname === '/terror-zones',
    isSettingsActive: pathname === '/settings',
  };
}

/**
 * TitleBar component that provides a custom draggable title bar for the Electron app.
 * Works across macOS, Linux, and Windows with platform-specific styling.
 * Follows Electron best practices from: https://www.electronjs.org/docs/latest/tutorial/custom-title-bar
 * @returns {JSX.Element} A custom title bar with app name and platform controls
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
  const routeStates = useRouteStates(location.pathname);

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
    <div
      className={cn(
        'flex h-12 min-h-12 w-full select-none items-center border-gray-200 border-b px-4 dark:border-gray-800',
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
      {isMac && <div className="w-20" />}

      {/* Navigation buttons */}
      <div
        className="flex items-center gap-1"
        style={
          {
            // Make buttons clickable (not draggable)
            WebkitAppRegion: 'no-drag',
            appRegion: 'no-drag',
          } as React.CSSProperties
        }
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          disabled={!canGoBack}
          title={t(translations.titleBar.goBack)}
          className="h-7 w-7 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleForward}
          disabled={!canGoForward}
          title={t(translations.titleBar.goForward)}
          className="h-7 w-7 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Center section - App title */}
      <div className="flex flex-1 items-center justify-center gap-2">
        <img src={logoUrl} alt={t(translations.app.title)} className="h-5 w-5" />
        <span className="font-semibold text-sm tracking-wide">{t(translations.app.title)}</span>
      </div>

      {/* Right section - Action buttons */}
      <div
        className="flex items-center gap-2"
        style={
          {
            // Make buttons clickable (not draggable)
            WebkitAppRegion: 'no-drag',
            appRegion: 'no-drag',
          } as React.CSSProperties
        }
      >
        <NotificationButton />
        <NavigationButton
          to="/"
          title={translations.titleBar.holyGrailTracker}
          icon={Trophy}
          isActive={routeStates.isTrackerActive}
          onClick={navigate}
        />
        <NavigationButton
          to="/statistics"
          title={translations.titleBar.statistics}
          icon={BarChart3}
          isActive={routeStates.isStatisticsActive}
          onClick={navigate}
        />
        <NavigationButton
          to="/runs"
          title={translations.titleBar.runCounter}
          icon={Timer}
          isActive={routeStates.isRunsActive}
          onClick={navigate}
        />
        <NavigationButton
          to="/runewords"
          title={translations.titleBar.runewordCalculator}
          icon={Calculator}
          isActive={routeStates.isRunewordsActive}
          onClick={navigate}
        />
        <NavigationButton
          to="/inventory-browser"
          title={translations.titleBar.inventoryBrowser}
          icon={PackageSearch}
          isActive={routeStates.isInventoryBrowserActive}
          onClick={navigate}
        />
        <NavigationButton
          to="/vault"
          title={translations.titleBar.itemVault}
          icon={Archive}
          isActive={routeStates.isVaultActive}
          onClick={navigate}
        />
        <NavigationButton
          to="/terror-zones"
          title={translations.titleBar.terrorZoneConfiguration}
          icon={AlertTriangle}
          isActive={routeStates.isTerrorZonesActive}
          onClick={navigate}
        />
        <NavigationButton
          to="/settings"
          title={translations.titleBar.settings}
          icon={Settings}
          isActive={routeStates.isSettingsActive}
          onClick={navigate}
        />
      </div>

      {/* Spacing for Windows/Linux native controls overlay */}
      {!isMac && <div className="w-36" />}
    </div>
  );
}
