import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { translations } from '@/i18n/translations';
import { shortcutFromEvent } from '@/lib/hotkeys';
import { cn } from '@/lib/utils';

interface ShortcutRecorderProps {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  description?: string;
  onChange: (shortcut: string) => void;
}

export function ShortcutRecorder({
  id,
  label,
  value,
  placeholder,
  description,
  onChange,
}: ShortcutRecorderProps) {
  const { t } = useTranslation();
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState('');

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    setError('');
  }, []);

  useEffect(() => {
    if (!isRecording) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === 'Escape') {
        stopRecording();
        return;
      }

      const nextShortcut = shortcutFromEvent(event);
      if (!nextShortcut) {
        setError(t(translations.settings.shortcutRecorder.includeNonModifier));
        return;
      }

      setError('');
      onChange(nextShortcut);
      stopRecording();
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [isRecording, onChange, stopRecording, t]);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-muted-foreground text-xs">
        {label}
      </Label>
      <div className="flex gap-2">
        <Input
          id={id}
          readOnly
          value={value || ''}
          placeholder={placeholder}
          className={cn('h-8 text-xs', isRecording && 'border-primary ring-2 ring-primary/30')}
        />
        <Button
          type="button"
          variant={isRecording ? 'default' : 'outline'}
          size="sm"
          onClick={() => setIsRecording((prev) => !prev)}
        >
          {isRecording ? t(translations.settings.shortcutRecorder.recording) : 'Edit'}
        </Button>
      </div>
      {isRecording ? (
        <p className="text-[11px] text-primary">
          {t(translations.settings.shortcutRecorder.pressKeyCombination)}
        </p>
      ) : description ? (
        <p className="text-[11px] text-muted-foreground">{description}</p>
      ) : null}
      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
    </div>
  );
}
