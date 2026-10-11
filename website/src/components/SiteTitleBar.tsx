import type { LucideIcon } from 'lucide-react';
import { BookOpen, CircleHelp, Download, Github, LayoutGrid } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { links } from '../content';
import { useActiveSection } from '../hooks/useActiveSection';

interface SectionLink {
  id: string;
  label: string;
  icon: LucideIcon;
}

// In page order: the active section is the last one scrolled past
export const SECTION_LINKS: SectionLink[] = [
  { id: 'features', label: 'Features', icon: LayoutGrid },
  { id: 'install', label: 'Install', icon: Download },
  { id: 'faq', label: 'FAQ', icon: CircleHelp },
  { id: 'guides', label: 'Guides', icon: BookOpen },
];

const SECTION_IDS = SECTION_LINKS.map((section) => section.id);

// Same link styles as the app's title bar navigation
const navLinkBase =
  'relative inline-flex h-8 shrink-0 items-center rounded-md font-medium text-sm outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50';
const navLinkIdle = 'text-muted-foreground hover:bg-accent/50 hover:text-foreground';
const navLinkActive =
  'bg-accent text-accent-foreground after:absolute after:inset-x-1.5 after:bottom-0.5 after:h-0.5 after:rounded-full after:bg-foreground';

/**
 * Link to a section of the page. Like the app's title bar links it shows its label on wider
 * screens and only its icon, with a tooltip, on phones.
 */
function SectionNavLink({
  section,
  isActive,
  homeUrl,
}: {
  section: SectionLink;
  isActive: boolean;
  homeUrl: string;
}) {
  const Icon = section.icon;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          // biome-ignore lint/a11y/useAnchorContent: TooltipTrigger renders its children (icon and label) inside this link
          <a
            href={`${homeUrl}#${section.id}`}
            aria-current={isActive ? 'location' : undefined}
            className={cn(
              navLinkBase,
              'w-8 justify-center sm:w-auto sm:gap-1.5 sm:px-2',
              isActive ? navLinkActive : navLinkIdle,
            )}
          />
        }
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="sr-only sm:not-sr-only">{section.label}</span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="sm:hidden">
        {section.label}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * The site navigation, styled like the app's title bar: brand on the left, links to the page's
 * sections on the right. The link of the section being read is marked like the app's active page.
 * On other pages (the guides), pass the home page's URL as `homeUrl` so the links go to its sections.
 */
export function SiteTitleBar({ homeUrl = '' }: { homeUrl?: string }) {
  const activeSection = useActiveSection(SECTION_IDS);

  return (
    <header className="sticky top-0 z-40 border-border border-b bg-background/90 backdrop-blur-md supports-backdrop-filter:bg-background/75">
      <div className="mx-auto flex h-12 max-w-7xl items-center gap-2 px-4 sm:px-6">
        <a
          href={`${homeUrl}#top`}
          className="flex min-w-0 items-center gap-2 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <img
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt=""
            width={20}
            height={20}
            className="h-5 w-5 shrink-0"
          />
          <span className="truncate font-display font-semibold text-sm tracking-wide max-[400px]:sr-only">
            D2R Arcane Tracker
          </span>
        </a>

        <div className="min-w-0 flex-1" />

        <nav aria-label="Main navigation" className="flex shrink-0 items-center">
          <ul className="flex items-center gap-1">
            {SECTION_LINKS.map((section) => (
              <li key={section.id}>
                <SectionNavLink
                  section={section}
                  isActive={section.id === activeSection}
                  homeUrl={homeUrl}
                />
              </li>
            ))}
          </ul>
          <div aria-hidden="true" className="mx-1 h-5 w-px bg-border sm:mx-2" />
          <Tooltip>
            <TooltipTrigger
              render={
                // biome-ignore lint/a11y/useAnchorContent: TooltipTrigger renders its children (icon and label) inside this link
                <a
                  href={links.repository}
                  className={cn(navLinkBase, navLinkIdle, 'w-8 justify-center')}
                />
              }
            >
              <Github className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="sr-only">GitHub</span>
            </TooltipTrigger>
            <TooltipContent side="bottom">GitHub</TooltipContent>
          </Tooltip>
        </nav>
      </div>
    </header>
  );
}
