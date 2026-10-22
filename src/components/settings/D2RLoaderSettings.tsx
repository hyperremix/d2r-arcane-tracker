import {
  type D2RLoaderInstallation,
  type D2RLoaderInstallResult,
  type D2RLoaderStatus,
  DEFAULT_D2RLOADER_PORT,
  MAX_D2RLOADER_PORT,
  MIN_D2RLOADER_PORT,
} from 'electron/types/d2rLoader';
import { AlertCircle, History, Plug, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { translations } from '@/i18n/translations';
import { onMainEvent } from '@/lib/ipcEvents';
import { useGrailStore } from '@/stores/grailStore';

const messages = translations.settings.d2rLoader;

/** Parses the port field; undefined unless it's a whole number in the allowed range. */
function parsePort(value: string): number | undefined {
  const port = Number(value.trim());
  return Number.isInteger(port) && port >= MIN_D2RLOADER_PORT && port <= MAX_D2RLOADER_PORT
    ? port
    : undefined;
}

/**
 * Returns the translation key and values of the connection state line.
 * @param status - The connection state
 */
function getStatusMessage(status: D2RLoaderStatus): {
  key: string;
  values?: Record<string, unknown>;
  error: boolean;
} {
  if (status.error === 'portInUse') {
    return { key: messages.statusPortInUse, values: { port: status.port }, error: true };
  }
  if (status.error === 'listenFailed') {
    return { key: messages.statusListenFailed, error: true };
  }
  if (status.connected) {
    return status.pluginVersion
      ? { key: messages.statusConnected, values: { version: status.pluginVersion }, error: false }
      : { key: messages.statusConnectedNoVersion, error: false };
  }
  return { key: messages.statusWaiting, error: false };
}

/**
 * Settings of the optional D2RLoader plugin: the connection with the plugin, installing it into
 * the D2R folder and importing Run Counter's history. See docs/D2RLOADER.md.
 * @returns A settings card
 */
export function D2RLoaderSettings() {
  const { t } = useTranslation();
  const { settings, setSettings } = useGrailStore(
    useShallow((state) => ({ settings: state.settings, setSettings: state.setSettings })),
  );
  const connectLabelId = useId();
  const connectDescriptionId = useId();
  const portInputId = useId();
  const portDescriptionId = useId();
  const portErrorId = useId();

  const enabled = settings.d2rLoaderBridge ?? false;
  const savedPort = settings.d2rLoaderPort ?? DEFAULT_D2RLOADER_PORT;
  const [portText, setPortText] = useState(String(savedPort));
  const [status, setStatus] = useState<D2RLoaderStatus>();
  const [installation, setInstallation] = useState<D2RLoaderInstallation>();
  const [busy, setBusy] = useState(false);

  const portInvalid = parsePort(portText) === undefined;

  const loadInstallation = useCallback(async () => {
    try {
      setInstallation(await window.electronAPI?.d2rLoader.getInstallation());
    } catch (error) {
      console.error('Failed to read the D2RLoader installation:', error);
    }
  }, []);

  useEffect(() => {
    void window.electronAPI?.d2rLoader.getStatus().then(setStatus);
    void loadInstallation();
    return onMainEvent('d2rLoader:status', setStatus);
  }, [loadInstallation]);

  useEffect(() => {
    setPortText(String(savedPort));
  }, [savedPort]);

  const toggleConnection = useCallback(
    async (checked: boolean) => {
      await setSettings({ d2rLoaderBridge: checked });
      // Turning the connection on creates the token the plugin's config needs
      await loadInstallation();
    },
    [setSettings, loadInstallation],
  );

  const commitPort = useCallback(async () => {
    const port = parsePort(portText);
    if (port === undefined || port === savedPort) {
      return;
    }
    await setSettings({ d2rLoaderPort: port });
    await loadInstallation();
  }, [portText, savedPort, setSettings, loadInstallation]);

  const runPluginAction = useCallback(
    async (action: () => Promise<D2RLoaderInstallResult>, successKey: string) => {
      setBusy(true);
      try {
        const result = await action();
        setInstallation(result.installation);
        if (result.canceled) {
          toast.error(t(messages.canceled));
        } else {
          toast.success(t(successKey));
        }
      } catch (error) {
        console.error('Failed to change the D2RLoader plugin:', error);
        toast.error(t(messages.actionFailed), {
          description: error instanceof Error ? error.message : undefined,
        });
      } finally {
        setBusy(false);
      }
    },
    [t],
  );

  const importRunCounter = useCallback(async () => {
    setBusy(true);
    try {
      const result = await window.electronAPI.d2rLoader.importRunCounter();
      if (!result.found) {
        toast.error(t(messages.runCounterNotFound, { folder: result.folder }));
      } else if (result.runs === 0) {
        toast.success(t(messages.runCounterNothingNew));
      } else {
        toast.success(t(messages.runCounterImported, { count: result.runs }), {
          description: t(messages.runCounterImportedItems, { count: result.items }),
        });
      }
    } catch (error) {
      console.error('Failed to import the Run Counter history:', error);
      toast.error(t(messages.runCounterFailed), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }, [t]);

  const statusMessage = status && enabled ? getStatusMessage(status) : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Plug className="h-5 w-5" aria-hidden="true" />
          {t(messages.title)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">{t(messages.description)}</p>

        <div className="flex items-center justify-between gap-4 rounded-md border p-3">
          <div className="space-y-1">
            <h4 id={connectLabelId} className="font-medium text-sm">
              {t(messages.connect)}
            </h4>
            <p id={connectDescriptionId} className="text-muted-foreground text-xs">
              {t(messages.connectDescription)}
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={toggleConnection}
            aria-labelledby={connectLabelId}
            aria-describedby={connectDescriptionId}
          />
        </div>

        {statusMessage && (
          <Alert variant={statusMessage.error ? 'destructive' : 'default'} live="polite">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription className="text-xs">
              {t(statusMessage.key, statusMessage.values)}
            </AlertDescription>
          </Alert>
        )}

        {enabled && (
          <div className="space-y-2">
            <Label htmlFor={portInputId}>{t(messages.port)}</Label>
            <Input
              id={portInputId}
              inputMode="numeric"
              className="w-32"
              value={portText}
              onChange={(event) => setPortText(event.target.value)}
              onBlur={() => void commitPort()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void commitPort();
              }}
              aria-invalid={portInvalid}
              aria-describedby={portInvalid ? portErrorId : portDescriptionId}
            />
            {portInvalid ? (
              <p id={portErrorId} className="text-destructive text-xs">
                {t(messages.portInvalid, { min: MIN_D2RLOADER_PORT, max: MAX_D2RLOADER_PORT })}
              </p>
            ) : (
              <p id={portDescriptionId} className="text-muted-foreground text-xs">
                {t(messages.portDescription, { defaultPort: DEFAULT_D2RLOADER_PORT })}
              </p>
            )}
          </div>
        )}

        {enabled && installation && (
          <PluginInstallationSection
            installation={installation}
            busy={busy}
            onCheckAgain={() => void loadInstallation()}
            onInstall={(successKey) =>
              void runPluginAction(() => window.electronAPI.d2rLoader.installPlugin(), successKey)
            }
            onUninstall={() =>
              void runPluginAction(
                () => window.electronAPI.d2rLoader.uninstallPlugin(),
                messages.removed,
              )
            }
          />
        )}

        {installation?.gameFolder && (
          <div className="space-y-2">
            <h4 className="flex items-center gap-2 font-medium text-sm">
              <History className="h-4 w-4" aria-hidden="true" />
              {t(messages.runCounterHeading)}
            </h4>
            <p className="text-muted-foreground text-xs">{t(messages.runCounterDescription)}</p>
            <Button variant="outline" size="sm" disabled={busy} onClick={importRunCounter}>
              {t(messages.runCounterImport)}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Props of {@link PluginInstallationSection}. */
interface PluginInstallationSectionProps {
  installation: D2RLoaderInstallation;
  busy: boolean;
  onCheckAgain: () => void;
  /** Installs, updates or connects the plugin; `successKey` is the message shown afterwards. */
  onInstall: (successKey: string) => void;
  onUninstall: () => void;
}

/**
 * Whether the plugin is installed in the D2R folder, with the action that installs, updates or
 * connects it, and the action that removes it.
 */
function PluginInstallationSection({
  installation,
  busy,
  onCheckAgain,
  onInstall,
  onUninstall,
}: PluginInstallationSectionProps) {
  const { t } = useTranslation();

  let stateKey: string;
  let actionKey: string | undefined;
  let successKey = messages.installed;
  if (!installation.gameFolder) {
    stateKey = messages.noGameFolder;
  } else if (!installation.loaderFound) {
    stateKey = messages.loaderMissing;
  } else if (!installation.pluginInstalled) {
    stateKey = installation.pluginBundled ? messages.notInstalled : messages.notBundled;
    actionKey = installation.pluginBundled ? messages.install : undefined;
  } else if (installation.pluginBundled && !installation.pluginUpToDate) {
    stateKey = messages.updateAvailable;
    actionKey = messages.update;
  } else if (!installation.configured) {
    stateKey = messages.notConfigured;
    actionKey = messages.connectPlugin;
    successKey = messages.connected;
  } else {
    stateKey = messages.upToDate;
  }

  return (
    <div className="space-y-2">
      <h4 className="font-medium text-sm">{t(messages.pluginHeading)}</h4>
      <p className="text-muted-foreground text-xs">{t(stateKey)}</p>
      <div className="flex flex-wrap gap-2">
        {actionKey && (
          <Button size="sm" disabled={busy} onClick={() => onInstall(successKey)}>
            {t(actionKey)}
          </Button>
        )}
        {installation.pluginInstalled && (
          <Button variant="outline" size="sm" disabled={busy} onClick={onUninstall}>
            {t(messages.uninstall)}
          </Button>
        )}
        <Button variant="ghost" size="sm" disabled={busy} onClick={onCheckAgain}>
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          {t(messages.checkAgain)}
        </Button>
      </div>
    </div>
  );
}
