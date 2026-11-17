import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { PlanRequestInput, TransportMode } from '@cta/shared';
import { api } from './api/client';
import { errorMessage } from './api/http';
import { useApiData } from './hooks/useApiData';
import { EMPTY_FILTERS, filterLocations, type Filters } from './lib/filters';
import { addStop, changeTransportMode, moveStop, parseSavedPlan, planFromResponse, removeStop, type Plan } from './lib/plan';
import MapComponent from './components/Map';
import PlannerWizard from './components/PlannerWizard';
import Itinerary from './components/Itinerary';
import LocationDetails from './components/LocationDetails';
import HeroEntrance from './components/HeroEntrance';
import CTADashboard from './components/CTADashboard';
import FloatingActionCluster from './components/FloatingActionCluster';
import SuggestionCarousel from './components/SuggestionCarousel';
import FilterBar from './components/FilterBar';

// Admin tools are only for curators; keep them out of the main bundle.
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));

type ViewState = 'ENTRANCE' | 'DASHBOARD' | 'MAP';

const PLAN_STORAGE_KEY = 'chicago_planner_plan';

function loadSavedPlan(): Plan | null {
  try {
    return parseSavedPlan(JSON.parse(localStorage.getItem(PLAN_STORAGE_KEY) ?? 'null'));
  } catch {
    return null;
  }
}

