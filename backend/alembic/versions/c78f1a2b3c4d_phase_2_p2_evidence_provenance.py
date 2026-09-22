"""Phase 2 P2 evidence provenance

Revision ID: c78f1a2b3c4d
Revises: 2aa7bd5ebb52
Create Date: 2026-09-23 01:33:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'c78f1a2b3c4d'
down_revision: Union[str, None] = '2aa7bd5ebb52'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add canonical evidence columns
    op.add_column('evidence', sa.Column('provider_id', sa.String(length=100), nullable=True))
    op.add_column('evidence', sa.Column('provider_record_id', sa.String(length=100), nullable=True))
    op.add_column('evidence', sa.Column('source_type', sa.String(length=50), nullable=True))
    op.add_column('evidence', sa.Column('source_name', sa.String(length=300), nullable=True))
    op.add_column('evidence', sa.Column('source_url', sa.String(length=500), nullable=True))
    op.add_column('evidence', sa.Column('metric_name', sa.String(length=100), nullable=True))
    op.add_column('evidence', sa.Column('numeric_value', sa.Numeric(precision=14, scale=4), nullable=True))
    op.add_column('evidence', sa.Column('text_value', sa.Text(), nullable=True))
    op.add_column('evidence', sa.Column('boolean_value', sa.Boolean(), nullable=True))
    op.add_column('evidence', sa.Column('observation_date', sa.Date(), nullable=True))
    op.add_column('evidence', sa.Column('reference_period_start', sa.Date(), nullable=True))
    op.add_column('evidence', sa.Column('reference_period_end', sa.Date(), nullable=True))
    op.add_column('evidence', sa.Column('retrieved_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('evidence', sa.Column('provider_last_updated_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('evidence', sa.Column('state', sa.String(length=100), nullable=True))
    op.add_column('evidence', sa.Column('district', sa.String(length=100), nullable=True))
    op.add_column('evidence', sa.Column('commodity', sa.String(length=100), nullable=True))
    op.add_column('evidence', sa.Column('business_category', sa.String(length=100), nullable=True))
    op.add_column('evidence', sa.Column('market_id', sa.String(length=100), nullable=True))
    op.add_column('evidence', sa.Column('market_name', sa.String(length=200), nullable=True))
    op.add_column('evidence', sa.Column('price_type', sa.String(length=50), nullable=True))
    op.add_column('evidence', sa.Column('currency', sa.String(length=10), nullable=True, server_default='INR'))
    op.add_column('evidence', sa.Column('quantity_unit', sa.String(length=20), nullable=True))
    op.add_column('evidence', sa.Column('provider_original_unit', sa.String(length=50), nullable=True))
    op.add_column('evidence', sa.Column('content_hash', sa.String(length=64), nullable=True))
    op.add_column('evidence', sa.Column('derivation_type', sa.String(length=100), nullable=True))
    op.add_column('evidence', sa.Column('derivation_version', sa.String(length=50), nullable=True))
    op.add_column('evidence', sa.Column('parent_evidence_ids', sa.JSON(), nullable=True))
    op.add_column('evidence', sa.Column('raw_reference', sa.JSON(), nullable=True))

    # 2. Relax legacy constraints so new canonical records don't require legacy fields
    op.alter_column('evidence', 'business_id', existing_type=sa.String(length=64), nullable=True)
    op.alter_column('evidence', 'source', existing_type=sa.String(length=150), nullable=True)
    op.alter_column('evidence', 'description', existing_type=sa.Text(), nullable=True)
    op.alter_column('evidence', 'confidence', existing_type=sa.Numeric(precision=5, scale=2), nullable=True)
    op.alter_column('evidence', 'is_observed', existing_type=sa.Boolean(), nullable=True)
    op.alter_column('evidence', 'is_estimated', existing_type=sa.Boolean(), nullable=True)

    # 3. Data migration: Migrate existing legacy rows
    op.execute("UPDATE evidence SET source_type = 'LEGACY_UNKNOWN' WHERE source_type IS NULL")
    op.execute("UPDATE evidence SET numeric_value = value WHERE value IS NOT NULL AND numeric_value IS NULL")
    op.alter_column('evidence', 'source_type', existing_type=sa.String(length=50), nullable=False)

    # 4. Create indexes
    op.create_index(op.f('ix_evidence_content_hash'), 'evidence', ['content_hash'], unique=False)
    op.create_index(op.f('ix_evidence_provider_id'), 'evidence', ['provider_id'], unique=False)
    op.create_index(op.f('ix_evidence_source_type'), 'evidence', ['source_type'], unique=False)
    op.create_index(op.f('ix_evidence_state'), 'evidence', ['state'], unique=False)
    op.create_index(op.f('ix_evidence_district'), 'evidence', ['district'], unique=False)
    op.create_index(op.f('ix_evidence_commodity'), 'evidence', ['commodity'], unique=False)
    op.create_index(op.f('ix_evidence_market_id'), 'evidence', ['market_id'], unique=False)
    op.create_index('ix_evidence_cache_lookup', 'evidence', ['provider_id', 'evidence_type', 'commodity', 'state', 'district'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_evidence_cache_lookup', table_name='evidence')
    op.drop_index(op.f('ix_evidence_market_id'), table_name='evidence')
    op.drop_index(op.f('ix_evidence_commodity'), table_name='evidence')
    op.drop_index(op.f('ix_evidence_district'), table_name='evidence')
    op.drop_index(op.f('ix_evidence_state'), table_name='evidence')
    op.drop_index(op.f('ix_evidence_source_type'), table_name='evidence')
    op.drop_index(op.f('ix_evidence_provider_id'), table_name='evidence')
    op.drop_index(op.f('ix_evidence_content_hash'), table_name='evidence')

    op.alter_column('evidence', 'is_estimated', existing_type=sa.Boolean(), nullable=False)
    op.alter_column('evidence', 'is_observed', existing_type=sa.Boolean(), nullable=False)
    op.alter_column('evidence', 'confidence', existing_type=sa.Numeric(precision=5, scale=2), nullable=False)
    op.alter_column('evidence', 'description', existing_type=sa.Text(), nullable=False)
    op.alter_column('evidence', 'source', existing_type=sa.String(length=150), nullable=False)
    op.alter_column('evidence', 'business_id', existing_type=sa.String(length=64), nullable=False)

    op.drop_column('evidence', 'raw_reference')
    op.drop_column('evidence', 'parent_evidence_ids')
    op.drop_column('evidence', 'derivation_version')
    op.drop_column('evidence', 'derivation_type')
    op.drop_column('evidence', 'content_hash')
    op.drop_column('evidence', 'provider_original_unit')
    op.drop_column('evidence', 'quantity_unit')
    op.drop_column('evidence', 'currency')
    op.drop_column('evidence', 'price_type')
    op.drop_column('evidence', 'market_name')
    op.drop_column('evidence', 'market_id')
    op.drop_column('evidence', 'business_category')
    op.drop_column('evidence', 'commodity')
    op.drop_column('evidence', 'district')
    op.drop_column('evidence', 'state')
    op.drop_column('evidence', 'provider_last_updated_at')
    op.drop_column('evidence', 'retrieved_at')
    op.drop_column('evidence', 'reference_period_end')
    op.drop_column('evidence', 'reference_period_start')
    op.drop_column('evidence', 'observation_date')
    op.drop_column('evidence', 'boolean_value')
    op.drop_column('evidence', 'text_value')
    op.drop_column('evidence', 'numeric_value')
    op.drop_column('evidence', 'metric_name')
    op.drop_column('evidence', 'source_url')
    op.drop_column('evidence', 'source_name')
    op.drop_column('evidence', 'source_type')
    op.drop_column('evidence', 'provider_record_id')
    op.drop_column('evidence', 'provider_id')
