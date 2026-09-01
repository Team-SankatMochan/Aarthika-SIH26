from decimal import Decimal, ROUND_HALF_UP, getcontext
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import select, desc
from app.models.scheme import Scheme, SchemeRule
from app.models.business import Business
from app.models.business_assumption import BusinessAssumption
from app.models.finance_assessment import FinanceAssessment
from app.schemas.finance_assessment import FinanceAssessmentRequest

# Set high precision for financial calculations
getcontext().prec = 28

TWO_PLACES = Decimal("0.01")
FOUR_PLACES = Decimal("0.0001")


def round_currency(value: Decimal) -> Decimal:
    """Round a Decimal amount to 2 decimal places (currency)."""
    return value.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def calculate_project_cost_from_margin(margin_contribution: Decimal) -> Decimal:
    """Project Cost = Margin / 0.10 (assuming 10% entrepreneur margin contribution)."""
    return round_currency(margin_contribution / Decimal("0.10"))


def calculate_margin_from_cost(project_cost: Decimal) -> Decimal:
    """Margin = Project Cost * 0.10 (10% entrepreneur contribution)."""
    return round_currency(project_cost * Decimal("0.10"))


def find_matching_scheme_rule(
    project_cost: Decimal, db: Session, scheme_id: Optional[str] = None
) -> Optional[SchemeRule]:
    """Find active scheme rule matching the project cost range."""
    query = select(SchemeRule).where(
        SchemeRule.active == True,
        SchemeRule.min_project_cost <= project_cost,
        SchemeRule.max_project_cost >= project_cost,
    )
    if scheme_id:
        query = query.where(SchemeRule.scheme_id == scheme_id)

    # Order by min_project_cost desc to pick the most specific bracket
    query = query.order_by(desc(SchemeRule.min_project_cost))
    return db.scalars(query).first()


def calculate_moratorium_interest(
    principal: Decimal, annual_rate: Decimal, moratorium_months: int
) -> Tuple[Decimal, Decimal]:
    """
    Calculate interest accrued during moratorium and capitalized principal.
    Interest = Principal * (annual_rate / 100 / 12) * moratorium_months
    Capitalized Principal = Principal + Accrued Moratorium Interest
    """
    if moratorium_months <= 0:
        return Decimal("0.00"), principal

    monthly_rate = (annual_rate / Decimal("100")) / Decimal("12")
    accrued_interest = round_currency(principal * monthly_rate * Decimal(moratorium_months))
    capitalized_principal = round_currency(principal + accrued_interest)
    return accrued_interest, capitalized_principal


def calculate_emi(
    capitalized_principal: Decimal, annual_rate: Decimal, active_tenure_months: int
) -> Decimal:
    """
    Calculate reducing balance EMI:
    EMI = [P * r * (1 + r)^n] / [(1 + r)^n - 1]
    where P = capitalized principal, r = monthly interest rate, n = active repayment months.
    """
    if active_tenure_months <= 0 or capitalized_principal <= Decimal("0.00"):
        return Decimal("0.00")

    monthly_rate = (annual_rate / Decimal("100")) / Decimal("12")
    
    if monthly_rate == Decimal("0.00"):
        return round_currency(capitalized_principal / Decimal(active_tenure_months))

    # (1 + r)^n
    factor = (Decimal("1.00") + monthly_rate) ** active_tenure_months
    numerator = capitalized_principal * monthly_rate * factor
    denominator = factor - Decimal("1.00")

    emi = numerator / denominator
    return round_currency(emi)


