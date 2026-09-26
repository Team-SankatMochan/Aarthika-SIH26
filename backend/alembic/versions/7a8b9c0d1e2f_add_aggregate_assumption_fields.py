"""Add aggregate assumption fields

Revision ID: 7a8b9c0d1e2f
Revises: 669388b27543
Create Date: 2026-09-27 03:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7a8b9c0d1e2f'
down_revision: Union[str, None] = '669388b27543'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = {c['name'] for c in inspector.get_columns('business_assumptions')}

    if 'monthly_fixed_cost' not in cols:
        op.add_column('business_assumptions', sa.Column('monthly_fixed_cost', sa.Numeric(precision=14, scale=2), nullable=True))
    if 'available_margin_capital' not in cols:
        op.add_column('business_assumptions', sa.Column('available_margin_capital', sa.Numeric(precision=14, scale=2), nullable=True))
    if 'project_cost' not in cols:
        op.add_column('business_assumptions', sa.Column('project_cost', sa.Numeric(precision=14, scale=2), nullable=True))


def downgrade() -> None:
    op.drop_column('business_assumptions', 'project_cost')
    op.drop_column('business_assumptions', 'available_margin_capital')
    op.drop_column('business_assumptions', 'monthly_fixed_cost')
