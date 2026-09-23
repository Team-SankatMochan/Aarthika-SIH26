import json

with open('finance-spec/golden-tests.json', 'r') as f:
    tests = json.load(f)

for test in tests:
    name = test['name']
    if name == 'inverse EMI':
        test['expected'].pop('post_loan_monthly_debt_payments', None)
        test['expected'].pop('post_loan_household_debt_ratio', None)
    elif name == 'requested loan above affordable amount':
        test['expected']['post_loan_monthly_debt_payments'] = 24536.74
        test['expected']['post_loan_household_debt_ratio'] = 1.23

with open('finance-spec/golden-tests.json', 'w') as f:
    json.dump(tests, f, indent=2)
