import { materialDisplayNameByCode } from 'electron/items/materials';
import { runeDisplayNameByCode, runeImageFilenameByCode } from 'electron/items/runes';
import { translations } from '@/i18n/translations';

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

type ParsedBaseDamage = {
  mindam?: unknown;
  maxdam?: unknown;
  twohandmindam?: unknown;
  twohandmaxdam?: unknown;
};

type ParsedMagicAttribute = {
  description?: unknown;
  visible?: unknown;
};

type ParsedSocketedRawItem = {
  runeword_name?: unknown;
  unique_name?: unknown;
  set_name?: unknown;
  name?: unknown;
  type_name?: unknown;
  type?: unknown;
  code?: unknown;
  inv_file?: unknown;
};

type ParsedRawItem = {
  runeword_name?: unknown;
  unique_name?: unknown;
  set_name?: unknown;
  name?: unknown;
  type_name?: unknown;
  type?: unknown;
  code?: unknown;
  inv_file?: unknown;
  base_damage?: unknown;
  current_durability?: unknown;
  max_durability?: unknown;
  socket_count?: unknown;
  total_nr_of_sockets?: unknown;
  nr_of_items_in_sockets?: unknown;
  socketed_items?: unknown;
  reqstr?: unknown;
  reqdex?: unknown;
  required_level?: unknown;
  reqlvl?: unknown;
  req_level?: unknown;
  levelreq?: unknown;
  level_req?: unknown;
  requiredlvl?: unknown;
  displayed_combined_magic_attributes?: unknown;
};

export interface GameItemTooltipSocketEntry {
  id: string;
  name: string;
  isOpenSocket: boolean;
  iconCandidates?: string[];
}

export interface GameItemTooltipModel {
  name: string;
  quality: string;
  isRuneword: boolean;
  baseTypeLine?: string;
  coreLines: string[];
  affixLines: string[];
  socketEntries: GameItemTooltipSocketEntry[];
}

