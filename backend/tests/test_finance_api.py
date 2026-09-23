import pytest
from app.main import app


@pytest.fixture
def seeded_business(client):
    user_payload = {
        "name": "Finance Tester",
        "phone": "+919998887776",
        "available_capital": 50000.00,
        "skills": ["tailoring"],
        "risk_tolerance": "MODERATE",
    }
    user_res = client.post("/users", json=user_payload)
    user_id = user_res.json()["id"]

    biz_payload = {
        "user_id": user_id,
        "business_name": "Test Finance Business",
        "business_category": "tailoring",
        "working_capital_needed": 10000.0,
    }
    biz_res = client.post("/businesses", json=biz_payload)
    return biz_res.json()["id"]


def test_finance_assessment_manual_mode(client, seeded_business):
    """Test manual mode calculation and persistence"""
    payload = {
        "financing_mode": "MANUAL",
        "project_cost": 100000.0,
        "monthly_units_sold": 100,
        "selling_price_per_unit": 500,
        "variable_cost_per_unit": 200,
        "monthly_other_fixed_cost": 10000,
        "requested_loan_amount": 50000.0,
        "monthly_household_nonbusiness_income": 20000,
        "monthly_household_essential_expenses": 10000,
        "existing_monthly_household_debt_payments": 2000,
        "annual_interest_rate_percent": 12.0,
        "repayment_tenure_months": 24,
        "moratorium_months": 0
    }
    
    response = client.post(f"/businesses/{seeded_business}/finance-assessment", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["business_id"] == seeded_business
    assert data["debt_affordability_status"] in ["READY_FOR_FINANCE_REVIEW", "HIGH_RISK"]
    assert data["capitalized_principal"] == "50000.00"
    assert data["annual_interest_rate"] == "12.00"
    assert data["total_tenure_months"] == 24
    
def test_finance_assessment_missing_working_capital_is_null(client, seeded_business):
    payload = {
        "financing_mode": "MANUAL",
        "project_cost": 100000.0,
        "monthly_units_sold": 100,
        "selling_price_per_unit": 500,
        "variable_cost_per_unit": 200,
        "requested_loan_amount": 50000.0,
        "monthly_household_nonbusiness_income": 20000,
        "annual_interest_rate_percent": 12.0,
        "repayment_tenure_months": 24,
    }
    response = client.post(f"/businesses/{seeded_business}/finance-assessment", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["working_capital_requirement"] is None
