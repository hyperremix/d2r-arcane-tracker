import { ChevronDown } from 'lucide-react';
import { guideUrl } from '../content';

/** A piece of an answer: plain text, a file path or folder, or a link. */
type AnswerPart = string | { code: string } | { text: string; href: string };

export interface FaqEntry {
  question: string;
  answer: AnswerPart[];
}

/**
 * The questions and answers. The visible FAQ and its FAQPage structured data are both built from
 * this list, so they always say the same thing.
 */
export const faqs: FaqEntry[] = [
  {
    question: 'Is it safe to use? Can I get banned?',
    answer: [
      "The app isn't affiliated with Blizzard, so it can't promise how Blizzard treats third-party tools. What it does: item tracking only reads your save files, and the app never writes to the game process. Two optional features edit game or save files: the Inventory Browser edits your save files and backs up each one first, and Terror Zone Configuration edits a game file and keeps a copy of the original.",
    ],
  },
  {
    question: 'Does it read game memory or only save files?',
    answer: [
      'Item detection only reads save files: the ',
      { code: '.d2s' },
      ' character files and the ',
      { code: '.d2i' },
      " shared stash. The Run Tracker's auto mode (Windows only) also reads D2R's memory to tell whether you are in a game, so it can start and end runs for you. It never writes to the game. If you'd rather not use it, turn auto mode off and start and end runs with keyboard shortcuts.",
    ],
  },
  {
    question: 'Does it work with the new v105+ shared stash?',
    answer: [
      'Yes. Finds in a shared stash in the v105+ ',
      { code: '.d2i' },
      ' format are detected like any other, and the stash is listed as Modern Shared Stash Softcore or Modern Shared Stash Hardcore. The Inventory Browser shows its tabs, including the Runes, Gems and Materials tabs with their stack counts.',
    ],
  },
  {
    question: 'Is there a macOS or Linux version?',
    answer: [
      'No. The app is only released for Windows 10 or later (64-bit). The ',
      { text: 'tracker comparison', href: guideUrl('COMPARISON.md') },
      ' lists other trackers, including ones that run on macOS and Linux.',
    ],
  },
  {
    question: 'Does it track hardcore characters?',
    answer: [
      "Yes. In Settings → Tracking → Game Mode you choose whether softcore characters, hardcore characters or both count toward your grail. Switching doesn't delete any finds. Softcore and hardcore shared stashes are listed separately.",
    ],
  },
  {
    question: 'Where are my D2R save files?',
    answer: [
      'Usually in ',
      { code: '%USERPROFILE%\\Saved Games\\Diablo II Resurrected' },
      ', the folder with your ',
      { code: '.d2s' },
      ' character files. The app uses that folder by default. If you pick its parent folder or one of its subfolders in the setup wizard, the wizard suggests the right one.',
    ],
  },
  {
    question: 'Do I need mule characters?',
    answer: [
      'No. Once an item is recorded you can sell, drop or use it. D2R only writes save files when you leave a game, so new finds show up once you are back in the menu.',
    ],
  },
  {
    question: 'Is it free and open source?',
    answer: [
      "Yes. It's free, needs no account, and the source code is on GitHub under the MIT license. Your progress is kept in a local database on your PC.",
    ],
  },
  {
    question: 'How does it compare to other grail trackers?',
    answer: [
      "It's a Windows desktop app that keeps watching your save folder, works offline and needs no account. It also has a run tracker and a terror zone editor. Other trackers support classic D2, more operating systems or an OBS feed. See the ",
      { text: 'tracker comparison', href: guideUrl('COMPARISON.md') },
      '.',
    ],
  },
];

/** The answer as plain text, exactly as it reads on the page. */
export function answerText(answer: AnswerPart[]): string {
  return answer
    .map((part) => {
      if (typeof part === 'string') return part;
      if ('code' in part) return part.code;
      return part.text;
    })
    .join('');
}

/** schema.org FAQPage data for search engines, built from the same entries as the visible FAQ. */
export function faqStructuredData(entries: FaqEntry[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: { '@type': 'Answer', text: answerText(entry.answer) },
    })),
  };
}

const code = 'rounded bg-muted px-1 py-0.5 font-mono text-[0.8125rem] text-foreground';

function Answer({ answer }: { answer: AnswerPart[] }) {
  return (
    <p className="px-5 pb-4 text-muted-foreground text-sm leading-relaxed">
      {answer.map((part, index) => {
        // Parts never move, so their position is a stable key
        const key = `${index}`;
        if (typeof part === 'string') return part;
        if ('code' in part) {
          return (
            <code key={key} className={code}>
              {part.code}
            </code>
          );
        }
        return (
          <a key={key} href={part.href} className="text-primary underline-offset-4 hover:underline">
            {part.text}
          </a>
        );
      })}
    </p>
  );
}

/**
 * Frequently asked questions, as rows that open like the app's collapsible lists. The answers are
 * part of the page's HTML, and the same entries are emitted as FAQPage structured data.
 */
export function FAQ() {
  // `<` is escaped so no answer can close the script element early
  const structuredData = JSON.stringify(faqStructuredData(faqs)).replace(/</g, '\\u003c');

  return (
    <section id="faq" className="border-border border-t">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-12">
        <div className="space-y-5">
          <h2 className="font-display font-semibold text-3xl text-foreground tracking-tight sm:text-4xl">
            FAQ
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            What the app reads and changes, where your saves are and what it runs on.
          </p>
        </div>
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {faqs.map((entry) => (
            <li key={entry.question}>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 outline-none transition-colors hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
                  <h3 className="min-w-0 flex-1 font-medium text-foreground text-sm">
                    {entry.question}
                  </h3>
                  <ChevronDown
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none"
                    aria-hidden="true"
                  />
                </summary>
                <Answer answer={entry.answer} />
              </details>
            </li>
          ))}
        </ul>
      </div>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD built from the static FAQ entries above, with `<` escaped
        dangerouslySetInnerHTML={{ __html: structuredData }}
      />
    </section>
  );
}
