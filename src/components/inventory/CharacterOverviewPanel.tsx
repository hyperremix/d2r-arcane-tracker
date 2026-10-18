import type {
  CharacterOverview,
  Difficulty,
  DifficultyProgress,
  QuestRewardId,
  QuestRewardState,
  SpeedStatTotal,
} from 'electron/types/grail';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCharacterOverview } from '@/components/inventory/useCharacterOverview';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { translations } from '@/i18n/translations';
import { characterClassLabelKey } from '@/lib/labelKeys';
import { cn } from '@/lib/utils';

const overviewKeys = translations.characterOverview;

const DIFFICULTY_LABEL_KEYS: Record<Difficulty, string> = {
  normal: overviewKeys.difficulties.normal,
  nightmare: overviewKeys.difficulties.nightmare,
  hell: overviewKeys.difficulties.hell,
};

const ACT_NUMERALS = ['I', 'II', 'III', 'IV', 'V'];

const REWARD_STATE_BADGE: Record<QuestRewardState, 'found' | 'default' | 'outline'> = {
  claimed: 'found',
  unclaimed: 'default',
  notEarned: 'outline',
};

function rewardStateLabelKey(reward: QuestRewardId, state: QuestRewardState): string {
  return reward === 'akaraRespec'
    ? overviewKeys.quests.respecStates[state]
    : overviewKeys.quests.states[state];
}

function progressLabelKey(progress: DifficultyProgress): string {
  if (progress.completed) {
    return overviewKeys.progress.completed;
  }
  return progress.reached ? overviewKeys.progress.inProgress : overviewKeys.progress.notReached;
}