interface BuildGameItemTooltipModelArgs {
  rawItemJson: string;
  fallbackName: string;
  quality: string;
  type?: string;
  socketCount?: number;
  t: TranslateFn;
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function toNonNegativeInteger(value: unknown): number | undefined {
  const parsed = toOptionalNumber(value);
  if (parsed === undefined) {
    return undefined;
  }

  return Math.max(0, Math.trunc(parsed));
}

function parseRawItem(rawItemJson: string): ParsedRawItem | undefined {
  try {
    const parsed = JSON.parse(rawItemJson);
    if (parsed && typeof parsed === 'object') {
      return parsed as ParsedRawItem;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function getBaseDamage(raw: ParsedRawItem): ParsedBaseDamage | undefined {
  if (!raw.base_damage || typeof raw.base_damage !== 'object') {
    return undefined;
  }

  return raw.base_damage as ParsedBaseDamage;
}

function getRequiredLevel(raw: ParsedRawItem): number | undefined {
  const candidates = [
    raw.required_level,
    raw.reqlvl,
    raw.req_level,
    raw.levelreq,
    raw.level_req,
    raw.requiredlvl,
  ];

  for (const candidate of candidates) {
    const value = toOptionalNumber(candidate);
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function getLine(label: string, value: string | number): string {
  return `${label} ${value}`;
}

function getAffixLines(raw: ParsedRawItem): string[] {
  if (!Array.isArray(raw.displayed_combined_magic_attributes)) {
    return [];
  }

  return raw.displayed_combined_magic_attributes
    .flatMap((attribute) => {
      if (!attribute || typeof attribute !== 'object') {
        return [];
      }

      const parsedAttribute = attribute as ParsedMagicAttribute;
      if (parsedAttribute.visible === false) {
        return [];
      }

      const description = toOptionalString(parsedAttribute.description);
      return description ? [description] : [];
    })
    .filter((line, index, all) => all.indexOf(line) === index);
}

function getName(raw: ParsedRawItem, fallbackName: string): string {
  const candidates = [raw.runeword_name, raw.unique_name, raw.set_name, raw.name];

  for (const candidate of candidates) {
    const parsed = toOptionalString(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return fallbackName;
}

function getBaseType(raw: ParsedRawItem): string | undefined {
  return toOptionalString(raw.type_name) ?? toOptionalString(raw.type);
}

function getSocketedItems(raw: ParsedRawItem): ParsedSocketedRawItem[] {
  if (!Array.isArray(raw.socketed_items)) {
    return [];
  }

  return raw.socketed_items
    .filter((item): item is ParsedSocketedRawItem => Boolean(item) && typeof item === 'object')
    .map((item) => item as ParsedSocketedRawItem);
}

function getSocketedItemName(raw: ParsedSocketedRawItem, t: TranslateFn): string {
  const code = toOptionalString(raw.code) ?? toOptionalString(raw.type);
  if (code && runeDisplayNameByCode[code]) {
    return runeDisplayNameByCode[code];
  }

  const candidates = [
    raw.runeword_name,
    raw.unique_name,
    raw.set_name,
    raw.name,
    raw.type_name,
    raw.type,
  ];

  for (const candidate of candidates) {
    const parsed = toOptionalString(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return t(translations.common.unknown);
}

function basename(input: string): string {
  const parts = input.split(/[\\/]/);
  return parts[parts.length - 1] ?? input;
}

function stripImageExtension(input: string): string {
  return input.replace(/\.(png|sprite|dc6|dds|jpg|jpeg|webp)$/i, '');
}

function toOptionalInvFilePng(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${value}.png`;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = stripImageExtension(basename(value.trim())).toLowerCase();
  if (!normalized) {
    return undefined;
  }

  return `${normalized}.png`;
}

function toSnakeCaseFilename(value: string): string | undefined {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/['`]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!normalized) {
    return undefined;
  }

  return `${normalized}.png`;
}

function addIconCandidate(candidates: Set<string>, value: unknown): void {
  if (typeof value !== 'string') {
    return;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return;
  }

  candidates.add(trimmed);
}

function addCodeIconCandidates(candidates: Set<string>, value: unknown): void {
  if (typeof value !== 'string') {
    return;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return;
  }

  candidates.add(trimmed);
  candidates.add(`${trimmed}.png`);
}

function addNameIconCandidates(candidates: Set<string>, value: unknown): void {
  if (typeof value !== 'string') {
    return;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return;
  }

  candidates.add(trimmed);

  const snakeFilename = toSnakeCaseFilename(trimmed);
  if (snakeFilename) {
    candidates.add(snakeFilename);
  }
}

function buildSocketIconCandidates(socketedItem: ParsedSocketedRawItem): string[] | undefined {
  const candidates = new Set<string>();

  // Fast path: if this is a known rune, add its canonical image filename first so the
  // icon resolves in a single IPC call rather than falling through ~10 misses.
  const itemCode = toOptionalString(socketedItem.code) ?? toOptionalString(socketedItem.type);
  if (itemCode) {
    const runeImageFilename = runeImageFilenameByCode[itemCode];
    if (runeImageFilename) {
      candidates.add(runeImageFilename);
    }
  }

  addIconCandidate(candidates, socketedItem.inv_file);
  addIconCandidate(candidates, toOptionalInvFilePng(socketedItem.inv_file));
  addCodeIconCandidates(candidates, socketedItem.code);
  addNameIconCandidates(candidates, socketedItem.runeword_name);
  addNameIconCandidates(candidates, socketedItem.unique_name);
  addNameIconCandidates(candidates, socketedItem.set_name);
  addNameIconCandidates(candidates, socketedItem.name);
  addNameIconCandidates(candidates, socketedItem.type_name);
  addNameIconCandidates(candidates, socketedItem.type);

  const resolvedCandidates = [...candidates];
  return resolvedCandidates.length > 0 ? resolvedCandidates : undefined;
}

function getTotalSocketCount(raw: ParsedRawItem, fallbackSocketCount?: number): number {
  const candidates = [raw.total_nr_of_sockets, raw.socket_count, fallbackSocketCount];

  for (const candidate of candidates) {
    const value = toNonNegativeInteger(candidate);
    if (value !== undefined) {
      return value;
    }
  }

  return 0;
}

function getFilledSocketCount(raw: ParsedRawItem, socketedItemsLength: number): number {
  const fromRaw = toNonNegativeInteger(raw.nr_of_items_in_sockets);
  if (fromRaw !== undefined) {
    return fromRaw;
  }

  return socketedItemsLength;
}

function buildSocketEntries(
  raw: ParsedRawItem,
  fallbackSocketCount: number | undefined,
  t: TranslateFn,
): GameItemTooltipSocketEntry[] {
  const socketedItems = getSocketedItems(raw);
  const socketEntries: GameItemTooltipSocketEntry[] = socketedItems.map((socketedItem, index) => ({
    id: `socketed-${index}`,
    name: getSocketedItemName(socketedItem, t),
    isOpenSocket: false,
    iconCandidates: buildSocketIconCandidates(socketedItem),
  }));

  const totalSockets = getTotalSocketCount(raw, fallbackSocketCount);
  const filledSockets = getFilledSocketCount(raw, socketedItems.length);
  const openSockets = Math.max(totalSockets - filledSockets, 0);

  for (let index = 0; index < openSockets; index += 1) {
    socketEntries.push({
      id: `open-socket-${index}`,
      name: t(translations.gameItemTooltip.openSocketLabel),
      isOpenSocket: true,
    });
  }

  return socketEntries;
}

function resolveNameAndBaseType(
  raw: ParsedRawItem,
  fallbackName: string,
): [
  name: string,
  baseTypeLine: string | undefined,
  hasBaseType: boolean,
  isMaterialOverride: boolean,
] {
  const itemCode = toOptionalString(raw.code) ?? toOptionalString(raw.type);
  if (itemCode && materialDisplayNameByCode[itemCode]) {
    return [materialDisplayNameByCode[itemCode], undefined, true, true];
  }
  const rawName = getName(raw, fallbackName);
  // When the base type line already contains the raw name (e.g. "vex" + "Vex Rune",
  // or "flaweddiamond" + "Flawed Diamond"), the raw name is a redundant internal
  // code — promote baseTypeLine to the title. Compare after stripping spaces so
  // multi-word type names like "Flawed Diamond" match their concatenated form.
  const rawBaseTypeLine = getBaseType(raw);
  const rawNameNormalized = rawName.toLowerCase().replace(/\s+/g, '');
  return rawBaseTypeLine?.toLowerCase().replace(/\s+/g, '').includes(rawNameNormalized)
    ? [rawBaseTypeLine, undefined, true, false]
    : [rawName, rawBaseTypeLine, Boolean(rawBaseTypeLine), false];
}

export function buildGameItemTooltipModel(
  args: BuildGameItemTooltipModelArgs,
): GameItemTooltipModel | null {
  const raw = parseRawItem(args.rawItemJson);
  if (!raw) {
    return null;
  }

  const [name, baseTypeLine, hasBaseType, isMaterialOverride] = resolveNameAndBaseType(
    raw,
    args.fallbackName,
  );
  const coreLines: string[] = [];

  const baseDamage = getBaseDamage(raw);
  const oneHandMin = toOptionalNumber(baseDamage?.mindam);
  const oneHandMax = toOptionalNumber(baseDamage?.maxdam);
  if (oneHandMin !== undefined && oneHandMax !== undefined) {
    coreLines.push(
      getLine(
        args.t(translations.gameItemTooltip.oneHandDamageLabel),
        args.t(translations.gameItemTooltip.oneHandDamageValue, {
          min: oneHandMin,
          max: oneHandMax,
        }),
      ),
    );
  }

  const twoHandMin = toOptionalNumber(baseDamage?.twohandmindam);
  const twoHandMax = toOptionalNumber(baseDamage?.twohandmaxdam);
  if (twoHandMin !== undefined && twoHandMax !== undefined) {
    coreLines.push(
      getLine(
        args.t(translations.gameItemTooltip.twoHandDamageLabel),
        args.t(translations.gameItemTooltip.twoHandDamageValue, {
          min: twoHandMin,
          max: twoHandMax,
        }),
      ),
    );
  }

  const currentDurability = toOptionalNumber(raw.current_durability);
  const maxDurability = toOptionalNumber(raw.max_durability);
  if (currentDurability !== undefined && maxDurability !== undefined) {
    coreLines.push(
      getLine(
        args.t(translations.gameItemTooltip.durabilityLabel),
        args.t(translations.gameItemTooltip.durabilityValue, {
          current: currentDurability,
          max: maxDurability,
        }),
      ),
    );
  }

  const reqStrength = toOptionalNumber(raw.reqstr);
  if (reqStrength !== undefined) {
    coreLines.push(
      getLine(args.t(translations.gameItemTooltip.requiredStrengthLabel), reqStrength),
    );
  }

  const reqDexterity = toOptionalNumber(raw.reqdex);
  if (reqDexterity !== undefined) {
    coreLines.push(
      getLine(args.t(translations.gameItemTooltip.requiredDexterityLabel), reqDexterity),
    );
  }

  const reqLevel = getRequiredLevel(raw);
  if (reqLevel !== undefined) {
    coreLines.push(getLine(args.t(translations.gameItemTooltip.requiredLevelLabel), reqLevel));
  }

  const affixLines = getAffixLines(raw);
  const socketEntries = buildSocketEntries(raw, args.socketCount, args.t);
  const hasMeaningfulContent =
    hasBaseType ||
    Boolean(baseTypeLine) ||
    coreLines.length > 0 ||
    affixLines.length > 0 ||
    socketEntries.length > 0;
  if (!hasMeaningfulContent) {
    return null;
  }

  return {
    name,
    quality: isMaterialOverride ? 'normal' : args.quality,
    isRuneword: Boolean(
      toOptionalString(raw.runeword_name) || args.type?.toLowerCase() === 'runeword',
    ),
    baseTypeLine,
    coreLines,
    affixLines,
    socketEntries,
  };
}
