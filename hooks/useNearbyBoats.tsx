"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { NearbyBoat, BoatStatus, FindNearbyBoatsParams } from '@/lib/types';

interface UseNearbyBoatsOptions {
  lat: number | null;
  lon: number | null;
  radius_km?: number;
  status?: BoatStatus | null;
  autoFetch?: boolean;
}

export default function useNearbyBoats(
  options: UseNearbyBoatsOptions | number | null,
  lon?: number | null,
  radius_km?: number
) {
  // Support both old and new API
  const opts: UseNearbyBoatsOptions = typeof options === 'object' && options !== null
    ? options
    : { lat: options, lon: lon ?? null, radius_km, autoFetch: true };

  const { lat, lon: longitude, radius_km: radiusKm = 5, status = null, autoFetch = true } = opts;

  const [boats, setBoats] = useState<NearbyBoat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNearby = async (params?: Partial<FindNearbyBoatsParams>) => {
    const queryLat = params?.lat ?? lat;
    const queryLon = params?.lon ?? longitude;
    const queryRadius = params?.radius_km ?? radiusKm;
    const queryStatus = params?.boat_status ?? status;

    if (queryLat == null || queryLon == null) {
      console.warn('[useNearbyBoats] Missing lat/lon');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const rpcParams: FindNearbyBoatsParams = {
        lat: queryLat,
        lon: queryLon,
        radius_km: queryRadius,
        boat_status: queryStatus,
      };

      // ✅ Call RPC function in daranee schema
      const { data, error: rpcError } = await supabase
        .schema('daranee')
        .rpc('find_nearby_boats', rpcParams);

      if (rpcError) throw rpcError;

      setBoats((data as NearbyBoat[]) || []);
      console.log(`[useNearbyBoats] Found ${data?.length || 0} boats`);
    } catch (err: any) {
      console.error('[useNearbyBoats] Error:', err);
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!autoFetch) return;

    let mounted = true;

    const runFetch = async () => {
      if (lat == null || longitude == null) return;
      await fetchNearby();
    };

    runFetch();

    return () => {
      mounted = false;
    };
  }, [lat, longitude, radiusKm, status, autoFetch]);

  return { boats, loading, error, setBoats, refetch: fetchNearby } as const;
}
