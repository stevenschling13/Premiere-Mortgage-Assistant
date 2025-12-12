import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, User, Mail, Phone, DollarSign, Save, Loader2 } from 'lucide-react';
import { Client } from '../../types';

const clientSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address").optional().or(z.literal('')),
  phone: z.string().min(10, "Phone number must be at least 10 digits").optional().or(z.literal('')),
  loanAmount: z.number().min(0, "Loan amount cannot be negative").default(0),
});

type ClientFormValues = z.infer<typeof clientSchema>;

interface CreateClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (client: Client) => void;
  initialStatus: string;
}

export const CreateClientModal: React.FC<CreateClientModalProps> = ({ isOpen, onClose, onSave, initialStatus }) => {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      loanAmount: 0
    }
  });

  const onSubmit = (data: ClientFormValues) => {
    const newClient: Client = {
      id: Date.now().toString(),
      name: data.name,
      email: data.email || '',
      phone: data.phone || '',
      loanAmount: data.loanAmount || 0,
      status: initialStatus,
      nextActionDate: new Date().toISOString().split('T')[0],
      notes: '',
      checklist: [],
      emailHistory: [],
      propertyAddress: ''
    };
    
    onSave(newClient);
    reset();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-800 flex items-center">
            <User size={18} className="mr-2 text-brand-red"/> New Client Record
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Full Name <span className="text-red-500">*</span></label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-3 text-gray-400"/>
              <input 
                {...register('name')}
                placeholder="Jane Doe" 
                className={`w-full pl-10 p-2.5 bg-gray-50 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red transition-all ${errors.name ? 'border-red-300' : 'border-gray-200'}`}
                autoFocus
              />
            </div>
            {errors.name && <p className="text-xs text-red-500 mt-1 font-medium">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email Address</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-3 text-gray-400"/>
              <input 
                {...register('email')}
                type="email"
                placeholder="jane@example.com" 
                className={`w-full pl-10 p-2.5 bg-gray-50 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red transition-all ${errors.email ? 'border-red-300' : 'border-gray-200'}`}
              />
            </div>
            {errors.email && <p className="text-xs text-red-500 mt-1 font-medium">{errors.email.message}</p>}
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Phone</label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-3 text-gray-400"/>
                <input 
                  {...register('phone')}
                  type="tel"
                  placeholder="(555) 555-5555" 
                  className={`w-full pl-10 p-2.5 bg-gray-50 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red transition-all ${errors.phone ? 'border-red-300' : 'border-gray-200'}`}
                />
              </div>
              {errors.phone && <p className="text-xs text-red-500 mt-1 font-medium">{errors.phone.message}</p>}
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Loan Amount</label>
              <div className="relative">
                <DollarSign size={14} className="absolute left-3 top-3 text-gray-400"/>
                <input 
                  {...register('loanAmount', { valueAsNumber: true })}
                  type="number" 
                  placeholder="0" 
                  className={`w-full pl-8 p-2.5 bg-gray-50 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red transition-all ${errors.loanAmount ? 'border-red-300' : 'border-gray-200'}`}
                />
              </div>
              {errors.loanAmount && <p className="text-xs text-red-500 mt-1 font-medium">{errors.loanAmount.message}</p>}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex justify-end space-x-3">
            <button 
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-brand-red text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin mr-2"/> : <Save size={16} className="mr-2"/>}
              Create Client
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};