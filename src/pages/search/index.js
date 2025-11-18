import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import SearchResults from '../../components/search/SearchResults';
import SkillMap from '../../components/map/SkillMap';
import Modal from '../../components/ui/Modal';
import PageHeader from '../../components/ui/PageHeader';
import GradientPill from '../../components/ui/GradientPill';
import InteractiveCard from '../../components/ui/InteractiveCard';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

export default function SearchPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    query: '',
    category: 'all',
    distance: 10,
    sort: 'relevance', // relevance | rating | credits
    withinRadius: false,
    autoFit: true
  });
  const [currentLocation, setCurrentLocation] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [auto, setAuto] = useState(true);
  const [address, setAddress] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);
  const addressInputRef = useRef(null);
  const hydratedRef = useRef(false);
  const [placeLabel, setPlaceLabel] = useState('');
  // Pick-on-map state
  const [pickMode, setPickMode] = useState(false);
  const [pickLoc, setPickLoc] = useState(null); // [lng, lat]
  const [pickLabel, setPickLabel] = useState('');
  const [pickFetching, setPickFetching] = useState(false);
  const [hireOpen, setHireOpen] = useState(false);
  const [hireTarget, setHireTarget] = useState(null);
  const [submittingHire, setSubmittingHire] = useState(false);
  const { 
    user: currentUser,
    refreshFavorites,
    addFavorite,
    removeFavorite,
    refreshSavedSearches,
    createSavedSearch,
    deleteSavedSearch,
    isAuthenticated
  } = useAuth();
  const { addToast } = useToast();
  const lastGpsToastRef = useRef({ time: 0, loc: null });
  const [savedSearches, setSavedSearches] = useState([]);
  const favorites = currentUser?.favorites || [];

  const router = useRouter();
  useEffect(() => {
    if (currentUser?.savedSearches) {
      setSavedSearches(currentUser.savedSearches);
    } else {
      setSavedSearches([]);
    }
  }, [currentUser?.savedSearches]);

  useEffect(() => {
    if (currentUser?.id) {
      refreshFavorites?.();
      refreshSavedSearches?.();
    }
  }, [currentUser?.id]);


  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'home', label: 'Home & Garden' },
    { value: 'tech', label: 'Technology' },
    { value: 'creative', label: 'Creative' },
    { value: 'education', label: 'Education' },
    { value: 'health', label: 'Health & Wellness' },
    { value: 'other', label: 'Other' }
  ];

  useEffect(() => {
    // One-time hydration from localStorage
    if (hydratedRef.current) return;
    try {
      const savedFilters = JSON.parse(localStorage.getItem('searchFilters') || 'null');
      if (savedFilters && typeof savedFilters === 'object') {
        const { auto: savedAuto, ...rest } = savedFilters;
        setFilters((prev) => ({ ...prev, ...rest }));
        if (typeof savedAuto === 'boolean') setAuto(savedAuto);
      }
      const savedLoc = JSON.parse(localStorage.getItem('searchLocation') || 'null');
      if (Array.isArray(savedLoc) && savedLoc.length === 2) {
        setCurrentLocation(savedLoc);
      }
      const savedLabel = localStorage.getItem('searchLocationLabel');
      if (savedLabel) setPlaceLabel(savedLabel);
    } catch {}
    hydratedRef.current = true;
  }, []);

  // React to URL query changes without rehydrating
  useEffect(() => {
    if (router.query?.q) {
      setFilters(prev => ({ ...prev, query: router.query.q }));
      performSearch({ query: router.query.q });
    }
  }, [router.query?.q]);

  // Request geolocation only when auto is enabled
  useEffect(() => {
    if (auto && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation([
            position.coords.longitude,
            position.coords.latitude
          ]);
        },
        (error) => {
          console.log('Geolocation error:', error);
        }
      );
    }
  }, [auto]);

  // Auto-focus address input when switching to manual (disabled for auto to avoid flicker)
  useEffect(() => {
    if (!auto) {
      try { addressInputRef.current?.focus(); } catch {}
    }
  }, [auto]);

  // Persist filters and location
  useEffect(() => {
    try {
    const { query, category, distance, sort, withinRadius, autoFit } = filters;
    localStorage.setItem('searchFilters', JSON.stringify({ query, category, distance, sort, withinRadius, autoFit, auto }));
    } catch {}
  }, [filters.query, filters.category, filters.distance, filters.sort, filters.withinRadius, filters.autoFit, auto]);
  useEffect(() => {
    try {
      if (currentLocation && currentLocation.length === 2) {
        localStorage.setItem('searchLocation', JSON.stringify(currentLocation));
      }
    } catch {}
  }, [currentLocation?.[0], currentLocation?.[1]]);
  useEffect(() => {
    try {
      if (placeLabel) localStorage.setItem('searchLocationLabel', placeLabel);
    } catch {}
  }, [placeLabel]);

  // Debounced search on filters change
  useEffect(() => {
    const t = setTimeout(() => {
      performSearch();
    }, 350);
    return () => clearTimeout(t);
  }, [filters.query, filters.category, filters.distance, filters.sort, currentLocation?.[0], currentLocation?.[1]]);

  // Reverse geocode currentLocation to a human label with throttling
  useEffect(() => {
    let abort = false;
    const doReverse = async () => {
      try {
        if (!currentLocation || !Array.isArray(currentLocation)) return;
        const res = await fetch(`/api/geocode/reverse?lng=${currentLocation[0]}&lat=${currentLocation[1]}`);
        const data = await res.json();
        const label = data?.features?.[0]?.place_name;
        if (!abort && label) setPlaceLabel(label);
      } catch {}
    };
    // Throttle by only reverse geocoding when auto mode is enabled and location changed significantly
    if (auto && currentLocation) {
      doReverse();
    }
    return () => { abort = true; };
  }, [currentLocation?.[0], currentLocation?.[1], auto]);

  // Reverse geocode pick location while picking
  useEffect(() => {
    let abort = false;
    const run = async () => {
      try {
        if (!pickMode || !Array.isArray(pickLoc)) return;
        const res = await fetch(`/api/geocode/reverse?lng=${pickLoc[0]}&lat=${pickLoc[1]}`);
        const data = await res.json();
        const label = data?.features?.[0]?.place_name;
        if (!abort) setPickLabel(label || '');
      } catch {}
    };
    run();
    return () => { abort = true; };
  }, [pickMode, pickLoc?.[0], pickLoc?.[1]]);

  const performSearch = async (newFilters = {}, locationOverride = null) => {
    const searchParams = { ...filters, ...newFilters };
    setLoading(true);

    try {
      const params = new URLSearchParams();
      Object.entries(searchParams).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const coords = Array.isArray(locationOverride) ? locationOverride : currentLocation;
      if (coords) {
        params.append('lng', coords[0]);
        params.append('lat', coords[1]);
      }

      const response = await fetch(`/api/users/search?${params}`);
      const data = await response.json();

      if (response.ok) {
        let list = data.users || [];
        // optional client-side trim to within radius of currentLocation
        if (searchParams.withinRadius && coords && Number(searchParams.distance)) {
          const toRad = (d) => (d * Math.PI) / 180;
          const hav = (a, b) => {
            const [lng1, lat1] = a; const [lng2, lat2] = b; const R = 6371;
            const dLat = toRad(lat2 - lat1); const dLng = toRad(lng2 - lng1);
            const h = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;
            const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1-h));
            return R * c;
          };
          list = list.filter(u => Array.isArray(u.location?.coordinates) && hav(u.location.coordinates, coords) <= Number(searchParams.distance));
        }
        // client-side sort options for quick UX
        if (searchParams.sort === 'rating') {
          list = [...list].sort((a, b) => (b.rating?.average || 0) - (a.rating?.average || 0));
        } else if (searchParams.sort === 'credits') {
          list = [...list].sort((a, b) => (b.credits || 0) - (a.credits || 0));
        }
        setUsers(list);
      }
    } catch (error) {
      console.error('Search error:', error);
    }
    setLoading(false);
  };

  const handleToggleFavorite = async (user) => {
    if (!currentUser) {
      router.push('/auth/login');
      return;
    }
    const providerId = user._id || user.id;
    const isFavorite = favorites?.includes?.(providerId);
    if (isFavorite) {
      const result = await removeFavorite?.(providerId);
      if (result?.success) {
        addToast?.({ type: 'info', title: 'Removed', message: `${user.name} removed from favorites` });
      } else if (result?.error) {
        addToast?.({ type: 'error', title: 'Could not update favorites', message: result.error });
      }
    } else {
      const result = await addFavorite?.(providerId);
      if (result?.success) {
        addToast?.({ type: 'success', title: 'Favorited', message: `${user.name} saved for quick access` });
      } else if (result?.error) {
        addToast?.({ type: 'error', title: 'Could not favorite', message: result.error });
      }
    }
  };

  const handleSaveCurrentSearch = async () => {
    if (!currentUser) {
      router.push('/auth/login');
      return;
    }
    const defaultName = filters.query ? `"${filters.query}" nearby` : 'My search';
    const name = window.prompt('Name this search', defaultName);
    if (!name) return;
    const payload = {
      query: filters.query || '',
      category: filters.category || 'all',
      distance: Number(filters.distance) || 10,
      sort: filters.sort || 'relevance',
      withinRadius: !!filters.withinRadius,
      autoFit: !!filters.autoFit
    };
    const result = await createSavedSearch?.(name, payload);
    if (result?.success) {
      addToast?.({ type: 'success', title: 'Search saved', message: 'Find it anytime under saved searches.' });
    } else if (result?.error) {
      addToast?.({ type: 'error', title: 'Could not save search', message: result.error });
    }
  };

  const handleApplySavedSearch = (entry) => {
    if (!entry) return;
    const entryFilters = entry.filters || {};
    setFilters(prev => ({
      ...prev,
      ...entryFilters,
      distance: entryFilters.distance != null ? String(entryFilters.distance) : prev.distance
    }));
    performSearch({ ...entryFilters, distance: entryFilters.distance });
    addToast?.({ type: 'success', title: 'Filters applied', message: `Using saved search “${entry.name}”` });
  };

  const handleDeleteSavedSearch = async (id) => {
    const result = await deleteSavedSearch?.(id);
    if (result?.success) {
      addToast?.({ type: 'info', title: 'Removed', message: 'Saved search deleted' });
    } else if (result?.error) {
      addToast?.({ type: 'error', title: 'Could not delete search', message: result.error });
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleUserSelect = (user) => {
    setSelectedUser(user);
    const userId = user._id || user.id;
    router.push(`/profile/${userId}`);
  };

  const handleMapUserSelect = (user) => {
    setSelectedUser(user);
    const userElement = document.getElementById(`user-${user._id || user.id}`);
    if (userElement) {
      userElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      userElement.classList.add('bg-blue-50');
      setTimeout(() => { userElement.classList.remove('bg-blue-50'); }, 2000);
    }
  };

  const handleManualLocationSubmit = async () => {
    const trimmed = address.trim();
    if (!trimmed) return;
    try {
      setGeoLoading(true);
      const res = await fetch(`/api/geocode/forward?q=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      const f = data?.features?.[0];
      const center = f?.center;
      if (Array.isArray(center) && center.length === 2) {
        setCurrentLocation(center);
        performSearch({}, center);
        const label = f?.place_name || trimmed;
        if (label) {
          setPlaceLabel(label);
          addToast?.({ type: 'success', title: 'Location updated', message: `Near: ${label}` });
        }
      }
    } catch (error) {
      console.error('Manual geocode error', error);
      addToast?.({ type: 'error', title: 'Location not found', message: 'Try a more specific address or pick on the map.' });
    } finally {
      setGeoLoading(false);
    }
  };

  const resultCount = Array.isArray(users) ? users.length : 0;
  const resultHeading = resultCount === 0 ? 'No matches yet' : `${resultCount} ${resultCount === 1 ? 'neighbor' : 'neighbors'} ready to trade`;
  const resultSubheading = placeLabel
    ? `Centered around ${placeLabel}`
    : 'Set a location to unlock hyperlocal results';

  return (
    <div className="space-y-12">
      <div className="mx-auto max-w-7xl space-y-10 px-4 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Search the marketplace"
          title="Find neighbors ready to swap skills"
          subtitle={resultSubheading}
          actions={
            <button
              type="button"
              onClick={handleSaveCurrentSearch}
              disabled={!currentUser}
              className={`btn-secondary whitespace-nowrap ${currentUser ? 'hover:-translate-y-[1px]' : 'opacity-60 cursor-not-allowed'}`}
            >
              {currentUser ? 'Save this search' : 'Log in to save searches'}
            </button>
          }
        />

        <div className="grid gap-8 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-6">
            <InteractiveCard className="space-y-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-500 dark:text-slate-300">Saved searches</p>
                  {savedSearches.length === 0 && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">Keep a favorite combo of filters for one-click reuse.</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleSaveCurrentSearch}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.26em] transition-all duration-200 ${currentUser ? 'border-emerald-200 text-emerald-600 hover:border-emerald-300 hover:text-emerald-800 dark:border-emerald-500/40 dark:text-emerald-200 dark:hover:border-emerald-400/70' : 'cursor-not-allowed border-slate-200 text-slate-400 dark:border-slate-700 dark:text-slate-600'}`}
                  disabled={!currentUser}
                >
                  Quick save
                </button>
              </div>

              {savedSearches.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {savedSearches.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => handleApplySavedSearch(entry)}
                      className="group inline-flex items-center gap-2 rounded-full border border-emerald-200/60 bg-emerald-50/70 px-3 py-1 text-sm text-emerald-700 transition hover:border-emerald-300 hover:text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                    >
                      <span>{entry.name}</span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); handleDeleteSavedSearch(entry.id); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleDeleteSavedSearch(entry.id); } }}
                        className="rounded-full bg-white/80 px-2 py-0.5 text-xs text-emerald-600 transition group-hover:bg-emerald-100/70 dark:bg-emerald-500/10 dark:text-emerald-100"
                      >
                        ✕
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-300">
                    Skill or keyword
                  </label>
                  <input
                    type="text"
                    value={filters.query}
                    onChange={(e) => handleFilterChange('query', e.target.value)}
                    placeholder="e.g., gardening, coding, cooking"
                    className="input-field"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-300">Category</label>
                    <select
                      value={filters.category}
                      onChange={(e) => handleFilterChange('category', e.target.value)}
                      className="input-field"
                    >
                      {categories.map(cat => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-300">Distance (km)</label>
                    <select
                      value={filters.distance}
                      onChange={(e) => handleFilterChange('distance', e.target.value)}
                      className="input-field"
                    >
                      <option value="5">5 km</option>
                      <option value="10">10 km</option>
                      <option value="25">25 km</option>
                      <option value="50">50 km</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-500 dark:text-slate-300">Location focus</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => { setAuto(true); setPickMode(false); }}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${auto && !pickMode ? 'border-emerald-300 bg-emerald-50/70 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200' : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300'}`}
                  >
                    Use GPS
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAuto(false); setPickMode(false); }}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${!auto && !pickMode ? 'border-emerald-300 bg-emerald-50/70 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200' : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300'}`}
                  >
                    Manual address
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPickMode(true); setAuto(false); setPickLoc(null); setPickLabel(''); }}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${pickMode ? 'border-emerald-300 bg-emerald-50/70 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200' : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300'}`}
                  >
                    Pick on map
                  </button>
                  {pickMode && (
                    <button
                      type="button"
                      onClick={() => { setPickMode(false); setPickLoc(null); setPickLabel(''); }}
                      className="rounded-full border border-rose-200 px-3 py-1.5 text-sm font-medium text-rose-600 transition hover:border-rose-300 hover:text-rose-700 dark:border-rose-500/40 dark:text-rose-200"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                {placeLabel && (
                  <p className="text-xs text-slate-500 dark:text-slate-300">
                    Current anchor: <span className="font-semibold text-slate-700 dark:text-slate-100">{placeLabel}</span>
                  </p>
                )}

                {!auto && !pickMode && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-300">Manual address</label>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        ref={addressInputRef}
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Enter an address or place"
                        className="input-field flex-1"
                      />
                      <button
                        type="button"
                        onClick={handleManualLocationSubmit}
                        disabled={geoLoading || !address.trim()}
                        className="btn-primary w-full justify-center sm:w-auto"
                      >
                        {geoLoading ? 'Locating…' : 'Set location'}
                      </button>
                    </div>
                  </div>
                )}

                {pickMode && (
                  <div className="rounded-2xl border border-dashed border-emerald-300/60 bg-emerald-50/70 px-4 py-3 text-xs text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200">
                    {pickLabel ? `Map pin ready: ${pickLabel}. Drag to refine and confirm on the map.` : 'Click on the map to drop a pin. Drag to fine tune, then confirm above the map.'}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-3 text-sm font-medium text-slate-600 dark:text-slate-200">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-400"
                    checked={!!filters.withinRadius}
                    onChange={(e) => handleFilterChange('withinRadius', e.target.checked)}
                  />
                  Only show neighbors within {filters.distance} km
                </label>
                <label className="flex items-center gap-3 text-sm font-medium text-slate-600 dark:text-slate-200">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-400"
                    checked={!!filters.autoFit}
                    onChange={(e) => handleFilterChange('autoFit', e.target.checked)}
                  />
                  Auto-fit map to results
                </label>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500 dark:text-slate-300">
                  Filters update automatically — refresh anytime for the latest availability.
                </p>
                <button
                  onClick={() => performSearch()}
                  disabled={loading}
                  className="btn-primary w-full justify-center sm:w-auto"
                >
                  {loading ? 'Searching…' : 'Refresh results'}
                </button>
              </div>
            </InteractiveCard>
          </div>

          <div className="space-y-6">
            <InteractiveCard className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-100">{resultHeading}</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{resultSubheading}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {placeLabel && <GradientPill>Near {placeLabel}</GradientPill>}
                <label className="flex items-center gap-2 rounded-full border border-white/60 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-slate-500 dark:border-slate-800/70 dark:bg-slate-900/60">
                  Sort
                  <select
                    value={filters.sort}
                    onChange={(e) => handleFilterChange('sort', e.target.value)}
                    className="bg-transparent text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-600 focus:outline-none dark:text-slate-200"
                  >
                    <option value="relevance">Relevance</option>
                    <option value="rating">Rating</option>
                    <option value="credits">Credits</option>
                  </select>
                </label>
              </div>
            </InteractiveCard>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,1fr)]">
              <InteractiveCard className="p-0">
                <SearchResults
                  users={users}
                  loading={loading}
                  onUserSelect={handleUserSelect}
                  currentLocation={currentLocation}
                  favorites={favorites}
                  onToggleFavorite={handleToggleFavorite}
                  isAuthenticated={!!isAuthenticated}
                  onHire={(u) => {
                    if (!currentUser) { router.push('/auth/login'); return; }
                    setHireTarget(u);
                    setHireOpen(true);
                  }}
                />
              </InteractiveCard>

              <InteractiveCard className="flex flex-col gap-3 p-0">
                <div className="h-[520px] w-full overflow-hidden rounded-[28px]">
                  <SkillMap
                    users={users}
                    onUserSelect={handleMapUserSelect}
                    currentLocation={currentLocation}
                    distanceKm={Number(filters.distance) || null}
                    autoFit={!!filters.autoFit}
                    placeLabel={placeLabel}
                    picking={pickMode}
                    pickLocation={pickLoc}
                    pickLabel={pickLabel}
                    onPickChanged={(ll) => setPickLoc(ll)}
                    onPickCancel={() => { setPickMode(false); setPickLoc(null); setPickLabel(''); }}
                    onPickConfirm={(ll) => {
                      if (!Array.isArray(ll) || ll.length !== 2) return;
                      setCurrentLocation(ll);
                      setPickMode(false);
                      const label = pickLabel?.trim();
                      if (label) {
                        setPlaceLabel(label);
                        setAddress(label);
                      }
                      setAuto(false);
                      performSearch({}, ll);
                      if (label) {
                        addToast?.({ type: 'success', title: 'Location updated', message: `Near: ${label}` });
                      } else {
                        addToast?.({ type: 'success', title: 'Location updated', message: 'Using chosen map location' });
                      }
                      setTimeout(() => { try { addressInputRef.current?.focus(); } catch {} }, 0);
                    }}
                    onLocationUpdate={(loc) => {
                      if (Array.isArray(loc) && loc.length === 2) {
                        const havKm = (a, b) => {
                          if (!a || !b) return Infinity;
                          const toRad = (d) => (d * Math.PI) / 180;
                          const [lng1, lat1] = a; const [lng2, lat2] = b; const R = 6371;
                          const dLat = toRad(lat2 - lat1); const dLng = toRad(lng2 - lng1);
                          const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
                          const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
                          return R * c;
                        };
                        const movedKm = currentLocation ? havKm(currentLocation, loc) : Infinity;
                        if (movedKm < 0.03) return;
                        setCurrentLocation(loc);
                        const now = Date.now();
                        const last = lastGpsToastRef.current;
                        if (!currentLocation || movedKm > 0.2) {
                          if (now - last.time > 15000) {
                            addToast?.({ type: 'success', title: 'Location updated', message: 'Using your current location' });
                            lastGpsToastRef.current = { time: now, loc };
                          }
                        }
                      }
                    }}
                  />
                </div>
                {pickMode && (
                  <p className="mx-6 mb-6 text-xs text-slate-500 dark:text-slate-300">
                    Use the map controls to fine tune your pin, then choose Confirm on the map overlay.
                  </p>
                )}
              </InteractiveCard>
            </div>
          </div>
        </div>
      </div>

      {/* Hire Modal */}
      <Modal open={hireOpen} onClose={() => setHireOpen(false)} title={hireTarget ? `Hire ${hireTarget.name}` : 'Hire'}>
        {hireOpen && (
          <HireForm
            skills={hireTarget?.skillsOffered || []}
            availableCredits={currentUser?.credits || 0}
            submitting={submittingHire}
            onSubmit={async ({ skillId, duration, credits, scheduled, custom }) => {
              if (!currentUser) { router.push('/auth/login'); return; }
              try {
                setSubmittingHire(true);
                const token = localStorage.getItem('token');
                // Build skill object
                const selected = (hireTarget?.skillsOffered || []).find(s => (s._id && String(s._id) === String(skillId)) || (!s._id && s.name === skillId));
                let skillObj = null;
                if (selected) {
                  skillObj = { name: selected.name, category: selected.category, description: selected.description };
                } else {
                  const customName = custom?.name?.trim();
                  const customDesc = (custom?.description || '').trim();
                  if (!customName) {
                    addToast?.({ type: 'error', title: 'Missing skill', message: 'Please enter the requested skill name' });
                    setSubmittingHire(false);
                    return;
                  }
                  skillObj = { name: customName, category: 'other', description: customDesc };
                }
                const body = {
                  providerId: hireTarget?._id || hireTarget?.id,
                  skill: skillObj,
                  duration: Number(duration),
                  credits: Number(credits),
                  scheduledDate: scheduled ? new Date(scheduled).toISOString() : null
                };
                const res = await fetch('/api/transactions/create', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                  body: JSON.stringify(body)
                });
                const data = await res.json();
                if (res.ok) {
                  addToast?.({ type: 'success', title: 'Request sent', message: 'Waiting for provider to confirm' });
                  setHireOpen(false);
                  router.push('/dashboard/transactions?status=pending');
                } else {
                  if (data?.code === 'INSUFFICIENT_CREDITS') {
                    addToast?.({ type: 'warning', title: 'Add credits', message: `You need ${data.missingCredits} more credits (~${data.amountFiat} ${data.currency}).` });
                    router.push(`/dashboard?topup=1&need=${encodeURIComponent(data.missingCredits)}`);
                  } else {
                    addToast?.({ type: 'error', title: 'Hire failed', message: data?.message || 'Could not create request' });
                  }
                }
              } catch (e) {
                console.error('Hire error', e);
                addToast?.({ type: 'error', title: 'Error', message: 'Error creating request' });
              } finally {
                setSubmittingHire(false);
              }
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function HireForm({ skills, availableCredits, submitting, onSubmit }) {
  const hasSkills = Array.isArray(skills) && skills.length > 0;
  const [skillId, setSkillId] = useState(hasSkills ? (skills[0]?._id || skills[0]?.name) : '__custom__');
  const [duration, setDuration] = useState(1);
  const [credits, setCredits] = useState(1);
  const [scheduled, setScheduled] = useState('');
  const [customName, setCustomName] = useState('');
  const [customDescription, setCustomDescription] = useState('');

  useEffect(() => { if (duration && duration > 0) setCredits(Number(duration)); }, [duration]);

  const onSubmitInternal = (e) => {
    e.preventDefault();
    const payload = { skillId, duration, credits, scheduled };
    if (skillId === '__custom__' || !hasSkills) {
      payload.custom = { name: customName.trim(), description: customDescription.trim() };
    }
    onSubmit?.(payload);
  };

  return (
    <form onSubmit={onSubmitInternal} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Skill</label>
        {hasSkills ? (
          <select className="w-full border rounded-md p-2 focus:ring-2 focus:ring-green-500 focus:border-green-500" value={skillId} onChange={(e) => setSkillId(e.target.value)}>
            {skills.map((s) => (
              <option key={s._id || s.name} value={s._id || s.name}>{s.name}</option>
            ))}
            <option value="__custom__">Custom request…</option>
          </select>
        ) : (
          <div className="text-sm text-gray-600">This user hasn&apos;t listed any skills. Send a custom request:</div>
        )}
      </div>
      {(skillId === '__custom__' || !hasSkills) && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Requested Skill</label>
            <input type="text" value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="e.g., Gardening help" className="w-full border rounded-md p-2 focus:ring-2 focus:ring-green-500 focus:border-green-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Details (optional)</label>
            <textarea rows={3} value={customDescription} onChange={(e) => setCustomDescription(e.target.value)} placeholder="Describe what you need" className="w-full border rounded-md p-2 focus:ring-2 focus:ring-green-500 focus:border-green-500" />
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Duration (hours)</label>
          <input type="number" min={1} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full border rounded-md p-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Credits</label>
          <input type="number" min={1} value={credits} onChange={(e) => setCredits(Number(e.target.value))} className="w-full border rounded-md p-2" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Date (optional)</label>
        <input type="datetime-local" value={scheduled} onChange={(e) => setScheduled(e.target.value)} className="w-full border rounded-md p-2" />
      </div>
      <div className="flex justify-between text-sm text-gray-600"><span>Available: {availableCredits} credits</span></div>
      <div className="flex justify-end">
        <button type="submit" disabled={submitting} className="btn-primary">{submitting ? 'Sending…' : 'Send Request'}</button>
      </div>
    </form>
  );
}