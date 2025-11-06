import type { TerrorZone } from 'electron/types/grail';
import { AlertTriangle, CheckCircle, RotateCcw, Search, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { TooltipProvider } from '@/components/ui/tooltip';

/**
 * TerrorZoneConfiguration component that serves as the main terror zone configuration page.
 * Allows users to enable/disable specific terror zones by modifying the game's desecratedzones.json file.
 * @returns {JSX.Element} The main terror zone configuration interface
 */
export function TerrorZoneConfiguration() {
  const [zones, setZones] = useState<TerrorZone[]>([]);
  const [config, setConfig] = useState<Record<number, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [validationStatus, setValidationStatus] = useState<{
    valid: boolean;
    path?: string;
    error?: string;
  }>({ valid: false });
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Validate path first
      const validation = await window.electronAPI.terrorZone.validatePath();
      setValidationStatus(validation);

      if (!validation.valid) {
        // Don't set error state for path validation issues - they're shown in the validation alert
        return;
      }

      // Load zones and config in parallel
      const [zonesData, configData] = await Promise.all([
        window.electronAPI.terrorZone.getZones(),
        window.electronAPI.terrorZone.getConfig(),
      ]);

      setZones(zonesData);
      setConfig(configData);
    } catch (err) {
      console.error('Failed to load terror zone data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load terror zone data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load zones and configuration on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleZoneToggle = useCallback(
    async (zoneId: number, enabled: boolean) => {
      try {
        setIsSaving(true);
        const newConfig = { ...config, [zoneId]: enabled };
        setConfig(newConfig);

        const result = await window.electronAPI.terrorZone.updateConfig(newConfig);
        if (!result.success) {
          throw new Error('Failed to update terror zone configuration');
        }
      } catch (err) {
        console.error('Failed to update zone:', err);
        setError(err instanceof Error ? err.message : 'Failed to update zone');
        // Revert the change
        setConfig(config);
      } finally {
        setIsSaving(false);
      }
    },
    [config],
  );

  const handleEnableAll = useCallback(async () => {
    try {
      setIsSaving(true);
      const newConfig: Record<number, boolean> = {};
      zones.forEach((zone) => {
        newConfig[zone.id] = true;
      });
      setConfig(newConfig);

      const result = await window.electronAPI.terrorZone.updateConfig(newConfig);
      if (!result.success) {
        throw new Error('Failed to enable all zones');
      }
    } catch (err) {
      console.error('Failed to enable all zones:', err);
      setError(err instanceof Error ? err.message : 'Failed to enable all zones');
      setConfig(config);
    } finally {
      setIsSaving(false);
    }
  }, [zones, config]);

  const handleDisableAll = useCallback(async () => {
    try {
      setIsSaving(true);
      const newConfig: Record<number, boolean> = {};
      zones.forEach((zone) => {
        newConfig[zone.id] = false;
      });
      setConfig(newConfig);

      const result = await window.electronAPI.terrorZone.updateConfig(newConfig);
      if (!result.success) {
        throw new Error('Failed to disable all zones');
      }
    } catch (err) {
      console.error('Failed to disable all zones:', err);
      setError(err instanceof Error ? err.message : 'Failed to disable all zones');
      setConfig(config);
    } finally {
      setIsSaving(false);
    }
  }, [zones, config]);

  const handleRestoreOriginal = useCallback(async () => {
    try {
      setIsSaving(true);
      const result = await window.electronAPI.terrorZone.restoreOriginal();
      if (!result.success) {
        throw new Error('Failed to restore original file');
      }

      // Reload data after restore
      await loadData();
      setShowRestoreDialog(false);
    } catch (err) {
      console.error('Failed to restore original:', err);
      setError(err instanceof Error ? err.message : 'Failed to restore original file');
    } finally {
      setIsSaving(false);
    }
  }, [loadData]);

  // Filter zones based on search term
  const filteredZones = zones.filter(
    (zone) =>
      zone.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      zone.id.toString().includes(searchTerm),
  );

  // Count enabled zones
  const enabledCount = Object.values(config).filter(Boolean).length;
  const totalCount = zones.length;

  if (isLoading) {
    return (
      <TooltipProvider>
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-6 p-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertTriangle className="h-5 w-5" />
                  Terror Zone Configuration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center py-8">
                  <div className="text-muted-foreground">Loading terror zones...</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-6 p-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className="h-5 w-5" />
                Terror Zone Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Warning Alert */}
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Warning:</strong> This feature modifies game files in your D2R
                  installation. Any issues related to these changes are your own responsibility.
                  Changes require a game restart to take effect.
                </AlertDescription>
              </Alert>

              {/* Validation Status */}
              {validationStatus.valid ? (
                <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800 dark:text-green-200">
                    D2R installation path is valid. Game file found at: {validationStatus.path}
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800 dark:text-red-200">
                    {validationStatus.error || 'D2R installation path is not configured'}
                  </AlertDescription>
                </Alert>
              )}

              {/* Error Display */}
              {error && (
                <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800 dark:text-red-200">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              {/* Search and Controls */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search terror zones..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-muted-foreground text-sm">
                    {enabledCount} of {totalCount} zones enabled
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleEnableAll}
                      disabled={isSaving || !validationStatus.valid}
                    >
                      Enable All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDisableAll}
                      disabled={isSaving || !validationStatus.valid}
                    >
                      Disable All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowRestoreDialog(true)}
                      disabled={isSaving || !validationStatus.valid}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Restore Original
                    </Button>
                  </div>
                </div>
              </div>

              {/* Zone List */}
              <div className="space-y-2">
                {filteredZones.map((zone) => (
                  <Card key={zone.id} className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`zone-${zone.id}`} className="font-medium">
                              {zone.name}
                            </Label>
                            <span className="text-muted-foreground text-xs">(ID: {zone.id})</span>
                          </div>
                          <div className="mt-1 text-muted-foreground text-xs">
                            {zone.levels.length} level{zone.levels.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                        <Switch
                          id={`zone-${zone.id}`}
                          checked={config[zone.id] ?? true}
                          onCheckedChange={(checked) => handleZoneToggle(zone.id, checked)}
                          disabled={isSaving || !validationStatus.valid}
                        />
                      </div>

                      {/* Collapsible Level Details */}
                      {zone.levels.length > 0 && (
                        <Collapsible>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="mt-2 h-6 px-2 text-xs">
                              Show Levels
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-2">
                            <div className="space-y-1 text-muted-foreground text-xs">
                              {zone.levels.map((level) => (
                                <div key={level.level_id} className="flex items-center gap-2">
                                  <span>Level {level.level_id}</span>
                                  {level.waypoint_level_id && (
                                    <span className="text-blue-600">
                                      (WP: {level.waypoint_level_id})
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {filteredZones.length === 0 && searchTerm && (
                <div className="py-8 text-center text-muted-foreground">
                  No zones found matching "{searchTerm}"
                </div>
              )}

              {/* Info Text */}
              <div className="border-t pt-2 text-muted-foreground text-xs">
                Changes to terror zone configuration require restarting Diablo II: Resurrected to
                take effect. The original file is automatically backed up and can be restored at any
                time.
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Restore Confirmation Dialog */}
        <AlertDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Restore Original File</AlertDialogTitle>
              <AlertDialogDescription>
                This will restore the original desecratedzones.json file from backup and clear your
                current configuration. This action cannot be undone. Are you sure you want to
                continue?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRestoreOriginal}
                disabled={isSaving}
                className="bg-red-600 hover:bg-red-700"
              >
                {isSaving ? 'Restoring...' : 'Restore Original'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
