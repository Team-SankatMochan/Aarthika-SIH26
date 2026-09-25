import { useState, useEffect } from 'react';

export type ProvenanceSource = 'USER_PROVIDED' | 'USER_CONFIRMED_ESTIMATE' | 'AARTHIKA_CALCULATION' | 'GOVERNMENT_RULE' | 'MARKET_DATA' | 'AI_EXPLANATION' | 'DEMO_DATA';

export interface CanonicalInput {
  field: string;
  value: number | string | boolean | null;
  unit?: string;
  source: ProvenanceSource;
  confirmed: boolean;
  derivation?: any;
  timestamp: number;
}

class CanonicalInputStore {
  private store: Map<string, CanonicalInput> = new Map();
  private listeners: Set<() => void> = new Set();

  set(input: CanonicalInput) {
    this.store.set(input.field, input);
    this.notify();
  }

  get(field: string): CanonicalInput | undefined {
    return this.store.get(field);
  }

  getAllAsRecord(): Record<string, any> {
    const record: Record<string, any> = {};
    for (const [key, val] of Array.from(this.store.entries())) {
      record[key] = val.value;
    }
    return record;
  }

  getConfirmedValues(): Record<string, any> {
    const record: Record<string, any> = {};
    for (const [key, val] of Array.from(this.store.entries())) {
      if (val.confirmed === true) {
        record[key] = val.value;
      }
    }
    return record;
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private notify() {
    for (const listener of Array.from(this.listeners)) {
      listener();
    }
  }
}

export const globalInputStore = new CanonicalInputStore();

export function useCanonicalInputs() {
  const [inputs, setInputs] = useState(globalInputStore.getAllAsRecord());

  useEffect(() => {
    return globalInputStore.subscribe(() => {
      setInputs(globalInputStore.getAllAsRecord());
    });
  }, []);

  return inputs;
}

export function useConfirmedCanonicalInputs() {
  const [inputs, setInputs] = useState(globalInputStore.getConfirmedValues());

  useEffect(() => {
    return globalInputStore.subscribe(() => {
      setInputs(globalInputStore.getConfirmedValues());
    });
  }, []);

  return inputs;
}
