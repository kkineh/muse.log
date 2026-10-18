'use client';

import { useSyncExternalStore } from 'react';

const KEY = 'neural-minimap-collapsed';
const EVENT = 'neural-minimap-collapsed-change';

function read(): boolean {
  try {
    return window.sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

export function useMinimapCollapsed(): [boolean, (collapsed: boolean) => void] {
  const collapsed = useSyncExternalStore(subscribe, read, () => false);
  const setCollapsed = (value: boolean) => {
    try {
      window.sessionStorage.setItem(KEY, value ? '1' : '0');
    } catch {}
    window.dispatchEvent(new Event(EVENT));
  };
  return [collapsed, setCollapsed];
}
