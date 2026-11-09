'use client';

import { useCallback } from 'react';
import { conversationsApi } from '@/lib/api';
import { useApi } from '@/lib/hooks';

export function useConversations() {
  const loader = useCallback(() => conversationsApi.list(), []);
  return useApi(loader);
}

export function useConversation(id: string) {
  const loader = useCallback(() => conversationsApi.get(id), [id]);
  return useApi(loader);
}
