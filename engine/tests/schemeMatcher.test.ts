import * as fs from 'fs';
import * as path from 'path';
import { evaluateSchemeCompatibility, evaluateAllSchemes } from '../schemeMatcher';

describe('Deterministic Scheme Matcher - Golden Fixtures Parity', () => {
    let goldenData: any;

    beforeAll(() => {
        const fixturePath = path.resolve(__dirname, '../../scheme-spec/golden-scheme-matches.json');
        const fileContent = fs.readFileSync(fixturePath, 'utf-8');
        goldenData = JSON.parse(fileContent);
    });

    it('should match all golden fixtures', () => {
        for (const testCase of goldenData.cases) {
            // console.log(`Testing case: ${testCase.id} - ${testCase.description}`);

            const profile = testCase.profile;
            const evaluationDate = testCase.evaluation_date;
            const freshnessPolicy = testCase.freshness_policy;

            if (testCase.scheme_rule !== undefined) {
                // Single rule
                const rule = testCase.scheme_rule;
                if (!rule) {
                    const result = evaluateAllSchemes(profile, [], evaluationDate, freshnessPolicy);
                    expect(result.status).toBe(testCase.expected.status);
                    continue;
                }

                const result = evaluateSchemeCompatibility(profile, rule, evaluationDate, freshnessPolicy);
                const expected = testCase.expected;

                expect(result.status).toBe(expected.status);
                expect(result.validity).toBe(expected.validity);
                if (expected.freshness) {
                    expect(result.freshness).toBe(expected.freshness);
                }

                expect(new Set(result.passed_rules)).toEqual(new Set(expected.passed_rules));
                expect(new Set(result.failed_rules.map(f => f.field))).toEqual(new Set(expected.failed_rules.map((f: any) => f.field)));
                expect(new Set(result.missing_fields)).toEqual(new Set(expected.missing_fields));
                expect(new Set(result.warnings)).toEqual(new Set(expected.warnings));
            } else if (testCase.rules !== undefined) {
                // Multi rule
                const rules = testCase.rules;
                const result = evaluateAllSchemes(profile, rules, evaluationDate, freshnessPolicy);

                if (testCase.expected_selected_rule_id) {
                    expect(result.compatible_schemes.length).toBe(1);
                    const schemeResult = result.compatible_schemes[0];
                    expect(schemeResult.best_rule!.scheme_rule_id).toBe(testCase.expected_selected_rule_id);
                    expect(schemeResult.best_rule!.selection_reason).toBe(testCase.expected_selection_reason);
                } else if (testCase.expected_compatible_scheme_ids) {
                    const expectedIds = testCase.expected_compatible_scheme_ids;
                    const actualIds = result.compatible_schemes.map(s => s.scheme_id);
                    expect(new Set(actualIds)).toEqual(new Set(expectedIds));
                }
            }
        }
    });
});