function App() {
  const fetchPublicLocations = useCallback(() => api.locations.list(), []);
  const { data: locations = [], reload: reloadLocations } = useApiData(fetchPublicLocations);

  // App State
  const [viewState, setViewState] = useState<ViewState>('ENTRANCE');
  const [showPlanner, setShowPlanner] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Selection State
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [plan, setPlan] = useState<Plan | null>(loadSavedPlan);
  const [planCollapsed, setPlanCollapsed] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  useEffect(() => {
    try {
      if (plan) localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan));
      else localStorage.removeItem(PLAN_STORAGE_KEY);
    } catch {
      // Storage unavailable (private mode); the plan just won't survive a reload.
    }
  }, [plan]);

  const handlePlanSubmit = async (criteria: PlanRequestInput) => {
    try {
      const response = await api.plan(criteria);
      if (response.items.length === 0) {
        alert('No places matched those choices. Try other categories, a different start, or a bigger budget.');
        return;
      }
      setSelectedLocationId(null);
      setShowFilters(false);
      setShowPlanner(false);
      setViewState('MAP');
      setPlan(planFromResponse(response));
      setPlanCollapsed(false);
    } catch (err) {
      alert(`Failed to plan: ${errorMessage(err)}`);
    }
  };

  // --- Plan editing (re-timed locally with the same scheduler the server uses) ---
  const addToPlan = (locationId: number) => {
    const loc = locations.find(l => l.id === locationId);
    if (!loc) return;
    setPlan(p => addStop(p, loc, locations));
    setPlanCollapsed(false);
  };
  const removeFromPlan = (locationId: number) => setPlan(p => p && removeStop(p, locationId, locations));
  const moveInPlan = (index: number, delta: -1 | 1) => setPlan(p => p && moveStop(p, index, delta, locations));
  const changePlanMode = (mode: TransportMode) => setPlan(p => p && changeTransportMode(p, mode, locations));
  const clearPlan = () => {
    if (confirm('Clear your plan for tonight?')) setPlan(null);
  };
  const viewPlan = () => {
    setSelectedLocationId(null);
    setViewState('MAP');
    setPlanCollapsed(false);
  };

  const handleLocationSelect = (id: number) => {
    setSelectedLocationId(id);
    setViewState('MAP');
  };

  const mapLocations = useMemo(() => filterLocations(locations, filters), [locations, filters]);

  const routeCoords = useMemo(
    () => plan?.items.map(item => [item.coords.lat, item.coords.lng] as [number, number]),
    [plan],
  );

  const selectedLocation = useMemo(() =>
    locations.find(l => l.id === selectedLocationId),
    [locations, selectedLocationId]);

  return (
    <div className="h-screen w-screen relative bg-[#050505] text-white overflow-hidden font-sans selection:bg-brand-primary selection:text-white">

      {/* 1. Hero Entrance Layer */}
      {viewState === 'ENTRANCE' && <HeroEntrance onEnter={() => setViewState('DASHBOARD')} />}

      {/* 2. Map Layer (Always rendered for smoothness, but masked in Dashboard) */}
      <div className={`absolute inset-0 z-0 transition-opacity duration-700 ${viewState === 'DASHBOARD' ? 'opacity-20 pointer-events-none blur-sm' : 'opacity-100'}`}>
        <MapComponent
          locations={mapLocations}
          routeCoords={routeCoords}
          onLocationSelect={handleLocationSelect}
        />
      </div>

      {/* 3. CTA Dashboard Layer */}
      {viewState === 'DASHBOARD' && (
        <CTADashboard
          onPlan={() => setShowPlanner(true)}
          onExploreMap={() => setViewState('MAP')}
          onManage={() => setShowAdmin(true)}
          locations={locations}
          onLocationSelect={handleLocationSelect}
        />
      )}

      {/* 4. Map Interface Layer (Only visible in MAP state) */}
      {viewState === 'MAP' && (
        <div className="absolute inset-0 z-50 pointer-events-none">

          {/* Top Bar / Brand */}
          <div className="absolute top-4 left-4 sm:top-6 sm:left-6 pointer-events-auto flex items-center gap-4">
            <button
              onClick={() => setViewState('DASHBOARD')}
              className="w-10 h-10 flex items-center justify-center bg-black/50 hover:bg-black/80 border border-white/20 rounded-full text-white transition backdrop-blur-md group"
              title="Back to Dashboard"
            >
              <svg className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h1 className="hidden sm:block text-2xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-brand-accent drop-shadow-lg opacity-80 hover:opacity-100 transition cursor-pointer" onClick={() => setViewState('DASHBOARD')}>
              CHICAGO TRAVEL AUTHORITY
            </h1>
          </div>

          {/* Left: Filter Panel (Toggleable) */}
          {showFilters && (
            <div className="absolute top-16 left-3 right-3 bottom-28 sm:top-20 sm:left-6 sm:right-auto sm:bottom-24 sm:w-[320px] pointer-events-auto animate-slideInLeft">
              <div className="h-full glass-panel rounded-2xl p-4 shadow-2xl border border-white/10">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400">Filters</h2>
                  <button onClick={() => setShowFilters(false)} className="text-white hover:text-brand-primary">✕</button>
                </div>
                <FilterBar filters={filters} onChange={setFilters} />
              </div>
            </div>
          )}

          {/* Right: Floating Action Cluster (Nav) */}
          <FloatingActionCluster
            // The current plan is only replaced once a new one is generated.
            onPlan={() => setShowPlanner(true)}
            onExplore={() => {
              setPlanCollapsed(true);
              setSelectedLocationId(null);
              setShowFilters(false);
              setShowPlanner(false);
            }}
            onToggleFilters={() => setShowFilters(prev => !prev)}
            onAdmin={() => setShowAdmin(true)}
          />

          {/* Bottom: Suggestion Carousel (Only show if no plan/details/filters active) */}
          {!selectedLocation && !showPlanner && (!plan || planCollapsed) && !showFilters && (
            <SuggestionCarousel
              locations={locations}
              onSelect={handleLocationSelect}
            />
          )}
        </div>
      )}

      {/* 5. Modals & Overlays (Pointer events auto, works globally) */}

      {/* Location Details Side Panel */}
      {selectedLocation && (
        <div className="absolute top-0 right-0 bottom-0 w-full md:w-[450px] z-[60] pointer-events-auto animate-slideInRight">
          <LocationDetails
            location={selectedLocation}
            inPlan={!!plan?.items.some(i => i.locationId === selectedLocation.id)}
            onAddToPlan={() => addToPlan(selectedLocation.id)}
            onViewPlan={viewPlan}
            onClose={() => setSelectedLocationId(null)}
          />
        </div>
      )}

      {/* Planner Wizard Overlay */}
      {showPlanner && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center sm:p-4 pointer-events-auto">
          <div className="w-full max-w-4xl h-full sm:h-[80vh] glass-panel sm:rounded-3xl overflow-hidden shadow-2xl sm:border border-white/10 relative bg-[#0b0b0b]">
            <PlannerWizard onSubmit={handlePlanSubmit} onCancel={() => setShowPlanner(false)} />
          </div>
        </div>
      )}

      {/* Itinerary Overlay (If plan exists) */}
      {plan && !selectedLocation && !showPlanner && viewState === 'MAP' && (
        planCollapsed ? (
          <button
            onClick={() => setPlanCollapsed(false)}
            className="absolute top-4 sm:top-6 left-1/2 -translate-x-1/2 z-[55] pointer-events-auto glass-panel rounded-full px-4 py-2.5 shadow-2xl border border-white/10 text-sm font-bold flex items-center gap-2 whitespace-nowrap"
          >
            🌙 Your Night · {plan.items.length} stop{plan.items.length === 1 ? '' : 's'} <span className="text-gray-400">▾</span>
          </button>
        ) : (
          <div className="absolute left-3 right-3 bottom-28 h-[52vh] sm:h-auto sm:top-20 sm:left-6 sm:right-auto sm:bottom-24 sm:w-[370px] z-[55] pointer-events-auto">
            <div className="h-full glass-panel rounded-2xl p-4 overflow-hidden flex flex-col shadow-2xl animate-fadeIn relative">
              <button
                onClick={() => setPlanCollapsed(true)}
                className="absolute top-1 left-1/2 -translate-x-1/2 text-gray-500 hover:text-white text-xs px-3"
                aria-label="Minimize plan"
              >
                ▾
              </button>
              <Itinerary
                plan={plan}
                onSelect={handleLocationSelect}
                onRemove={removeFromPlan}
                onMove={moveInPlan}
                onChangeMode={changePlanMode}
                onClear={clearPlan}
              />
            </div>
          </div>
        )
      )}

      {/* Admin Dashboard Modal */}
      {showAdmin && (
        <Suspense fallback={null}>
          <AdminDashboard onClose={() => { setShowAdmin(false); reloadLocations(); }} />
        </Suspense>
      )}

    </div>
  );
}

export default App;
