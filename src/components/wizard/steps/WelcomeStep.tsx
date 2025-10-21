/**
 * WelcomeStep component - First step of the setup wizard.
 * Provides a welcome message and overview of what the wizard will configure.
 * @returns {JSX.Element} Welcome step content
 */
export function WelcomeStep() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <img src="/logo.png" alt="D2R Arcane Tracker" className="h-20 w-20" />
        <h2 className="font-bold text-2xl">Welcome to D2R Arcane Tracker!</h2>
        <p className="max-w-lg text-muted-foreground">
          Track your Diablo II: Resurrected Holy Grail progress with automatic save file monitoring
          and real-time item detection.
        </p>
      </div>

      <div className="space-y-4 rounded-lg border bg-muted/30 p-6">
        <h3 className="font-semibold text-lg">This wizard will help you configure:</h3>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>Save file directory for automatic character monitoring</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>Game mode and version preferences</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>Holy Grail tracking options (normal, ethereal, runes, runewords)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>Appearance theme and display preferences</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>Notification settings and widget overlay</span>
          </li>
        </ul>
      </div>

      <div className="text-center text-muted-foreground text-sm">
        You can skip this wizard and configure settings later, or click Next to get started.
      </div>
    </div>
  );
}
