

export interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  reminderDate?: string; // ISO Date string YYYY-MM-DD
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  loanAmount: number;
  propertyAddress: string;
  status: 'Lead' | 'Pre-Approval' | 'Underwriting' | 'Clear to Close' | 'Closed';
  nextActionDate: string;
  notes: string;
  checklist: ChecklistItem[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  isError?: boolean;
  groundingLinks?: Array<{uri: string; title: string}>;
}

export interface LoanScenario {
  purchasePrice: number;
  downPaymentPercent: number;
  interestRate: number;
  loanTerm: number; // in years
  propertyTaxRate: number; // percentage
  insuranceAnnual: number;
  hoaMonthly: number;
  isInterestOnly: boolean;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  isDefault?: boolean;
}

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

export enum AppView {
  DASHBOARD = 'DASHBOARD', // Client Manager
  CALCULATOR = 'CALCULATOR', // Jumbo Calc
  DTI_ANALYSIS = 'DTI_ANALYSIS', // DTI
  RATES_NOTES = 'RATES_NOTES', // Rates & Notes
  MARKETING = 'MARKETING', // Marketing Studio
  ASSISTANT = 'ASSISTANT'
}

// AI Command Types
export type CommandAction = 'CREATE_CLIENT' | 'UPDATE_STATUS' | 'UPDATE_CLIENT' | 'ADD_NOTE' | 'ADD_TASK' | 'UNKNOWN';

export interface CommandIntent {
  action: CommandAction;
  clientName?: string; // Used for fuzzy matching
  payload: {
    name?: string;
    loanAmount?: number;
    status?: string;
    phone?: string;
    email?: string;
    note?: string;
    taskLabel?: string;
    date?: string;
  };
}