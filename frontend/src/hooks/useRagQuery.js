import { useState } from 'react';

import { postRagQuery } from '../api';

export function useRagQuery() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function runQuery(payload) {
    setLoading(true);
    setError(null);
    try {
      const response = await postRagQuery(payload);
      setData(response.data);
      return response.data;
    } catch (requestError) {
      setError(requestError);
      throw requestError;
    } finally {
      setLoading(false);
    }
  }

  return { data, loading, error, runQuery };
}
