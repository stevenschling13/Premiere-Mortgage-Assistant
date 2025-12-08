

export interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  reminderDate?: string; // ISO Date string YYYY-MM-DD
}

export interface EmailLog {
  id: string;
  date: string;
  subject: string;
  body: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  loanAmount: number;
  propertyAddress: string;
  estimatedPropertyValue?: number; // AI-fetched estimate
  status: string; // Changed from union to string to support custom deal stages
  nextActionDate: string;
  notes: string;
  checklist: ChecklistItem[];
  emailHistory: EmailLog[];
  lastSummary?: string;
}

export interface ManualDeal {
  id: string;
  date: string;
  clientName: string;
  loanAmount: number;
  commission: number;
}

export interface DealStage {
  name: string;
  color: string;
}

export interface VerificationResult {
  status: 'VERIFIED' | 'ISSUES_FOUND' | 'UNVERIFIABLE';
  text: string;
  sources: Array<{uri: string; title: string}>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  isError?: boolean;
  groundingLinks?: Array<{uri: string; title: string}>;
  searchEntryPoint?: string;
  searchQueries?: string[];
  verificationResult?: VerificationResult;
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

export interface MarketIndex {
  label: string;
  value: string;
  change: string;
  isUp: boolean;
}

export interface NewsItem {
  id: string;
  source: string;
  date: string;
  title: string;
  summary: string;
  category: 'Rates' | 'Economy' | 'Housing';
  talkingPoints?: string[]; // Optional as it might be generated later
}

export interface UserProfile {
  baseSalary: number;
  commissionBps: number; // e.g. 55 for 55bps
  splitPercentage: number; // e.g. 15 for 15%
  annualIncomeGoal: number;
}

export enum AppView {
  DASHBOARD = 'DASHBOARD', // Client Manager
  CALCULATOR = 'CALCULATOR', // Jumbo Calc
  DTI_ANALYSIS = 'DTI_ANALYSIS', // DTI
  RATES_NOTES = 'RATES_NOTES', // Rates & Notes
  MARKETING = 'MARKETING', // Marketing Studio
  ASSISTANT = 'ASSISTANT',
  COMPENSATION = 'COMPENSATION' // Wealth & Performance
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

// Marketing Types
export interface MarketingCampaign {
  linkedInPost: string;
  emailSubject: string;
  emailBody: string;
  smsTeaser: string;
}

export interface GeneratedImage {
  url: string; // Base64 data URL
  prompt: string;
}

export interface SavedClientView {
  id: string;
  name: string;
  filters: {
    status: string;
    loanAmount: string;
    date: string;
    searchQuery: string;
  };
}