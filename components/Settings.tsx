
import React, { useState, useRef } from 'react';
import { Save, Download, Upload, AlertTriangle, Key, Trash2, CheckCircle, Database } from 'lucide-react';
import { exportAllData, importAllData, clearAllData, saveToStorage, loadFromStorage, StorageKeys } from '../services/storageService';
import { useToast } from './Toast';

export const Settings: React.FC = () => {
    const { showToast } = useToast();
    const [apiKey, setApiKey] = useState(() => loadFromStorage(StorageKeys.API_KEY, ''));
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSaveKey = () => {
        saveToStorage(StorageKeys.API_KEY, apiKey);
        showToast('API Key saved successfully', 'success');
    };

    const handleExport = () => {
        const dataStr = exportAllData();
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const exportFileDefaultName = `premiere_backup_${new Date().toISOString().split('T')[0]}.json`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        showToast('Backup downloaded', 'success');
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const jsonStr = event.target?.result as string;
            if (importAllData(jsonStr)) {
                showToast('Data restored successfully! reloading...', 'success');
                setTimeout(() => window.location.reload(), 1500);
            } else {
                showToast('Failed to import data. Invalid file.', 'error');
            }
        };
        reader.readAsText(file);
    };

    const handleReset = () => {
        if (confirm('DANGER: This will delete ALL client data, rates, and notes. This cannot be undone. Are you sure?')) {
            clearAllData();
            showToast('Application reset. Reloading...', 'info');
            setTimeout(() => window.location.reload(), 1000);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto animate-fade-in pb-20">
            <h2 className="text-3xl font-bold text-brand-dark mb-2">Global Settings</h2>
            <p className="text-gray-500 mb-8">Manage application configuration and data security.</p>

            {/* API Key Section */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-8">
                <div className="flex items-center mb-4 text-brand-dark">
                    <Key className="mr-3" size={24} />
                    <h3 className="text-xl font-bold">API Configuration (BYOK)</h3>
                </div>
                <p className="text-sm text-gray-500 mb-4">
                    To use the AI features in production without a backend server, provide your own Gemini API Key. 
                    This key is stored securely in your browser's Local Storage and is never sent to our servers.
                </p>
                <div className="flex gap-4">
                    <input 
                        type="password" 
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Enter your Gemini API Key (AIza...)"
                        className="flex-1 p-3 bg-gray-50 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-red font-mono text-sm"
                    />
                    <button 
                        onClick={handleSaveKey}
                        className="px-6 py-2 bg-brand-dark text-white font-bold rounded-lg hover:bg-gray-800 transition-colors flex items-center"
                    >
                        <Save size={18} className="mr-2" />
                        Save
                    </button>
                </div>
                <div className="mt-4 flex items-center text-xs text-green-600 bg-green-50 p-2 rounded border border-green-200 inline-block">
                    <CheckCircle size={12} className="mr-1" />
                    Data is sent directly from your browser to Google APIs.
                </div>
            </div>

            {/* Data Management Section */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-8">
                <div className="flex items-center mb-4 text-brand-dark">
                    <Database className="mr-3" size={24} />
                    <h3 className="text-xl font-bold">Data Management</h3>
                </div>
                <p className="text-sm text-gray-500 mb-6">
                    Your data lives in this browser. Create backups frequently to prevent data loss if you clear your cache or switch devices.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                    <button 
                        onClick={handleExport}
                        className="flex-1 px-6 py-4 bg-gray-50 border border-gray-200 text-brand-dark font-bold rounded-xl hover:bg-gray-100 hover:border-brand-gold transition-all flex flex-col items-center justify-center group"
                    >
                        <Download size={32} className="mb-2 text-brand-gold group-hover:scale-110 transition-transform" />
                        <span>Backup Data (JSON)</span>
                        <span className="text-xs text-gray-400 font-normal mt-1">Export all clients & settings</span>
                    </button>
                    
                    <button 
                        onClick={handleImportClick}
                        className="flex-1 px-6 py-4 bg-gray-50 border border-gray-200 text-brand-dark font-bold rounded-xl hover:bg-gray-100 hover:border-brand-red transition-all flex flex-col items-center justify-center group"
                    >
                        <Upload size={32} className="mb-2 text-brand-red group-hover:scale-110 transition-transform" />
                        <span>Restore Data</span>
                        <span className="text-xs text-gray-400 font-normal mt-1">Import from backup file</span>
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        accept=".json" 
                        className="hidden" 
                    />
                </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-red-50 p-6 rounded-xl border border-red-100">
                <div className="flex items-center mb-4 text-red-800">
                    <AlertTriangle className="mr-3" size={24} />
                    <h3 className="text-xl font-bold">Danger Zone</h3>
                </div>
                <div className="flex items-center justify-between">
                    <p className="text-sm text-red-600 max-w-lg">
                        Resetting the application will wipe all local data, clients, and history. This action cannot be undone unless you have a backup.
                    </p>
                    <button 
                        onClick={handleReset}
                        className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors flex items-center shadow-sm"
                    >
                        <Trash2 size={16} className="mr-2" />
                        Reset App
                    </button>
                </div>
            </div>
        </div>
    );
};
