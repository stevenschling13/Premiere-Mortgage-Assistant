
import { Client, DealStage, SalesScript, MortgageTerm, SimulationScenario } from './types';

export const INITIAL_CLIENTS: Client[] = [
    {
        id: 'seed-john-doe',
        name: 'John Doe',
        loanAmount: 1200000,
        status: 'Lead',
        nextActionDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
        email: 'john.doe@example.com',
        phone: '555-123-4567',
        propertyAddress: '',
        notes: 'New lead added via request.',
        checklist: [
            {
                id: 'task-seed-1',
                label: 'Follow up with lender',
                checked: false,
                reminderDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]
            }
        ],
        emailHistory: []
    }
];

export const DEFAULT_DEAL_STAGES: DealStage[] = [
    { name: 'Lead', color: '#64748B' }, // Slate
    { name: 'Pre-Approval', color: '#3B82F6' }, // Blue
    { name: 'Underwriting', color: '#A855F7' }, // Purple
    { name: 'Clear to Close', color: '#22C55E' }, // Green
    { name: 'Closed', color: '#CD1337' } // Brand Red
];

export const COLOR_PALETTE = [
    '#64748B', '#EF4444', '#F97316', '#F59E0B', '#84CC16', 
    '#22C55E', '#10B981', '#06B6D4', '#3B82F6', '#6366F1', 
    '#8B5CF6', '#A855F7', '#D946EF', '#EC4899', '#CD1337', '#F4B23E'
];

// --- REAL UNDERWRITING GUIDELINES (Source: AllRegs/Selling Guides 2024) ---
export const AGENCY_GUIDELINES = {
    CONVENTIONAL: {
        name: 'Conventional (FNMA/FHLMC)',
        maxLTV: 97, // First time home buyer
        standardLTV: 95,
        maxDTI: 50.00, // Absolute hard stop for DU/LPA usually
        standardDTI: 45.00, // Threshold requiring strong reserves/credit
        reserves: '2-6 months based on DTI/Credit',
        notes: 'FNMA B3-6-02: DTI > 45% requires strong compensating factors or DU Approve/Eligible.'
    },
    FHA: {
        name: 'FHA (HUD 4000.1)',
        maxLTV: 96.5,
        maxDTI: 56.9, // Max back-end with AUS Approval
        manualDTI: 43.00, // Max back-end for Manual Underwrite (without comp factors)
        standardDTI: 46.9, // Max front-end with AUS
        reserves: 'None for 1-2 unit standard',
        notes: 'HUD 4000.1: Ratios up to 46.9%/56.9% allowable with TOTAL Scorecard Accept/Approve. Manual Downgrade caps at 43%.'
    },
    VA: {
        name: 'VA (Lenders Handbook)',
        maxLTV: 100,
        maxDTI: 60.00, // Soft cap, Residual Income is primary driver
        standardDTI: 41.00, // Benchmark
        reserves: 'None standard',
        notes: 'Chapter 4: DTI is secondary to Residual Income. Ratios > 41% require rigorous justification.'
    },
    JUMBO: {
        name: 'Jumbo / Non-Agency',
        maxLTV: 80, // Typical
        maxDTI: 43.00, // Strict QM definition usually
        standardDTI: 43.00,
        reserves: '12+ months post-closing liquidity',
        notes: 'Investor Specific. Generally follows Appendix Q or strict 43% DTI hard stop.'
    }
};

export const VA_REGIONS = ['NORTHEAST', 'MIDWEST', 'SOUTH', 'WEST'] as const;

// VA Residual Income Table (Loan Amounts > $80,000)
// Family Size: 1, 2, 3, 4, 5+
export const VA_RESIDUAL_INCOME_TABLE = {
    NORTHEAST: [450, 755, 909, 1025, 1062], 
    MIDWEST: [441, 738, 889, 1003, 1039],
    SOUTH: [441, 738, 889, 1003, 1039],
    WEST: [491, 823, 990, 1117, 1158]
};
export const VA_ADDITIONAL_MEMBER_AMOUNT = 80;

// --- KNOWLEDGE BASE CONTENT ---

