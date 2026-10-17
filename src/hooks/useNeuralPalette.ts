'use client';

import { useSyncExternalStore } from 'react';
import {
  applyPalette,
  DEFAULT_PALETTE_INDEX,
  NEURAL_PALETTES,
  PALETTE_STORAGE_KEY,
} from '@/lib/neural-palettes';

const CHANGE_EVENT = 'neural-palette-change';

function readIndex(): number {
  try {
    const saved = Number(window.localStorage.getItem(PALETTE_STORAGE_KEY));
    if (window.localStorage.getItem(PALETTE_STORAGE_KEY) !== null && NEURAL_PALETTES[saved]) return saved;
  } catch {}
  return DEFAULT_PALETTE_INDEX;
}

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function setNeuralPalette(index: number) {
  try {
    window.localStorage.setItem(PALETTE_STORAGE_KEY, String(index));
  } catch {}
  applyPalette(NEURAL_PALETTES[index]);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useNeuralPalette(): number {
  return useSyncExternalStore(subscribe, readIndex, () => DEFAULT_PALETTE_INDEX);
}
