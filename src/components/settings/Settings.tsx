import type { LucideIcon } from 'lucide-react';
import { Database, Info, Monitor, Settings2, Sparkles, Trophy } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageShell } from '@/components/layout/PageShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TooltipProvider } from '@/components/ui/tooltip';
import { translations } from '@/i18n/translations';
import { cn } from '@/lib/utils';
import { useWizardStore } from '@/stores/wizardStore';
import { D2RInstallationSettings } from './D2RInstallationSettings';
import { DatabaseCard } from './Database';
import { GameModeSettings } from './GameModeSettings';
import { GameVersionSettings } from './GameVersionSettings';
import { GrailSettings } from './GrailSettings';
import { ItemIconSettings } from './ItemIconSettings';
import { NotificationSettings } from './NotificationSettings';
import { ReportIssues } from './ReportIssues';
import { RunTrackerSettings } from './RunTrackerSettings';
import { SaveFileMonitor } from './SaveFileMonitor';
import { ThemeSettings } from './ThemeSettings';
import { UpdateSettings } from './UpdateSettings';
import { WidgetSettings } from './WidgetSettings';

/**
 * Identifiers of the settings groups shown in the side navigation.
 */
export type SettingsSectionId = 'general' | 'tracking' | 'display' | 'data' | 'about';

/**
 * Static configuration of a settings group.
 */
interface SettingsSectionConfig {
  id: SettingsSectionId;
  titleKey: string;
  descriptionKey: string;
  icon: LucideIcon;
}

/**
 * Ordered settings groups. The order defines both the navigation and the page layout.
 */
const settingsSections: SettingsSectionConfig[] = [
  {
    id: 'general',
    titleKey: translations.settings.nav.general,
    descriptionKey: translations.settings.nav.generalDescription,
    icon: Settings2,
  },
  {
    id: 'tracking',
    titleKey: translations.settings.nav.tracking,
    descriptionKey: translations.settings.nav.trackingDescription,
    icon: Trophy,
  },
  {
    id: 'display',
    titleKey: translations.settings.nav.display,
    descriptionKey: translations.settings.nav.displayDescription,
    icon: Monitor,
  },
  {
    id: 'data',
    titleKey: translations.settings.nav.data,
    descriptionKey: translations.settings.nav.dataDescription,
    icon: Database,
  },
  {
    id: 'about',
    titleKey: translations.settings.nav.about,
    descriptionKey: translations.settings.nav.aboutDescription,
    icon: Info,
  },
];

/**
 * Distance (px) from the top of the scroll container at which a section counts as active.
 */
const SCROLL_SPY_OFFSET = 96;

/**
 * Time (ms) without scroll events after which a navigation-triggered scroll is considered finished.
 */
const SCROLL_SETTLE_DELAY = 150;

/**
 * Time (ms) after a navigation click before the navigation lock is released if no scroll happens
 * (for example when the section is already in place).
 */
const NAVIGATION_LOCK_TIMEOUT = SCROLL_SETTLE_DELAY * 4;

/**
 * Tolerance (px) for treating the scroll position as the very bottom, absorbing sub-pixel rounding.
 */
const SCROLL_BOTTOM_TOLERANCE = 2;

/**
 * Returns whether a scroll container is scrolled to (within a few pixels of) its bottom.
 * @param {HTMLElement} container - The scroll container
 * @returns {boolean} True when the container cannot scroll down any further
 */
const isAtBottom = (container: HTMLElement) =>
  container.scrollTop + container.clientHeight >= container.scrollHeight - SCROLL_BOTTOM_TOLERANCE;

/**
 * Builds the DOM id of a settings section.
 * @param {SettingsSectionId} id - The section id
 * @returns {string} The DOM id of the section element
 */
const getSectionDomId = (id: SettingsSectionId) => `settings-section-${id}`;

/**
 * Builds the DOM id of a settings section heading.
 * @param {SettingsSectionId} id - The section id
 * @returns {string} The DOM id of the section heading
 */
const getSectionHeadingId = (id: SettingsSectionId) => `settings-section-${id}-heading`;

/**
 * Returns whether the user prefers reduced motion.
 * @returns {boolean} True when smooth scrolling should be avoided
 */
const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Setup wizard card allowing the user to re-run the onboarding wizard.
 * @returns {JSX.Element} A settings card with a button that opens the setup wizard
 */
