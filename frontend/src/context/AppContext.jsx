import { createContext, useContext, useMemo, useState } from 'react';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [allDistricts, setAllDistricts] = useState([]);

  const alertCounts = useMemo(() => {
    return allDistricts.reduce(
      (counts, district) => {
        if (district?.riskStatus === 'red') counts.red += 1;
        if (district?.riskStatus === 'yellow') counts.yellow += 1;
        if (district?.riskStatus === 'green') counts.green += 1;
        return counts;
      },
      { red: 0, yellow: 0, green: 0 },
    );
  }, [allDistricts]);

  const value = useMemo(
    () => ({
      selectedDistrict,
      setSelectedDistrict,
      allDistricts,
      setAllDistricts,
      alertCounts,
    }),
    [selectedDistrict, allDistricts, alertCounts],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
