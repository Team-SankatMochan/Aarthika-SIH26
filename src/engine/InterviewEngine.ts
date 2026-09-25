export interface DerivationStep {
  id: string;
  prompt_hi: string;
}

export interface QuestionConfig {
  id: string;
  canonical_field: string;
  prompt_hi: string;
  prompt_en: string;
  input_type: 'NUMBER_WITH_UNIT' | 'TEXT' | 'SELECT';
  required: boolean;
  allow_estimation: boolean;
  allow_unknown: boolean;
  confirmation_hi: string;
  derivation_steps?: DerivationStep[];
  derivation_formula?: (answers: Record<string, number>) => number;
}

export const INTERVIEW_QUESTIONS: QuestionConfig[] = [
  {
    id: "location",
    canonical_field: "location",
    prompt_hi: "आपना गाँव, ब्लॉक और जिला बताएँ।",
    prompt_en: "Please tell your village, block and district.",
    input_type: "TEXT",
    required: true,
    allow_estimation: false,
    allow_unknown: false,
    confirmation_hi: "आपने {{value}} कहा. सही है?"
  },
  {
    id: "business_category",
    canonical_field: "business_category",
    prompt_hi: "आप कौन सा काम शुरू करना चाहते हैं?",
    prompt_en: "What business do you want to start?",
    input_type: "TEXT",
    required: true,
    allow_estimation: false,
    allow_unknown: false,
    confirmation_hi: "आपने {{value}} कहा. सही है?"
  },
  {
    id: "margin_capital",
    canonical_field: "available_margin_capital",
    prompt_hi: "आपके पास अभी कितनी पूंजी है?",
    prompt_en: "How much capital do you currently have?",
    input_type: "NUMBER_WITH_UNIT",
    required: true,
    allow_estimation: false,
    allow_unknown: false,
    confirmation_hi: "आपने {{value}} रुपये कहा. सही है?"
  },
  {
    id: "monthly_units_sold",
    canonical_field: "monthly_units_sold",
    prompt_hi: "एक महीने में लगभग कितना माल (या लीटर) बेच पाएंगे?",
    prompt_en: "How many units can you sell in a month?",
    input_type: "NUMBER_WITH_UNIT",
    required: true,
    allow_estimation: true,
    allow_unknown: true,
    confirmation_hi: "आपने {{value}} यूनिट प्रति महीना कहा. सही है?"
  },
  {
    id: "selling_price",
    canonical_field: "selling_price_per_unit",
    prompt_hi: "एक यूनिट कितने में बेचेंगे?",
    prompt_en: "What is your selling price per unit?",
    input_type: "NUMBER_WITH_UNIT",
    required: true,
    allow_estimation: false,
    allow_unknown: true,
    confirmation_hi: "आपने {{value}} रुपये कहा. सही है?"
  },
  {
    id: "variable_cost",
    canonical_field: "variable_cost_per_unit",
    prompt_hi: "प्रति लीटर या प्रति यूनिट बनाने का खर्च कितना है?",
    prompt_en: "What is the per unit variable cost?",
    input_type: "NUMBER_WITH_UNIT",
    required: true,
    allow_estimation: true,
    allow_unknown: true,
    confirmation_hi: "आपने {{value}} रुपये कहा. सही है?"
  },
  {
    id: "hh_income",
    canonical_field: "monthly_household_nonbusiness_income",
    prompt_hi: "घर की महीने की अन्य कमाई कितनी है? (बिना इस काम के)",
    prompt_en: "What is the monthly household income from other sources?",
    input_type: "NUMBER_WITH_UNIT",
    required: true,
    allow_estimation: true,
    allow_unknown: true,
    confirmation_hi: "आपने {{value}} रुपये कहा. सही है?"
  },
  {
    id: "hh_expenses",
    canonical_field: "monthly_household_essential_expenses",
    prompt_hi: "घर का महीने का जरूरी खर्च कितना है?",
    prompt_en: "What are your essential monthly household expenses?",
    input_type: "NUMBER_WITH_UNIT",
    required: true,
    allow_estimation: true,
    allow_unknown: true,
    confirmation_hi: "आपने {{value}} रुपये कहा. सही है?"
  },
  {
    id: "hh_debt",
    canonical_field: "existing_monthly_household_debt_payments",
    prompt_hi: "क्या घर में पहले से कोई कर्ज़ा है जिसकी किस्त जाती हो? अगर है तो कितने की?",
    prompt_en: "Any existing monthly loan EMI?",
    input_type: "NUMBER_WITH_UNIT",
    required: true,
    allow_estimation: true,
    allow_unknown: true,
    confirmation_hi: "आपने {{value}} रुपये कहा. सही है?"
  },
  {
    id: "monthly_rent",
    canonical_field: "monthly_rent",
    prompt_hi: "हर महीने का किराया कितना है?",
    prompt_en: "What is the monthly rent?",
    input_type: "NUMBER_WITH_UNIT",
    required: true,
    allow_estimation: false,
    allow_unknown: true,
    confirmation_hi: "आपने {{value}} रुपये कहा. सही है?"
  },
  {
    id: "monthly_labour",
    canonical_field: "monthly_labour_cost",
    prompt_hi: "मजदूरी का हर महीने का खर्च कितना है?",
    prompt_en: "What is the monthly labour cost?",
    input_type: "NUMBER_WITH_UNIT",
    required: true,
    allow_estimation: false,
    allow_unknown: true,
    confirmation_hi: "आपने {{value}} रुपये कहा. सही है?"
  },
  {
    id: "monthly_transport",
    canonical_field: "monthly_transport_cost",
    prompt_hi: "आने-जाने (ट्रांसपोर्ट) का महीने का खर्च कितना है?",
    prompt_en: "What is the monthly transport cost?",
    input_type: "NUMBER_WITH_UNIT",
    required: true,
    allow_estimation: false,
    allow_unknown: true,
    confirmation_hi: "आपने {{value}} रुपये कहा. सही है?"
  },
  {
    id: "monthly_fixed_cost",
    canonical_field: "monthly_other_fixed_cost",
    prompt_hi: "हर महीने का पक्का खर्च (चारा, किराया आदि) कितना है?",
    prompt_en: "What are your fixed monthly business expenses?",
    input_type: "NUMBER_WITH_UNIT",
    required: true,
    allow_estimation: true,
    allow_unknown: true,
    confirmation_hi: "आपने {{value}} रुपये कहा. सही है?",
    derivation_steps: [
      { id: 'cows', prompt_hi: 'आपके पास कितनी गाएं/भैंसें होंगी?' },
      { id: 'daily_fodder', prompt_hi: 'एक जानवर के चारे पर रोज़ का कितना खर्च आएगा?' }
    ],
    derivation_formula: (ans) => (ans.cows || 0) * (ans.daily_fodder || 0) * 30
  }
];

export class InterviewEngine {
  private questions = INTERVIEW_QUESTIONS;
  
  getNextQuestion(currentAnswers: Record<string, any>): QuestionConfig | null {
    for (const q of this.questions) {
      if (currentAnswers[q.canonical_field] === undefined) {
        return q;
      }
    }
    return null;
  }
}