function BasicsCard({ overview }: { overview: CharacterOverview }) {
  const { t } = useTranslation();
  const { attributes } = overview;
  const facts: [string, number][] = [
    [overviewKeys.basics.experience, overview.experience],
    [overviewKeys.basics.goldInventory, overview.gold.inventory],
    [overviewKeys.basics.goldStash, overview.gold.stash],
  ];
  const attributeRows: [string, number][] = [
    [overviewKeys.basics.strength, attributes.strength],
    [overviewKeys.basics.dexterity, attributes.dexterity],
    [overviewKeys.basics.vitality, attributes.vitality],
    [overviewKeys.basics.energy, attributes.energy],
    [overviewKeys.basics.unusedStatPoints, attributes.unusedStatPoints],
    [overviewKeys.basics.unusedSkillPoints, attributes.unusedSkillPoints],
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t(overviewKeys.basics.title)}</CardTitle>
        <CardDescription>
          {t(translations.inventoryBrowser.snapshotList.classLevel, {
            characterClass: t(characterClassLabelKey(overview.characterClass ?? 'unknown')),
            level: overview.level,
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">
            {t(overview.hardcore ? overviewKeys.basics.hardcore : overviewKeys.basics.softcore)}
          </Badge>
          {!overview.expansion && <Badge variant="outline">{t(overviewKeys.basics.classic)}</Badge>}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {facts.map(([labelKey, value]) => (
            <div key={labelKey} className="contents">
              <dt className="text-muted-foreground">{t(labelKey)}</dt>
              <dd className="text-right tabular-nums">{value.toLocaleString()}</dd>
            </div>
          ))}
        </dl>
        <div className="space-y-1">
          <h3 className="font-medium text-sm">{t(overviewKeys.basics.attributesTitle)}</h3>
          <p className="text-muted-foreground text-xs">{t(overviewKeys.basics.attributesNote)}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {attributeRows.map(([labelKey, value]) => (
              <div key={labelKey} className="contents">
                <dt className="text-muted-foreground">{t(labelKey)}</dt>
                <dd className="text-right tabular-nums">{value.toLocaleString()}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="space-y-1">
          <h3 className="font-medium text-sm">{t(overviewKeys.progress.title)}</h3>
          <ul className="flex flex-wrap gap-2">
            {overview.difficulties.map((progress) => (
              <li key={progress.difficulty}>
                <Badge variant={progress.completed ? 'found' : 'outline'}>
                  {t(overviewKeys.progress.difficultyState, {
                    difficulty: t(DIFFICULTY_LABEL_KEYS[progress.difficulty]),
                    state: t(progressLabelKey(progress)),
                  })}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function QuestRewardsCard({ overview }: { overview: CharacterOverview }) {
  const { t } = useTranslation();
  const rewardIds = overview.difficulties[0]?.rewards.map((status) => status.reward) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t(overviewKeys.quests.title)}</CardTitle>
        <CardDescription>{t(overviewKeys.quests.description)}</CardDescription>
      </CardHeader>
      <CardContent>
        {overview.questDataAvailable ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t(overviewKeys.quests.rewardColumn)}</TableHead>
                  {overview.difficulties.map((progress) => (
                    <TableHead key={progress.difficulty}>
                      {t(DIFFICULTY_LABEL_KEYS[progress.difficulty])}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rewardIds.map((reward) => (
                  <TableRow key={reward}>
                    <TableHead scope="row" className="whitespace-normal font-normal">
                      {t(overviewKeys.quests.rewards[reward])}
                    </TableHead>
                    {overview.difficulties.map((progress) => {
                      const state =
                        progress.rewards.find((status) => status.reward === reward)?.state ??
                        'notEarned';
                      return (
                        <TableCell
                          key={progress.difficulty}
                          className={cn(state === 'unclaimed' && 'bg-primary/10')}
                        >
                          <Badge variant={REWARD_STATE_BADGE[state]}>
                            {t(rewardStateLabelKey(reward, state))}
                          </Badge>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-3 text-muted-foreground text-xs">
              {t(overviewKeys.quests.unconfirmedNote)}
            </p>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">{t(overviewKeys.quests.noData)}</p>
        )}
      </CardContent>
    </Card>
  );
}

function DifficultyWaypoints({ progress }: { progress: DifficultyProgress }) {
  const { t } = useTranslation();
  const missingByAct = new Map<number, string[]>();
  for (const { act, waypoint } of progress.missingWaypoints) {
    missingByAct.set(act, [
      ...(missingByAct.get(act) ?? []),
      t(overviewKeys.waypoints.names[waypoint]),
    ]);
  }

  return (
    <section className="space-y-1">
      <h3 className="flex flex-wrap items-baseline justify-between gap-2 font-medium text-sm">
        <span>{t(DIFFICULTY_LABEL_KEYS[progress.difficulty])}</span>
        <span className="font-normal text-muted-foreground text-xs">
          {progress.reached
            ? t(overviewKeys.waypoints.count, {
                activated: progress.activatedWaypointCount,
                total: progress.totalWaypointCount,
              })
            : t(overviewKeys.progress.notReached)}
        </span>
      </h3>
      {progress.reached &&
        (missingByAct.size === 0 ? (
          <p className="text-muted-foreground text-sm">{t(overviewKeys.waypoints.allActivated)}</p>
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            {[...missingByAct.entries()].map(([act, names]) => (
              <div key={act} className="contents">
                <dt className="whitespace-nowrap font-medium">
                  {t(overviewKeys.waypoints.act, { act: ACT_NUMERALS[act - 1] })}
                </dt>
                <dd className="text-muted-foreground">{names.join(', ')}</dd>
              </div>
            ))}
          </dl>
        ))}
    </section>
  );
}

function WaypointsCard({ overview }: { overview: CharacterOverview }) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t(overviewKeys.waypoints.title)}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {overview.difficulties.map((progress) => (
          <DifficultyWaypoints key={progress.difficulty} progress={progress} />
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * One speed stat with its breakpoints. Attack speed is a plain number: its breakpoints depend on
 * the weapon and the skill.
 */
function SpeedRow({ labelKey, stat }: { labelKey: string; stat: SpeedStatTotal | number }) {
  const { t } = useTranslation();
  const total = typeof stat === 'number' ? stat : stat.total;
  const breakpoints = typeof stat === 'number' ? undefined : stat.breakpoints;

  return (
    <TableRow>
      <TableHead scope="row" className="font-normal">
        {t(labelKey)}
      </TableHead>
      <TableCell className="tabular-nums">
        {t(overviewKeys.gear.percent, { value: total })}
      </TableCell>
      {breakpoints ? (
        <>
          <TableCell className="tabular-nums">
            {t(overviewKeys.gear.percent, { value: breakpoints.reached })}
          </TableCell>
          <TableCell className="tabular-nums">
            {breakpoints.next === undefined
              ? t(overviewKeys.gear.lastBreakpoint)
              : t(overviewKeys.gear.percent, { value: breakpoints.next })}
          </TableCell>
        </>
      ) : (
        <TableCell colSpan={2} className="whitespace-normal text-muted-foreground">
          {t(
            typeof stat === 'number'
              ? overviewKeys.gear.weaponDependent
              : overviewKeys.gear.noBreakpointTable,
          )}
        </TableCell>
      )}
    </TableRow>
  );
}

function GearTotalsCard({ overview }: { overview: CharacterOverview }) {
  const { t } = useTranslation();
  const { gear } = overview;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t(overviewKeys.gear.title)}</CardTitle>
        <CardDescription>{t(overviewKeys.gear.description)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">{t(overviewKeys.gear.magicFind)}</dt>
          <dd className="text-right tabular-nums">
            {t(overviewKeys.gear.percent, { value: gear.magicFind })}
          </dd>
          <dt className="text-muted-foreground">{t(overviewKeys.gear.goldFind)}</dt>
          <dd className="text-right tabular-nums">
            {t(overviewKeys.gear.percent, { value: gear.goldFind })}
          </dd>
        </dl>

        <section className="space-y-1">
          <h3 className="font-medium text-sm">{t(overviewKeys.gear.resistances)}</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t(overviewKeys.gear.resistanceColumn)}</TableHead>
                {overview.difficulties.map((progress) => (
                  <TableHead key={progress.difficulty}>
                    {t(DIFFICULTY_LABEL_KEYS[progress.difficulty])}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {gear.resistances.map((resistance) => (
                <TableRow key={resistance.kind}>
                  <TableHead scope="row" className="font-normal">
                    {t(overviewKeys.gear.resistanceNames[resistance.kind])}
                  </TableHead>
                  {resistance.byDifficulty.map(({ difficulty, total, cap }) => (
                    <TableCell
                      key={difficulty}
                      className={cn('tabular-nums', total < 0 && 'text-destructive')}
                    >
                      {t(overviewKeys.gear.percent, { value: Math.min(total, cap) })}
                      {total > cap && (
                        <span className="block text-muted-foreground text-xs">
                          {t(overviewKeys.gear.overCap, { total, cap })}
                        </span>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {gear.anyaScrollBonus > 0 && (
            <p className="text-muted-foreground text-xs">
              {t(overviewKeys.gear.anyaScrollBonus, { value: gear.anyaScrollBonus })}
            </p>
          )}
        </section>

        <section className="space-y-1">
          <h3 className="font-medium text-sm">{t(overviewKeys.gear.speed)}</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t(overviewKeys.gear.speedColumn)}</TableHead>
                <TableHead>{t(overviewKeys.gear.totalColumn)}</TableHead>
                <TableHead>{t(overviewKeys.gear.breakpointColumn)}</TableHead>
                <TableHead>{t(overviewKeys.gear.nextBreakpointColumn)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <SpeedRow labelKey={overviewKeys.gear.fasterCastRate} stat={gear.fasterCastRate} />
              <SpeedRow
                labelKey={overviewKeys.gear.fasterHitRecovery}
                stat={gear.fasterHitRecovery}
              />
              <SpeedRow labelKey={overviewKeys.gear.fasterBlockRate} stat={gear.fasterBlockRate} />
              <SpeedRow
                labelKey={overviewKeys.gear.increasedAttackSpeed}
                stat={gear.increasedAttackSpeed}
              />
            </TableBody>
          </Table>
        </section>

        <p className="text-muted-foreground text-xs">{t(overviewKeys.gear.notCounted)}</p>
      </CardContent>
    </Card>
  );
}

/**
 * Overview of one character save: basics, quest rewards per difficulty with the unclaimed ones
 * highlighted, missing waypoints and the totals of the equipped gear. It only reads the save.
 * @param filePath - Path of the .d2s file.
 */
export function CharacterOverviewPanel({ filePath }: { filePath: string }) {
  const { t } = useTranslation();
  const state = useCharacterOverview(filePath);

  if (state.status === 'loading') {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 p-6 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {t(translations.common.loading)}
      </div>
    );
  }

  if (state.status === 'unavailable') {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center text-muted-foreground text-sm">
        {t(overviewKeys.unavailable)}
      </div>
    );
  }

  const { overview } = state;
  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="columns-1 gap-4 lg:columns-2 [&>*]:mb-4 [&>*]:break-inside-avoid">
        <BasicsCard overview={overview} />
        <QuestRewardsCard overview={overview} />
        <WaypointsCard overview={overview} />
        <GearTotalsCard overview={overview} />
      </div>
      <p className="text-muted-foreground text-xs">{t(overviewKeys.readOnlyNote)}</p>
    </div>
  );
}
