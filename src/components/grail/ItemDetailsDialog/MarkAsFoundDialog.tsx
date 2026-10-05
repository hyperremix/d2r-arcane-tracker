import dayjs from 'dayjs';
import type { GrailProgress, Item, Settings } from 'electron/types/grail';
import { type FormEvent, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { translations } from '@/i18n/translations';
import { canItemBeNormal, shouldShowEtherealStatus, shouldShowNormalStatus } from '@/lib/ethereal';
import { useGrailStore } from '@/stores/grailStore';

export type ItemVersion = 'normal' | 'ethereal';

const DATE_INPUT_FORMAT = 'YYYY-MM-DD';

/**
 * Returns the item versions a user can record as found, based on the item and grail settings.
 * Falls back to the item's intrinsic version if no version is tracked by the current settings.
 */
export function getRecordableVersions(item: Item, settings: Settings): ItemVersion[] {
  const versions: ItemVersion[] = [];
  if (shouldShowNormalStatus(item, settings)) versions.push('normal');
  if (shouldShowEtherealStatus(item, settings)) versions.push('ethereal');
  if (versions.length === 0) versions.push(canItemBeNormal(item) ? 'normal' : 'ethereal');
  return versions;
}

/**
 * Converts a date input value (YYYY-MM-DD, local time) into the found date to persist.
 * Today's date keeps the current time so the find is ordered correctly among recent finds.
 */
function toFoundDate(value: string): Date {
  const today = dayjs().format(DATE_INPUT_FORMAT);
  return value === today ? new Date() : dayjs(value).toDate();
}

interface SelectOption {
  value: string;
  label: string;
}

interface LabeledSelectProps {
  label: string;
  options: SelectOption[];
  value: string | undefined;
  placeholder?: string;
  onValueChange: (value: string) => void;
}

function LabeledSelect({ label, options, value, placeholder, onValueChange }: LabeledSelectProps) {
  const id = useId();

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        items={options}
        value={value ?? null}
        onValueChange={(next) => next && onValueChange(next as string)}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function isVersionRecorded(
  progress: GrailProgress[],
  itemId: string,
  characterId: string | undefined,
  isEthereal: boolean,
): boolean {
  return progress.some(
    (p) =>
      p.itemId === itemId &&
      p.characterId === characterId &&
      p.isEthereal === isEthereal &&
      p.foundDate !== undefined,
  );
}

interface MarkAsFoundFormProps {
  item: Item;
  onDone: () => void;
}

function MarkAsFoundForm({ item, onDone }: MarkAsFoundFormProps) {
  const { t } = useTranslation();
  const characters = useGrailStore((state) => state.characters);
  const progress = useGrailStore((state) => state.progress);
  const settings = useGrailStore((state) => state.settings);
  const addManualProgress = useGrailStore((state) => state.addManualProgress);

  const dateFieldId = useId();
  const messageId = useId();

  const versions = useMemo(() => getRecordableVersions(item, settings), [item, settings]);
  const today = dayjs().format(DATE_INPUT_FORMAT);

  const [characterId, setCharacterId] = useState<string | undefined>(characters[0]?.id);
  const [version, setVersion] = useState<ItemVersion>(versions[0]);
  const [foundDate, setFoundDate] = useState(today);
  const [submitting, setSubmitting] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const selectedCharacter = characters.find((c) => c.id === characterId);
  const isEthereal = version === 'ethereal';
  const alreadyRecorded = isVersionRecorded(progress, item.id, selectedCharacter?.id, isEthereal);
  const dateIsValid = foundDate !== '' && foundDate <= today;
  const canSubmit = selectedCharacter !== undefined && !alreadyRecorded && dateIsValid;

  const characterOptions = useMemo(
    () => characters.map((character) => ({ value: character.id, label: character.name })),
    [characters],
  );
  const versionLabels: Record<ItemVersion, string> = {
    normal: t(translations.grail.itemCard.normal),
    ethereal: t(translations.grail.itemDetails.ethereal),
  };
  const versionOptions = versions.map((v) => ({ value: v, label: versionLabels[v] }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    setSaveFailed(false);
    try {
      await addManualProgress({
        itemId: item.id,
        characterId: selectedCharacter.id,
        isEthereal,
        foundDate: toFoundDate(foundDate),
      });
      onDone();
    } catch (error) {
      console.error('Failed to mark item as found:', error);
      setSaveFailed(true);
    } finally {
      setSubmitting(false);
    }
  };

  const messages = [
    characters.length === 0 && t(translations.grail.itemDetails.noCharactersAvailable),
    alreadyRecorded &&
      t(translations.grail.itemDetails.alreadyRecorded, { character: selectedCharacter?.name }),
    !dateIsValid && t(translations.grail.itemDetails.invalidFoundDate),
  ];
  const message = messages.find(Boolean) || undefined;

  return (
    <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
      {characters.length > 0 && (
        <>
          <LabeledSelect
            label={t(translations.grail.itemDetails.character)}
            options={characterOptions}
            value={characterId}
            placeholder={t(translations.grail.itemDetails.selectCharacter)}
            onValueChange={setCharacterId}
          />

          {versions.length > 1 && (
            <LabeledSelect
              label={t(translations.grail.itemDetails.version)}
              options={versionOptions}
              value={version}
              onValueChange={(value) => setVersion(value as ItemVersion)}
            />
          )}

          <div className="grid gap-2">
            <Label htmlFor={dateFieldId}>{t(translations.grail.itemDetails.foundDate)}</Label>
            <Input
              id={dateFieldId}
              type="date"
              value={foundDate}
              max={today}
              required
              aria-invalid={!dateIsValid || undefined}
              aria-describedby={dateIsValid ? undefined : messageId}
              onChange={(event) => setFoundDate(event.target.value)}
            />
          </div>
        </>
      )}

      {message && (
        <p id={messageId} className="text-muted-foreground text-sm" aria-live="polite">
          {message}
        </p>
      )}

      {saveFailed && (
        <p className="text-destructive text-sm" role="alert">
          {t(translations.grail.itemDetails.markAsFoundError)}
        </p>
      )}

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>
          {t(translations.common.cancel)}
        </DialogClose>
        <Button type="submit" disabled={!canSubmit || submitting}>
          {t(translations.grail.itemDetails.markAsFound)}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface MarkAsFoundDialogProps {
  item: Item;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Dialog that prompts the user for the information needed to manually record an item as found:
 * the character who found it, the version (normal/ethereal) when ambiguous, and the found date.
 */
export function MarkAsFoundDialog({ item, open, onOpenChange }: MarkAsFoundDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(translations.grail.itemDetails.markAsFound)}</DialogTitle>
          <DialogDescription>
            {t(translations.grail.itemDetails.markAsFoundDescription, { item: item.name })}
          </DialogDescription>
        </DialogHeader>
        {open && <MarkAsFoundForm item={item} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
