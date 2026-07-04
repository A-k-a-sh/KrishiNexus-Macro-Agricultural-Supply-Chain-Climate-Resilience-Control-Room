import { useEffect, useState } from 'react';

import { getDistricts } from '../api';
import { useAppContext } from '../context/AppContext';

export function useDistricts() {
  const { allDistricts, setAllDistricts } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadDistricts() {
      if (allDistricts.length > 0) return;

      setLoading(true);
      setError(null);
      try {
        const response = await getDistricts();
        if (!active) return;
        setAllDistricts(response.data || []);
      } catch (requestError) {
        if (!active) return;
        setError(requestError);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDistricts();
    return () => {
      active = false;
    };
  }, [allDistricts.length, setAllDistricts]);

  return { allDistricts, loading, error };
}
