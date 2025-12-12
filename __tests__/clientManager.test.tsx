import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClientManager } from '../components/ClientManager';

vi.mock('../components/Toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../components/ClientDetailView', () => ({
  ClientDetailView: ({ client }: any) => <div data-testid="client-detail">{client.name}</div>,
}));

vi.mock('../services/geminiService', () => ({
  streamMorningMemo: () => [],
  fetchDailyMarketPulse: () => Promise.resolve({ indices: [] }),
  scanPipelineOpportunities: () => Promise.resolve([]),
  generateAudioBriefing: () => Promise.resolve(''),
}));

const setup = () => render(<ClientManager />);

describe('ClientManager', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates a client via modal and selects it', async () => {
    setup();

    const addButton = screen.getByLabelText(/add client/i);
    await userEvent.click(addButton);

    const nameInput = await screen.findByLabelText(/client name/i);
    await userEvent.type(nameInput, 'Test Client');

    const loanInput = screen.getByLabelText(/loan amount/i);
    await userEvent.clear(loanInput);
    await userEvent.type(loanInput, '500000');

    const submit = screen.getByRole('button', { name: /create/i });
    await userEvent.click(submit);

    await waitFor(() => {
      expect(screen.getByText('Test Client')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByTestId('client-detail')).toHaveTextContent('Test Client');
    });
  });
});
