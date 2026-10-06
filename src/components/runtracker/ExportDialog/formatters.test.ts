import type { Run, Session } from 'electron/types/grail';
import { describe, expect, it } from 'vitest';
import { formatSessionAsCSV } from './formatters';

const date = new Date('2024-01-01T00:00:00Z');

const baseSession: Session = {
  id: 'session-1',
  startTime: date,
  totalRunTime: 1000,
  totalSessionTime: 2000,
  runCount: 1,
  archived: false,
  created: date,
  lastUpdated: date,
};

const baseRun: Run = {
  id: 'run-1',
  sessionId: 'session-1',
  runNumber: 1,
  startTime: date,
  created: date,
  lastUpdated: date,
};

describe('When formatting a session as CSV', () => {
  it('If the notes contain a carriage return, a comma and a quote, Then the cell is quoted and quotes are doubled', () => {
    // Arrange
    const session: Session = { ...baseSession, notes: 'line one\r\nsaid "hi", left' };

    // Act
    const csv = formatSessionAsCSV(session, [baseRun]);

    // Assert
    expect(csv).toContain('Notes,"line one\r\nsaid ""hi"", left"');
  });

  it('If the notes are plain text, Then the cell is not quoted', () => {
    // Arrange
    const session: Session = { ...baseSession, notes: 'plain notes' };

    // Act
    const csv = formatSessionAsCSV(session, [baseRun]);

    // Assert
    expect(csv).toContain('\nNotes,plain notes\n');
  });
});
