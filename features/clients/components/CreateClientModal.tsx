import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Client } from '../../../types';

const clientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z
    .string()
    .email('Enter a valid email')
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .regex(/^[0-9+()\-\s]*$/, 'Phone can contain digits and +-( )')
    .max(20, 'Phone number is too long')
    .optional()
    .or(z.literal('')),
  loanAmount: z
    .number({ invalid_type_error: 'Loan amount must be a number' })
    .nonnegative('Loan amount cannot be negative')
    .max(10000000, 'Loan amount seems too high'),
  propertyAddress: z.string().optional().or(z.literal('')),
});

export type CreateClientFormValues = z.infer<typeof clientSchema>;

interface CreateClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (client: Client) => void;
  defaultStatus: string;
}

export const CreateClientModal: React.FC<CreateClientModalProps> = ({ isOpen, onClose, onCreate, defaultStatus }) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      loanAmount: 0,
      propertyAddress: '',
    },
  });

  const submit = (values: CreateClientFormValues) => {
    const newClient: Client = {
      id: Date.now().toString(),
      name: values.name.trim(),
      email: values.email?.trim() || '',
      phone: values.phone?.trim() || '',
      loanAmount: values.loanAmount,
      propertyAddress: values.propertyAddress?.trim() || '',
      status: defaultStatus,
      nextActionDate: new Date().toISOString().split('T')[0],
      notes: '',
      checklist: [],
      emailHistory: [],
    };
    onCreate(newClient);
    reset();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase">Create Client</p>
            <h3 className="text-lg font-bold text-brand-dark">Add a new relationship</h3>
          </div>
          <button
            aria-label="Close client form"
            onClick={onClose}
            className="p-2 rounded-md text-gray-500 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-red"
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit(submit)} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700">Name *</label>
            <input
              {...register('name')}
              aria-label="Client name"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-red"
            />
            {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700">Email</label>
              <input
                {...register('email')}
                aria-label="Client email"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-red"
              />
              {errors.email && <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700">Phone</label>
              <input
                {...register('phone')}
                aria-label="Client phone"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-red"
              />
              {errors.phone && <p className="text-sm text-red-600 mt-1">{errors.phone.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700">Loan Amount</label>
              <input
                type="number"
                step="1000"
                {...register('loanAmount', { valueAsNumber: true })}
                aria-label="Loan amount"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-red"
              />
              {errors.loanAmount && <p className="text-sm text-red-600 mt-1">{errors.loanAmount.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700">Property Address</label>
              <input
                {...register('propertyAddress')}
                aria-label="Property address"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-red"
              />
              {errors.propertyAddress && <p className="text-sm text-red-600 mt-1">{errors.propertyAddress.message}</p>}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-brand-red text-white font-semibold hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-red"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
