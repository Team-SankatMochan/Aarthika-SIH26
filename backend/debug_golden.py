import json
from decimal import Decimal
from app.services.finance_calculator import calculate_financial_assessment

policy = json.load(open("../finance-spec/calculation-policy.json"))
tests = json.load(open("../finance-spec/golden-tests.json"))

for t in tests:
    if t['name'] in ['requested loan above scheme maximum', 'requested loan above affordable amount', 'missing loan terms']:
        res = calculate_financial_assessment(dict(t['inputs']), policy, allow_stage_overrides=True)
        print(f"--- {t['name']} ---")
        for k, v in t['expected'].items():
            actual = res.get(k, 'MISSING')
            match = str(v) == str(actual) if v is not None else actual is None
            print(f"  {k}: expected={v}, got={actual}, match={match}")
