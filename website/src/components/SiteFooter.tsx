import { links } from '../content';

const footerLinks = [
  { label: 'GitHub', href: links.repository },
  { label: 'Releases', href: links.releases },
  { label: 'Issues', href: links.issues },
  { label: 'Discussions', href: links.discussions },
  { label: 'Third-party licenses', href: links.thirdPartyLicenses },
];

export function SiteFooter() {
  return (
    <footer className="border-border border-t">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 text-muted-foreground text-sm sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-[60ch] space-y-2">
          <p className="flex items-center gap-2 font-display font-semibold text-foreground tracking-wide">
            <img
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt=""
              width={20}
              height={20}
              className="h-5 w-5"
            />
            D2R Arcane Tracker
          </p>
          <p>
            Released under the{' '}
            <a href={links.license} className="text-foreground underline-offset-4 hover:underline">
              MIT license
            </a>
            . Diablo II: Resurrected is a trademark of Blizzard Entertainment. This project isn't
            affiliated with Blizzard.
          </p>
        </div>
        <nav aria-label="Project links">
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {footerLinks.map((link) => (
              <li key={link.label}>
                <a href={link.href} className="hover:text-foreground">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
