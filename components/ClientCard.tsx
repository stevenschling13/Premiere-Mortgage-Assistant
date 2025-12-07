import React, { memo } from 'react';
import { Client } from '../types';
import { Check, ArrowUpRight, Calendar, ChevronRight } from 'lucide-react';

interface ClientCardProps {
    client: Client;
    isSelected: boolean;
    isBulkSelectionActive: boolean;
    isBulkSelected: boolean;
    stageColor: string;
    onSelect: (client: Client) => void;
    onToggleBulkSelect: (id: string, e?: React.MouseEvent) => void;
}

export const ClientCard = memo(({ 
    client, 
    isSelected, 
    isBulkSelectionActive, 
    isBulkSelected, 
    stageColor, 
    onSelect, 
    onToggleBulkSelect 
}: ClientCardProps) => {
    return (
        <div 
            onClick={() => onSelect(client)}
            className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors relative group ${isSelected ? 'bg-blue-50/50' : ''}`}
            role="button"
            aria-selected={isSelected}
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(client);
                }
            }}
        >
            <div className="flex justify-between items-start mb-1">
                <div className="flex items-center">
                        {/* Bulk Checkbox */}
                        <div 
                        onClick={(e) => onToggleBulkSelect(client.id, e)}
                        className={`mr-3 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                            isBulkSelected 
                            ? 'bg-brand-red border-brand-red text-white' 
                            : 'border-gray-300 hover:border-gray-400 text-transparent'
                        }`}
                        role="checkbox"
                        aria-checked={isBulkSelected}
                        tabIndex={0}
                        onKeyDown={(e) => {
                             if (e.key === 'Enter' || e.key === ' ') {
                                e.stopPropagation();
                                e.preventDefault();
                                onToggleBulkSelect(client.id, e as any);
                             }
                        }}
                        >
                            <Check size={12} />
                        </div>
                        <h3 className="font-bold text-gray-900">{client.name}</h3>
                </div>
                <span 
                    className="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider text-white"
                    style={{ backgroundColor: stageColor }}
                >
                    {client.status}
                </span>
            </div>
            <div className="pl-8">
                <p className="text-xs text-gray-500 mb-1 flex items-center">
                    <ArrowUpRight size={12} className="mr-1 inline text-gray-400" />
                    ${client.loanAmount.toLocaleString()}
                </p>
                <p className="text-xs text-gray-400 flex items-center">
                    <Calendar size={12} className="mr-1 inline" />
                    Next: {new Date(client.nextActionDate).toLocaleDateString()}
                </p>
            </div>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronRight className="text-gray-300" size={20} />
            </div>
        </div>
    );
});

ClientCard.displayName = 'ClientCard';