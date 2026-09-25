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
}

export const INTERVIEW_QUESTIONS: QuestionConfig[] = [
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
    prompt_hi: "एक महीने में लगभग कितना माल बेच पाएंगे?",
    prompt_en: "How many units can you sell in a month?",
    input_type: "NUMBER_WITH_UNIT",
    required: true,
    allow_estimation: true,
    allow_unknown: true,
    confirmation_hi: "आपने {{value}} यूनिट प्रति महीना कहा. सही है?"
  },
  {
    id: "variable_cost",
    canonical_field: "variable_cost_per_unit",
    prompt_hi: "एक यूनिट बनाने या खरीदने में कितना खर्च आता है?",
    prompt_en: "What is the variable cost per unit?",
    input_type: "NUMBER_WITH_UNIT",
    required: true,
    allow_estimation: true,
    allow_unknown: true,
    confirmation_hi: "आपने {{value}} रुपये कहा. सही है?"
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
