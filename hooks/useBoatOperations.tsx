"use client";

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type {
  UpdateBoatStatusParams,
  UpdateBoatStatusResponse,
  CreateBookingParams,
  CreateBookingResponse,
  CheckBoatAvailabilityParams,
} from '@/lib/types';

/**
 * Hook for boat operation functions
 * Handles booking, status updates, and availability checks
 */
export function useBoatOperations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Update boat status (e.g., available, busy, booked, maintenance)
   */
  const updateBoatStatus = async (
    params: UpdateBoatStatusParams
  ): Promise<UpdateBoatStatusResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('update_boat_status', {
        boat_id: params.boat_id,
        new_status: params.new_status,
        caller_line_user_id: params.caller_line_user_id,
      });

      if (rpcError) throw rpcError;

      return data as UpdateBoatStatusResponse;
    } catch (err: any) {
      console.error('[useBoatOperations] updateBoatStatus error:', err);
      setError(err.message || String(err));
      return null;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Check if a boat is available for a specific time period
   */
  const checkAvailability = async (
    params: CheckBoatAvailabilityParams
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('check_boat_availability', {
        boat_id: params.boat_id,
        start_time: params.start_time,
        end_time: params.end_time,
      });

      if (rpcError) throw rpcError;

      return data as boolean;
    } catch (err: any) {
      console.error('[useBoatOperations] checkAvailability error:', err);
      setError(err.message || String(err));
      return false;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Create a new boat booking
   */
  const createBooking = async (
    params: CreateBookingParams
  ): Promise<CreateBookingResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('create_booking', {
        boat_id: params.boat_id,
        line_user_id: params.line_user_id,
        start_time: params.start_time,
        end_time: params.end_time,
        pickup_lat: params.pickup_lat,
        pickup_lon: params.pickup_lon,
      });

      if (rpcError) throw rpcError;

      return data as CreateBookingResponse;
    } catch (err: any) {
      console.error('[useBoatOperations] createBooking error:', err);
      setError(err.message || String(err));
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    updateBoatStatus,
    checkAvailability,
    createBooking,
    loading,
    error,
  };
}

export default useBoatOperations;