def assess_business_finance(
    business_id: str, request: FinanceAssessmentRequest, db: Session
) -> FinanceAssessment:
    """
    Perform deterministic financial assessment for a business.
    Calculates:
    - Project Cost
    - Maximum Permitted Loan (Scheme cap)
    - Recommended Loan (Debt Service & Cash flow affordability)
    - Moratorium Interest Accrual & Capitalized Principal
    - EMI and Total Interest
    - Debt Affordability Status & Audit Versioning
    """
    # 1. Derive Project Cost and Margin Contribution
    if request.project_cost is not None and request.project_cost > Decimal("0.00"):
        project_cost = round_currency(request.project_cost)
        margin_contribution = (
            round_currency(request.margin_contribution)
            if request.margin_contribution is not None
            else calculate_margin_from_cost(project_cost)
        )
    elif request.margin_contribution is not None:
        margin_contribution = round_currency(request.margin_contribution)
        project_cost = calculate_project_cost_from_margin(margin_contribution)
    else:
        raise ValueError("Either project_cost or margin_contribution must be provided")

    # 2. Match Scheme Rule
    rule = find_matching_scheme_rule(project_cost, db, request.scheme_id or request.scheme_rule_id)
    if not rule:
        # Fallback to defaults if no custom rule exists yet
        if project_cost <= Decimal("140000.00"):
            financing_pct = Decimal("90.00")
            max_loan_cap = Decimal("125000.00")
            annual_rate = Decimal("6.50")
            total_tenure = 36
            moratorium_months = 3
        else:
            financing_pct = Decimal("90.00")
            max_loan_cap = Decimal("4500000.00")
            annual_rate = Decimal("8.00")
            total_tenure = 84
            moratorium_months = 6
        scheme_id = request.scheme_id
        scheme_rule_id = request.scheme_rule_id
    else:
        financing_pct = rule.financing_percentage
        max_loan_cap = rule.max_loan_amount
        annual_rate = rule.annual_interest_rate
        total_tenure = rule.tenure_months
        moratorium_months = rule.moratorium_months
        scheme_id = rule.scheme_id
        scheme_rule_id = rule.id

    # 3. Maximum Possible Loan
    raw_loan = round_currency(project_cost * (financing_pct / Decimal("100.00")))
    maximum_loan = min(raw_loan, max_loan_cap)

    # 4. Assess Net Monthly Cash Flow for Recommended Loan
    # Check latest business assumption if monthly cash flow not passed explicitly
    monthly_cash_surplus = request.monthly_net_cash_flow
    if monthly_cash_surplus is None:
        latest_assumption = db.scalars(
            select(BusinessAssumption)
            .where(BusinessAssumption.business_id == business_id)
            .order_by(desc(BusinessAssumption.created_at))
        ).first()

        if latest_assumption:
            # Revenue = customers * price or production_volume * price
            rev = (
                latest_assumption.production_volume * latest_assumption.selling_price
                if latest_assumption.production_volume > Decimal("0.00")
                else Decimal(latest_assumption.expected_customers) * latest_assumption.selling_price * Decimal("30")
            )
            costs = (
                latest_assumption.raw_material_cost
                + latest_assumption.labour_cost
                + latest_assumption.rent
                + latest_assumption.transport_cost
                + latest_assumption.other_operating_cost
            )
            monthly_cash_surplus = rev - costs

    # 5. Determine Recommended Loan vs Maximum Loan
    # If monthly cash surplus is known, recommend loan such that EMI <= 35% of monthly cash surplus
    active_tenure = total_tenure - moratorium_months
    
    # Calculate for maximum loan first
    _, max_cap_principal = calculate_moratorium_interest(maximum_loan, annual_rate, moratorium_months)
    max_emi = calculate_emi(max_cap_principal, annual_rate, active_tenure)

    if monthly_cash_surplus is not None and monthly_cash_surplus > Decimal("0.00"):
        safe_emi_limit = round_currency(monthly_cash_surplus * Decimal("0.35"))
        if max_emi <= safe_emi_limit:
            recommended_loan = maximum_loan
            debt_affordability_status = "AFFORDABLE"
            debt_service_burden = round_currency((max_emi / monthly_cash_surplus) * Decimal("100"))
        elif max_emi <= monthly_cash_surplus * Decimal("0.50"):
            # Stretched borrowing
            recommended_loan = round_currency(maximum_loan * Decimal("0.80"))
            debt_affordability_status = "STRETCHED"
            debt_service_burden = round_currency((max_emi / monthly_cash_surplus) * Decimal("100"))
        else:
            # High risk borrowing
            recommended_loan = round_currency(maximum_loan * Decimal("0.50"))
            debt_affordability_status = "UNSUSTAINABLE"
            debt_service_burden = round_currency((max_emi / monthly_cash_surplus) * Decimal("100"))
    else:
        # Default conservative recommendation (80% of max loan when cash flow unverified)
        recommended_loan = round_currency(maximum_loan * Decimal("0.85"))
        debt_affordability_status = "AFFORDABLE"
        debt_service_burden = Decimal("25.00")

    # 6. Final Calculations for the Recommended Loan (or assessed structure)
    moratorium_interest, capitalized_principal = calculate_moratorium_interest(
        recommended_loan, annual_rate, moratorium_months
    )
    emi = calculate_emi(capitalized_principal, annual_rate, active_tenure)
    total_repayment = round_currency(emi * Decimal(active_tenure))
    total_interest = round_currency(total_repayment - recommended_loan)

    # 7. Audit Versioning
    latest_assessment = db.scalars(
        select(FinanceAssessment)
        .where(FinanceAssessment.business_id == business_id)
        .order_by(desc(FinanceAssessment.calculation_version))
    ).first()
    next_version = (latest_assessment.calculation_version + 1) if latest_assessment else 1

    assessment = FinanceAssessment(
        business_id=business_id,
        scheme_id=scheme_id,
        scheme_rule_id=scheme_rule_id,
        project_cost=project_cost,
        margin_contribution=margin_contribution,
        maximum_loan=maximum_loan,
        recommended_loan=recommended_loan,
        annual_interest_rate=annual_rate,
        total_tenure_months=total_tenure,
        moratorium_months=moratorium_months,
        active_repayment_months=active_tenure,
        capitalized_principal=capitalized_principal,
        emi=emi,
        total_interest=total_interest,
        debt_affordability_status=debt_affordability_status,
        debt_service_burden=debt_service_burden,
        working_capital_requirement=request.working_capital_needed or Decimal("0.00"),
        calculation_version=next_version,
    )

    db.add(assessment)
    db.commit()
    db.refresh(assessment)
    return assessment
