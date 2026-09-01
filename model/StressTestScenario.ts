import { Model, Relation } from '@nozbe/watermelondb';
import { field, readonly, date, relation } from '@nozbe/watermelondb/decorators';
import type StressTest from './StressTest';

export default class StressTestScenario extends Model {
    static table = 'stress_test_scenarios';
    static associations = {
        stress_tests: { type: 'belongs_to', key: 'stress_test_id' },
    } as const;

    @field('stress_test_id') stressTestId!: string;
    @field('scenario_type') scenarioType!: string; // price_drop, cost_spike, demand_fall
    @field('parameter_name') parameterName!: string;
    @field('change_percentage') changePercentage!: number;
    @field('change_absolute') changeAbsolute!: number;
    @field('revenue') revenue!: number;
    @field('operating_cost') operatingCost!: number;
    @field('cash_surplus') cashSurplus!: number;
    @field('debt_repayment_burden') debtRepaymentBurden!: number;
    @field('working_capital_pressure') workingCapitalPressure!: number;
    @field('break_even') breakEven!: number;
    @field('resilience_score') resilienceScore!: number;
    @field('result_status') resultStatus!: string; // viable, stressed, unviable
    @readonly @date('created_at') createdAt!: number;

    @relation('stress_tests', 'stress_test_id') stressTest!: Relation<StressTest>;
}
