import { useState, useEffect, useMemo, useRef } from 'react';
import Map, { Marker, Popup, NavigationControl, GeolocateControl, ScaleControl, FullscreenControl, Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const styles = [
  { id: 'streets', label: 'Streets', url: 'mapbox://styles/mapbox/streets-v11' },
  { id: 'outdoors', label: 'Outdoors', url: 'mapbox://styles/mapbox/outdoors-v11' },
  { id: 'light', label: 'Light', url: 'mapbox://styles/mapbox/light-v10' },
  { id: 'dark', label: 'Dark', url: 'mapbox://styles/mapbox/dark-v10' },
  { id: 'satellite', label: 'Satellite', url: 'mapbox://styles/mapbox/satellite-streets-v11' }
];

const SkillMap = ({ users = [], onUserSelect, currentLocation, distanceKm = null, autoFit = true, placeLabel = '', onLocationUpdate, picking = false, pickLocation = null, pickLabel = '', onPickChanged, onPickCancel, onPickConfirm }) => {
  const [viewState, setViewState] = useState({
    longitude: -122.4376,
    latitude: 37.7577,
    zoom: 12
  });
  const [selectedUser, setSelectedUser] = useState(null);
  const [mapStyle, setMapStyle] = useState(styles[0].url);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const mapRef = useRef(null);
  const haversineKm = (coordA, coordB) => {
    if (!coordA || !coordB) return null;
    const toRad = (d) => (d * Math.PI) / 180;
    const [lng1, lat1] = coordA;
    const [lng2, lat2] = coordB;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  useEffect(() => {
    if (currentLocation) {
      setViewState({
        longitude: currentLocation[0],
        latitude: currentLocation[1],
        zoom: 12
      });
      // Fit to results + current location when both available
      try {
        const map = mapRef.current?.getMap?.();
        if (autoFit && map && (users?.length || 0) > 0) {
          let minLng = currentLocation[0], maxLng = currentLocation[0], minLat = currentLocation[1], maxLat = currentLocation[1];
          users.forEach((u) => {
            const lng = u.location?.coordinates?.[0];
            const lat = u.location?.coordinates?.[1];
            if (typeof lng === 'number' && typeof lat === 'number') {
              minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng);
              minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
            }
          });
          map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 60, duration: 800 });
        }
      } catch {}
    }
  }, [currentLocation, !!autoFit]);

  useEffect(() => {
    // if users change and we have no current location, fit to users
    if (autoFit && (!currentLocation || !currentLocation.length) && users && users.length > 0) {
      try {
        const map = mapRef.current?.getMap?.();
        if (!map) return;
        let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
        users.forEach((u) => {
          const lng = u.location?.coordinates?.[0];
          const lat = u.location?.coordinates?.[1];
          if (typeof lng === 'number' && typeof lat === 'number') {
            minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng);
            minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
          }
        });
        if (isFinite(minLng) && isFinite(minLat) && isFinite(maxLng) && isFinite(maxLat)) {
          map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 60, duration: 800 });
        }
      } catch {}
    }
  }, [users?.length, !!autoFit]);

  const handleMarkerClick = (user) => {
    setSelectedUser(user);
    onUserSelect && onUserSelect(user);
  };

  // Build a radius circle polygon around current location
  const radiusGeoJSON = useMemo(() => {
    if (!currentLocation || !distanceKm) return null;
    const [lng, lat] = currentLocation;
    const points = 64;
    const coords = [];
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * 2 * Math.PI;
      // approximate meters per degree
      const kmPerDegLat = 110.574;
      const kmPerDegLng = 111.320 * Math.cos(lat * Math.PI / 180);
      const dLng = (distanceKm * Math.cos(angle)) / kmPerDegLng;
      const dLat = (distanceKm * Math.sin(angle)) / kmPerDegLat;
      coords.push([lng + dLng, lat + dLat]);
    }
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Polygon', coordinates: [coords] }
        }
      ]
    };
  }, [currentLocation?.[0], currentLocation?.[1], distanceKm]);

  // Build pick marker if in picking mode
  const activePick = picking ? (Array.isArray(pickLocation) ? pickLocation : currentLocation) : null;

  return (
    <div className="h-full w-full rounded-lg overflow-hidden">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        style={{ width: '100%', height: '100%' }}
        mapStyle={mapStyle}
        interactiveLayerIds={["clusters","cluster-count","unclustered"]}
        onClick={(e) => {
          const map = mapRef.current?.getMap?.();
          if (!map) return;
          if (picking) {
            const [lng, lat] = e.lngLat?.toArray?.() || [e.lngLat?.lng, e.lngLat?.lat];
            if (typeof lng === 'number' && typeof lat === 'number') {
              onPickChanged && onPickChanged([lng, lat]);
            }
            return;
          }
          const feature = e.features && e.features[0];
          if (!feature) return;
          if (feature.layer?.id === 'clusters' || feature.layer?.id === 'cluster-count') {
            const clusterId = feature.properties?.cluster_id;
            const source = map.getSource('users');
            if (!source || typeof source.getClusterExpansionZoom !== 'function') return;
            source.getClusterExpansionZoom(clusterId, (err, zoom) => {
              if (err) return;
              map.easeTo({ center: feature.geometry.coordinates, zoom });
            });
          } else if (feature.layer?.id === 'unclustered') {
            const userId = feature.properties?.userId;
            const u = users.find(x => String(x._id || x.id) === String(userId));
            if (u) setSelectedUser(u);
          }
        }}
      >
        {/* Controls */}
        <NavigationControl position="top-right" showCompass={true} visualizePitch={true} />
        <GeolocateControl
          position="top-right"
          trackUserLocation
          showUserHeading
          showAccuracyCircle
          onGeolocate={(e) => {
            const lng = e.coords.longitude;
            const lat = e.coords.latitude;
            const acc = typeof e.coords.accuracy === 'number' ? Math.round(e.coords.accuracy) : null;
            setViewState((vs) => ({ ...vs, longitude: lng, latitude: lat, zoom: Math.max(vs.zoom, 13) }));
            if (acc !== null) setGpsAccuracy(acc);
            try { onLocationUpdate && onLocationUpdate([lng, lat]); } catch {}
          }}
        />
        <FullscreenControl position="top-right" />
        <ScaleControl position="bottom-left" maxWidth={120} unit="metric" />

        {/* Style selector and controls */}
        <div className="absolute top-2 left-2 z-10 bg-white/80 backdrop-blur rounded shadow p-2 flex items-center gap-2">
          <select className="text-sm border rounded px-2 py-1" value={mapStyle} onChange={(e) => setMapStyle(e.target.value)}>
            {styles.map(s => (<option key={s.id} value={s.url}>{s.label}</option>))}
          </select>
          <button
            className="text-sm px-2 py-1 rounded border hover:bg-gray-50"
            title="Recenter to saved/current location"
            onClick={() => {
              try {
                const map = mapRef.current?.getMap?.();
                if (!map) return;
                let center = null;
                if (Array.isArray(currentLocation) && currentLocation.length === 2) {
                  center = currentLocation;
                } else if (typeof window !== 'undefined') {
                  try {
                    const saved = JSON.parse(window.localStorage.getItem('searchLocation') || 'null');
                    if (Array.isArray(saved) && saved.length === 2) center = saved;
                  } catch {}
                }
                if (!center) return;
                const targetZoom = Math.max((map.getZoom?.() ?? viewState.zoom ?? 0), 12);
                map.easeTo({ center, zoom: targetZoom, duration: 600 });
              } catch {}
            }}
          >
            Recenter
          </button>
          <button
            className="text-sm px-2 py-1 rounded border hover:bg-gray-50"
            onClick={() => {
              try {
                const map = mapRef.current?.getMap?.();
                if (!map) return;
                let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
                if (currentLocation) {
                  minLng = Math.min(minLng, currentLocation[0]); maxLng = Math.max(maxLng, currentLocation[0]);
                  minLat = Math.min(minLat, currentLocation[1]); maxLat = Math.max(maxLat, currentLocation[1]);
                }
                users.forEach((u) => {
                  const lng = u.location?.coordinates?.[0];
                  const lat = u.location?.coordinates?.[1];
                  if (typeof lng === 'number' && typeof lat === 'number') {
                    minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng);
                    minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
                  }
                });
                if (isFinite(minLng)) {
                  map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 60, duration: 800 });
                }
              } catch {}
            }}
          >
            Fit to results
          </button>
        </div>

        {/* Pick-on-map overlay controls */}
        {picking && (
          <div className="absolute top-2 right-2 z-20 bg-white/90 backdrop-blur rounded shadow px-3 py-2 text-sm flex items-center gap-2 max-w-[70%]">
            <div className="text-gray-700 truncate">
              <div className="font-medium">Pick a location</div>
              {activePick ? (
                <div className="text-[12px] text-gray-600 truncate">
                  {pickLabel ? (
                    <span title={pickLabel}>Selected: {pickLabel}</span>
                  ) : (
                    <span>lng {activePick[0].toFixed(5)}, lat {activePick[1].toFixed(5)}</span>
                  )}
                </div>
              ) : (
                <div className="text-[12px] text-gray-500">Click to drop or drag pin</div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button className="px-2 py-1 rounded border hover:bg-gray-50" onClick={() => onPickCancel && onPickCancel()}>Cancel</button>
              <button
                className="px-2 py-1 rounded bg-green-600 text-white disabled:opacity-50"
                disabled={!activePick}
                onClick={() => activePick && onPickConfirm && onPickConfirm(activePick)}
              >
                Use this location
              </button>
            </div>
          </div>
        )}

        {/* Location label overlay */}
        {placeLabel ? (
          <div className="absolute top-2 right-2 z-10 bg-white/80 backdrop-blur rounded shadow px-3 py-1 text-sm text-gray-700 max-w-[60%] truncate">
            Near: {placeLabel}
          </div>
        ) : null}

        {/* GPS accuracy badge */}
        {typeof gpsAccuracy === 'number' ? (() => {
          const acc = gpsAccuracy;
          const quality = acc < 25 ? 'Good' : acc <= 100 ? 'Fair' : 'Coarse';
          const colorClass = acc < 25 ? 'text-green-700' : acc <= 100 ? 'text-amber-700' : 'text-red-700';
          const dotClass = acc < 25 ? 'bg-green-500' : acc <= 100 ? 'bg-amber-500' : 'bg-red-500';
          return (
            <div className={`absolute top-12 right-2 z-10 bg-white/80 backdrop-blur rounded shadow px-2 py-0.5 text-[11px] ${colorClass} flex items-center gap-1`}>
              <span className={`inline-block h-2 w-2 rounded-full ${dotClass}`}></span>
              <span>~{acc} m • {quality}</span>
            </div>
          );
        })() : null}

        {/* Radius circle */}
        {radiusGeoJSON && (
          <Source id="radius" type="geojson" data={radiusGeoJSON}>
            <Layer id="radius-fill" type="fill" paint={{ 'fill-color': '#10b981', 'fill-opacity': 0.12 }} />
            <Layer id="radius-outline" type="line" paint={{ 'line-color': '#10b981', 'line-width': 2, 'line-opacity': 0.6 }} />
          </Source>
        )}

        {/* Current location marker (hidden during picking) */}
        {!picking && currentLocation && (
          <Marker longitude={currentLocation[0]} latitude={currentLocation[1]} anchor="center">
            <div className="relative">
              <span className="absolute inline-flex h-5 w-5 rounded-full bg-sky-400 opacity-75 animate-ping"></span>
              <span className="relative inline-flex rounded-full h-5 w-5 bg-sky-600 border-2 border-white"></span>
            </div>
          </Marker>
        )}

        {/* Pick marker (draggable-like) */}
        {picking && activePick && (
          <Marker
            longitude={activePick[0]}
            latitude={activePick[1]}
            anchor="bottom"
            draggable
            onDragEnd={(e) => {
              const [lng, lat] = e.lngLat?.toArray?.() || [e.lngLat?.lng, e.lngLat?.lat];
              if (typeof lng === 'number' && typeof lat === 'number') {
                onPickChanged && onPickChanged([lng, lat]);
              }
            }}
          >
            <div className="relative">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-red-600 drop-shadow">
                <path fillRule="evenodd" d="M11.47 3.841a.75.75 0 011.06 0c1.93 1.93 6.47 6.658 6.47 9.659A6 6 0 0112 21a6 6 0 01-7-7.5c0-3.001 4.54-7.729 6.47-9.659zm.53 6.659a3 3 0 100 6 3 3 0 000-6z" clipRule="evenodd" />
              </svg>
            </div>
          </Marker>
        )}

        {/* Clustered users source */}
        <Source
          id="users"
          type="geojson"
          data={{
            type: 'FeatureCollection',
            features: (users || []).filter(u => Array.isArray(u.location?.coordinates)).map((u) => ({
              type: 'Feature',
              properties: {
                userId: String(u._id || u.id),
                credits: u.credits || 0,
                category: (u.skillsOffered && u.skillsOffered[0]?.category) || 'other',
                rating: u.rating?.average || 0,
              },
              geometry: { type: 'Point', coordinates: u.location.coordinates }
            }))
          }}
          cluster={true}
          clusterMaxZoom={14}
          clusterRadius={50}
        >
          <Layer
            id="clusters"
            type="circle"
            filter={["has", "point_count"]}
            paint={{
              // color clusters by average of child point ratings when available, fallback to size
              'circle-color': [
                'case',
                ['has', 'cluster'],
                [
                  'let', 'avg', ['get', 'rating'],
                  [
                    'case',
                    ['>=', ['var', 'avg'], 4.5], '#22c55e',
                    ['>=', ['var', 'avg'], 4.0], '#4ade80',
                    ['>=', ['var', 'avg'], 3.5], '#a3e635',
                    '#86efac'
                  ]
                ],
                [
                  'step',
                  ['get', 'point_count'],
                  '#86efac',
                  10, '#34d399',
                  25, '#10b981'
                ]
              ],
              'circle-radius': [
                'step',
                ['get', 'point_count'],
                16, 10, 20, 25, 26
              ],
              'circle-stroke-color': '#fff',
              'circle-stroke-width': 2
            }}
          />
          <Layer
            id="cluster-count"
            type="symbol"
            filter={["has", "point_count"]}
            layout={{
              'text-field': ['get', 'point_count_abbreviated'],
              'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
              'text-size': 12
            }}
            paint={{ 'text-color': '#064e3b' }}
          />
          <Layer
            id="unclustered"
            type="circle"
            filter={["!has", "point_count"]}
            paint={{
              'circle-color': '#10b981',
              'circle-radius': 8,
              'circle-stroke-color': '#fff',
              'circle-stroke-width': 2
            }}
          />
        </Source>

        {selectedUser && (
          <Popup
            longitude={selectedUser.location?.coordinates[0] || -122.4376}
            latitude={selectedUser.location?.coordinates[1] || 37.7577}
            onClose={() => setSelectedUser(null)}
            closeOnClick={false}
            anchor="bottom"
          >
            <div className="p-2 max-w-xs">
              <h3 className="font-semibold text-lg mb-1 flex items-center gap-2">
                <span>{selectedUser.name}</span>
                {selectedUser.online && (
                  <span className="inline-flex items-center gap-1 text-xs text-green-700">
                    <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                    Online
                  </span>
                )}
              </h3>
              <p className="text-sm text-gray-600 mb-2 line-clamp-2">{selectedUser.bio}</p>
              
              <div className="mb-2">
                <strong className="text-sm">Offers:</strong>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedUser.skillsOffered?.slice(0, 3).map((skill, index) => (
                    <span 
                      key={index} 
                      className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded"
                    >
                      {skill.name}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center text-sm mb-2">
                <span className="text-yellow-600">
                  ⭐ {selectedUser.rating?.average || 'No ratings'}
                </span>
                <span className="text-green-600 font-semibold">
                  {selectedUser.credits} credits
                </span>
              </div>
              {currentLocation && Array.isArray(selectedUser.location?.coordinates) && (
                <div className="text-[12px] text-gray-500 mb-2">
                  {(haversineKm(selectedUser.location.coordinates, currentLocation) || 0).toFixed(1)} km away
                </div>
              )}

              <button 
                className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 text-sm"
                onClick={() => {
                  onUserSelect && onUserSelect(selectedUser);
                  setSelectedUser(null);
                }}
              >
                Connect
              </button>
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
};

export default SkillMap;