function SetupWizardCard() {
  const { t } = useTranslation();
  const { openWizard } = useWizardStore();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          {t(translations.settings.setupWizard.title)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          {t(translations.settings.setupWizard.description)}
        </p>
        <Button onClick={openWizard} variant="default">
          <Sparkles className="mr-2 h-4 w-4" />
          {t(translations.settings.setupWizard.runWizard)}
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Renders the settings cards belonging to a group.
 * @param {SettingsSectionId} id - The section id
 * @returns {ReactNode} The cards of the section
 */
function renderSectionContent(id: SettingsSectionId): ReactNode {
  switch (id) {
    case 'general':
      return (
        <>
          <SaveFileMonitor />
          <D2RInstallationSettings />
          <GameModeSettings />
          <GameVersionSettings />
        </>
      );
    case 'tracking':
      return (
        <>
          <GrailSettings />
          <RunTrackerSettings />
        </>
      );
    case 'display':
      return (
        <>
          <ThemeSettings />
          <ItemIconSettings />
          <WidgetSettings />
          <NotificationSettings />
        </>
      );
    case 'data':
      return (
        <>
          <DatabaseCard />
          <SetupWizardCard />
        </>
      );
    case 'about':
      return (
        <>
          <UpdateSettings />
          <ReportIssues />
        </>
      );
  }
}

/**
 * Settings component that serves as the main settings page.
 * Groups the configuration cards into General, Tracking, Display, Data and About sections
 * and provides a sticky side navigation with scroll-spy highlighting of the visible section.
 * @returns {JSX.Element} The main settings interface with grouped configuration cards
 */
export function Settings() {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('general');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const navigationTargetRef = useRef<SettingsSectionId | undefined>(undefined);
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /**
   * Determines the section currently at the top of the scroll container.
   */
  const computeActiveSection = useCallback((): SettingsSectionId => {
    const container = scrollContainerRef.current;
    if (!container) {
      return settingsSections[0].id;
    }

    // At the very bottom, the last section is active even if it is too short to reach the top
    if (isAtBottom(container)) {
      return settingsSections[settingsSections.length - 1].id;
    }

    const containerTop = container.getBoundingClientRect().top;
    let current = settingsSections[0].id;
    for (const section of settingsSections) {
      const element = document.getElementById(getSectionDomId(section.id));
      if (!element) continue;
      if (element.getBoundingClientRect().top - containerTop <= SCROLL_SPY_OFFSET) {
        current = section.id;
      }
    }
    return current;
  }, []);

  /**
   * Releases the navigation lock and recomputes the highlight, since scroll events that
   * arrived while it was held were ignored. A clicked section that is visible but too short
   * to reach the top of the page keeps its highlight at the bottom of the page.
   */
  const releaseNavigationLock = useCallback(() => {
    const target = navigationTargetRef.current;
    navigationTargetRef.current = undefined;
    settleTimeoutRef.current = undefined;

    const container = scrollContainerRef.current;
    const next = computeActiveSection();
    if (target && target !== next && container) {
      const targetTop = document
        .getElementById(getSectionDomId(target))
        ?.getBoundingClientRect().top;
      const containerTop = container.getBoundingClientRect().top;
      const targetVisibleBelowTop =
        targetTop !== undefined && targetTop - containerTop > SCROLL_SPY_OFFSET;
      if (isAtBottom(container) && targetVisibleBelowTop) {
        setActiveSection(target);
        return;
      }
    }
    setActiveSection(next);
  }, [computeActiveSection]);

  // Scroll-spy: highlight the section currently in view
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    let frame: number | undefined;

    const handleScroll = () => {
      // While a navigation-triggered scroll is in progress keep the clicked section highlighted
      if (navigationTargetRef.current) {
        if (settleTimeoutRef.current) {
          clearTimeout(settleTimeoutRef.current);
        }
        // Keep the clicked section active once scrolling settles, even if a shorter
        // section below it is also visible at the bottom of the page
        settleTimeoutRef.current = setTimeout(releaseNavigationLock, SCROLL_SETTLE_DELAY);
        return;
      }

      if (frame !== undefined) {
        return;
      }
      frame = requestAnimationFrame(() => {
        frame = undefined;
        setActiveSection(computeActiveSection());
      });
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (frame !== undefined) {
        cancelAnimationFrame(frame);
      }
      if (settleTimeoutRef.current) {
        clearTimeout(settleTimeoutRef.current);
      }
    };
  }, [computeActiveSection, releaseNavigationLock]);

  const handleNavigate = useCallback(
    (id: SettingsSectionId) => {
      const section = document.getElementById(getSectionDomId(id));
      navigationTargetRef.current = id;
      setActiveSection(id);

      // Release the navigation lock even if no scroll happens (section already in place)
      if (settleTimeoutRef.current) {
        clearTimeout(settleTimeoutRef.current);
      }
      settleTimeoutRef.current = setTimeout(releaseNavigationLock, NAVIGATION_LOCK_TIMEOUT);

      section?.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'start',
      });

      // Move focus to the section heading so keyboard and screen reader users land in the section
      document.getElementById(getSectionHeadingId(id))?.focus({ preventScroll: true });
    },
    [releaseNavigationLock],
  );

  return (
    <TooltipProvider>
      <div className="flex min-h-0 flex-1">
        <nav
          aria-label={t(translations.settings.nav.label)}
          className="w-56 shrink-0 overflow-y-auto border-r p-4"
        >
          <ul className="space-y-1">
            {settingsSections.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <li key={section.id}>
                  <button
                    type="button"
                    onClick={() => handleNavigate(section.id)}
                    aria-current={isActive ? 'location' : undefined}
                    aria-controls={getSectionDomId(section.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left font-medium text-sm transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {t(section.titleKey)}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <PageShell
          ref={scrollContainerRef}
          contentClassName="space-y-10"
          data-testid="settings-scroll-container"
        >
          <PageHeader
            title={t(translations.settings.title)}
            description={t(translations.settings.description)}
          />
          {settingsSections.map((section) => (
            <section
              key={section.id}
              id={getSectionDomId(section.id)}
              aria-labelledby={getSectionHeadingId(section.id)}
              className="scroll-mt-6 space-y-4"
            >
              <div className="space-y-1">
                <h2
                  id={getSectionHeadingId(section.id)}
                  tabIndex={-1}
                  className="font-semibold text-xl outline-none"
                >
                  {t(section.titleKey)}
                </h2>
                <p className="text-muted-foreground text-sm">{t(section.descriptionKey)}</p>
              </div>
              <div className="space-y-6">{renderSectionContent(section.id)}</div>
            </section>
          ))}
        </PageShell>
      </div>
    </TooltipProvider>
  );
}
