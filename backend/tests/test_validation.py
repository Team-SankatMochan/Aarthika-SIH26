import pytest
from decimal import Decimal
from pydantic import ValidationError
from app.schemas.location import LocationCreate
from app.schemas.user import UserCreate
from app.schemas.business_assumption import BusinessAssumptionCreate
from app.schemas.scheme import SchemeRuleCreate
from app.schemas.finance_assessment import FinanceAssessmentRequest
from app.schemas.market_data import MarketDataCreate


def test_invalid_location_coordinates():
    """Verify latitude [-90, 90] and longitude [-180, 180] constraints."""
    # Invalid latitude
    with pytest.raises(ValidationError):
        LocationCreate(
            state="Maharashtra",
            district="Latur",
            village_or_city="Ausa",
            latitude=Decimal("95.0000"),  # > 90
            longitude=Decimal("76.5000"),
        )

    # Invalid longitude
    with pytest.raises(ValidationError):
        LocationCreate(
            state="Maharashtra",
            district="Latur",
            village_or_city="Ausa",
            latitude=Decimal("18.0000"),
            longitude=Decimal("200.0000"),  # > 180
        )


def test_invalid_user_capital_and_workforce():
    """Verify negative capital or workforce rejected."""
    with pytest.raises(ValidationError):
        UserCreate(
            name="Ramesh",
            available_capital=Decimal("-1000.00"),  # Negative capital
        )

    with pytest.raises(ValidationError):
        UserCreate(
            name="Ramesh",
            family_workforce=-2,  # Negative workforce
        )


def test_invalid_scheme_rule_tenure_and_moratorium():
    """Verify moratorium < tenure and interest rate constraints."""
    # Moratorium >= Tenure
    with pytest.raises(ValidationError):
        SchemeRuleCreate(
            min_project_cost=Decimal("0"),
            max_project_cost=Decimal("140000"),
            financing_percentage=Decimal("90"),
            max_loan_amount=Decimal("125000"),
            annual_interest_rate=Decimal("6.5"),
            tenure_months=12,
            moratorium_months=15,  # Moratorium > Tenure
        )

    # Negative max project cost
    with pytest.raises(ValidationError):
        SchemeRuleCreate(
            min_project_cost=Decimal("0"),
            max_project_cost=Decimal("-50000"),
            financing_percentage=Decimal("90"),
            max_loan_amount=Decimal("125000"),
            annual_interest_rate=Decimal("6.5"),
            tenure_months=36,
            moratorium_months=3,
        )


def test_invalid_business_assumptions():
    """Verify negative cost or customer assumptions rejected."""
    with pytest.raises(ValidationError):
        BusinessAssumptionCreate(
            business_id="biz_1",
            expected_customers=-5,  # Negative customers
            selling_price=Decimal("50"),
            production_volume=Decimal("100"),
            raw_material_cost=Decimal("30"),
        )


def test_finance_assessment_request_validation():
    """Verify finance assessment rejects missing or negative values."""
    # Neither cost nor margin provided
    with pytest.raises(ValidationError):
        FinanceAssessmentRequest()

    # Negative project cost
    with pytest.raises(ValidationError):
        FinanceAssessmentRequest(project_cost=Decimal("-10000"))


def test_market_data_observed_estimated_validation():
    """Verify market data enforces is_observed or is_estimated distinction."""
    with pytest.raises(ValidationError):
        MarketDataCreate(
            location_id="loc_1",
            data_type="PRICE",
            source="Survey",
            value=Decimal("50"),
            unit="INR",
            is_observed=False,
            is_estimated=False,  # Both false is invalid
        )
