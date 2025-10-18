import { MessageCircle } from 'lucide-react';
import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * ReportIssues component that provides a link to report bugs on GitHub.
 * Displays information about reporting issues and a button to open the GitHub issues page.
 * @returns {JSX.Element} A settings card with bug reporting information and action button
 */
export function ReportIssues() {
  const handleOpenIssues = useCallback(async () => {
    await window.electronAPI?.shell.openExternal(
      'https://github.com/hyperremix/d2r-arcane-tracker/issues',
    );
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageCircle className="h-5 w-5" />
          Report Issues
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <p className="text-gray-600 text-sm dark:text-gray-400">
            If you encounter any bugs or issues while using D2R Arcane Tracker, please report them
            on our GitHub repository. Your feedback helps us improve the application for everyone.
          </p>
          <Button onClick={handleOpenIssues} size="sm" className="gap-2">
            Open GitHub Issues
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
