import React from 'react';
import { DealStage } from '../types';

interface ClientFiltersProps {
    isOpen: boolean;
    statusFilter: string;
    setStatusFilter: (val: string) => void;
    loanAmountFilter: string;
    setLoanAmountFilter: (val: string) => void;
    dateFilter: string;
    setDateFilter: (val: string) => void;
    dealStages: DealStage[];
}

export const ClientFilters: React.FC<ClientFiltersProps> = ({
    isOpen,
    statusFilter,
    setStatusFilter,
    loanAmountFilter,
    setLoanAmountFilter,
    dateFilter,
    setDateFilter,
    dealStages
}) => {
    if (!isOpen) return null;

    return (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm space-y-3 animate-fade-in">
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status</label>
                <select 
                    value={statusFilter} 
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full p-2 bg-white border border-gray-300 rounded text-gray-900 focus:border-brand-red outline-none"
                >
                    <option value="All">All Statuses</option>
                    {dealStages.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Loan Amount</label>
                    <select 
                        value={loanAmountFilter} 
                        onChange={(e) => setLoanAmountFilter(e.target.value)}
                        className="w-full p-2 bg-white border border-gray-300 rounded text-gray-900 focus:border-brand-red outline-none"
                    >
                        <option value="All">Any</option>
                        <option value="<1M">&lt; $1M</option>
                        <option value="1M-2.5M">$1M - $2.5M</option>
                        <option value=">2.5M">&gt; $2.5M</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Action Date</label>
                    <select 
                        value={dateFilter} 
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="w-full p-2 bg-white border border-gray-300 rounded text-gray-900 focus:border-brand-red outline-none"
                    >
                        <option value="All">Any</option>
                        <option value="Today">Today</option>
                        <option value="Upcoming">Next 7 Days</option>
                        <option value="Overdue">Overdue</option>
                    </select>
                </div>
            </div>
        </div>
    );
};