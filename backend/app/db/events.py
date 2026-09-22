import logging
from sqlalchemy import event, insert, select, func
from sqlalchemy.orm import Mapper, Session
from app.db.base import SyncableMixin, global_sync_sequence
from app.models.sync_changes import SyncChange

from sqlalchemy import event, insert, select, func, text

logger = logging.getLogger(__name__)

_sqlite_seq = 1000000

def _get_sequence_value(connection):
    """Retrieve the next value from the global sequence."""
    if connection.dialect.name == 'sqlite':
        global _sqlite_seq
        _sqlite_seq += 1
        return _sqlite_seq
    return connection.scalar(global_sync_sequence.next_value())

def record_sync_change(mapper: Mapper, connection, target, operation: str):
    """Record a change in the sync_changes table."""
    try:
        # Get sequence
        seq_val = _get_sequence_value(connection)
        
        # Update server_revision on target
        if hasattr(target, 'server_revision'):
            # In SQLAlchemy, changing properties during after_* events is tricky.
            # But we can update the table directly for the target.
            # Wait, modifying object state in after_insert requires another UPDATE.
            # It's better to use before_insert/before_update to set the property!
            pass
            
        # Insert sync_change record
        table_name = mapper.local_table.name
        record_id = getattr(target, 'id', None)
        
        if record_id:
            stmt = insert(SyncChange).values(
                sequence=seq_val,
                table_name=table_name,
                record_id=str(record_id),
                operation=operation,
                changed_at=func.now()
            )
            connection.execute(stmt)
            
    except Exception as e:
        logger.error(f"Error recording sync change for {target}: {e}", exc_info=True)
        raise

@event.listens_for(SyncableMixin, "before_insert", propagate=True)
def receive_before_insert(mapper, connection, target):
    seq_val = _get_sequence_value(connection)
    target.server_revision = seq_val
    # We can stash seq_val on target to use in after_insert
    target._sync_seq_val = seq_val

@event.listens_for(SyncableMixin, "after_insert", propagate=True)
def receive_after_insert(mapper, connection, target):
    seq_val = getattr(target, '_sync_seq_val', None)
    if not seq_val:
        seq_val = _get_sequence_value(connection)
    
    table_name = mapper.local_table.name
    record_id = getattr(target, 'id', None)
    if record_id:
        stmt = insert(SyncChange).values(
            sequence=seq_val,
            table_name=table_name,
            record_id=str(record_id),
            operation="CREATE",
            changed_at=func.now()
        )
        connection.execute(stmt)

@event.listens_for(SyncableMixin, "before_update", propagate=True)
def receive_before_update(mapper, connection, target):
    seq_val = _get_sequence_value(connection)
    target.server_revision = seq_val
    target._sync_seq_val = seq_val

@event.listens_for(SyncableMixin, "after_update", propagate=True)
def receive_after_update(mapper, connection, target):
    seq_val = getattr(target, '_sync_seq_val', None)
    if not seq_val:
        seq_val = _get_sequence_value(connection)
        
    table_name = mapper.local_table.name
    record_id = getattr(target, 'id', None)
    if record_id:
        stmt = insert(SyncChange).values(
            sequence=seq_val,
            table_name=table_name,
            record_id=str(record_id),
            operation="UPDATE",
            changed_at=func.now()
        )
        connection.execute(stmt)

@event.listens_for(SyncableMixin, "after_delete", propagate=True)
def receive_after_delete(mapper, connection, target):
    seq_val = _get_sequence_value(connection)
    table_name = mapper.local_table.name
    record_id = getattr(target, 'id', None)
    if record_id:
        stmt = insert(SyncChange).values(
            sequence=seq_val,
            table_name=table_name,
            record_id=str(record_id),
            operation="DELETE",
            changed_at=func.now()
        )
        connection.execute(stmt)
