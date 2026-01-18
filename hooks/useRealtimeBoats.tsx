"use client";

import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { RealtimePayload, Boat } from '@/lib/types';

/**
 * Hook to listen for real-time changes on boats table
 * Uses new 'daranee' schema
 */
export default function useRealtimeBoats(onChange: (payload: RealtimePayload<Boat>) => void) {
  useEffect(() => {
    // Subscribe to changes in daranee.boats table
    const channel = supabase
      .channel('daranee:boats')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'daranee',
          table: 'boats',
        },
        (payload) => {
          console.log('[useRealtimeBoats] Received change:', payload);
          onChange(payload as RealtimePayload<Boat>);
        }
      )
      .subscribe((status) => {
        console.log('[useRealtimeBoats] Subscription status:', status);
      });

    return () => {
      console.log('[useRealtimeBoats] Unsubscribing');
      channel.unsubscribe();
    };
  }, [onChange]);
}
