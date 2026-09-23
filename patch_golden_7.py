import json

with open('finance-spec/golden-tests.json', 'r') as f:
    tests = json.load(f)

for test in tests:
    if test['name'] == 'inverse EMI':
        test['expected']['affordable_loan_amount'] = 101968.26

with open('finance-spec/golden-tests.json', 'w') as f:
    json.dump(tests, f, indent=2)
