import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DailyPlanner } from '../components/DailyPlanner';

vi.mock('../components/Toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../services/geminiService', () => ({
  generateDailySchedule: () => Promise.resolve([]),
  generateMeetingPrep: () => Promise.resolve(''),
}));

describe('DailyPlanner', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('adds an event through the modal', async () => {
    render(<DailyPlanner />);

    const addButtons = screen.getAllByLabelText(/add event at/i);
    await userEvent.click(addButtons[0]);

    const titleInput = await screen.findByLabelText(/event title/i);
    await userEvent.type(titleInput, 'Kickoff Call');

    const durationInput = screen.getByLabelText(/duration/i);
    await userEvent.clear(durationInput);
    await userEvent.type(durationInput, '45');

    const submit = screen.getByRole('button', { name: /^Add Event$/i });
    await userEvent.click(submit);

    await waitFor(() => {
      expect(screen.getAllByText('Kickoff Call').length).toBeGreaterThan(0);
    });
  });
});
