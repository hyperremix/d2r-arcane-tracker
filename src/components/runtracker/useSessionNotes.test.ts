import { act, renderHook } from '@testing-library/react';
import type { Session } from 'electron/types/grail';
import { describe, expect, it, vi } from 'vitest';
import { useSessionNotes } from './useSessionNotes';

const session: Session = {
  id: 'session-1',
  startTime: new Date('2024-01-01T10:00:00Z'),
  totalRunTime: 0,
  totalSessionTime: 0,
  runCount: 0,
  archived: false,
  notes: 'Saved notes',
  created: new Date('2024-01-01T10:00:00Z'),
  lastUpdated: new Date('2024-01-01T10:00:00Z'),
};

const changeEvent = (value: string) =>
  ({ target: { value } }) as React.ChangeEvent<HTMLTextAreaElement>;

describe('useSessionNotes', () => {
  it('When the edited notes are unchanged on blur, Then nothing is saved', async () => {
    // Arrange
    const updateSessionNotes = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() => useSessionNotes(session, updateSessionNotes));

    // Act
    await act(async () => {
      await result.current.handleNotesBlur();
    });

    // Assert
    expect(updateSessionNotes).not.toHaveBeenCalled();
  });

  it('When saving is in flight, Then isSavingNotes is true until the save settles', async () => {
    // Arrange
    let finishSave: (saved: boolean) => void = () => undefined;
    const updateSessionNotes = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finishSave = resolve;
        }),
    );
    const { result } = renderHook(() => useSessionNotes(session, updateSessionNotes));
    act(() => {
      result.current.handleNotesChange(changeEvent('New notes'));
    });

    // Act
    let blur: Promise<void> = Promise.resolve();
    act(() => {
      blur = result.current.handleNotesBlur();
    });

    // Assert
    expect(result.current.isSavingNotes).toBe(true);
    await act(async () => {
      finishSave(true);
      await blur;
    });
    expect(result.current.isSavingNotes).toBe(false);
    expect(result.current.notes).toBe('New notes');
  });

  it('If saving fails, Then the saved notes are shown again', async () => {
    // Arrange
    const updateSessionNotes = vi.fn().mockResolvedValue(false);
    const { result } = renderHook(() => useSessionNotes(session, updateSessionNotes));
    act(() => {
      result.current.handleNotesChange(changeEvent('New notes'));
    });

    // Act
    await act(async () => {
      await result.current.handleNotesBlur();
    });

    // Assert
    expect(updateSessionNotes).toHaveBeenCalledWith('session-1', 'New notes');
    expect(result.current.notes).toBe('Saved notes');
    expect(result.current.isSavingNotes).toBe(false);
  });
});
