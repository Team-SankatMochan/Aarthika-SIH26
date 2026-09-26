"""
Deterministic SIH Scheme Rules (Python Parity Implementation)

Mirrors exact rules from src/engine/SIHSchemeRules.ts
SIH terms:
- Micro Finance:
  project cost <= ₹1.40 lakh
  90% component
  cap ₹1.25 lakh
  6.5%
  36 months total (3m moratorium + 33m repayment)

- Term Loan:
  > ₹1.40 lakh and <= ₹50 lakh
  90% component
  cap ₹45 lakh
  8.0%
  84 months total (6m moratorium + 78m repayment)

- > ₹50 lakh:
  OUT_OF_SCOPE
"""

from decimal import Decimal
from typing import Dict, Any, Optional


def get_sih_scheme_terms(margin_capital: Optional[float | Decimal]) -> Dict[str, Any]:
    """
    Given margin capital (user's equity / available margin capital),
    calculate project cost, loan component, interest rate, and tenures.
    """
    if margin_capital is None:
        return {
            "scheme_name": "Invalid",
            "is_micro_finance": False,
            "project_cost": 0.0,
            "max_loan_component": 0.0,
            "raw_90_percent_loan": 0.0,
            "scheme_loan_cap": 0.0,
            "interest_rate": 0.0,
            "total_tenure_months": 0,
            "active_repayment_months": 0,
            "moratorium_months": 0,
            "is_out_of_scope": True,
        }

    margin = float(margin_capital)
    if margin <= 0:
        return {
            "scheme_name": "Invalid",
            "is_micro_finance": False,
            "project_cost": 0.0,
            "max_loan_component": 0.0,
            "raw_90_percent_loan": 0.0,
            "scheme_loan_cap": 0.0,
            "interest_rate": 0.0,
            "total_tenure_months": 0,
            "active_repayment_months": 0,
            "moratorium_months": 0,
            "is_out_of_scope": True,
        }

    project_cost = margin / 0.10
    raw_loan_component = project_cost * 0.90

    if project_cost <= 140000.0:
        # Micro Finance
        return {
            "scheme_name": "Micro Finance",
            "is_micro_finance": True,
            "project_cost": round(project_cost, 2),
            "max_loan_component": round(min(raw_loan_component, 125000.0), 2),
            "raw_90_percent_loan": round(raw_loan_component, 2),
            "scheme_loan_cap": 125000.0,
            "interest_rate": 6.5,
            "total_tenure_months": 36,
            "active_repayment_months": 33,
            "moratorium_months": 3,
            "is_out_of_scope": False,
        }
    elif project_cost <= 5000000.0:
        # Term Loan
        return {
            "scheme_name": "Term Loan",
            "is_micro_finance": False,
            "project_cost": round(project_cost, 2),
            "max_loan_component": round(min(raw_loan_component, 4500000.0), 2),
            "raw_90_percent_loan": round(raw_loan_component, 2),
            "scheme_loan_cap": 4500000.0,
            "interest_rate": 8.0,
            "total_tenure_months": 84,
            "active_repayment_months": 78,
            "moratorium_months": 6,
            "is_out_of_scope": False,
        }
    else:
        # Out of scope
        return {
            "scheme_name": "Out of Scope",
            "is_micro_finance": False,
            "project_cost": round(project_cost, 2),
            "max_loan_component": 0.0,
            "raw_90_percent_loan": 0.0,
            "scheme_loan_cap": 0.0,
            "interest_rate": 0.0,
            "total_tenure_months": 0,
            "active_repayment_months": 0,
            "moratorium_months": 0,
            "is_out_of_scope": True,
        }
