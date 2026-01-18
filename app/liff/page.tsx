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
  const { boats, loading, error: boatsError, setBoats } = useNearbyBoats({
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

    setBoats((current) => {
      const map = new Map(current.map((b) => [b.id, b]));

      if (eventType === 'DELETE') {
        const id = oldRow?.id || newRow?.id;
        if (id) {
          map.delete(id);
          console.log(`[LIFF] Boat ${id} deleted`);
        }
      } else if (newRow) {
        // For INSERT or UPDATE
        // Note: realtime payload doesn't include distance_m, 
        // so we need to refetch or calculate it
        const existingBoat = map.get(newRow.id);
        
        // Keep existing distance if available, otherwise set to 0
        const updatedBoat: NearbyBoat = {
          id: newRow.id,
          name: newRow.name,
          status: newRow.status,
          boat_type: newRow.boat_type,
          capacity: newRow.capacity,
          price_per_hour: newRow.price_per_hour,
          latitude: 0, // Will be calculated from location
          longitude: 0,
          updated_at: newRow.updated_at,
          distance_m: existingBoat?.distance_m ?? 0,
        };

        // Extract coordinates from PostGIS geography if needed
        // In practice, you might need to refetch from RPC to get accurate lat/lon
        
        map.set(newRow.id, updatedBoat);
        console.log(`[LIFF] Boat ${newRow.id} ${eventType === 'INSERT' ? 'added' : 'updated'}`);
      }

      return Array.from(map.values());
    });
  }, [setBoats]);

  useRealtimeBoats(handleRealtime);

  // Initialize LIFF
  useEffect(() => {
    const scriptId = 'liff-sdk';
    
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
      const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID || '';
      
      if (!window.liff) {
        setError('LIFF SDK ไม่สามารถโหลดได้');
        return;
      }

      window.liff
        .init({ liffId: LIFF_ID })
        .then(() => {
          console.log('[LIFF] Initialized successfully');
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
        });
    }
  }, []);

  // Watch user location
  useEffect(() => {
    if (!liffReady) return;

    if (!('geolocation' in navigator)) {
      setError('เบราว์เซอร์ไม่รองรับ Geolocation');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        });
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
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>🚢 ดารณี - Boat Finder</div>
            <div style={{ fontSize: 11, color: '#999' }}>
              {lineUserId ? `👤 ${lineUserId.substring(0, 8)}...` : '👤 ไม่ได้เข้าสู่ระบบ'}
            </div>
          </div>
          {position && (
            <div style={{ fontSize: 11, color: '#666', textAlign: 'right' }}>
              📍 {position.lat.toFixed(4)}, {position.lon.toFixed(4)}
            </div>
          )}
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div style={{ 
          padding: '8px 16px', 
          background: '#fee', 
          color: '#c33', 
          fontSize: 13,
          borderBottom: '1px solid #fcc'
        }}>
          ⚠️ {error}
        </div>
      )}

      {boatsError && (
        <div style={{ 
          padding: '8px 16px', 
          background: '#ffc', 
          color: '#880', 
          fontSize: 13,
          borderBottom: '1px solid #dd8'
        }}>
          ⚠️ ไม่สามารถโหลดข้อมูลเรือ: {boatsError}
        </div>
      )}

      {/* Main Content - Map */}
      <main style={{ flex: 1, position: 'relative' }}>
        <LeafletMap center={position} boats={boats} onBoatClick={handleBoatClick} />

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
            <div style={{ fontWeight: 700, fontSize: 15 }}>🚢 เรือใกล้เคียง</div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
              {loading ? '🔄 กำลังโหลด...' : `พบ ${boats.length} ลำ`}
            </div>
          </div>

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
                      <div>ประเภท: {boat.boat_type}</div>
                      <div>สถานะ: <span style={{ 
                        fontWeight: 600,
                        color: boat.status === 'available' ? '#2ecc71' : 
                               boat.status === 'busy' ? '#e74c3c' : 
                               boat.status === 'booked' ? '#f1c40f' : '#95a5a6'
                      }}>
                        {boat.status === 'available' ? 'ว่าง' :
                         boat.status === 'busy' ? 'ไม่ว่าง' :
                         boat.status === 'booked' ? 'จองแล้ว' : 'ซ่อม'}
                      </span></div>
                      <div>ที่นั่ง: {boat.capacity} คน</div>
                      {boat.price_per_hour && (
                        <div>ราคา: ฿{boat.price_per_hour.toFixed(0)}/ชม.</div>
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
