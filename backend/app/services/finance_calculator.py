from decimal import Decimal, ROUND_HALF_UP, getcontext
from typing import Dict, Any, Optional

getcontext().prec = 28
TWO_PLACES = Decimal("0.01")

def round_currency(value: Decimal) -> Decimal:
    if value is None:
        return None
    return value.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)

def calculate_financial_assessment(inputs: Dict[str, Any], policy: Dict[str, Any]) -> Dict[str, Any]:
    result = {}
    
    # Extract root business inputs
    req_loan = Decimal(str(inputs.get("requested_loan_amount", "0"))) if inputs.get("requested_loan_amount") is not None else None
    
    rate = inputs.get("annual_interest_rate_percent")
    if rate is not None:
        rate = Decimal(str(rate))
    
    repay_months = inputs.get("repayment_tenure_months")
    moratorium = inputs.get("moratorium_months", 0)
    moratorium_method = inputs.get("moratorium_interest_method", "NONE")
    
    units_sold = inputs.get("monthly_units_sold")
    price = inputs.get("selling_price_per_unit")
    var_cost = inputs.get("variable_cost_per_unit")
    
    if "monthly_fixed_cost" in inputs and inputs["monthly_fixed_cost"] is not None:
        fixed_cost = Decimal(str(inputs["monthly_fixed_cost"]))
    else:
        labour = Decimal(str(inputs.get("monthly_labour_cost", 0)))
        rent = Decimal(str(inputs.get("monthly_rent", 0)))
        transport = Decimal(str(inputs.get("monthly_transport_cost", 0)))
        other_fixed = Decimal(str(inputs.get("monthly_other_fixed_cost", 0)))
        fixed_cost = labour + rent + transport + other_fixed
        
    result["monthly_fixed_cost"] = round_currency(fixed_cost)
            
    if price is not None and var_cost is not None:
        cm = Decimal(str(price)) - Decimal(str(var_cost))
        result["unit_contribution_margin"] = round_currency(cm)
        if cm > Decimal("0"):
            be = fixed_cost / cm
            result["break_even_units"] = int(be.to_integral_value(rounding=ROUND_HALF_UP))
            result["break_even_status"] = "VIABLE"
        elif cm == Decimal("0"):
            result["break_even_units"] = None
            result["break_even_status"] = "NO_FINITE_BREAK_EVEN"
        else:
            result["break_even_units"] = None
            result["break_even_status"] = "STRUCTURALLY_UNVIABLE"
            
    if units_sold is not None and price is not None and var_cost is not None:
        rev = Decimal(str(units_sold)) * Decimal(str(price))
        vc = Decimal(str(units_sold)) * Decimal(str(var_cost))
        surplus = rev - (vc + fixed_cost)
        
        result["monthly_revenue"] = round_currency(rev)
        result["monthly_variable_cost"] = round_currency(vc)
        result["monthly_operating_surplus"] = round_currency(surplus)
        result["business_cash_available_for_debt_service"] = round_currency(surplus)

    # 2. Loan Calculations
    def get_p_cap(p: Decimal, r: Decimal, m: int, method: str) -> Decimal:
        if method == "NONE" or m == 0:
            return p
        elif method == "SIMPLE_CAPITALIZE":
            return p * (Decimal("1") + r * Decimal(m))
        elif method == "COMPOUND_CAPITALIZE":
            return p * ((Decimal("1") + r) ** m)
        return p

    def get_emi(p_cap: Decimal, r: Decimal, n: int) -> Decimal:
        if n == 0:
            return Decimal("0")
        if r == Decimal("0"):
            return p_cap / Decimal(n)
        return p_cap * r * ((Decimal("1") + r) ** n) / (((Decimal("1") + r) ** n) - Decimal("1"))
        
    def get_p_from_emi(emi: Decimal, r: Decimal, n: int) -> Decimal:
        if n == 0:
            return Decimal("0")
        if r == Decimal("0"):
            return emi * Decimal(n)
        return emi * (((Decimal("1") + r) ** n) - Decimal("1")) / (r * ((Decimal("1") + r) ** n))
        
    def get_p_from_p_cap(p_cap: Decimal, r: Decimal, m: int, method: str) -> Decimal:
        if method == "NONE" or m == 0:
            return p_cap
        elif method == "SIMPLE_CAPITALIZE":
            return p_cap / (Decimal("1") + r * Decimal(m))
        elif method == "COMPOUND_CAPITALIZE":
            return p_cap / ((Decimal("1") + r) ** m)
        return p_cap

    monthly_rate = None
    if rate is not None:
        monthly_rate = (rate / Decimal("100")) / Decimal("12")
        
    # Candidate scheme loan = min(requested, verified_scheme_max)
    max_scheme = inputs.get("maximum_scheme_loan_amount")
    max_scheme = Decimal(str(max_scheme)) if max_scheme is not None else None
    
    if req_loan is not None:
        cand_loan = min(req_loan, max_scheme) if max_scheme is not None else req_loan
    else:
        cand_loan = None

    emi = None
    if cand_loan is not None and monthly_rate is not None and repay_months is not None:
        p_cap = get_p_cap(cand_loan, monthly_rate, moratorium, moratorium_method)
        emi = get_emi(p_cap, monthly_rate, repay_months)
        
        result["capitalized_principal"] = round_currency(p_cap)
        result["candidate_emi"] = round_currency(emi)
        result["emi"] = round_currency(emi)
        
        total_repayment = emi * Decimal(repay_months)
        total_int = total_repayment - cand_loan
        if total_int >= Decimal("0"):
            result["total_interest"] = round_currency(total_int)

    biz_dscr = None
    if "business_cash_available_for_debt_service" in result and emi is not None and emi > 0:
        biz_dscr = result["business_cash_available_for_debt_service"] / emi
        result["business_dscr"] = round_currency(biz_dscr)

    min_dscr = Decimal(str(policy.get("minimum_required_dscr", "1.20")))
    max_hh_debt = Decimal(str(policy.get("maximum_household_debt_ratio", "0.50")))

    # Max affordable EMI = CFADS / min_dscr
    max_emi = None
    if "business_cash_available_for_debt_service" in result:
        max_emi = result["business_cash_available_for_debt_service"] / min_dscr
        result["maximum_affordable_emi"] = round_currency(max_emi)

    aff_p = None
    if max_emi is not None and max_emi > 0 and monthly_rate is not None and repay_months is not None:
        aff_p_cap = get_p_from_emi(max_emi, monthly_rate, repay_months)
        aff_p = get_p_from_p_cap(aff_p_cap, monthly_rate, moratorium, moratorium_method)
        result["affordable_loan_amount"] = round_currency(aff_p)

    if req_loan is not None and aff_p is not None:
        rec_loan = min(req_loan, aff_p)
        if max_scheme is not None:
            rec_loan = min(rec_loan, max_scheme)
        result["recommended_loan_amount"] = round_currency(rec_loan)
        
    # Readiness states (Missing loan terms)
    if req_loan is not None and (repay_months is None or rate is None):
        result["loan_structure_status"] = "INSUFFICIENT_DATA"
        result["business_affordability_status"] = "INSUFFICIENT_DATA"
        missing = []
        if repay_months is None: missing.append("repayment_tenure_months")
        if rate is None: missing.append("annual_interest_rate_percent")
        result["missing_fields"] = missing

    # Missing household fields
    if "monthly_household_nonbusiness_income" not in inputs or inputs["monthly_household_nonbusiness_income"] is None:
        result["household_affordability_status"] = "INSUFFICIENT_DATA"
        result["overall_readiness"] = "INCOMPLETE"
        if "missing_fields" not in result:
            result["missing_fields"] = []
        result["missing_fields"].append("monthly_household_nonbusiness_income")

    # Household cashflow
    hh_income_raw = inputs.get("monthly_household_nonbusiness_income")
    hh_post_ratio = None
    if hh_income_raw is not None and hh_income_raw != "null":
        hh_inc = Decimal(str(hh_income_raw))
        hh_exp = Decimal(str(inputs.get("monthly_household_essential_expenses", "0")))
        hh_debt = Decimal(str(inputs.get("existing_monthly_household_debt_payments", "0")))
        
        hh_free = hh_inc - hh_exp - hh_debt
        result["household_free_cash"] = round_currency(hh_free)
        
        if hh_inc == Decimal("0"):
            result["household_existing_debt_ratio"] = None
            result["household_buffer_ratio"] = None
            result["household_income_status"] = "ZERO_INCOME"
            result["household_affordability_status"] = "HIGH_RISK"
        else:
            ex_ratio = hh_debt / hh_inc
            buf_ratio = hh_free / hh_inc
            result["household_existing_debt_ratio"] = round_currency(ex_ratio)
            result["household_buffer_ratio"] = round_currency(buf_ratio)
            result["household_income_status"] = "VALID"
            
        if emi is not None:
            post_debt = hh_debt + emi
            result["post_loan_monthly_debt_payments"] = round_currency(post_debt)
            if hh_inc == Decimal("0"):
                result["post_loan_household_debt_ratio"] = None
            else:
                hh_post_ratio = post_debt / hh_inc
                result["post_loan_household_debt_ratio"] = round_currency(hh_post_ratio)
                
    if biz_dscr is not None and hh_post_ratio is not None:
        if biz_dscr >= min_dscr:
            result["business_affordability_status"] = "READY_FOR_FINANCE_REVIEW"
        else:
            result["business_affordability_status"] = "HIGH_RISK"
            
        if hh_post_ratio <= max_hh_debt:
            result["household_affordability_status"] = "READY_FOR_FINANCE_REVIEW"
        else:
            result["household_affordability_status"] = "HIGH_RISK"
            
        if result["business_affordability_status"] == "READY_FOR_FINANCE_REVIEW" and result["household_affordability_status"] == "READY_FOR_FINANCE_REVIEW":
            result["overall_readiness"] = "READY_FOR_FINANCE_REVIEW"
        else:
            result["overall_readiness"] = "HIGH_RISK"
            
    return result
