import json
policy = json.load(open("../finance-spec/calculation-policy.json"))
tests = json.load(open("../finance-spec/golden-tests.json"))
for t in tests:
    if t['name'] in ['requested loan above scheme maximum', 'requested loan above affordable amount', 'missing loan terms']:
        print(f"--- {t['name']} ---")
        print('inputs:', json.dumps(t['inputs'], indent=2))
        print('expected:', json.dumps(t['expected'], indent=2))
