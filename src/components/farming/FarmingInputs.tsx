import {
  MAX_FARMING_CHARACTER_LEVEL,
  MAX_FARMING_MAGIC_FIND,
  MAX_FARMING_PLAYERS,
} from 'electron/types/grail';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { translations } from '@/i18n/translations';
import { clampInteger } from '@/lib/farming';

interface NumberFieldProps {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

/**
 * A number input that keeps what is typed while it is being edited (an empty field, say) and
 * passes on every valid number, clamped to its range.
 */
function NumberField({ label, description, value, min, max, onChange }: NumberFieldProps) {
  const id = useId();
  const descriptionId = useId();
  const [draft, setDraft] = useState<string | undefined>(undefined);
  return (
    <div className="grid gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={draft ?? String(value)}
        aria-describedby={descriptionId}
        onChange={(event) => {
          setDraft(event.target.value);
          if (event.target.value !== '' && Number.isFinite(event.target.valueAsNumber)) {
            onChange(clampInteger(event.target.valueAsNumber, min, max));
          }
        }}
        onBlur={() => setDraft(undefined)}
        className="w-28"
      />
      <p id={descriptionId} className="text-muted-foreground text-xs">
        {description}
      </p>
    </div>
  );
}

/** Which inputs to show and their values. */
interface FarmingInputsProps {
  characterLevel?: { value: number; onChange: (value: number) => void };
  players?: { value: number; onChange: (value: number) => void };
  magicFind?: { value: number; onChange: (value: number) => void };
}

/**
 * The inputs of the drop calculation: character level for terror zones, /players and magic find.
 */
export function FarmingInputs({ characterLevel, players, magicFind }: FarmingInputsProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-4">
      {characterLevel && (
        <NumberField
          label={t(translations.farming.characterLevel)}
          description={t(translations.farming.characterLevelDescription)}
          min={1}
          max={MAX_FARMING_CHARACTER_LEVEL}
          {...characterLevel}
        />
      )}
      {players && (
        <NumberField
          label={t(translations.farming.players)}
          description={t(translations.farming.playersDescription)}
          min={1}
          max={MAX_FARMING_PLAYERS}
          {...players}
        />
      )}
      {magicFind && (
        <NumberField
          label={t(translations.farming.magicFind)}
          description={t(translations.farming.magicFindDescription)}
          min={0}
          max={MAX_FARMING_MAGIC_FIND}
          {...magicFind}
        />
      )}
    </div>
  );
}
