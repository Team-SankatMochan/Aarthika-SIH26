import { useEffect, useState } from 'react';
import { ThemedText, type ThemedTextProps } from './themed-text';

interface AnimatedValueProps extends Omit<ThemedTextProps, 'children'> {
  value: number;
  format?: 'currency' | 'percentage' | 'number';
  formatter?: (value: number) => string;
}

export function AnimatedValue({ value, format = 'number', formatter, ...textProps }: AnimatedValueProps) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    // Simple animation: lerp to target value
    const duration = 300;
    const steps = 20;
    const stepDuration = duration / steps;
    const delta = (value - displayValue) / steps;

    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setDisplayValue(value);
        clearInterval(interval);
      } else {
        setDisplayValue((prev) => prev + delta);
      }
    }, stepDuration);

    return () => clearInterval(interval);
  }, [value]);

  const formatted = formatter
    ? formatter(displayValue)
    : format === 'currency'
    ? `₹${Math.round(displayValue).toLocaleString('en-IN')}`
    : format === 'percentage'
    ? `${Math.round(displayValue)}%`
    : Math.round(displayValue).toString();

  return <ThemedText {...textProps}>{formatted}</ThemedText>;
}
