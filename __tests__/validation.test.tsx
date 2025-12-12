import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateClientModal } from '../features/clients/components/CreateClientModal';

const onClose = vi.fn();
const onCreate = vi.fn();

describe('Form validation', () => {
  it('shows errors for invalid numeric input', async () => {
    render(
      <CreateClientModal
        isOpen
        onClose={onClose}
        onCreate={onCreate as any}
        defaultStatus="Lead"
      />
    );

    await userEvent.type(screen.getByLabelText(/client name/i), 'Validation Client');
    const loanInput = screen.getByLabelText(/loan amount/i);
    await userEvent.clear(loanInput);

    const submit = screen.getByRole('button', { name: /^Create$/i });
    await userEvent.click(submit);

    const message = await screen.findByText((text) => text.toLowerCase().includes('loan') && text.toLowerCase().includes('number'));
    expect(message).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });
});
