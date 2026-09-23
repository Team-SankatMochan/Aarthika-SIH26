import json

with open('finance-spec/golden-tests.json', 'r') as f:
    tests = json.load(f)

for test in tests:
    name = test['name']
    if name == 'inverse EMI':
        test['inputs']['monthly_units_sold'] = 100
        test['inputs']['selling_price_per_unit'] = 100
        test['inputs']['variable_cost_per_unit'] = 40
        test['inputs']['monthly_fixed_cost'] = 0
        test['expected']['business_cash_available_for_debt_service'] = 6000.00
        test['expected']['maximum_affordable_emi'] = 5000.00
    elif name == 'requested loan above scheme maximum':
        test['inputs']['monthly_units_sold'] = 400
        test['inputs']['selling_price_per_unit'] = 100
        test['inputs']['variable_cost_per_unit'] = 40
        test['inputs']['monthly_fixed_cost'] = 0
        test['inputs']['annual_interest_rate_percent'] = 12
        test['inputs']['repayment_tenure_months'] = 24
        test['inputs']['moratorium_months'] = 0
        test['inputs']['moratorium_interest_method'] = "NONE"
        # CFADS = 24000
        # max EMI = 20000 -> affordable loan > 400,000 (requested is 500,000)
    elif name == 'requested loan above affordable amount':
        test['inputs']['monthly_units_sold'] = 400
        test['inputs']['selling_price_per_unit'] = 100
        test['inputs']['variable_cost_per_unit'] = 40
        test['inputs']['monthly_fixed_cost'] = 0
        test['inputs']['annual_interest_rate_percent'] = 12
        test['inputs']['repayment_tenure_months'] = 24
        test['inputs']['moratorium_months'] = 0
        test['inputs']['moratorium_interest_method'] = "NONE"
        # max EMI = 20000 -> affordable loan = 424867.75

with open('finance-spec/golden-tests.json', 'w') as f:
    json.dump(tests, f, indent=2)

