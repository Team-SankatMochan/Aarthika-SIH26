"""Add canonical finance fields

Revision ID: 4301e3d279b2
Revises: 0001_initial_phase2_schema
Create Date: 2026-09-22 19:20:41.412976

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4301e3d279b2'
down_revision: Union[str, None] = '0001_initial_phase2_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # business_assumptions
    op.add_column('business_assumptions', sa.Column('monthly_units_sold', sa.Numeric(precision=14, scale=2), nullable=True))
    op.add_column('business_assumptions', sa.Column('unit_of_measure', sa.String(length=50), nullable=True))
    op.add_column('business_assumptions', sa.Column('selling_price_per_unit', sa.Numeric(precision=14, scale=2), nullable=True))
    op.add_column('business_assumptions', sa.Column('variable_cost_per_unit', sa.Numeric(precision=14, scale=2), nullable=True))
    op.add_column('business_assumptions', sa.Column('monthly_labour_cost', sa.Numeric(precision=14, scale=2), nullable=True))
    op.add_column('business_assumptions', sa.Column('monthly_rent', sa.Numeric(precision=14, scale=2), nullable=True))
    op.add_column('business_assumptions', sa.Column('monthly_transport_cost', sa.Numeric(precision=14, scale=2), nullable=True))
    op.add_column('business_assumptions', sa.Column('monthly_other_fixed_cost', sa.Numeric(precision=14, scale=2), nullable=True))
    op.add_column('business_assumptions', sa.Column('requested_loan_amount', sa.Numeric(precision=14, scale=2), nullable=True))
    op.add_column('business_assumptions', sa.Column('working_capital_required', sa.Numeric(precision=14, scale=2), nullable=True))
    
    op.add_column('business_assumptions', sa.Column('monthly_household_nonbusiness_income', sa.Numeric(precision=14, scale=2), nullable=True))
    op.add_column('business_assumptions', sa.Column('monthly_household_essential_expenses', sa.Numeric(precision=14, scale=2), nullable=True))
    op.add_column('business_assumptions', sa.Column('existing_monthly_household_debt_payments', sa.Numeric(precision=14, scale=2), nullable=True))

    # finance_assessments
    op.add_column('finance_assessments', sa.Column('monthly_revenue', sa.Numeric(precision=14, scale=2), nullable=True))
    op.add_column('finance_assessments', sa.Column('monthly_variable_cost', sa.Numeric(precision=14, scale=2), nullable=True))
    op.add_column('finance_assessments', sa.Column('monthly_fixed_cost', sa.Numeric(precision=14, scale=2), nullable=True))
    op.add_column('finance_assessments', sa.Column('monthly_business_surplus', sa.Numeric(precision=14, scale=2), nullable=True))
    
    op.add_column('finance_assessments', sa.Column('maximum_scheme_loan_amount', sa.Numeric(precision=14, scale=2), nullable=True))
    op.add_column('finance_assessments', sa.Column('affordable_loan_amount', sa.Numeric(precision=14, scale=2), nullable=True))
    
    op.add_column('finance_assessments', sa.Column('business_dscr', sa.Numeric(precision=14, scale=2), nullable=True))
    op.add_column('finance_assessments', sa.Column('household_existing_debt_ratio', sa.Numeric(precision=14, scale=2), nullable=True))
    op.add_column('finance_assessments', sa.Column('household_buffer_ratio', sa.Numeric(precision=14, scale=2), nullable=True))
    op.add_column('finance_assessments', sa.Column('break_even_units', sa.Integer(), nullable=True))
    
    op.add_column('finance_assessments', sa.Column('policy_version', sa.Integer(), server_default='1', nullable=False))
    op.add_column('finance_assessments', sa.Column('input_hash', sa.String(length=64), nullable=True))

def downgrade() -> None:
    # finance_assessments
    op.drop_column('finance_assessments', 'input_hash')
    op.drop_column('finance_assessments', 'policy_version')
    op.drop_column('finance_assessments', 'break_even_units')
    op.drop_column('finance_assessments', 'household_buffer_ratio')
    op.drop_column('finance_assessments', 'household_existing_debt_ratio')
    op.drop_column('finance_assessments', 'business_dscr')
    op.drop_column('finance_assessments', 'affordable_loan_amount')
    op.drop_column('finance_assessments', 'maximum_scheme_loan_amount')
    op.drop_column('finance_assessments', 'monthly_business_surplus')
    op.drop_column('finance_assessments', 'monthly_fixed_cost')
    op.drop_column('finance_assessments', 'monthly_variable_cost')
    op.drop_column('finance_assessments', 'monthly_revenue')

    # business_assumptions
    op.drop_column('business_assumptions', 'existing_monthly_household_debt_payments')
    op.drop_column('business_assumptions', 'monthly_household_essential_expenses')
    op.drop_column('business_assumptions', 'monthly_household_nonbusiness_income')
    op.drop_column('business_assumptions', 'working_capital_required')
    op.drop_column('business_assumptions', 'requested_loan_amount')
    op.drop_column('business_assumptions', 'monthly_other_fixed_cost')
    op.drop_column('business_assumptions', 'monthly_transport_cost')
    op.drop_column('business_assumptions', 'monthly_rent')
    op.drop_column('business_assumptions', 'monthly_labour_cost')
    op.drop_column('business_assumptions', 'variable_cost_per_unit')
    op.drop_column('business_assumptions', 'selling_price_per_unit')
    op.drop_column('business_assumptions', 'unit_of_measure')
    op.drop_column('business_assumptions', 'monthly_units_sold')
