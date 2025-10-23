import { BarChart3, Calculator, ChevronLeft, ChevronRight, Settings, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { NotificationButton } from './grail/NotificationButton';

/**
 * TitleBar component that provides a custom draggable title bar for the Electron app.
 * Works across macOS, Linux, and Windows with platform-specific styling.
 * Follows Electron best practices from: https://www.electronjs.org/docs/latest/tutorial/custom-title-bar
 * @returns {JSX.Element} A custom title bar with app name and platform controls
 */
export function TitleBar() {
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

  // Check if routes are active
  const isTrackerActive = location.pathname === '/';
  const isStatisticsActive = location.pathname === '/statistics';
  const isRunewordsActive = location.pathname === '/runewords';
  const isSettingsActive = location.pathname === '/settings';

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
          title="Go back"
          className="h-7 w-7 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleForward}
          disabled={!canGoForward}
          title="Go forward"
          className="h-7 w-7 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Center section - App title */}
      <div className="flex flex-1 items-center justify-center gap-2">
        <img src="/logo.png" alt="D2R Arcane Tracker" className="h-5 w-5" />
        <span className="font-semibold text-sm tracking-wide">D2R Arcane Tracker</span>
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
        <div className="relative">
          <div
            className={cn(
              '-top-1.75 absolute right-0 left-0',
              isTrackerActive && 'border-t-4 border-t-primary-500',
            )}
          />
          <Button
            asChild
            variant="ghost"
            size="sm"
            className={cn('relative hover:text-primary-500', isTrackerActive && 'text-primary-500')}
          >
            <Link to="/" title="Holy Grail Tracker">
              <Trophy className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="relative">
          <div
            className={cn(
              '-top-1.75 absolute right-0 left-0',
              isStatisticsActive && 'border-t-4 border-t-primary-500',
            )}
          />
          <Button
            asChild
            variant="ghost"
            size="sm"
            className={cn(
              'relative hover:text-primary-500',
              isStatisticsActive && 'text-primary-500',
            )}
          >
            <Link to="/statistics" title="Statistics">
              <BarChart3 className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="relative">
          <div
            className={cn(
              '-top-1.75 absolute right-0 left-0',
              isRunewordsActive && 'border-t-4 border-t-primary-500',
            )}
          />
          <Button
            asChild
            variant="ghost"
            size="sm"
            className={cn(
              'relative hover:text-primary-500',
              isRunewordsActive && 'text-primary-500',
            )}
          >
            <Link to="/runewords" title="Runeword Calculator">
              <Calculator className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="relative">
          <div
            className={cn(
              '-top-1.75 absolute right-0 left-0',
              isSettingsActive && 'border-t-4 border-t-primary-500',
            )}
          />
          <Button
            asChild
            variant="ghost"
            size="sm"
            className={cn(
              'relative hover:text-primary-500',
              isSettingsActive && 'text-primary-500',
            )}
          >
            <Link to="/settings" title="Settings">
              <Settings className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Spacing for Windows/Linux native controls overlay */}
      {!isMac && <div className="w-36" />}
    </div>
  );
}
