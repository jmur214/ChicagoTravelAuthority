import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { ItineraryItem, PlanRequestInput } from '@cta/shared';
import { api } from './api/client';
import { errorMessage } from './api/http';
import { useApiData } from './hooks/useApiData';
import { EMPTY_FILTERS, filterLocations, type Filters } from './lib/filters';
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

function loadSavedPlan(): ItineraryItem[] | null {
  try {
    const saved = JSON.parse(localStorage.getItem(PLAN_STORAGE_KEY) ?? 'null');
    return Array.isArray(saved) ? saved : null;
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
  const [plan, setPlan] = useState<ItineraryItem[] | null>(loadSavedPlan);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  useEffect(() => {
    if (plan) localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan));
    else localStorage.removeItem(PLAN_STORAGE_KEY);
  }, [plan]);

  const handlePlanSubmit = async (criteria: PlanRequestInput) => {
    try {
      const { items } = await api.plan(criteria);
      if (items.length === 0) {
        alert('No places matched those choices. Try other categories or a bigger budget.');
        return;
      }
      setSelectedLocationId(null);
      setShowFilters(false);
      setShowPlanner(false);
      setViewState('MAP');
      setPlan(items);
    } catch (err) {
      alert(`Failed to plan: ${errorMessage(err)}`);
    }
  };

  const handleLocationSelect = (id: number) => {
    setSelectedLocationId(id);
    setViewState('MAP');
  };

  const mapLocations = useMemo(() => filterLocations(locations, filters), [locations, filters]);

  const routeCoords = useMemo(
    () => plan?.map(item => [item.coords.lat, item.coords.lng] as [number, number]),
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
          <div className="absolute top-6 left-6 pointer-events-auto flex items-center gap-4">
            <button
              onClick={() => setViewState('DASHBOARD')}
              className="w-10 h-10 flex items-center justify-center bg-black/50 hover:bg-black/80 border border-white/20 rounded-full text-white transition backdrop-blur-md group"
              title="Back to Dashboard"
            >
              <svg className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h1 className="text-2xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-brand-accent drop-shadow-lg opacity-80 hover:opacity-100 transition cursor-pointer" onClick={() => setViewState('DASHBOARD')}>
              CHICAGO TRAVEL AUTHORITY
            </h1>
          </div>

          {/* Left: Filter Panel (Toggleable) */}
          {showFilters && (
            <div className="absolute top-20 left-6 bottom-24 w-[320px] pointer-events-auto animate-slideInLeft">
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
            onPlan={() => { setShowPlanner(true); setPlan(null); }}
            onExplore={() => {
              setPlan(null);
              setSelectedLocationId(null);
              setShowFilters(false);
              setShowPlanner(false);
            }}
            onToggleFilters={() => setShowFilters(prev => !prev)}
            onAdmin={() => setShowAdmin(true)}
          />

          {/* Bottom: Suggestion Carousel (Only show if no plan/details/filters active) */}
          {!selectedLocation && !showPlanner && !plan && !showFilters && (
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
          <LocationDetails location={selectedLocation} onClose={() => setSelectedLocationId(null)} />
        </div>
      )}

      {/* Planner Wizard Overlay */}
      {showPlanner && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto">
          <div className="w-full max-w-4xl h-[80vh] glass-panel rounded-3xl overflow-hidden shadow-2xl border border-white/10 relative">
            <PlannerWizard onSubmit={handlePlanSubmit} onCancel={() => setShowPlanner(false)} />
          </div>
        </div>
      )}

      {/* Itinerary Overlay (If plan exists) */}
      {plan && !selectedLocation && !showPlanner && viewState === 'MAP' && (
        <div className="absolute top-20 left-6 bottom-24 w-[350px] z-[55] pointer-events-auto">
          <div className="h-full glass-panel rounded-2xl p-4 overflow-hidden flex flex-col shadow-2xl animate-fadeIn">
            <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
              <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Your Night</h2>
              <button onClick={() => setPlan(null)} className="text-xs text-red-400 hover:text-red-300 uppercase tracking-widest font-bold">Clear</button>
            </div>
            <Itinerary items={plan} />
          </div>
        </div>
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
