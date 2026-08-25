import { createContext, useContext, useState, useEffect } from 'react';
import { getDistricts, getMe } from '../api';

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
        upazilasByDistrict,
        setUpazilasByDistrict,
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