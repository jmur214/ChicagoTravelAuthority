import { useEffect, useState, useMemo } from 'react';
import MapComponent from './components/Map';
import PlannerWizard from './components/PlannerWizard';
import Itinerary from './components/Itinerary';
import type { ItineraryItem } from './components/Itinerary';
import ImportModal from './components/ImportModal';
import LocationModal from './components/LocationModal';
import LocationDetails from './components/LocationDetails';
import AdminDashboard from './components/AdminDashboard';
import { fetchLocations, generatePlan } from './api/client';
import type { Location } from './api/client';

// V2 Components
import HeroEntrance from './components/HeroEntrance';
import CTADashboard from './components/CTADashboard';
import FloatingActionCluster from './components/FloatingActionCluster';
import SuggestionCarousel from './components/SuggestionCarousel';
import FilterBar from './components/FilterBar';

type ViewState = 'ENTRANCE' | 'DASHBOARD' | 'MAP';

function App() {
  const [locations, setLocations] = useState<Location[]>([]);

  // App State
  const [viewState, setViewState] = useState<ViewState>('ENTRANCE');
  const [showPlanner, setShowPlanner] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Selection State
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [plan, setPlan] = useState<ItineraryItem[] | null>(() => {
    const saved = localStorage.getItem('chicago_planner_plan');
    return saved ? JSON.parse(saved) : null;
  });

  // Filter State (for filtering map)
  const [activeFilters, setActiveFilters] = useState<any>({});

  useEffect(() => {
    fetchLocations().then(setLocations);
  }, []);

  useEffect(() => {
    if (plan) localStorage.setItem('chicago_planner_plan', JSON.stringify(plan));
    else localStorage.removeItem('chicago_planner_plan');
  }, [plan]);

  const handlePlanSubmit = async (criteria: any) => {
    console.log("Generating plan with:", criteria);
    try {
      const result = await generatePlan(criteria);

      if (Array.isArray(result)) {
        // Ensure we clear conflicts
        setSelectedLocationId(null);
        setShowFilters(false);
        setShowPlanner(false);
        setViewState('MAP'); // Switch to Map view to show plan
        setPlan(result);
      } else {
        console.error("Plan generation returned invalid format:", result);
        alert("Could not generate plan. Please try different criteria.");
        setShowPlanner(false);
      }
    } catch (err) {
      console.error("Plan generation failed:", err);
      alert("Failed to plan. Please try again.");
    }
  };

  const handleLocationSelect = (id: number) => {
    setSelectedLocationId(id);
    setViewState('MAP'); // Ensure we go to map if selecting from dashboard
  };

  // Filter Logic
  const mapLocations = useMemo(() => {
    let filtered = locations;

    // Apply tag/category filter
    if (activeFilters.primaryTag && activeFilters.primaryTag !== 'All') {
      filtered = filtered.filter(l =>
        l.categories?.some(c => c.name === activeFilters.primaryTag) ||
        l.tags?.some(t => t.tag.name === activeFilters.primaryTag) // Fallback to tags for now
      );
    }
    // Apply search filter
    if (activeFilters.search) {
      const q = activeFilters.search.toLowerCase();
      filtered = filtered.filter(l => l.name.toLowerCase().includes(q) || l.description?.toLowerCase().includes(q));
    }

    return filtered;
  }, [locations, activeFilters]);

  const routeCoords: [number, number][] | undefined = plan ? plan.map(item => {
    if (item.coords) return [item.coords.lat, item.coords.lng] as [number, number];
    const loc = locations.find(l => l.id === item.locationId);
    return loc ? [loc.latitude, loc.longitude] as [number, number] : [0, 0] as [number, number];
  }).filter(c => c[0] !== 0) : undefined;

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
                <FilterBar onFilterChange={setActiveFilters} />
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
            <Itinerary items={plan} onClose={() => setPlan(null)} />
          </div>
        </div>
      )}

      {/* Admin Dashboard Modal */}
      {showAdmin && <AdminDashboard onClose={() => { setShowAdmin(false); fetchLocations().then(setLocations); }} />}

      {/* Import Modal */}
      {showImport && <ImportModal onClose={() => setShowImport(false)} />}

    </div>
  );
}

export default App;
