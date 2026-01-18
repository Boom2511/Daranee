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
        (payload: any) => {
          console.log('[useRealtimeBoats] Received change:', payload);
          // Convert Supabase payload to our RealtimePayload type
          const realtimePayload: RealtimePayload<Boat> = {
            eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            schema: payload.schema,
            table: payload.table,
            new: payload.new,
            old: payload.old,
          };
          onChange(realtimePayload);
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
