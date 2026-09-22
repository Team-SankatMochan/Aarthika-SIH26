import { Model, Relation } from '@nozbe/watermelondb';
import { field, readonly, date, relation } from '@nozbe/watermelondb/decorators';
import type Pilot from './Pilot';

export default class PilotResult extends Model {
    @field('server_revision') serverRevision!: number;
    static table = 'pilot_results';
    static associations = {
        pilots: { type: 'belongs_to', key: 'pilot_id' },
    } as const;

    @field('pilot_id') pilotId!: string;
    @field('target_customers') targetCustomers!: number;
    @field('actual_customers') actualCustomers!: number;
    @field('repeat_purchase_rate') repeatPurchaseRate!: number;
    @field('price_acceptance') priceAcceptance!: number;
    @field('delivery_cost') deliveryCost!: number;
    @field('conversion_rate') conversionRate!: number;
    @field('actual_revenue') actualRevenue!: number;
    @field('actual_cost') actualCost!: number;
    @field('customer_feedback') customerFeedback!: string;
    @field('observations') observations!: string;
    @readonly @date('created_at') createdAt!: number;

    @relation('pilots', 'pilot_id') pilot!: Relation<Pilot>;

    get customerAcquisitionRate(): number {
        if (this.targetCustomers === 0) return 0;
        return (this.actualCustomers / this.targetCustomers) * 100;
    }

    get profitMargin(): number {
        if (this.actualRevenue === 0) return 0;
        return ((this.actualRevenue - this.actualCost) / this.actualRevenue) * 100;
    }
}
