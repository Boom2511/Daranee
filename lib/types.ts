// ============================================
// TypeScript Types for Daranee Application
// Matching schema in supabase/sql/schema_v2.sql
// ============================================

export type BoatStatus = 'available' | 'busy' | 'booked' | 'maintenance';
export type BoatType = 'standard' | 'premium' | 'speedboat' | 'longtail';
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

// Database table types
export interface Boat {
  id: string;
  name: string;
  status: BoatStatus;
  boat_type: BoatType;
  capacity: number;
  price_per_hour: number | null;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  boat_id: string;
  line_user_id: string;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  total_price: number | null;
  created_at: string;
  updated_at: string;
}

export interface Operator {
  id: string;
  line_user_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  rating: number;
  total_trips: number;
  created_at: string;
  updated_at: string;
}

// RPC function return types
export interface NearbyBoat {
  id: string;
  name: string;
  status: BoatStatus;
  boat_type: BoatType;
  capacity: number;
  price_per_hour: number | null;
  latitude: number;
  longitude: number;
  updated_at: string;
  distance_m: number;
}

export interface UpdateBoatStatusResponse {
  success: boolean;
  boat_id?: string;
  status?: BoatStatus;
  updated_at?: string;
  error?: string;
}

export interface CreateBookingResponse {
  success: boolean;
  booking_id?: string;
  total_price?: number;
  total_hours?: number;
  error?: string;
}

// Realtime payload types
export interface RealtimePayload<T = any> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  schema: string;
  table: string;
  new?: T;
  old?: T;
}

// UI types
export interface MapCenter {
  lat: number;
  lon: number;
}

export interface BoatWithDistance extends NearbyBoat {
  // Already includes distance_m from NearbyBoat
}

// Supabase RPC parameters
export interface FindNearbyBoatsParams {
  lat: number;
  lon: number;
  radius_km?: number;
  boat_status?: BoatStatus | null;
}

export interface UpdateBoatStatusParams {
  boat_id: string;
  new_status: BoatStatus;
  caller_line_user_id: string;
}

export interface CheckBoatAvailabilityParams {
  boat_id: string;
  start_time: string;
  end_time: string;
}

export interface CreateBookingParams {
  boat_id: string;
  line_user_id: string;
  start_time: string;
  end_time: string;
  pickup_lat?: number;
  pickup_lon?: number;
}
