import { CheckCircle2, Sparkles } from 'lucide-react';
import { useGrailStore } from '@/stores/grailStore';

/**
 * CompletionStep component - Final step of the setup wizard.
 * Displays a summary of configured settings and completion message.
 * @returns {JSX.Element} Completion step content
 */
export function CompletionStep() {
  const { settings } = useGrailStore();

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="rounded-full bg-gradient-to-br from-green-500 to-emerald-500 p-4">
          <CheckCircle2 className="h-12 w-12 text-white" />
        </div>
        <h2 className="font-bold text-2xl">You're All Set!</h2>
        <p className="max-w-lg text-muted-foreground">
          Your D2R Arcane Tracker is now configured and ready to track your Holy Grail progress.
        </p>
      </div>

      <div className="space-y-4 rounded-lg border bg-muted/30 p-6">
        <h3 className="flex items-center gap-2 font-semibold text-lg">
          <Sparkles className="h-5 w-5" />
          Configuration Summary
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Save Directory:</span>
            <span className="font-medium">{settings.saveDir ? 'Configured' : 'Not set'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Game Mode:</span>
            <span className="font-medium">{settings.gameMode || 'Both'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Game Version:</span>
            <span className="font-medium">{settings.gameVersion || 'Resurrected'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Normal Items:</span>
            <span className="font-medium">
              {(settings.grailNormal ?? true) ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Ethereal Items:</span>
            <span className="font-medium">{settings.grailEthereal ? 'Enabled' : 'Disabled'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Runes:</span>
            <span className="font-medium">{settings.grailRunes ? 'Enabled' : 'Disabled'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Runewords:</span>
            <span className="font-medium">{settings.grailRunewords ? 'Enabled' : 'Disabled'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Theme:</span>
            <span className="font-medium capitalize">{settings.theme || 'system'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Notifications:</span>
            <span className="font-medium">
              {(settings.enableSounds ?? true) ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Widget:</span>
            <span className="font-medium">{settings.widgetEnabled ? 'Enabled' : 'Disabled'}</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border-2 border-primary/50 border-dashed bg-primary/5 p-6">
        <h3 className="font-semibold text-lg">Next Steps</h3>
        <ul className="mt-3 space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <span className="text-primary">1.</span>
            <span>Start playing Diablo II: Resurrected</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">2.</span>
            <span>The tracker will automatically monitor your save files</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">3.</span>
            <span>View your progress in the main tracker interface</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">4.</span>
            <span>Check statistics to see your completion percentage</span>
          </li>
        </ul>
      </div>

      <div className="text-center text-muted-foreground text-sm">
        Click Finish to save your settings and start using D2R Arcane Tracker!
      </div>
    </div>
  );
}
