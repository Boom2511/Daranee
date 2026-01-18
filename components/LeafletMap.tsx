"use client";

import React, { useEffect, useRef, useState } from 'react';
import type { NearbyBoat, BoatStatus, BoatType, MapCenter } from '@/lib/types';

// Dynamically import Leaflet components to avoid SSR issues
let MapContainer: any;
let TileLayer: any;
let CircleMarker: any;
let Popup: any;
let useMap: any;

interface LeafletMapProps {
  center: MapCenter | null;
  boats: NearbyBoat[];
  onBoatClick?: (boat: NearbyBoat) => void;
}

export default function LeafletMap({ center, boats, onBoatClick }: LeafletMapProps) {
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Prevent double initialization in React Strict Mode
    if (hasInitialized.current) {
      return;
    }
    hasInitialized.current = true;

    // Dynamically import react-leaflet only on client side
    import('react-leaflet').then((module) => {
      MapContainer = module.MapContainer;
      TileLayer = module.TileLayer;
      CircleMarker = module.CircleMarker;
      Popup = module.Popup;
      useMap = module.useMap;
      setLeafletLoaded(true);
      
      // Small delay to ensure everything is ready
      setTimeout(() => {
        setMapReady(true);
      }, 100);
    });
  }, []);

  const defaultCenter = center ? [center.lat, center.lon] : [13.7563, 100.5018];

  const colorFor = (status: BoatStatus): string => {
    switch (status) {
      case 'available':
        return '#2ecc71'; // Green
      case 'busy':
        return '#e74c3c'; // Red
      case 'booked':
        return '#f1c40f'; // Yellow
      case 'maintenance':
        return '#95a5a6'; // Gray
      default:
        return '#95a5a6';
    }
  };

  const iconFor = (boatType: BoatType): string => {
    switch (boatType) {
      case 'speedboat':
        return '🚤';
      case 'longtail':
        return '🛶';
      case 'premium':
        return '⛵';
      case 'standard':
      default:
        return '🚢';
    }
  };

  const statusTextTH = (status: BoatStatus): string => {
    switch (status) {
      case 'available':
        return 'ว่าง';
      case 'busy':
        return 'ไม่ว่าง';
      case 'booked':
        return 'จองแล้ว';
      case 'maintenance':
        return 'ซ่อมบำรุง';
      default:
        return status;
    }
  };

  const boatTypeTextTH = (type: BoatType): string => {
    switch (type) {
      case 'standard':
        return 'ปกติ';
      case 'premium':
        return 'พรีเมียม';
      case 'speedboat':
        return 'เรือเร็ว';
      case 'longtail':
        return 'เรือหางยาว';
      default:
        return type;
    }
  };

  const FlyToComponent = ({ center }: { center: MapCenter | null }) => {
    const map = useMap();
    useEffect(() => {
      if (!center) return;
      map.setView([center.lat, center.lon], 14, { animate: true });
    }, [center, map]);
    return null;
  };

  // Wait for Leaflet to load and be ready
  if (!leafletLoaded || !mapReady) {
    return (
      <div style={{ width: '100%', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>Loading map...</div>
      </div>
    );
  }

  return (
    <div ref={mapContainerRef} style={{ width: '100%', height: '100vh' }}>
      {MapContainer && (
        <MapContainer
          center={defaultCenter as [number, number]}
          zoom={13}
          style={{ width: '100%', height: '100%' }}
          zoomControl={true}
          scrollWheelZoom={true}
          attributionControl={true}
          whenReady={() => {
            console.log('[LeafletMap] Map initialized successfully');
          }}
        >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FlyToComponent center={center} />

        {/* User location marker */}
        {center && (
          <CircleMarker
            center={[center.lat, center.lon]}
            radius={10}
            pathOptions={{
              color: '#007aff',
              fillColor: '#007aff',
              fillOpacity: 0.8,
              weight: 3,
            }}
          >
            <Popup>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, marginBottom: 4 }}>📍</div>
                <div style={{ fontWeight: 600 }}>คุณอยู่ที่นี่</div>
                <div style={{ fontSize: 12, color: '#666' }}>
                  {center.lat.toFixed(6)}, {center.lon.toFixed(6)}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        )}

        {/* Boat markers */}
        {boats.map((boat) => (
          <CircleMarker
            key={boat.id}
            center={[boat.latitude, boat.longitude]}
            radius={8}
            pathOptions={{
              color: colorFor(boat.status),
              fillColor: colorFor(boat.status),
              fillOpacity: 0.8,
              weight: 2,
            }}
            eventHandlers={{
              click: () => {
                if (onBoatClick) {
                  onBoatClick(boat);
                }
              },
            }}
          >
            <Popup>
              <div style={{ minWidth: 180, padding: 4 }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>
                  {iconFor(boat.boat_type)}
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                  {boat.name}
                </div>
                <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
                  <div>ประเภท: {boatTypeTextTH(boat.boat_type)}</div>
                  <div>สถานะ: <span style={{ color: colorFor(boat.status), fontWeight: 600 }}>{statusTextTH(boat.status)}</span></div>
                  <div>ที่นั่ง: {boat.capacity} คน</div>
                  {boat.price_per_hour && (
                    <div>ราคา: ฿{boat.price_per_hour.toFixed(0)}/ชม.</div>
                  )}
                </div>
                {typeof boat.distance_m === 'number' && (
                  <div style={{ fontSize: 12, color: '#999', paddingTop: 8, borderTop: '1px solid #eee' }}>
                    📏 ระยะ: {(boat.distance_m / 1000).toFixed(2)} กม.
                  </div>
                )}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      )}
    </div>
  );
}
