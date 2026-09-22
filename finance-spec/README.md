# Aarthika Phase 1 Financial Specification

This directory serves as the single source of truth for all deterministic financial calculations, rules, and tests across the TypeScript and Python implementations of the Aarthika platform.

## 1. Cashflow Definitions

### 1.1 Business Cashflow
* `monthly_revenue` = `monthly_units_sold` × `selling_price_per_unit`
* `monthly_variable_cost` = `monthly_units_sold` × `variable_cost_per_unit`
* `monthly_fixed_cost` = `monthly_labour_cost` + `monthly_rent` + `monthly_transport_cost` + `monthly_other_fixed_cost`
* `monthly_operating_surplus` = `monthly_revenue` - (`monthly_variable_cost` + `monthly_fixed_cost`)

*Note: In Phase 1, `monthly_cash_available_for_debt_service` is identical to `monthly_operating_surplus` as taxes, depreciation, and working capital interest are not modeled.*
* `monthly_cash_available_for_debt_service` = `monthly_operating_surplus`

### 1.2 Household Cashflow
Household and business cashflows must not be merged. Do not include projected future business revenue in household income basis unless defined by specific policy.
* `household_free_cash` = `monthly_household_nonbusiness_income` - `monthly_household_essential_expenses` - `existing_monthly_household_debt_payments`

If `monthly_household_nonbusiness_income == 0`:
* `household_existing_debt_ratio` = `null`
* `household_income_status` = `ZERO_INCOME`
* `household_affordability_status` = `HIGH_RISK`

Else:
* `household_existing_debt_ratio` = `existing_monthly_household_debt_payments` / `monthly_household_nonbusiness_income`
* `household_buffer_ratio` = `household_free_cash` / `monthly_household_nonbusiness_income`
* `household_income_status` = `VALID`

## 2. Break-Even Analysis
Break-even determines viability before debt service.
* `unit_contribution_margin` = `selling_price_per_unit` - `variable_cost_per_unit`

* If `unit_contribution_margin > 0`:
  * `break_even_units` = `monthly_fixed_cost` / `unit_contribution_margin`
  * `break_even_status` = `VIABLE`
* If `unit_contribution_margin == 0`:
  * `break_even_units` = `null`
  * `break_even_status` = `NO_FINITE_BREAK_EVEN`
* If `unit_contribution_margin < 0`:
  * `break_even_units` = `null`
  * `break_even_status` = `STRUCTURALLY_UNVIABLE`

## 3. EMI & Moratorium Derivations
Let `r` = `annual_interest_rate / 12 / 100`
Let `n` = `repayment_tenure_months`
Let `m` = `moratorium_months`
Let `P` = `candidate_loan_amount`

### 3.1 Moratorium Methods
* **`NONE`**: No interest accrued during moratorium. `P_cap = P`
* **`SIMPLE_CAPITALIZE`**: Simple interest accrued and added to principal. `P_cap = P × (1 + r × m)`
* **`COMPOUND_CAPITALIZE`**: Compound interest accrued and added to principal. `P_cap = P × (1 + r)^m`

### 3.2 EMI Calculation
If `r > 0`:
* `EMI = P_cap × r × (1 + r)^n / ((1 + r)^n - 1)`
If `r == 0`:
* `EMI = P_cap / n`

### 3.3 Inverse EMI (Affordable Loan Amount)
Let `maximum_affordable_emi` = `monthly_cash_available_for_debt_service` / `minimum_required_dscr`

If `r > 0`:
* `affordable_P_cap` = `maximum_affordable_emi × ((1 + r)^n - 1) / (r × (1 + r)^n)`
If `r == 0`:
* `affordable_P_cap` = `maximum_affordable_emi × n`

Then, reverse the moratorium capitalization to find `affordable_loan_amount` (`affordable_P`):
* If **`NONE`**: `affordable_P` = `affordable_P_cap`
* If **`SIMPLE_CAPITALIZE`**: `affordable_P` = `affordable_P_cap / (1 + r × m)`
* If **`COMPOUND_CAPITALIZE`**: `affordable_P` = `affordable_P_cap / (1 + r)^m`

### 3.4 Recommended Loan Logic
* `candidate_loan_amount` = min(`requested_loan_amount`, `maximum_scheme_loan_amount`)
* `candidate_emi` = `EMI(candidate_loan_amount)`
* `business_dscr` = `monthly_cash_available_for_debt_service` / `candidate_emi`
* `recommended_loan_amount` = min(`requested_loan_amount`, `maximum_scheme_loan_amount`, `affordable_loan_amount`)

## 4. Post-Loan Household Burden
* `post_loan_monthly_debt_payments` = `existing_monthly_household_debt_payments` + `candidate_emi`

If `monthly_household_nonbusiness_income == 0`:
* `post_loan_household_debt_ratio` = `null`
Else:
* `post_loan_household_debt_ratio` = `post_loan_monthly_debt_payments` / `monthly_household_nonbusiness_income`

## 5. Subsystem Readiness States

### 5.1 Business Economics Readiness
* **`BUSINESS_ECONOMICS_READY`**: Requires `monthly_units_sold`, `selling_price_per_unit`, `variable_cost_per_unit`, and all fixed cost inputs. Missing inputs yield `INSUFFICIENT_DATA`.

### 5.2 Loan Structure Readiness
* **`LOAN_STRUCTURE_READY`**: Requires `candidate_loan_amount`, `annual_interest_rate`, `repayment_tenure_months`, `moratorium_months`, and `moratorium_interest_method`. Missing terms yield `INSUFFICIENT_DATA` with explicit missing fields listed.

### 5.3 Business Affordability Readiness
* **`BUSINESS_AFFORDABILITY_READY`**: Requires both `BUSINESS_ECONOMICS_READY` and `LOAN_STRUCTURE_READY`.

### 5.4 Household Affordability Readiness
* **`HOUSEHOLD_AFFORDABILITY_READY`**: Requires `monthly_household_nonbusiness_income`, `monthly_household_essential_expenses`, and `existing_monthly_household_debt_payments`.

*Note: Missing loan terms must not be treated as a business-data failure. If household fields are missing, household readiness is INSUFFICIENT_DATA, but business affordability can still be calculated if business/loan data is present.*

## 6. Versioning & Input Hashing
To ensure auditability, snapshots must include precise versioning:
* `engine_version`: e.g., "1.0.0"
* `policy_version`: e.g., "policy-2026-v1"
* `scheme_rule_version`: e.g., "mudra-tarun-2026-1"
* `calculated_at`: ISO8601 Timestamp

**Canonical Hashing Rules (input_hash)**:
1. Construct a flat dictionary of all source inputs.
2. Sort keys alphabetically.
3. Convert all values to strings (formatting floating points to exactly 2 decimal places, e.g., `100.00`).
4. Serialize to JSON without spaces (`{"key":"value"}`).
5. Hash using SHA-256 and return the hex digest.
