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

export interface FinancialProfile {
  totalIncome: number;
  totalDebts: number;
  proposedHousing: number;
  creditScore?: number;
  liquidAssets?: number;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  referralSource?: string; 
  referralEmail?: string;  
  loanAmount: number;
  propertyAddress: string;
  estimatedPropertyValue?: number; 
  status: string; 
  nextActionDate: string;
  notes: string;
  checklist: ChecklistItem[];
  emailHistory: EmailLog[];
  lastSummary?: string;
  financialProfile?: FinancialProfile;
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

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  action?: {
    label: string;
    onClick: () => void;
  };
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
  PLANNER = 'PLANNER', // Daily Planner & Chief of Staff
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

// Error Logging Types
export interface ErrorLog {
  id: string;
  timestamp: number;
  message: string;
  stack?: string;
  type: 'ERROR' | 'API_FAIL' | 'USER_ACTION';
  metadata?: any;
}

// Simulation Types
export interface SimulationScenario {
  id: string;
  title: string;
  description: string;
  difficulty: 'ROOKIE' | 'VETERAN' | 'LEGEND';
  systemInstruction: string;
}

// Added Missing Types
export interface Opportunity {
  clientId: string;
  clientName: string;
  trigger: string;
  action: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface DealStrategy {
  title: string;
  type: 'SAFE' | 'AGGRESSIVE' | 'BALANCED';
  monthlyPayment: string;
  pros: string[];
  cons: string[];
  description: string;
}

export interface GiftSuggestion {
  item: string;
  reason: string;
  priceRange: string;
}

export interface GeneratedImage {
  url: string; // Base64 data URL
  prompt: string;
}

// Calendar / Planner Types
export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO Date String
  end: string; // ISO Date String
  type: 'MEETING' | 'CALL' | 'TASK' | 'BLOCK';
  clientId?: string; // Optional link to a client
  notes?: string;
  isAiGenerated?: boolean;
}

// Knowledge Base Types
export interface SalesScript {
  id: string;
  title: string;
  category: 'Objection' | 'Update' | 'Closing' | 'Prospecting';
  content: string;
  tags: string[];
}

export interface MortgageTerm {
  term: string;
  definition: string;
  category: 'Underwriting' | 'Market' | 'Product';
  example?: string;
}