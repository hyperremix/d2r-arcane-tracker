import type { Session } from 'electron/types/grail';
import { useCallback, useEffect, useState } from 'react';

/**
 * Editing state of the notes of a session. The notes are saved when the editor loses focus; if
 * saving fails, the store reports the failure inline (without a retry, because a retry could
 * overwrite the notes of another session) and the saved notes are shown again.
 * @param session - The session whose notes are edited, if there is one
 * @param updateSessionNotes - The store action that saves notes; resolves to whether they were saved
 * @returns The current text, whether a save is in flight, and the editor change and blur handlers
 */
export function useSessionNotes(
  session: Session | null | undefined,
  updateSessionNotes: (sessionId: string, notes: string) => Promise<boolean>,
) {
  const [notes, setNotes] = useState<string>(session?.notes || '');
  const [isSavingNotes, setIsSavingNotes] = useState<boolean>(false);

  // Update notes when the saved notes change
  useEffect(() => {
    if (session?.notes !== undefined) {
      setNotes(session.notes || '');
    }
  }, [session?.notes]);

  const handleNotesChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(e.target.value);
  }, []);

  const handleNotesBlur = useCallback(async () => {
    if (!session || notes === (session.notes || '')) return;

    setIsSavingNotes(true);
    const saved = await updateSessionNotes(session.id, notes);
    setIsSavingNotes(false);
    if (!saved) {
      setNotes(session.notes || '');
    }
  }, [session, notes, updateSessionNotes]);

  return { notes, isSavingNotes, handleNotesChange, handleNotesBlur };
}
