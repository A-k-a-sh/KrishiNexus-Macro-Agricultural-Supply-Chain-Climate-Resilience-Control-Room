import { createContext, useContext, useState, useEffect } from 'react';
import { getDistricts } from '../api';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [allDistricts, setAllDistricts]         = useState([]);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [alertCounts, setAlertCounts]           = useState({ red: 0, yellow: 0, green: 0 });
  const [districtsLoading, setDistrictsLoading] = useState(true);
  const [districtsError, setDistrictsError]     = useState(null);

  // Load all 64 districts once on app mount
  useEffect(() => {
    getDistricts()
      .then(({ data }) => {
        const districts = data.data;
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
  }, []);

  function selectDistrict(district) {
    setSelectedDistrict(district);
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