'use client';

import React, { useEffect, useState } from 'react';
import type { NearbyBoat, BoatStatus, BoatType, MapCenter } from '@/lib/types';

let MapContainer: any;
let TileLayer: any;
let CircleMarker: any;
let Popup: any;
let useMap: any;

interface LeafletMapProps {
  center: MapCenter | null;
  boats: NearbyBoat[];
  onBoatClick?: (boat: NearbyBoat) => void;
  selectedBoat?: NearbyBoat | null;
}

export default function LeafletMap({ center, boats, onBoatClick, selectedBoat }: LeafletMapProps) {
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const hasInitialized = React.useRef(false);

  useEffect(() => {
    // Prevent double initialization in React Strict Mode
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    import('react-leaflet').then((m) => {
      MapContainer = m.MapContainer;
      TileLayer = m.TileLayer;
      CircleMarker = m.CircleMarker;
      Popup = m.Popup;
      useMap = m.useMap;
      setLeafletLoaded(true);
      
      // Small delay to ensure everything is ready
      setTimeout(() => {
        setMapReady(true);
      }, 100);
    });
  }, []);

  if (!leafletLoaded || !mapReady) {
    return (
      <div style={{ width: '100%', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>Loading map...</div>
      </div>
    );
  }

  const defaultCenter: [number, number] = center
    ? [center.lat, center.lon]
    : [13.7563, 100.5018];

  const colorFor = (status: BoatStatus) => {
    switch (status) {
      case 'available': return '#2ecc71';
      case 'busy': return '#e74c3c';
      case 'booked': return '#f1c40f';
      default: return '#95a5a6';
    }
  };

  const FlyTo = ({ center }: { center: MapCenter | null }) => {
    const map = useMap();
    useEffect(() => {
      if (center) {
        map.setView([center.lat, center.lon], 14, { animate: true });
      }
    }, [center, map]);
    return null;
  };

  // ✅ Fly to selected boat when user clicks from list
  const FlyToBoat = ({ boat }: { boat: NearbyBoat | null }) => {
    const map = useMap();
    useEffect(() => {
      if (boat && boat.latitude !== 0 && boat.longitude !== 0) {
        console.log('[LeafletMap] Flying to selected boat:', boat.name);
        map.setView([boat.latitude, boat.longitude], 15, { 
          animate: true,
          duration: 0.5
        });
        
        // Optional: Open popup after flying
        setTimeout(() => {
          map.eachLayer((layer: any) => {
            if (layer.options?.boatId === boat.id && layer.openPopup) {
              layer.openPopup();
            }
          });
        }, 600);
      }
    }, [boat, map]);
    return null;
  };

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      {MapContainer && (
        <MapContainer
          center={defaultCenter}
          zoom={13}
          style={{ width: '100%', height: '100%' }}
          zoomControl={true}
          scrollWheelZoom={true}
          attributionControl={true}
          whenReady={() => {
            console.log('[LeafletMap] Map initialized successfully');
          }}
        >
          {/* Base map: Carto Voyager (clean and modern) */}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          
          {/* Overlay: OpenSeaMap (nautical information) */}
          <TileLayer
            url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"
            attribution='Map data: &copy; <a href="http://www.openseamap.org">OpenSeaMap</a> contributors'
          />

          <FlyTo center={center} />
          <FlyToBoat boat={selectedBoat || null} />

          {center && (
            <CircleMarker
              center={[center.lat, center.lon]}
              radius={10}
              pathOptions={{ color: '#007aff', fillColor: '#007aff', fillOpacity: 0.8 }}
            >
              <Popup>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#007aff">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  </svg>
                  คุณอยู่ที่นี่
                </div>
              </Popup>
            </CircleMarker>
          )}

          {boats.map((boat) => (
            <CircleMarker
              key={boat.id}
              center={[boat.latitude, boat.longitude]}
              radius={selectedBoat?.id === boat.id ? 12 : 8}
              pathOptions={{
                color: selectedBoat?.id === boat.id ? '#007aff' : colorFor(boat.status),
                fillColor: colorFor(boat.status),
                fillOpacity: selectedBoat?.id === boat.id ? 1 : 0.8,
                weight: selectedBoat?.id === boat.id ? 3 : 2,
              }}
              eventHandlers={{
                click: () => onBoatClick?.(boat),
              }}
              // @ts-ignore - custom property for layer identification
              boatId={boat.id}
            >
              <Popup>
                <div style={{ minWidth: '200px' }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 18h18M3 18l3-9h12l3 9M6 18v-2M18 18v-2M12 9V3M8 5h8"/>
                    </svg>
                    {boat.name}
                  </div>
                  <div style={{ fontSize: 13, color: '#666', lineHeight: 1.6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: 4 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill={
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: 4 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                      </svg>
                      {boat.capacity} คน
                    </div>
                    {boat.price_per_hour && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                        </svg>
                        ฿{boat.price_per_hour.toFixed(0)}/ชม.
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      )}
    </div>
  );
}
