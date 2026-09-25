import { Decimal } from 'decimal.js';

const TWO_PLACES = 2;

function roundCurrency(val: Decimal | null | undefined): Decimal | null {
  if (!val) return null;
  return val.toDecimalPlaces(TWO_PLACES, Decimal.ROUND_HALF_UP);
}

export function formatINR(n: number): string {
  const rounded = Math.round(n);
  const s = rounded.toString();
  if (s.length <= 3) return '₹' + s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return '₹' + grouped + ',' + last3;
}

export function calculateFinancialAssessment(inputs: any, policy: any): any {
  if (!policy || !policy.minimum_required_dscr) throw new Error("CRITICAL: minimum_required_dscr missing from policy");
  if (!policy.maximum_household_debt_ratio) throw new Error("CRITICAL: maximum_household_debt_ratio missing from policy");
  
  const result: any = {};
  
  const reqLoan = inputs.requested_loan_amount != null ? new Decimal(inputs.requested_loan_amount) : null;
  
  const rate = inputs.annual_interest_rate_percent != null ? new Decimal(inputs.annual_interest_rate_percent) : null;
  const repayMonths = inputs.repayment_tenure_months != null ? Number(inputs.repayment_tenure_months) : null;
  const moratorium = inputs.moratorium_months != null ? Number(inputs.moratorium_months) : 0;
  const moratoriumMethod = inputs.moratorium_interest_method || "NONE";
  
  const unitsSold = inputs.monthly_units_sold != null ? new Decimal(inputs.monthly_units_sold) : null;
  const price = inputs.selling_price_per_unit != null ? new Decimal(inputs.selling_price_per_unit) : null;
  const varCost = inputs.variable_cost_per_unit != null ? new Decimal(inputs.variable_cost_per_unit) : null;
  
  const missingFields: string[] = [];
  const checkMissing = (field: string) => {
    if (inputs[field] == null && inputs.monthly_fixed_cost == null) {
      missingFields.push(field);
      return new Decimal(0);
    }
    return new Decimal(inputs[field] || 0);
  };

  const labour = checkMissing('monthly_labour_cost');
  const rent = checkMissing('monthly_rent');
  const transport = checkMissing('monthly_transport_cost');
  const otherFixed = checkMissing('monthly_other_fixed_cost');
  
  if (missingFields.length > 0 && inputs.monthly_fixed_cost == null) {
    result.loan_structure_status = "INSUFFICIENT_DATA";
    result.business_affordability_status = "INSUFFICIENT_DATA";
    result.overall_readiness = "INCOMPLETE";
    result.missing_fields = missingFields;
    return result;
  }

  const fixedCost = inputs.monthly_fixed_cost != null ? new Decimal(inputs.monthly_fixed_cost) : labour.add(rent).add(transport).add(otherFixed);
  result.monthly_fixed_cost = Number(roundCurrency(fixedCost)!.toFixed(2));
  
  if (price != null && varCost != null) {
    const cm = price.sub(varCost);
    result.unit_contribution_margin = Number(roundCurrency(cm)!.toFixed(2));
    
    if (cm.greaterThan(0)) {
      result.break_even_units = Math.round(Number(fixedCost.div(cm))); 
      result.break_even_status = "VIABLE";
    } else if (cm.equals(0)) {
      result.break_even_units = null;
      result.break_even_status = "NO_FINITE_BREAK_EVEN";
    } else {
      result.break_even_units = null;
      result.break_even_status = "STRUCTURALLY_UNVIABLE";
    }
  }

  if (unitsSold != null && price != null && varCost != null) {
    const rev = price.mul(unitsSold);
    const vc = varCost.mul(unitsSold);
    const surplus = rev.sub(vc).sub(fixedCost);
    
    result.monthly_revenue = Number(roundCurrency(rev)!.toFixed(2));
    result.monthly_variable_cost = Number(roundCurrency(vc)!.toFixed(2));
    result.monthly_operating_surplus = Number(roundCurrency(surplus)!.toFixed(2));
    result.business_cash_available_for_debt_service = Number(roundCurrency(surplus)!.toFixed(2));
  }
  
  function getPCap(p: Decimal, r: Decimal, m: number, method: string): Decimal {
    if (method === "NONE" || m === 0) return p;
    if (method === "SIMPLE_CAPITALIZE") return p.mul(new Decimal(1).add(r.mul(m)));
    if (method === "COMPOUND_CAPITALIZE") return p.mul(new Decimal(1).add(r).pow(m));
    return p;
  }
  
  function getEmi(pCap: Decimal, r: Decimal, n: number): Decimal {
    if (n === 0) return new Decimal(0);
    if (r.equals(0)) return pCap.div(n);
    const onePlusRPow = new Decimal(1).add(r).pow(n);
    return pCap.mul(r).mul(onePlusRPow).div(onePlusRPow.sub(1));
  }
  
  function getPFromEmi(emi: Decimal, r: Decimal, n: number): Decimal {
    if (n === 0) return new Decimal(0);
    if (r.equals(0)) return emi.mul(n);
    const onePlusRPow = new Decimal(1).add(r).pow(n);
    return emi.mul(onePlusRPow.sub(1)).div(r.mul(onePlusRPow));
  }
  
  function getPFromPCap(pCap: Decimal, r: Decimal, m: number, method: string): Decimal {
    if (method === "NONE" || m === 0) return pCap;
    if (method === "SIMPLE_CAPITALIZE") return pCap.div(new Decimal(1).add(r.mul(m)));
    if (method === "COMPOUND_CAPITALIZE") return pCap.div(new Decimal(1).add(r).pow(m));
    return pCap;
  }
  
  const monthlyRate = rate != null ? rate.div(100).div(12) : null;
  const maxScheme = inputs.maximum_scheme_loan_amount != null ? new Decimal(inputs.maximum_scheme_loan_amount) : null;
  
  let candLoan = reqLoan;
  if (reqLoan != null && maxScheme != null) {
      candLoan = Decimal.min(reqLoan, maxScheme);
  }
  
  let emiVal = null;
  if (candLoan != null && monthlyRate != null && repayMonths != null) {
    const pCap = getPCap(candLoan, monthlyRate, moratorium, moratoriumMethod);
    emiVal = getEmi(pCap, monthlyRate, repayMonths);
    
    result.capitalized_principal = Number(roundCurrency(pCap)!.toFixed(2));
    result.candidate_emi = Number(roundCurrency(emiVal)!.toFixed(2));
    result.emi = Number(roundCurrency(emiVal)!.toFixed(2));
    
    const totalRepayment = emiVal.mul(repayMonths);
    const totalInt = totalRepayment.sub(candLoan);
    if (totalInt.greaterThanOrEqualTo(0)) {
      result.total_interest = Number(roundCurrency(totalInt)!.toFixed(2));
    }
  }

  let bizDscr = null;
  if (result.business_cash_available_for_debt_service != null && emiVal != null && emiVal.greaterThan(0)) {
    bizDscr = new Decimal(result.business_cash_available_for_debt_service).div(emiVal);
    result.business_dscr = Number(roundCurrency(bizDscr)!.toFixed(2));
  }

  
  const minDscr = new Decimal(policy.minimum_required_dscr);
  const maxHhDebt = new Decimal(policy.maximum_household_debt_ratio);

  let maxEmi = null;
  if (result.business_cash_available_for_debt_service != null) {
    maxEmi = new Decimal(result.business_cash_available_for_debt_service).div(minDscr);
    result.maximum_affordable_emi = Number(roundCurrency(maxEmi)!.toFixed(2));
  }

  let affP = null;
  if (maxEmi != null && maxEmi.greaterThan(0) && monthlyRate != null && repayMonths != null) {
    const affPCap = getPFromEmi(maxEmi, monthlyRate, repayMonths);
    affP = getPFromPCap(affPCap, monthlyRate, moratorium, moratoriumMethod);
    result.affordable_loan_amount = Number(roundCurrency(affP)!.toFixed(2));
  }
  
  if (reqLoan != null && affP != null) {
    let recLoan = Decimal.min(reqLoan, affP);
    if (maxScheme != null) {
      recLoan = Decimal.min(recLoan, maxScheme);
    }
    result.recommended_loan_amount = Number(roundCurrency(recLoan)!.toFixed(2));
  }
  
  if (reqLoan != null && (repayMonths == null || rate == null)) {
    result.loan_structure_status = "INSUFFICIENT_DATA";
    result.business_affordability_status = "INSUFFICIENT_DATA";
    const missing = [];
    if (repayMonths == null) missing.push("repayment_tenure_months");
    if (rate == null) missing.push("annual_interest_rate_percent");
    result.missing_fields = missing;
  }
  
  let hhPostRatio = null;
  if (!("monthly_household_nonbusiness_income" in inputs) || inputs.monthly_household_nonbusiness_income === null ||
      !("monthly_household_essential_expenses" in inputs) || inputs.monthly_household_essential_expenses === null ||
      !("existing_monthly_household_debt_payments" in inputs) || inputs.existing_monthly_household_debt_payments === null) {
    result.household_affordability_status = "INSUFFICIENT_DATA";
    result.overall_readiness = "INCOMPLETE";
    if (!result.missing_fields) result.missing_fields = [];
    if (!("monthly_household_nonbusiness_income" in inputs) || inputs.monthly_household_nonbusiness_income === null) result.missing_fields.push("monthly_household_nonbusiness_income");
    if (!("monthly_household_essential_expenses" in inputs) || inputs.monthly_household_essential_expenses === null) result.missing_fields.push("monthly_household_essential_expenses");
    if (!("existing_monthly_household_debt_payments" in inputs) || inputs.existing_monthly_household_debt_payments === null) result.missing_fields.push("existing_monthly_household_debt_payments");
  } else {
    const hhIncomeRaw = inputs.monthly_household_nonbusiness_income;
    const hhInc = new Decimal(hhIncomeRaw);
    const hhExp = new Decimal(inputs.monthly_household_essential_expenses);
    const hhDebt = new Decimal(inputs.existing_monthly_household_debt_payments);
    
    const hhFree = hhInc.sub(hhExp).sub(hhDebt);
    result.household_free_cash = Number(roundCurrency(hhFree)!.toFixed(2));
    
    if (hhInc.equals(0)) {
      result.household_existing_debt_ratio = null;
      result.household_buffer_ratio = null;
      result.household_income_status = "ZERO_INCOME";
      result.household_affordability_status = "HIGH_RISK";
    } else {
      const exRatio = hhDebt.div(hhInc);
      const bufRatio = hhFree.div(hhInc);
      result.household_existing_debt_ratio = Number(roundCurrency(exRatio)!.toFixed(2));
      result.household_buffer_ratio = Number(roundCurrency(bufRatio)!.toFixed(2));
      result.household_income_status = "VALID";
    }
    
    if (emiVal != null) {
      const postDebt = hhDebt.add(emiVal);
      result.post_loan_monthly_debt_payments = Number(roundCurrency(postDebt)!.toFixed(2));
      if (hhInc.equals(0)) {
        result.post_loan_household_debt_ratio = null;
      } else {
        hhPostRatio = postDebt.div(hhInc);
        result.post_loan_household_debt_ratio = Number(roundCurrency(hhPostRatio)!.toFixed(2));
      }
    }
  }
  
  if (bizDscr != null && hhPostRatio != null) {
    if (bizDscr.greaterThanOrEqualTo(minDscr)) {
      result.business_affordability_status = "READY_FOR_FINANCE_REVIEW";
    } else {
      result.business_affordability_status = "HIGH_RISK";
    }
    
    if (hhPostRatio.lessThanOrEqualTo(maxHhDebt)) {
      result.household_affordability_status = "READY_FOR_FINANCE_REVIEW";
    } else {
      result.household_affordability_status = "HIGH_RISK";
    }
    
    if (result.business_affordability_status === "READY_FOR_FINANCE_REVIEW" && result.household_affordability_status === "READY_FOR_FINANCE_REVIEW") {
      result.overall_readiness = "READY_FOR_FINANCE_REVIEW";
    } else {
      result.overall_readiness = "HIGH_RISK";
    }
  }
  
  return result;
}
