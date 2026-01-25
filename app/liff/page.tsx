"use client";

import React, { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import useNearbyBoats from '@/hooks/useNearbyBoats';
import useRealtimeBoats from '@/hooks/useRealtimeBoats';
import type { NearbyBoat, RealtimePayload, Boat, MapCenter } from '@/lib/types';

// dynamic import to avoid SSR issues with Leaflet
const LeafletMap = dynamic(() => import('@/components/LeafletMap'), { ssr: false });

declare global {
  interface Window {
    liff: any;
  }
}

export default function LiffPage() {
  const [liffReady, setLiffReady] = useState(false);
  const [lineUserId, setLineUserId] = useState<string | null>(null);
  const [position, setPosition] = useState<MapCenter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedBoat, setSelectedBoat] = useState<NearbyBoat | null>(null);

  // Use new hook with object syntax
  const { boats, loading, error: boatsError, setBoats, refetch } = useNearbyBoats({
    lat: position?.lat ?? null,
    lon: position?.lon ?? null,
    radius_km: 5,
    status: null, // Show all boats
    autoFetch: true,
  });

  // Handle realtime boat updates with proper typing
  const handleRealtime = useCallback((payload: RealtimePayload<Boat>) => {
    console.log('[LIFF] Realtime update:', payload);

    const { eventType, new: newRow, old: oldRow } = payload;

    if (!newRow && !oldRow) return;

    // ✅ แนะนำ: ไม่ update พิกัด (0,0) โดยตรง → trigger refetch แทน
    // เพราะ realtime payload ไม่มี lat/lon จาก PostGIS geography
    if (eventType === 'DELETE') {
      // ลบเรือออกจาก list ทันที
      const id = oldRow?.id || newRow?.id;
      if (id) {
        setBoats((current) => current.filter((b) => b.id !== id));
        console.log(`[LIFF] Boat ${id} deleted`);
      }
    } else if (eventType === 'INSERT' || eventType === 'UPDATE') {
      // สำหรับ INSERT/UPDATE → refetch เพื่อให้ได้พิกัดที่ถูกต้อง
      console.log(`[LIFF] Boat ${eventType} detected - refetching nearby boats...`);
      
      // Debounce refetch เล็กน้อยเพื่อไม่ให้ยิงถี่เกิน
      setTimeout(() => {
        refetch();
      }, 300);
    }
  }, [setBoats, refetch]);

  useRealtimeBoats(handleRealtime);

  // Initialize LIFF
  useEffect(() => {
    const scriptId = 'liff-sdk';
    
    // ✅ Dev mode fallback: ถ้าไม่มี LIFF_ID หรือเปิดนอก LINE app
    const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID || '';
    
    if (!LIFF_ID || LIFF_ID === 'your_liff_id') {
      console.warn('[LIFF] LIFF_ID missing or not configured – running in DEV mode');
      setLiffReady(true);
      setError('⚠️ Dev Mode: ไม่ได้เชื่อมต่อกับ LINE (ใช้สำหรับทดสอบเท่านั้น)');
      
      // Use mock location for dev (Bangkok)
      setPosition({ lat: 13.7563, lon: 100.5018 });
      return;
    }
    
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js';
      script.async = true;
      script.onload = () => initLiff();
      document.head.appendChild(script);
    } else {
      initLiff();
    }

    function initLiff() {
      if (!window.liff) {
        setError('LIFF SDK ไม่สามารถโหลดได้');
        return;
      }

      window.liff
        .init({ liffId: LIFF_ID })
        .then(() => {
          console.log('[LIFF] Initialized successfully');
          
          // ✅ Check if running inside LINE app
          if (!window.liff.isInClient()) {
            console.warn('[LIFF] Not running in LINE app');
            setError('⚠️ กรุณาเปิดใน LINE app เพื่อใช้งานเต็มรูปแบบ');
            // Still allow usage for testing
            setLiffReady(true);
            return;
          }
          
          setLiffReady(true);

          // Get user profile
          if (window.liff.isLoggedIn()) {
            window.liff
              .getProfile()
              .then((profile: any) => {
                if (profile && profile.userId) {
                  setLineUserId(profile.userId);
                  localStorage.setItem('lineUserId', profile.userId);
                  console.log('[LIFF] User logged in:', profile.userId);
                }
              })
              .catch((err: any) => {
                console.error('[LIFF] Failed to get profile:', err);
              });
          }
        })
        .catch((err: any) => {
          console.error('[LIFF] Init failed:', err);
          setError('LIFF เริ่มต้นไม่สำเร็จ: ' + String(err));
          
          // ✅ Fallback: ให้ใช้งานได้แม้ LIFF fail (dev-friendly)
          setLiffReady(true);
        });
    }
  }, []);

  // Watch user location with debounce to prevent excessive API calls
  useEffect(() => {
    if (!liffReady) return;

    if (!('geolocation' in navigator)) {
      setError('เบราว์เซอร์ไม่รองรับ Geolocation');
      return;
    }

    let lastPosition: MapCenter | null = null;

    // Helper function to calculate distance between two points (Haversine formula)
    const calculateDistance = (pos1: MapCenter, pos2: MapCenter): number => {
      const R = 6371000; // Earth's radius in meters
      const lat1 = pos1.lat * Math.PI / 180;
      const lat2 = pos2.lat * Math.PI / 180;
      const deltaLat = (pos2.lat - pos1.lat) * Math.PI / 180;
      const deltaLon = (pos2.lon - pos1.lon) * Math.PI / 180;

      const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                Math.cos(lat1) * Math.cos(lat2) *
                Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      return R * c; // Distance in meters
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const newPosition: MapCenter = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        };

        // ✅ Debounce: อัปเดตเฉพาะเมื่อขยับมากกว่า 50 เมตร
        // ป้องกัน watchPosition ยิงทุก 2-5 วิ → battery drain + API quota
        if (!lastPosition) {
          // First position - always update
          setPosition(newPosition);
          lastPosition = newPosition;
          console.log('[LIFF] Initial position set');
        } else {
          const distance = calculateDistance(lastPosition, newPosition);
          
          // Update only if moved more than 50 meters
          if (distance > 50) {
            setPosition(newPosition);
            lastPosition = newPosition;
            console.log(`[LIFF] Position updated (moved ${distance.toFixed(0)}m)`);
          } else {
            console.log(`[LIFF] Position change ignored (only ${distance.toFixed(0)}m)`);
          }
        }
      },
      (err) => {
        console.error('[LIFF] Geolocation error:', err);
        setError('ไม่สามารถเข้าถึงตำแหน่งได้: ' + err.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [liffReady]);

  const handleBoatClick = useCallback((boat: NearbyBoat) => {
    setSelectedBoat(boat);
    console.log('[LIFF] Boat selected:', boat);
  }, []);

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ 
        padding: '12px 16px', 
        background: '#fff', 
        zIndex: 1000,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        borderBottom: '1px solid #eee'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 18h18M3 18l3-9h12l3 9M6 18v-2M18 18v-2M12 9V3M8 5h8"/>
            </svg>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>ดารณี - Boat Finder</div>
              <div style={{ fontSize: 11, color: '#999', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {lineUserId ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                    </svg>
                    {lineUserId.substring(0, 8)}...
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"/>
                    </svg>
                    {!window.liff?.isInClient?.() && 'Dev Mode'}
                  </>
                )}
              </div>
            </div>
          </div>
          {position && (
            <div style={{ fontSize: 11, color: '#666', textAlign: 'right', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
              {position.lat.toFixed(4)}, {position.lon.toFixed(4)}
            </div>
          )}
        </div>
      </header>

      {/* Main Content - Map */}
      <main style={{ flex: 1, position: 'relative' }}>
        <LeafletMap 
          center={position} 
          boats={boats} 
          onBoatClick={handleBoatClick}
          selectedBoat={selectedBoat}
        />

        {/* Boat List Sidebar */}
        <aside style={{ 
          position: 'absolute', 
          right: 8, 
          top: 8, 
          zIndex: 999, 
          maxHeight: '70vh', 
          overflow: 'auto', 
          background: 'rgba(255,255,255,0.97)', 
          borderRadius: 12, 
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)', 
          width: 300,
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{ 
            padding: '12px 16px', 
            borderBottom: '2px solid #eee',
            background: '#f8f9fa',
            borderRadius: '12px 12px 0 0'
          }}>
            <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 18h18M3 18l3-9h12l3 9M6 18v-2M18 18v-2M12 9V3M8 5h8"/>
              </svg>
              เรือใกล้เคียง
            </div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 4, display: 'flex', alignItems: 'center', gap: '4px' }}>
              {loading ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  กำลังโหลด...
                </>
              ) : boatsError ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <span style={{ color: '#e74c3c' }}>ไม่สามารถโหลดข้อมูล</span>
                </>
              ) : (
                `พบ ${boats.length} ลำ`
              )}
            </div>
          </div>
          <style dangerouslySetInnerHTML={{ __html: '@keyframes spin { to { transform: rotate(360deg); } }' }} />

          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {boats.length === 0 && !loading && (
              <li style={{ padding: '24px 16px', textAlign: 'center', color: '#999' }}>
                ไม่พบเรือในบริเวณนี้
              </li>
            )}
            {boats.map((boat) => (
              <li 
                key={boat.id} 
                style={{ 
                  padding: '12px 16px', 
                  borderBottom: '1px solid #f0f0f0',
                  cursor: 'pointer',
                  background: selectedBoat?.id === boat.id ? '#f0f8ff' : 'transparent',
                  transition: 'background 0.2s'
                }}
                onClick={() => handleBoatClick(boat)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                      {boat.name}
                    </div>
                    <div style={{ fontSize: 12, color: '#666', lineHeight: 1.5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 18h18M3 18l3-9h12l3 9"/>
                        </svg>
                        {boat.boat_type}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill={
                          boat.status === 'available' ? '#2ecc71' : 
                          boat.status === 'busy' ? '#e74c3c' : 
                          boat.status === 'booked' ? '#f1c40f' : '#95a5a6'
                        }>
                          <circle cx="12" cy="12" r="10"/>
                        </svg>
                        <span style={{ 
                          fontWeight: 600,
                          color: boat.status === 'available' ? '#2ecc71' : 
                                 boat.status === 'busy' ? '#e74c3c' : 
                                 boat.status === 'booked' ? '#f1c40f' : '#95a5a6'
                        }}>
                          {boat.status === 'available' ? 'ว่าง' :
                           boat.status === 'busy' ? 'ไม่ว่าง' :
                           boat.status === 'booked' ? 'จองแล้ว' : 'ซ่อม'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                        </svg>
                        {boat.capacity} คน
                      </div>
                      {boat.price_per_hour && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                          </svg>
                          {boat.price_per_hour.toFixed(0)}/ชม.
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: '#999', textAlign: 'right', marginLeft: 8 }}>
                    {(boat.distance_m / 1000).toFixed(2)} กม.
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </main>
    </div>
  );
}