export const INITIAL_SCRIPTS: SalesScript[] = [
    {
        id: 'script-float-down',
        title: 'The "Float Down" Pitch',
        category: 'Update',
        content: "Great news. The market has improved since we locked. Because we built in the 'Float Down' option, I can actually lower your rate to [NEW_RATE]% at no cost. Most lenders would keep this spread, but I wanted to make sure you got the benefit immediately.",
        tags: ['Rates', 'Service', 'Lock']
    },
    {
        id: 'script-rate-objection',
        title: 'Rate Shopper Rebuttal',
        category: 'Objection',
        content: "I understand the other quote is 0.125% lower. However, looking at their fee sheet, they are charging 1 point ($5,000) to get that rate. My quote is at 'par' (0 points). If you took that $5,000 and applied it to your principal, you'd save more interest than the rate difference offers. Let me show you the math.",
        tags: ['Competition', 'Fees', 'Math']
    },
    {
        id: 'script-preapproval-urgency',
        title: 'Pre-Approval Urgency',
        category: 'Prospecting',
        content: "In this market, a standard Pre-Qualification letter isn't enough. Listing agents are looking for fully underwritten approvals. If you send me your docs today, I can get you a 'Commitment Letter' by Friday. This puts your offer on par with cash buyers.",
        tags: ['Speed', 'Purchase', 'Docs']
    }
];

export const MORTGAGE_TERMS: MortgageTerm[] = [
    {
        term: 'Debt Service Coverage Ratio (DSCR)',
        definition: 'A metric used in investment property lending. It measures cash flow available to pay current debt obligations. Formula: Net Operating Income / Total Debt Service.',
        category: 'Underwriting',
        example: 'A DSCR of 1.25 means the property generates 1.25x the rent needed to cover the mortgage.'
    },
    {
        term: 'Loan Level Price Adjustment (LLPA)',
        definition: 'Risk-based fees assessed by Fannie Mae and Freddie Mac. These adjustments are based on credit score, LTV, property type, and occupancy.',
        category: 'Product',
        example: 'A 740 score with 20% down has a lower LLPA than a 680 score with 5% down.'
    },
    {
        term: 'Yield Curve Inversion',
        definition: 'A market state where short-term debt instruments have higher yields than long-term instruments of the same credit risk profile. Often a predictor of recession.',
        category: 'Market',
        example: 'When the 2-Year Treasury yield is higher than the 10-Year Treasury yield.'
    },
    {
        term: 'MBS Spread',
        definition: 'The difference between the 30-Year Mortgage rate and the 10-Year Treasury yield. This spread represents the risk premium investors demand for holding mortgages.',
        category: 'Market'
    }
];

export const SIMULATION_SCENARIOS: SimulationScenario[] = [
    {
        id: 'rate_shopper',
        title: 'Competitive Rebuttal',
        description: 'Client has a quote from a major bank (5.875%). Articulate the value proposition of your 6.00% offer beyond just rate.',
        difficulty: 'VETERAN',
        systemInstruction: `You are John, a skeptical client. You have a quote from Chase for 5.875% and the user is offering 6.00%. 
        You are purely focused on monthly payment. 
        Challenge the user on "why should I pay more?". Be blunt but professional.
        If the user mentions "service", "speed", or "custom structure", act unimpressed unless they give a concrete example.`
    },
    {
        id: 'nervous_first_timer',
        title: 'Market Anxiety',
        description: 'A tech employee buying their first $1.5M home. Address their concerns about a potential market correction.',
        difficulty: 'ROOKIE',
        systemInstruction: `You are Sarah, a nervous first-time buyer. You work at Google. 
        You are worried that buying now is a mistake because "prices might drop". 
        Ask for reassurance. Be emotional but receptive to logic.`
    },
    {
        id: 'wealth_manager',
        title: 'Partner Interview',
        description: 'A Wealth Manager (CPA) is vetting your technical expertise on complex income structures before referring clients.',
        difficulty: 'LEGEND',
        systemInstruction: `You are Michael, a high-net-worth Wealth Manager. 
        You are interviewing the user to see if they can handle your complex clients (RSUs, Trusts, LLCs).
        Ask technical questions about "Asset Depletion" and "Cross-Collateralization". 
        Be sophisticated and critical.`
    }
];

export const SUGGESTED_PROMPTS = [
  "What are today's 30-year Jumbo rates?",
  "Latest 10-Year Treasury yield?",
  "Scenario: $2.5M Purchase, 20% down, 760 FICO",
  "Summarize Fed Chair Powell's recent comments",
  "How is my commission tracking vs target?"
];
