import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getDistricts, getMe, getUpazilas } from '../api';

export const AppContext = createContext(null);

export function AppProvider({ children }) {
  // Existing state
  const [allDistricts, setAllDistricts]         = useState([]);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [alertCounts, setAlertCounts]           = useState({ red: 0, yellow: 0, green: 0 });
  const [districtsLoading, setDistrictsLoading] = useState(true);
  const [districtsError, setDistrictsError]     = useState(null);

  // New V2 state
  const [currentUser, setCurrentUser]           = useState(null);
  const [isAuthLoading, setIsAuthLoading]       = useState(true);
  const [selectedUpazila, setSelectedUpazila]   = useState(null);
  const [upazilasByDistrict, setUpazilasByDistrict] = useState({});
  const [isDrilledIn, setIsDrilledIn]           = useState(false);

  // --- Upazila loading -------------------------------------------------------
  // Both the map (on drill-in) and the left-nav tree (on expand, and on a search
  // that has to look inside districts) need upazilas, so the fetch lives here
  // instead of in either component. Refs track what's loaded or in flight so
  // two callers asking at the same instant produce one request, not two.
  const [allUpazilasLoaded, setAllUpazilasLoaded] = useState(false);
  const loadedRef   = useRef({}); // districtId → true
  const inFlightRef = useRef({}); // districtId | '*' → Promise
  const allLoadedRef = useRef(false);

  const ensureUpazilas = useCallback((districtId) => {
    const key = String(districtId);
    if (!districtId || allLoadedRef.current || loadedRef.current[key]) return Promise.resolve();
    if (inFlightRef.current[key]) return inFlightRef.current[key];

    const request = getUpazilas(districtId)
      .then((res) => {
        loadedRef.current[key] = true;
        setUpazilasByDistrict((prev) => ({ ...prev, [key]: res.data?.data || [] }));
      })
      .catch((err) => console.error('Failed to load upazilas', err))
      .finally(() => { delete inFlightRef.current[key]; });

    inFlightRef.current[key] = request;
    return request;
  }, []);

  // One request for the whole country (~495 records). Called lazily — only when
  // a search actually needs to match upazila names outside the open district —
  // so the dashboard's first paint never pays for it.
  const ensureAllUpazilas = useCallback(() => {
    if (allLoadedRef.current) return Promise.resolve();
    if (inFlightRef.current['*']) return inFlightRef.current['*'];

    const request = getUpazilas()
      .then((res) => {
        const grouped = {};
        for (const u of res.data?.data || []) {
          const key = String(u.districtId);
          (grouped[key] ||= []).push(u);
          loadedRef.current[key] = true;
        }
        allLoadedRef.current = true;
        setAllUpazilasLoaded(true);
        // Already-fetched districts win: same data, but keeping their array
        // identity avoids re-rendering rows that didn't change.
        setUpazilasByDistrict((prev) => ({ ...grouped, ...prev }));
      })
      .catch((err) => console.error('Failed to load upazilas', err))
      .finally(() => { delete inFlightRef.current['*']; });

    inFlightRef.current['*'] = request;
    return request;
  }, []);

  // Load all 64 districts once on app mount
  useEffect(() => {
    // Only load districts if user is authenticated (wait for auth check)
    if (!currentUser && !isAuthLoading) {
      setDistrictsLoading(false);
      return;
    }
    
    // In V2, the districts API is protected, so we should wait until auth check is complete.
    // However, Landing page might need them if it's public. 
    // Assuming we fetch anyway, the interceptor will add the token if available.
    getDistricts()
      .then((data) => {
        // Handle axios response shape or fallback
        const districts = data.data?.data || data.data || [];
        setAllDistricts(districts);

        // Compute alert counts for the left-nav status badges
        const counts = { red: 0, yellow: 0, green: 0 };
        for (const d of districts) {
          if (d.riskStatus === 'red')    counts.red++;
          else if (d.riskStatus === 'yellow') counts.yellow++;
          else counts.green++;
        }
        setAlertCounts(counts);
      })
      .catch((err) => setDistrictsError(err.message))
      .finally(() => setDistrictsLoading(false));
  }, [currentUser, isAuthLoading]);

  // Authenticate user on mount
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      getMe(token)
        .then(user => {
          setCurrentUser(user);
        })
        .catch(() => {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          setCurrentUser(null);
        })
        .finally(() => setIsAuthLoading(false));
    } else {
      setIsAuthLoading(false);
    }
  }, []);

  // `drillIn` is explicit so the caller owns the drill-down decision. It used to
  // be hardcoded false here while the map's click handler set it back to true
  // immediately afterwards, which only worked because React batched the two
  // updates — one non-batched call site away from clearing the drill state it
  // was supposed to enter.
  function selectDistrict(district, { drillIn = false } = {}) {
    setSelectedDistrict(district);
    // Reset upazila state on district change
    setSelectedUpazila(null);
    setIsDrilledIn(Boolean(district) && drillIn);
  }

  // Picking an upazila implies its district and drill-down. Setting all three
  // here — rather than letting a caller run selectDistrict() and then
  // setSelectedUpazila() — keeps the intent in one update and avoids depending on
  // those two calls landing in the right order, which is what broke drill-down
  // before (see the note above).
  function selectUpazila(district, upazila) {
    if (district) setSelectedDistrict(district);
    setIsDrilledIn(true);
    setSelectedUpazila(upazila);
  }

  return (
    <AppContext.Provider
      value={{
        allDistricts,
        selectedDistrict,
        alertCounts,
        districtsLoading,
        districtsError,
        selectDistrict,
        
        currentUser,
        setCurrentUser,
        isAuthLoading,
        
        selectedUpazila,
        setSelectedUpazila,
        selectUpazila,
        upazilasByDistrict,
        setUpazilasByDistrict,
        ensureUpazilas,
        ensureAllUpazilas,
        allUpazilasLoaded,
        isDrilledIn,
        setIsDrilledIn
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used inside <AppProvider>');
  return ctx;
}