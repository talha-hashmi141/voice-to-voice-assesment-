'use client';

import { useEffect, useRef } from 'react';

/** Ref that always holds the latest value – keeps long-lived callbacks (sockets, VAD) free of stale closures. */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}
