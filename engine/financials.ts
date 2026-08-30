export interface ProjectInputs {
    marginCapital: number;
    marginPercent: number;
}

export function calculateProjectCost({ marginCapital, marginPercent }: ProjectInputs): number {
    return marginCapital / marginPercent;
}

export function calculateEMI(loanAmount: number, annualRatePercent: number, months: number): number {
    const r = annualRatePercent / 12 / 100;
    return (loanAmount * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}