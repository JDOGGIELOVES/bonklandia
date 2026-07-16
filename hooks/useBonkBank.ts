'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BANK_CHANGE_EVENT,
  addChips as addChipsToBank,
  loadBankState,
  spendChips as spendChipsFromBank,
  type BankState,
} from '@/lib/bank';

export function useBonkBank() {
  const [state, setState] = useState<BankState>(() => loadBankState());

  const refresh = useCallback(() => {
    setState(loadBankState());
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener(BANK_CHANGE_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(BANK_CHANGE_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [refresh]);

  const addChips = useCallback((amount: number) => {
    const next = addChipsToBank(amount);
    setState(next);
    return next;
  }, []);

  const spendChips = useCallback((amount: number) => {
    const result = spendChipsFromBank(amount);
    if (result.ok) setState(result.state);
    return result;
  }, []);

  return {
    state,
    chips: state.chips,
    lifetimeChipsWon: state.lifetimeChipsWon,
    lifetimeExchanges: state.lifetimeExchanges,
    addChips,
    spendChips,
    refresh,
  };
}