import pytest
import sys
from pathlib import Path
from decimal import Decimal
from datetime import date
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

# Add backend directory to sys.path
backend_path = str(Path(__file__).resolve().parent.parent)
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.location import Location
from app.models.user import User
from app.models.business import Business
from app.models.scheme import Scheme, SchemeRule
from app.models.business_assumption import BusinessAssumption

# SQLite in-memory engine with StaticPool to ensure shared connection & tables
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


@event.listens_for(test_engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="function")
def db_session():
    """Create fresh in-memory database tables for each test."""
    Base.metadata.create_all(bind=test_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(scope="function")
def client(db_session):
    """Test client with overridden get_db dependency."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def seeded_schemes(db_session):
    """Seed standard Micro Finance and Term Loan schemes into test db."""
    micro = Scheme(
        scheme_name="Micro Finance Scheme",
        scheme_type="MICRO_FINANCE",
        description="Micro enterprise loan facility",
        active=True,
    )
    db_session.add(micro)
    db_session.flush()

    micro_rule = SchemeRule(
        scheme_id=micro.id,
        min_project_cost=Decimal("0.00"),
        max_project_cost=Decimal("140000.00"),
        financing_percentage=Decimal("90.00"),
        max_loan_amount=Decimal("125000.00"),
        annual_interest_rate=Decimal("6.50"),
        tenure_months=36,
        moratorium_months=3,
        effective_from=date(2024, 1, 1),
        active=True,
    )
    db_session.add(micro_rule)

    term = Scheme(
        scheme_name="Term Loan Scheme",
        scheme_type="TERM_LOAN",
        description="Term loan facility",
        active=True,
    )
    db_session.add(term)
    db_session.flush()

    term_rule = SchemeRule(
        scheme_id=term.id,
        min_project_cost=Decimal("140000.01"),
        max_project_cost=Decimal("5000000.00"),
        financing_percentage=Decimal("90.00"),
        max_loan_amount=Decimal("4500000.00"),
        annual_interest_rate=Decimal("8.00"),
        tenure_months=84,
        moratorium_months=6,
        effective_from=date(2024, 1, 1),
        active=True,
    )
    db_session.add(term_rule)
    db_session.commit()
    return {"micro": micro, "micro_rule": micro_rule, "term": term, "term_rule": term_rule}


@pytest.fixture(scope="function")
def sample_business(db_session, seeded_schemes):
    """Create a sample user and business for testing."""
    loc = Location(
        state="Maharashtra",
        district="Latur",
        block="Ausa",
        village_or_city="Ausa",
    )
    db_session.add(loc)
    db_session.flush()

    user = User(
        name="Ramesh Patil",
        phone="+919876543210",
        location_id=loc.id,
        available_capital=Decimal("25000.00"),
    )
    db_session.add(user)
    db_session.flush()

    biz = Business(
        user_id=user.id,
        location_id=loc.id,
        business_name="Samruddhi Dairy Enterprise",
        business_category="Dairy",
    )
    db_session.add(biz)
    db_session.flush()

    assumptions = BusinessAssumption(
        business_id=biz.id,
        expected_customers=35,
        selling_price=Decimal("55.00"),
        production_volume=Decimal("80.00"),
        raw_material_cost=Decimal("34.00"),
        labour_cost=Decimal("4000.00"),
        rent=Decimal("1500.00"),
        transport_cost=Decimal("1800.00"),
        working_capital=Decimal("15000.00"),
        proposed_loan_amount=Decimal("120000.00"),
    )
    db_session.add(assumptions)
    db_session.commit()
    return {"location": loc, "user": user, "business": biz, "assumptions": assumptions}
