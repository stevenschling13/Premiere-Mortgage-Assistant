import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Clock, Calendar as CalendarIcon, AlignLeft, User, Save, Loader2 } from 'lucide-react';
import { CalendarEvent, Client } from '../../types';

const eventSchema = z.object({
  title: z.string().min(1, "Event title is required"),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
  type: z.enum(['MEETING', 'CALL', 'TASK', 'BLOCK']),
  clientId: z.string().optional(),
  notes: z.string().optional(),
});

type EventFormValues = z.infer<typeof eventSchema>;

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: Partial<CalendarEvent>) => void;
  initialHour: number | null;
  dateStr: string;
  clients: Client[];
}

export const EventModal: React.FC<EventModalProps> = ({ isOpen, onClose, onSave, initialHour, dateStr, clients }) => {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: '',
      startTime: initialHour !== null ? `${initialHour.toString().padStart(2, '0')}:00` : '09:00',
      endTime: initialHour !== null ? `${initialHour.toString().padStart(2, '0')}:30` : '09:30',
      type: 'MEETING',
      notes: ''
    }
  });

  // Reset form when modal opens with new hour
  useEffect(() => {
    if (isOpen && initialHour !== null) {
      reset({
        title: '',
        startTime: `${initialHour.toString().padStart(2, '0')}:00`,
        endTime: `${initialHour.toString().padStart(2, '0')}:30`,
        type: 'MEETING',
        notes: ''
      });
    }
  }, [isOpen, initialHour, reset]);

  const onSubmit = (data: EventFormValues) => {
    const start = `${dateStr}T${data.startTime}:00`;
    const end = `${dateStr}T${data.endTime}:00`;

    onSave({
      title: data.title,
      start,
      end,
      type: data.type,
      clientId: data.clientId === 'none' ? undefined : data.clientId,
      notes: data.notes
    });
    
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-800 flex items-center">
            <Clock size={16} className="mr-2 text-brand-dark"/> New Event
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Event Title</label>
            <input 
              {...register('title')}
              placeholder="Client Call, Deep Work, etc." 
              className={`w-full p-3 bg-gray-50 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-gold ${errors.title ? 'border-red-300' : 'border-gray-200'}`}
              autoFocus
            />
            {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Start Time</label>
              <input 
                type="time" 
                {...register('startTime')}
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">End Time</label>
              <input 
                type="time" 
                {...register('endTime')}
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Type</label>
                <select {...register('type')} className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                    <option value="MEETING">Meeting</option>
                    <option value="CALL">Call</option>
                    <option value="BLOCK">Block</option>
                    <option value="TASK">Task</option>
                </select>
             </div>
             <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Link Client</label>
                <select {...register('clientId')} className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                    <option value="none">None</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
             </div>
          </div>

          <div>
             <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Notes</label>
             <textarea 
                {...register('notes')}
                rows={2}
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm resize-none"
                placeholder="Details..."
             />
          </div>

          <div className="pt-2 border-t border-gray-100 flex justify-end">
            <button 
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-brand-dark text-white text-sm font-bold rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin mr-2"/> : <Save size={16} className="mr-2"/>}
              Add to Calendar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};