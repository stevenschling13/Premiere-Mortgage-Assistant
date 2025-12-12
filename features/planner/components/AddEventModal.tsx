import React, { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarEvent, Client } from '../../../types';

const eventSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  startTime: z.string().min(1, 'Start time is required'),
  durationMinutes: z
    .number({ invalid_type_error: 'Duration must be a number' })
    .int('Duration must be whole minutes')
    .positive('Duration must be at least 1 minute')
    .max(480, 'Duration too long'),
  type: z.enum(['MEETING', 'CALL', 'TASK', 'BLOCK']),
  clientId: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});

export type AddEventFormValues = z.infer<typeof eventSchema>;

interface AddEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (event: CalendarEvent) => void;
  date: string;
  defaultHour: number;
  clients: Client[];
}

export const AddEventModal: React.FC<AddEventModalProps> = ({ isOpen, onClose, onCreate, date, defaultHour, clients }) => {
  const defaultTime = useMemo(
    () => `${String(defaultHour).padStart(2, '0')}:00`,
    [defaultHour]
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<AddEventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: '',
      startTime: defaultTime,
      durationMinutes: 30,
      type: 'MEETING',
      clientId: '',
      notes: '',
    },
  });

  useEffect(() => {
    setValue('startTime', defaultTime);
  }, [defaultTime, setValue]);

  const onSubmit = (values: AddEventFormValues) => {
    const [hour, minute] = values.startTime.split(':').map(Number);
    const startDate = new Date(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`);
    const endDate = new Date(startDate);
    endDate.setMinutes(endDate.getMinutes() + values.durationMinutes);

    const newEvent: CalendarEvent = {
      id: `evt-${Date.now()}`,
      title: values.title.trim(),
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      type: values.type,
      clientId: values.clientId || undefined,
      notes: values.notes?.trim() || undefined,
      isAiGenerated: false,
    };

    onCreate(newEvent);
    reset({ ...values, title: '', notes: '', startTime: defaultTime });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase">Add Event</p>
            <h3 className="text-lg font-bold text-brand-dark">Schedule for {new Date(`${date}T00:00:00`).toLocaleDateString()}</h3>
          </div>
          <button
            aria-label="Close add event form"
            onClick={onClose}
            className="p-2 rounded-md text-gray-500 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-red"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700">Title *</label>
            <input
              {...register('title')}
              aria-label="Event title"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-red"
            />
            {errors.title && <p className="text-sm text-red-600 mt-1">{errors.title.message}</p>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700">Start time *</label>
              <input
                type="time"
                step={300}
                defaultValue={defaultTime}
                {...register('startTime')}
                aria-label="Start time"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-red"
              />
              {errors.startTime && <p className="text-sm text-red-600 mt-1">{errors.startTime.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700">Duration (minutes) *</label>
              <input
                type="number"
                min={5}
                max={480}
                {...register('durationMinutes', { valueAsNumber: true })}
                aria-label="Duration in minutes"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-red"
              />
              {errors.durationMinutes && <p className="text-sm text-red-600 mt-1">{errors.durationMinutes.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700">Type</label>
              <select
                {...register('type')}
                aria-label="Event type"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-red"
              >
                <option value="MEETING">Meeting</option>
                <option value="CALL">Call</option>
                <option value="TASK">Task</option>
                <option value="BLOCK">Focus Block</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700">Client</label>
              <select
                {...register('clientId')}
                aria-label="Linked client"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-red"
              >
                <option value="">No client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700">Notes</label>
              <textarea
                {...register('notes')}
                rows={3}
                aria-label="Event notes"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-red"
              />
              {errors.notes && <p className="text-sm text-red-600 mt-1">{errors.notes.message}</p>}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-brand-red text-white font-semibold hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-red"
            >
              Add Event
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
