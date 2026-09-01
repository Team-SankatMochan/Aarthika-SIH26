"""Initial Phase 2 schema for ArthSetu / Vyapar Crash Test

Revision ID: 0001_initial_phase2_schema
Revises: 
Create Date: 2026-08-29 16:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0001_initial_phase2_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Locations Table
    op.create_table(
        'locations',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('state', sa.String(length=100), nullable=False),
        sa.Column('district', sa.String(length=100), nullable=False),
        sa.Column('block', sa.String(length=100), nullable=True),
        sa.Column('village_or_city', sa.String(length=100), nullable=False),
        sa.Column('latitude', sa.Numeric(precision=10, scale=7), nullable=True),
        sa.Column('longitude', sa.Numeric(precision=10, scale=7), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_locations_district', 'locations', ['district'])
    op.create_index('ix_locations_state', 'locations', ['state'])
    op.create_index('ix_locations_state_district', 'locations', ['state', 'district'])
    op.create_index('ix_locations_village_or_city', 'locations', ['village_or_city'])

    # 2. Users Table
    op.create_table(
        'users',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('phone', sa.String(length=20), nullable=True),
        sa.Column('location_id', sa.String(length=64), nullable=True),
        sa.Column('available_capital', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('skills', sa.JSON(), nullable=True),
        sa.Column('experience', sa.String(length=255), nullable=True),
        sa.Column('assets', sa.JSON(), nullable=True),
        sa.Column('family_workforce', sa.Integer(), nullable=False),
        sa.Column('preferences', sa.JSON(), nullable=True),
        sa.Column('risk_tolerance', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['location_id'], ['locations.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_users_name', 'users', ['name'])
    op.create_index('ix_users_phone', 'users', ['phone'])
    op.create_index('ix_users_location_id', 'users', ['location_id'])

    # 3. Businesses Table
    op.create_table(
        'businesses',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('user_id', sa.String(length=64), nullable=False),
        sa.Column('location_id', sa.String(length=64), nullable=True),
        sa.Column('business_name', sa.String(length=200), nullable=False),
        sa.Column('business_category', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['location_id'], ['locations.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_businesses_business_category', 'businesses', ['business_category'])
    op.create_index('ix_businesses_business_name', 'businesses', ['business_name'])
    op.create_index('ix_businesses_location_id', 'businesses', ['location_id'])
    op.create_index('ix_businesses_status', 'businesses', ['status'])
    op.create_index('ix_businesses_user_category', 'businesses', ['user_id', 'business_category'])
    op.create_index('ix_businesses_user_id', 'businesses', ['user_id'])

    # 4. Schemes Table
    op.create_table(
        'schemes',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('scheme_name', sa.String(length=200), nullable=False),
        sa.Column('scheme_type', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('scheme_name')
    )
    op.create_index('ix_schemes_scheme_name', 'schemes', ['scheme_name'])
    op.create_index('ix_schemes_scheme_type', 'schemes', ['scheme_type'])

    # 5. Scheme Rules Table
    op.create_table(
        'scheme_rules',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('scheme_id', sa.String(length=64), nullable=False),
        sa.Column('min_project_cost', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('max_project_cost', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('financing_percentage', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('max_loan_amount', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('annual_interest_rate', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('tenure_months', sa.Integer(), nullable=False),
        sa.Column('moratorium_months', sa.Integer(), nullable=False),
        sa.Column('effective_from', sa.Date(), nullable=True),
        sa.Column('effective_to', sa.Date(), nullable=True),
        sa.Column('active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['scheme_id'], ['schemes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_scheme_rules_cost_range', 'scheme_rules', ['scheme_id', 'min_project_cost', 'max_project_cost'])
    op.create_index('ix_scheme_rules_scheme_id', 'scheme_rules', ['scheme_id'])

    # 6. Market Data Table
    op.create_table(
        'market_data',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('location_id', sa.String(length=64), nullable=False),
        sa.Column('business_id', sa.String(length=64), nullable=True),
        sa.Column('data_type', sa.String(length=100), nullable=False),
        sa.Column('source', sa.String(length=150), nullable=False),
        sa.Column('value', sa.Numeric(precision=14, scale=4), nullable=False),
        sa.Column('unit', sa.String(length=50), nullable=False),
        sa.Column('observation_date', sa.Date(), nullable=True),
        sa.Column('confidence', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('is_observed', sa.Boolean(), nullable=False),
        sa.Column('is_estimated', sa.Boolean(), nullable=False),
        sa.Column('metadata_json', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint('(is_observed = true AND is_estimated = false) OR (is_observed = false AND is_estimated = true) OR (is_observed = true AND is_estimated = true)', name='check_observed_estimated_validity'),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['location_id'], ['locations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_market_data_business_id', 'market_data', ['business_id'])
    op.create_index('ix_market_data_data_type', 'market_data', ['data_type'])
    op.create_index('ix_market_data_loc_type', 'market_data', ['location_id', 'data_type'])
    op.create_index('ix_market_data_location_id', 'market_data', ['location_id'])

    # 7. Business Assumptions Table
    op.create_table(
        'business_assumptions',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('business_id', sa.String(length=64), nullable=False),
        sa.Column('expected_customers', sa.Integer(), nullable=False),
        sa.Column('selling_price', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('production_volume', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('raw_material_cost', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('labour_cost', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('rent', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('transport_cost', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('working_capital', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('proposed_loan_amount', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('other_operating_cost', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('assumption_source', sa.String(length=100), nullable=False),
        sa.Column('confidence', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_business_assumptions_biz_created', 'business_assumptions', ['business_id', 'created_at'])
    op.create_index('ix_business_assumptions_business_id', 'business_assumptions', ['business_id'])

    # 8. Stress Tests Table
    op.create_table(
        'stress_tests',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('business_id', sa.String(length=64), nullable=False),
        sa.Column('base_assumption_id', sa.String(length=64), nullable=True),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['base_assumption_id'], ['business_assumptions.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_stress_tests_base_assumption_id', 'stress_tests', ['base_assumption_id'])
    op.create_index('ix_stress_tests_business_id', 'stress_tests', ['business_id'])

    # 9. Stress Test Scenarios Table
    op.create_table(
        'stress_test_scenarios',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('stress_test_id', sa.String(length=64), nullable=False),
        sa.Column('scenario_type', sa.String(length=100), nullable=False),
        sa.Column('parameter_name', sa.String(length=100), nullable=False),
        sa.Column('change_percentage', sa.Numeric(precision=6, scale=2), nullable=True),
        sa.Column('change_absolute', sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column('revenue', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('operating_cost', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('cash_surplus', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('debt_repayment_burden', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('working_capital_pressure', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('break_even', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('resilience_score', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('result_status', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['stress_test_id'], ['stress_tests.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_stress_scenarios_test_type', 'stress_test_scenarios', ['stress_test_id', 'scenario_type'])
    op.create_index('ix_stress_test_scenarios_result_status', 'stress_test_scenarios', ['result_status'])
    op.create_index('ix_stress_test_scenarios_scenario_type', 'stress_test_scenarios', ['scenario_type'])
    op.create_index('ix_stress_test_scenarios_stress_test_id', 'stress_test_scenarios', ['stress_test_id'])

    # 10. Pilots Table
    op.create_table(
        'pilots',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('business_id', sa.String(length=64), nullable=False),
        sa.Column('objective', sa.Text(), nullable=False),
        sa.Column('hypothesis', sa.Text(), nullable=False),
        sa.Column('duration_days', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_pilots_business_id', 'pilots', ['business_id'])
    op.create_index('ix_pilots_status', 'pilots', ['status'])

    # 11. Pilot Results Table
    op.create_table(
        'pilot_results',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('pilot_id', sa.String(length=64), nullable=False),
        sa.Column('target_customers', sa.Integer(), nullable=False),
        sa.Column('actual_customers', sa.Integer(), nullable=False),
        sa.Column('repeat_purchase_rate', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('price_acceptance', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('delivery_cost', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('conversion_rate', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('actual_revenue', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('actual_cost', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('customer_feedback', sa.Text(), nullable=True),
        sa.Column('observations', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['pilot_id'], ['pilots.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_pilot_results_pilot_id', 'pilot_results', ['pilot_id'])

    # 12. Finance Assessments Table
    op.create_table(
        'finance_assessments',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('business_id', sa.String(length=64), nullable=False),
        sa.Column('scheme_id', sa.String(length=64), nullable=True),
        sa.Column('scheme_rule_id', sa.String(length=64), nullable=True),
        sa.Column('project_cost', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('margin_contribution', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('maximum_loan', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('recommended_loan', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('annual_interest_rate', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('total_tenure_months', sa.Integer(), nullable=False),
        sa.Column('moratorium_months', sa.Integer(), nullable=False),
        sa.Column('active_repayment_months', sa.Integer(), nullable=False),
        sa.Column('capitalized_principal', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('emi', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('total_interest', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('debt_affordability_status', sa.String(length=50), nullable=False),
        sa.Column('debt_service_burden', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('working_capital_requirement', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('calculation_version', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['scheme_id'], ['schemes.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['scheme_rule_id'], ['scheme_rules.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_finance_assessments_biz_version', 'finance_assessments', ['business_id', 'calculation_version'])
    op.create_index('ix_finance_assessments_business_id', 'finance_assessments', ['business_id'])
    op.create_index('ix_finance_assessments_debt_affordability_status', 'finance_assessments', ['debt_affordability_status'])
    op.create_index('ix_finance_assessments_scheme_id', 'finance_assessments', ['scheme_id'])
    op.create_index('ix_finance_assessments_scheme_rule_id', 'finance_assessments', ['scheme_rule_id'])

    # 13. Evidence Table
    op.create_table(
        'evidence',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('business_id', sa.String(length=64), nullable=False),
        sa.Column('evidence_type', sa.String(length=50), nullable=False),
        sa.Column('source', sa.String(length=150), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('value', sa.Numeric(precision=14, scale=4), nullable=True),
        sa.Column('confidence', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('is_observed', sa.Boolean(), nullable=False),
        sa.Column('is_estimated', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_evidence_biz_type', 'evidence', ['business_id', 'evidence_type'])
    op.create_index('ix_evidence_business_id', 'evidence', ['business_id'])
    op.create_index('ix_evidence_evidence_type', 'evidence', ['evidence_type'])

    # 14. Decisions Table
    op.create_table(
        'decisions',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('business_id', sa.String(length=64), nullable=False),
        sa.Column('decision', sa.String(length=50), nullable=False),
        sa.Column('rationale', sa.Text(), nullable=False),
        sa.Column('confidence', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('evidence_summary', sa.JSON(), nullable=True),
        sa.Column('assumptions_summary', sa.JSON(), nullable=True),
        sa.Column('financial_risk_summary', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_decisions_biz_created', 'decisions', ['business_id', 'created_at'])
    op.create_index('ix_decisions_business_id', 'decisions', ['business_id'])
    op.create_index('ix_decisions_decision', 'decisions', ['decision'])

    # 15. Sync Records Table
    op.create_table(
        'sync_records',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('client_id', sa.String(length=64), nullable=True),
        sa.Column('entity_type', sa.String(length=64), nullable=False),
        sa.Column('entity_id', sa.String(length=64), nullable=False),
        sa.Column('operation', sa.String(length=20), nullable=False),
        sa.Column('client_timestamp', sa.BigInteger(), nullable=True),
        sa.Column('server_timestamp', sa.BigInteger(), nullable=False),
        sa.Column('sync_status', sa.String(length=30), nullable=False),
        sa.Column('payload_hash', sa.String(length=64), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_sync_records_client_id', 'sync_records', ['client_id'])
    op.create_index('ix_sync_records_entity_id', 'sync_records', ['entity_id'])
    op.create_index('ix_sync_records_entity_op', 'sync_records', ['entity_type', 'entity_id', 'operation'])
    op.create_index('ix_sync_records_entity_type', 'sync_records', ['entity_type'])
    op.create_index('ix_sync_records_payload_hash', 'sync_records', ['payload_hash'])
    op.create_index('ix_sync_records_server_time', 'sync_records', ['server_timestamp'])
    op.create_index('ix_sync_records_server_timestamp', 'sync_records', ['server_timestamp'])


def downgrade() -> None:
    op.drop_table('sync_records')
    op.drop_table('decisions')
    op.drop_table('evidence')
    op.drop_table('finance_assessments')
    op.drop_table('pilot_results')
    op.drop_table('pilots')
    op.drop_table('stress_test_scenarios')
    op.drop_table('stress_tests')
    op.drop_table('business_assumptions')
    op.drop_table('market_data')
    op.drop_table('scheme_rules')
    op.drop_table('schemes')
    op.drop_table('businesses')
    op.drop_table('users')
    op.drop_table('locations')
