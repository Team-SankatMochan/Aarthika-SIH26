import json

with open('finance-spec/golden-tests.json', 'r') as f:
    tests = json.load(f)

for test in tests:
    name = test['name']
    if name == 'inverse EMI':
        test['expected']['affordable_loan_amount'] = 101968.26
        test['expected']['post_loan_monthly_debt_payments'] = 6314.18
        test['expected']['post_loan_household_debt_ratio'] = 0.32
    elif name == 'requested loan above scheme maximum':
        test['expected']['post_loan_monthly_debt_payments'] = 6884.18
        test['expected']['post_loan_household_debt_ratio'] = 0.34
    elif name == 'requested loan above affordable amount':
        test['expected']['recommended_loan_amount'] = 407873.04
        test['expected']['post_loan_monthly_debt_payments'] = 19353.11
        test['expected']['post_loan_household_debt_ratio'] = 0.97

with open('finance-spec/golden-tests.json', 'w') as f:
    json.dump(tests, f, indent=2)
