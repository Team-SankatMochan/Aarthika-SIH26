from decimal import Decimal
import pytest
from app.services.finance_service import assess_business_finance
from app.schemas.finance_assessment import FinanceAssessmentRequest

def test_assess_business_finance(db_session, sample_business, seeded_schemes):
    biz_id = sample_business["business"].id
    
    # Real inputs
    req = FinanceAssessmentRequest(
        scheme_id=seeded_schemes["micro"].id,
        monthly_units_sold=Decimal("100"),
        selling_price_per_unit=Decimal("500"),
        variable_cost_per_unit=Decimal("200"),
        monthly_rent=Decimal("5000"),
        monthly_labour_cost=Decimal("2000"),
        requested_loan_amount=Decimal("100000"),
        monthly_household_nonbusiness_income=Decimal("20000"),
        monthly_household_essential_expenses=Decimal("5000"),
        existing_monthly_household_debt_payments=Decimal("1000")
    )
    
    assessment = assess_business_finance(biz_id, req, db_session)
    
    # Assertions
    assert assessment.monthly_revenue == Decimal("50000.00")
    assert assessment.monthly_variable_cost == Decimal("20000.00")
    assert assessment.monthly_fixed_cost == Decimal("7300.00")
    assert assessment.monthly_business_surplus == Decimal("22700.00")
    assert assessment.capitalized_principal is not None
    assert assessment.emi is not None
    assert assessment.business_dscr is not None
    assert assessment.affordable_loan_amount is not None
    assert assessment.recommended_loan is not None
    assert assessment.household_existing_debt_ratio == Decimal("0.05")
