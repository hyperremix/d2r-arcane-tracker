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

type ParsedRawItem = {
  runeword_name?: unknown;
  unique_name?: unknown;
  set_name?: unknown;
  name?: unknown;
  type_name?: unknown;
  type?: unknown;
  base_damage?: unknown;
  current_durability?: unknown;
  max_durability?: unknown;
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

export interface GameItemTooltipModel {
  name: string;
  quality: string;
  isRuneword: boolean;
  baseTypeLine?: string;
  coreLines: string[];
  affixLines: string[];
}

interface BuildGameItemTooltipModelArgs {
  rawItemJson: string;
  fallbackName: string;
  quality: string;
  type?: string;
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

export function buildGameItemTooltipModel(
  args: BuildGameItemTooltipModelArgs,
): GameItemTooltipModel | null {
  const raw = parseRawItem(args.rawItemJson);
  if (!raw) {
    return null;
  }

  const name = getName(raw, args.fallbackName);
  const baseTypeLine = getBaseType(raw);
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
  const hasMeaningfulContent =
    Boolean(baseTypeLine) || coreLines.length > 0 || affixLines.length > 0;
  if (!hasMeaningfulContent) {
    return null;
  }

  return {
    name,
    quality: args.quality,
    isRuneword: Boolean(
      toOptionalString(raw.runeword_name) || args.type?.toLowerCase() === 'runeword',
    ),
    baseTypeLine,
    coreLines,
    affixLines,
  };
}
