'use client';

import { useEffect } from 'react';
import { useNeuralPalette } from '@/hooks/useNeuralPalette';
import { applyPalette, NEURAL_PALETTES } from '@/lib/neural-palettes';

export function NeuralPaletteApplier() {
  const index = useNeuralPalette();
  useEffect(() => {
    applyPalette(NEURAL_PALETTES[index]);
  }, [index]);
  return null;
}
