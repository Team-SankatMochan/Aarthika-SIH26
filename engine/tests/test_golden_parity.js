"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
/// <reference types="node" />
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const financeCalculator_1 = require("../financeCalculator");
const specDir = path.join(__dirname, '../../finance-spec');
const testsFile = path.join(specDir, 'golden-tests.json');
const policyFile = path.join(specDir, 'calculation-policy.json');
const goldenTests = JSON.parse(fs.readFileSync(testsFile, 'utf8'));
const policy = JSON.parse(fs.readFileSync(policyFile, 'utf8'));
function calculateGoldenTestWrapper(inputs, policy) {
    const scenario = inputs.scenario;
    const units = inputs.monthly_units_sold;
    const var_cost = inputs.variable_cost_per_unit;
    const fixed_cost = inputs.monthly_fixed_cost || 0;
    const transport = inputs.monthly_transport_cost || 0;
    const labour = inputs.monthly_labour_cost || 0;
    const rent = inputs.monthly_rent || 0;
    const other_fixed = inputs.monthly_other_fixed_cost || 0;
    const sim_outputs = {};
    if (scenario === "DEMAND_DROP_20" && units !== undefined) {
        inputs.monthly_units_sold = Math.floor(units * 0.8);
        sim_outputs.simulated_monthly_units_sold = inputs.monthly_units_sold;
    }
    else if (scenario === "RAW_MATERIAL_UP_20" && var_cost !== undefined) {
        inputs.variable_cost_per_unit = var_cost * 1.20;
        sim_outputs.simulated_variable_cost_per_unit = inputs.variable_cost_per_unit;
        if (units !== undefined) {
            sim_outputs.simulated_monthly_units_sold = units;
        }
    }
    else if (scenario === "TRANSPORT_COST_SPIKE_50") {
        const new_transport = transport * 1.50;
        inputs.monthly_fixed_cost = labour + rent + new_transport + other_fixed;
        sim_outputs.simulated_monthly_transport_cost = new_transport;
        if (units !== undefined) {
            sim_outputs.simulated_monthly_units_sold = units;
        }
    }
    const res = (0, financeCalculator_1.calculateFinancialAssessment)(inputs, policy);
    if (scenario) {
        for (const k of ["monthly_revenue", "monthly_variable_cost", "monthly_fixed_cost", "monthly_operating_surplus", "business_cash_available_for_debt_service"]) {
            if (res[k] !== undefined) {
                res[`simulated_${k}`] = res[k];
            }
        }
    }
    return { ...res, ...sim_outputs };
}
let passed = 0;
let failed = 0;
for (const testCase of goldenTests) {
    const result = calculateGoldenTestWrapper(testCase.inputs, policy);
    let testPassed = true;
    for (const [key, expectedValue] of Object.entries(testCase.expected)) {
        const resVal = result[key];
        if (expectedValue === null) {
            if (resVal !== null && resVal !== undefined) {
                console.error(`[FAIL] ${testCase.name}: Mismatch for ${key}: expected null, got ${resVal}`);
                testPassed = false;
            }
        }
        else if (typeof expectedValue === 'string') {
            if (resVal !== expectedValue) {
                console.error(`[FAIL] ${testCase.name}: Mismatch for ${key}: expected ${expectedValue}, got ${resVal}`);
                testPassed = false;
            }
        }
        else if (Array.isArray(expectedValue)) {
            if (String(resVal) !== String(expectedValue)) {
                console.error(`[FAIL] ${testCase.name}: Mismatch for ${key}: expected ${expectedValue}, got ${resVal}`);
                testPassed = false;
            }
        }
        else {
            if (Number(expectedValue) !== Number(resVal)) {
                console.error(`[FAIL] ${testCase.name}: Mismatch for ${key}: expected ${expectedValue}, got ${resVal}`);
                testPassed = false;
            }
        }
    }
    if (testPassed) {
        console.log(`[PASS] ${testCase.name}`);
        passed++;
    }
    else {
        failed++;
    }
}
console.log(`\nTests passed: ${passed}, failed: ${failed}`);
if (failed > 0) {
    process.exit(1);
}
