from decimal import Decimal
from datetime import date
from sqlalchemy import select
from app.models.location import Location
from app.models.user import User
from app.models.business import Business
from app.models.scheme import Scheme, SchemeRule
from app.models.market_data import MarketData
from app.models.evidence import Evidence


def test_user_creation_and_retrieval(db_session):
    """Test user creation, foreign key, and querying."""
    loc = Location(
        state="Maharashtra",
        district="Latur",
        village_or_city="Ausa",
        latitude=Decimal("18.2467"),
        longitude=Decimal("76.5025"),
    )
    db_session.add(loc)
    db_session.commit()

    user = User(
        name="Sunita Shinde",
        phone="+919812345678",
        location_id=loc.id,
        available_capital=Decimal("40000.00"),
        skills=["organic_farming", "poultry"],
        family_workforce=3,
        risk_tolerance="MODERATE",
    )
    db_session.add(user)
    db_session.commit()

    retrieved = db_session.get(User, user.id)
    assert retrieved is not None
    assert retrieved.name == "Sunita Shinde"
    assert retrieved.available_capital == Decimal("40000.00")
    assert retrieved.location.state == "Maharashtra"


def test_business_and_relationships(db_session, sample_business):
    """Test business entity with child models cascading."""
    biz = sample_business["business"]
    
    # Add market data
    md = MarketData(
        location_id=sample_business["location"].id,
        business_id=biz.id,
        data_type="COMPETITOR_DENSITY",
        source="Field Verification",
        value=Decimal("2.5000"),
        unit="shops/km",
        is_observed=True,
        is_estimated=False,
    )
    db_session.add(md)

    # Add evidence
    ev = Evidence(
        business_id=biz.id,
        evidence_type="MARKET",
        source="Interviews",
        description="Local market daily consumption approx 400L",
        value=Decimal("400.00"),
        is_observed=True,
    )
    db_session.add(ev)
    db_session.commit()

    # Query business and check relationships
    queried_biz = db_session.get(Business, biz.id)
    assert len(queried_biz.assumptions) >= 1
    assert len(queried_biz.market_data) == 1
    assert len(queried_biz.evidence) == 1
    assert queried_biz.market_data[0].is_observed is True


def test_scheme_and_scheme_rules(db_session, seeded_schemes):
    """Test scheme configuration and rule queries."""
    schemes = db_session.scalars(select(Scheme)).all()
    assert len(schemes) == 2

    micro_scheme = db_session.query(Scheme).filter_by(scheme_name="Micro Finance Scheme").first()
    assert micro_scheme is not None
    assert len(micro_scheme.rules) == 1
    rule = micro_scheme.rules[0]
    assert rule.max_project_cost == Decimal("140000.00")
    assert rule.max_loan_amount == Decimal("125000.00")
    assert rule.annual_interest_rate == Decimal("6.50")
    assert rule.tenure_months == 36
    assert rule.moratorium_months == 3
