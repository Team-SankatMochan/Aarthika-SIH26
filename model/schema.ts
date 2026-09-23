import { appSchema, tableSchema } from '@nozbe/watermelondb';

export default appSchema({
    version: 4,
    tables: [
        // ─── Core Entities ─────────────────────────────────────────

        tableSchema({
            name: 'locations',
            columns: [
                { name: 'state', type: 'string' },
                { name: 'district', type: 'string', isOptional: true },
                { name: 'block', type: 'string', isOptional: true },
                { name: 'village_or_city', type: 'string', isOptional: true },
                { name: 'latitude', type: 'number', isOptional: true },
                { name: 'longitude', type: 'number', isOptional: true },
                { name: 'location_type', type: 'string', isOptional: true }, // P1
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'server_revision', type: 'number', isOptional: true },
            ],
        }),

        tableSchema({
            name: 'users',
            columns: [
                { name: 'name', type: 'string' },
                { name: 'phone', type: 'string', isOptional: true },
                { name: 'location_id', type: 'string', isIndexed: true },
                { name: 'available_capital', type: 'number' },
                { name: 'skills', type: 'string', isOptional: true }, // JSON string
                { name: 'experience', type: 'string', isOptional: true },
                { name: 'assets', type: 'string', isOptional: true }, // JSON string
                { name: 'family_workforce', type: 'number', isOptional: true },
                { name: 'preferences', type: 'string', isOptional: true }, // JSON string
                { name: 'risk_tolerance', type: 'string', isOptional: true },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'server_revision', type: 'number', isOptional: true },
            ],
        }),

        tableSchema({
            name: 'businesses',
            columns: [
                { name: 'user_id', type: 'string', isIndexed: true },
                { name: 'location_id', type: 'string', isIndexed: true },
                { name: 'business_name', type: 'string' },
                { name: 'business_category', type: 'string' },
                { name: 'description', type: 'string', isOptional: true },
                { name: 'status', type: 'string' }, // planning, testing, validated, financed
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'server_revision', type: 'number', isOptional: true },
            ],
        }),

        // ─── Market & Financial Data ───────────────────────────────

        tableSchema({
            name: 'market_data',
            columns: [
                { name: 'location_id', type: 'string', isIndexed: true },
                { name: 'business_id', type: 'string', isIndexed: true, isOptional: true },
                { name: 'data_type', type: 'string' }, // demand, price, cost, competition
                { name: 'source', type: 'string' },
                { name: 'value', type: 'number' },
                { name: 'unit', type: 'string', isOptional: true },
                { name: 'observation_date', type: 'number' },
                { name: 'confidence', type: 'number', isOptional: true },
                { name: 'is_observed', type: 'boolean' },
                { name: 'is_estimated', type: 'boolean' },
                { name: 'metadata_json', type: 'string', isOptional: true }, // JSON string
                { name: 'created_at', type: 'number' },
                { name: 'server_revision', type: 'number', isOptional: true },
            ],
        }),

        tableSchema({
            name: 'business_assumptions',
            columns: [
                { name: 'business_id', type: 'string', isIndexed: true },
                { name: 'expected_customers', type: 'number' },
                { name: 'selling_price', type: 'number' },
                { name: 'production_volume', type: 'number' },
                { name: 'raw_material_cost', type: 'number' },
                { name: 'labour_cost', type: 'number' },
                { name: 'rent', type: 'number' },
                { name: 'transport_cost', type: 'number' },
                { name: 'working_capital', type: 'number' },
                { name: 'proposed_loan_amount', type: 'number' },
                { name: 'other_operating_cost', type: 'number' },
                { name: 'assumption_source', type: 'string' },
                { name: 'confidence', type: 'number', isOptional: true },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'server_revision', type: 'number', isOptional: true },
            ],
        }),

        // ─── Stress Testing & Validation ───────────────────────────

        tableSchema({
            name: 'stress_tests',
            columns: [
                { name: 'business_id', type: 'string', isIndexed: true },
                { name: 'base_assumption_id', type: 'string', isIndexed: true },
                { name: 'name', type: 'string' },
                { name: 'description', type: 'string', isOptional: true },
                { name: 'status', type: 'string' }, // pending, running, completed
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'server_revision', type: 'number', isOptional: true },
            ],
        }),

        tableSchema({
            name: 'stress_test_scenarios',
            columns: [
                { name: 'stress_test_id', type: 'string', isIndexed: true },
                { name: 'scenario_type', type: 'string' }, // price_drop, cost_spike, demand_fall
                { name: 'parameter_name', type: 'string' },
                { name: 'change_percentage', type: 'number', isOptional: true },
                { name: 'change_absolute', type: 'number', isOptional: true },
                { name: 'revenue', type: 'number' },
                { name: 'operating_cost', type: 'number' },
                { name: 'cash_surplus', type: 'number' },
                { name: 'debt_repayment_burden', type: 'number', isOptional: true },
                { name: 'working_capital_pressure', type: 'number', isOptional: true },
                { name: 'break_even', type: 'number', isOptional: true },
                { name: 'break_even_status', type: 'string', isOptional: true },
                { name: 'resilience_score', type: 'number', isOptional: true },
                { name: 'result_status', type: 'string' }, // viable, stressed, unviable
                { name: 'created_at', type: 'number' },
                { name: 'server_revision', type: 'number', isOptional: true },
            ],
        }),

        // ─── Real-World Pilots ─────────────────────────────────────

        tableSchema({
            name: 'pilots',
            columns: [
                { name: 'business_id', type: 'string', isIndexed: true },
                { name: 'objective', type: 'string' },
                { name: 'hypothesis', type: 'string', isOptional: true },
                { name: 'duration_days', type: 'number' },
                { name: 'status', type: 'string' }, // planned, running, completed
                { name: 'start_date', type: 'number', isOptional: true },
                { name: 'end_date', type: 'number', isOptional: true },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'server_revision', type: 'number', isOptional: true },
            ],
        }),

        tableSchema({
            name: 'pilot_results',
            columns: [
                { name: 'pilot_id', type: 'string', isIndexed: true },
                { name: 'target_customers', type: 'number' },
                { name: 'actual_customers', type: 'number' },
                { name: 'repeat_purchase_rate', type: 'number', isOptional: true },
                { name: 'price_acceptance', type: 'number', isOptional: true },
                { name: 'delivery_cost', type: 'number', isOptional: true },
                { name: 'conversion_rate', type: 'number', isOptional: true },
                { name: 'actual_revenue', type: 'number' },
                { name: 'actual_cost', type: 'number' },
                { name: 'customer_feedback', type: 'string', isOptional: true },
                { name: 'observations', type: 'string', isOptional: true },
                { name: 'created_at', type: 'number' },
                { name: 'server_revision', type: 'number', isOptional: true },
            ],
        }),

        // ─── Financing & Schemes ───────────────────────────────────

        tableSchema({
            name: 'schemes',
            columns: [
                { name: 'scheme_name', type: 'string' },
                { name: 'scheme_type', type: 'string' },
                { name: 'description', type: 'string', isOptional: true },
                { name: 'active', type: 'boolean' },
                { name: 'official_source_name', type: 'string', isOptional: true }, // P1
                { name: 'official_source_url', type: 'string', isOptional: true }, // P1
                { name: 'last_verified_at', type: 'number', isOptional: true }, // P1
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'server_revision', type: 'number', isOptional: true },
            ],
        }),

        tableSchema({
            name: 'scheme_rules',
            columns: [
                { name: 'scheme_id', type: 'string', isIndexed: true },
                { name: 'min_project_cost', type: 'number' },
                { name: 'max_project_cost', type: 'number' },
                { name: 'financing_percentage', type: 'number' },
                { name: 'max_loan_amount', type: 'number' },
                { name: 'annual_interest_rate', type: 'number' },
                { name: 'tenure_months', type: 'number' },
                { name: 'moratorium_months', type: 'number' },
                { name: 'effective_from', type: 'number', isOptional: true },
                { name: 'effective_to', type: 'number', isOptional: true },
                { name: 'active', type: 'boolean' },
                { name: 'rule_version', type: 'number' }, // P1
                { name: 'moratorium_interest_method', type: 'string' }, // P1
                { name: 'location_type', type: 'string', isOptional: true }, // P1
                { name: 'allowed_business_categories', type: 'string', isOptional: true }, // P1
                { name: 'source_name', type: 'string', isOptional: true }, // P1
                { name: 'source_url', type: 'string', isOptional: true }, // P1
                { name: 'last_verified_at', type: 'number', isOptional: true }, // P1
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
                { name: 'server_revision', type: 'number', isOptional: true },
            ],
        }),

        tableSchema({
            name: 'finance_assessments',
            columns: [
                { name: 'business_id', type: 'string', isIndexed: true },
                { name: 'scheme_id', type: 'string', isIndexed: true, isOptional: true },
                { name: 'scheme_rule_id', type: 'string', isIndexed: true, isOptional: true },
                { name: 'project_cost', type: 'number', isOptional: true },
                { name: 'margin_contribution', type: 'number', isOptional: true },
                { name: 'maximum_loan', type: 'number', isOptional: true },
                { name: 'recommended_loan', type: 'number', isOptional: true },
                { name: 'annual_interest_rate', type: 'number', isOptional: true },
                { name: 'total_tenure_months', type: 'number', isOptional: true },
                { name: 'moratorium_months', type: 'number' },
                { name: 'active_repayment_months', type: 'number', isOptional: true },
                { name: 'capitalized_principal', type: 'number', isOptional: true },
                { name: 'emi', type: 'number', isOptional: true },
                { name: 'total_interest', type: 'number', isOptional: true },
                { name: 'debt_affordability_status', type: 'string' },
                { name: 'debt_service_burden', type: 'number' },
                { name: 'working_capital_requirement', type: 'number', isOptional: true },
                { name: 'calculation_version', type: 'number' },
                { name: 'policy_version', type: 'string', isOptional: true },
                { name: 'engine_version', type: 'string', isOptional: true },
                { name: 'input_hash', type: 'string', isOptional: true },
                { name: 'scheme_rule_version', type: 'number', isOptional: true }, // P1
                { name: 'scheme_last_verified_at', type: 'number', isOptional: true }, // P1
                { name: 'created_at', type: 'number' },
                { name: 'server_revision', type: 'number', isOptional: true },
            ],
        }),

        // ─── Evidence & Decisions ──────────────────────────────────

        tableSchema({
            name: 'evidence',
            columns: [
                // Legacy fields (kept for migration compatibility)
                { name: 'business_id', type: 'string', isIndexed: true },
                { name: 'evidence_type', type: 'string', isOptional: true },
                { name: 'source', type: 'string', isOptional: true },
                { name: 'description', type: 'string', isOptional: true },
                { name: 'value', type: 'number', isOptional: true },
                { name: 'confidence', type: 'number', isOptional: true },
                { name: 'is_observed', type: 'boolean', isOptional: true },
                { name: 'is_estimated', type: 'boolean', isOptional: true },
                // P2 Canonical provenance fields
                { name: 'source_type', type: 'string', isOptional: true },
                { name: 'provider_id', type: 'string', isOptional: true },
                { name: 'provider_record_id', type: 'string', isOptional: true },
                { name: 'source_name', type: 'string', isOptional: true },
                { name: 'source_url', type: 'string', isOptional: true },
                { name: 'metric_name', type: 'string', isOptional: true },
                { name: 'numeric_value', type: 'string', isOptional: true }, // Decimal as string
                { name: 'text_value', type: 'string', isOptional: true },
                { name: 'boolean_value', type: 'boolean', isOptional: true },
                { name: 'observation_date', type: 'number', isOptional: true },
                { name: 'reference_period_start', type: 'number', isOptional: true },
                { name: 'reference_period_end', type: 'number', isOptional: true },
                { name: 'retrieved_at', type: 'number', isOptional: true },
                { name: 'state', type: 'string', isOptional: true },
                { name: 'district', type: 'string', isOptional: true },
                { name: 'commodity', type: 'string', isOptional: true },
                { name: 'market_id', type: 'string', isOptional: true },
                { name: 'market_name', type: 'string', isOptional: true },
                { name: 'price_type', type: 'string', isOptional: true },
                { name: 'currency', type: 'string', isOptional: true },
                { name: 'quantity_unit', type: 'string', isOptional: true },
                { name: 'content_hash', type: 'string', isOptional: true },
                { name: 'derivation_type', type: 'string', isOptional: true },
                { name: 'derivation_version', type: 'string', isOptional: true },
                { name: 'parent_evidence_ids', type: 'string', isOptional: true }, // JSON string
                { name: 'created_at', type: 'number' },
                { name: 'server_revision', type: 'number', isOptional: true },
            ],
        }),

        tableSchema({
            name: 'decisions',
            columns: [
                { name: 'business_id', type: 'string', isIndexed: true },
                { name: 'decision', type: 'string' }, // GO, MODIFY, DO_NOT_INVEST_YET
                { name: 'rationale', type: 'string' },
                { name: 'confidence', type: 'number', isOptional: true },
                { name: 'evidence_summary', type: 'string', isOptional: true }, // JSON string
                { name: 'assumptions_summary', type: 'string', isOptional: true }, // JSON string
                { name: 'financial_risk_summary', type: 'string', isOptional: true }, // JSON string
                { name: 'created_at', type: 'number' },
                { name: 'server_revision', type: 'number', isOptional: true },
            ],
        }),

        // ─── Legacy (for backward compatibility during migration) ───

        tableSchema({
            name: 'profiles',
            columns: [
                { name: 'capital', type: 'number' },
                { name: 'city_key', type: 'string' },
                { name: 'business_type_key', type: 'string' },
                { name: 'city_name', type: 'string' },
                { name: 'business_label', type: 'string' },
                { name: 'tier', type: 'string' },
                { name: 'created_at', type: 'number' },
                { name: 'server_revision', type: 'number', isOptional: true },
            ],
        }),

        tableSchema({
            name: 'interactions',
            columns: [
                { name: 'profile_id', type: 'string', isIndexed: true },
                { name: 'slider_name', type: 'string' },
                { name: 'slider_value', type: 'number' },
                { name: 'timestamp', type: 'number' },
            ],
        }),
    ],
});
