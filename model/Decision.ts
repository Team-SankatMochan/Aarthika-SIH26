import { Model, Relation } from '@nozbe/watermelondb';
import { field, readonly, date, relation } from '@nozbe/watermelondb/decorators';
import type Business from './Business';

export default class Decision extends Model {
    static table = 'decisions';
    static associations = {
        businesses: { type: 'belongs_to', key: 'business_id' },
    } as const;

    @field('business_id') businessId!: string;
    @field('decision') decision!: string; // GO, MODIFY, DO_NOT_INVEST_YET
    @field('rationale') rationale!: string;
    @field('confidence') confidence!: number;
    @field('evidence_summary') evidenceSummaryJson!: string;
    @field('assumptions_summary') assumptionsSummaryJson!: string;
    @field('financial_risk_summary') financialRiskSummaryJson!: string;
    @readonly @date('created_at') createdAt!: number;

    @relation('businesses', 'business_id') business!: Relation<Business>;

    get evidenceSummary(): any {
        try {
            return this.evidenceSummaryJson ? JSON.parse(this.evidenceSummaryJson) : null;
        } catch {
            return null;
        }
    }

    get assumptionsSummary(): any {
        try {
            return this.assumptionsSummaryJson ? JSON.parse(this.assumptionsSummaryJson) : null;
        } catch {
            return null;
        }
    }

    get financialRiskSummary(): any {
        try {
            return this.financialRiskSummaryJson ? JSON.parse(this.financialRiskSummaryJson) : null;
        } catch {
            return null;
        }
    }
}
