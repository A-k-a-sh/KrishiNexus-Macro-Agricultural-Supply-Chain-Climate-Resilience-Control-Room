const { getDb, getSearchDb } = require('../db/connect');

/**
 * Standard $vectorSearch against any collection (used for pathology, thresholds, advisories).
 *
 * @param {string}   collectionName  - e.g. 'crop_pathology'
 * @param {number[]} queryVector     - 3072-float embedding
 * @param {string}   [indexName='embedding'] - Vector search index name
 * @param {object}   [filter=null]   - Pre-filter e.g. { districtId: "22" }
 * @param {number}   [k=3]           - Result count limit
 * @returns {Promise<object[]>}
 */
async function vectorSearch(collectionName, queryVector, indexName = 'embedding', filter = null, k = 3) {
  const db = getDb();

  const vectorSearchStage = {
    $vectorSearch: {
      index: indexName,
      path: 'embedding',
      queryVector,
      numCandidates: Math.max(k * 10, 20),
      limit: k,
    },
  };

  if (filter) {
    vectorSearchStage.$vectorSearch.filter = filter;
  }

  const pipeline = [
    vectorSearchStage,
    {
      $project: { embedding: 0 },
    },
    {
      $addFields: {
        searchScore: { $meta: 'vectorSearchScore' },
      },
    },
  ];

  return await db.collection(collectionName).aggregate(pipeline).toArray();
}

/**
 * Reciprocal Rank Fusion (RRF) merger in Node.js
 * Combines two ranked lists of documents by ID using weights and RRF formula: weight / (60 + rank)
 *
 * @param {object[]} vectorDocs - Docs from vector search
 * @param {object[]} textDocs   - Docs from text search
 * @param {number}   k          - Final number of docs to return
 * @param {number}   vectorWeight - e.g. 0.6
 * @param {number}   textWeight   - e.g. 0.4
 * @returns {object[]} Combined top-k documents with rrfScore
 */
function reciprocalRankFusion(vectorDocs, textDocs, k = 5, vectorWeight = 0.6, textWeight = 0.4) {
  const RRF_K = 60;
  const scoreMap = new Map();
  const docMap = new Map();

  // Score vector documents
  vectorDocs.forEach((doc, rank) => {
    const id = doc._id.toString();
    docMap.set(id, doc);
    const score = vectorWeight * (1 / (RRF_K + rank + 1));
    scoreMap.set(id, (scoreMap.get(id) || 0) + score);
  });

  // Score text documents
  textDocs.forEach((doc, rank) => {
    const id = doc._id.toString();
    if (!docMap.has(id)) {
      docMap.set(id, doc);
    }
    const score = textWeight * (1 / (RRF_K + rank + 1));
    scoreMap.set(id, (scoreMap.get(id) || 0) + score);
  });

  // Sort by combined RRF score descending
  const sortedIds = Array.from(scoreMap.entries()).sort((a, b) => b[1] - a[1]);

  return sortedIds.slice(0, k).map(([id, rrfScore]) => {
    const doc = docMap.get(id);
    return {
      ...doc,
      rrfScore: Number(rrfScore.toFixed(6)),
      searchMode: 'hybrid-rrf',
    };
  });
}

/**
 * Advanced Advisory Search: Supports native MongoDB $rankFusion and Node.js RRF Hybrid Search
 *
 * @param {number[]} queryVector - 3072-float embedding of user query
 * @param {string}   queryText   - Raw text query
 * @param {number}   [k=5]       - Top-k results
 * @param {object}   [filter]    - District filter e.g. { districtId: "22" }
 * @param {boolean}  [useHybrid=false] - If true, combines vector and BM25 text search
 * @returns {Promise<object[]>}
 */
async function searchAdvisories(queryVector, queryText, k = 5, filter = null, useHybrid = false) {
  const searchDb = getSearchDb();

  // If hybrid search is NOT requested, use pure vector search
  if (!useHybrid || !queryText) {
    try {
      const results = await vectorSearch('regional_advisories', queryVector, 'embedding', filter, k);
      return results.map((d) => ({ ...d, searchMode: 'vector' }));
    } catch (err) {
      console.warn('Vector search on primary cluster failed, attempting on search cluster:', err.message);
      const searchStage = {
        $vectorSearch: {
          index: 'embedding',
          path: 'embedding',
          queryVector,
          numCandidates: Math.max(k * 10, 20),
          limit: k,
          ...(filter ? { filter } : {}),
        },
      };
      return await searchDb
        .collection('regional_advisories')
        .aggregate([searchStage, { $project: { embedding: 0 } }])
        .toArray();
    }
  }

  // ── HYBRID SEARCH ───────────────────────────────────────────────────────────
  // Attempt 1: Native MongoDB $rankFusion aggregation pipeline on searchDb
  try {
    const rankFusionPipeline = [
      {
        $rankFusion: {
          input: {
            pipelines: {
              vectorPipeline: [
                {
                  $vectorSearch: {
                    index: 'embedding',
                    path: 'embedding',
                    queryVector,
                    numCandidates: Math.max(k * 10, 50),
                    limit: Math.max(k * 2, 10),
                    ...(filter ? { filter } : {}),
                  },
                },
              ],
              textPipeline: [
                {
                  $search: {
                    index: 'advisory_text_index',
                    text: {
                      query: queryText,
                      path: 'ragContextChunk',
                    },
                  },
                },
                { $limit: Math.max(k * 2, 10) },
              ],
            },
          },
          combination: {
            weights: { vectorPipeline: 0.6, textPipeline: 0.4 },
          },
        },
      },
      { $limit: k },
      { $project: { embedding: 0 } },
    ];

    const results = await searchDb.collection('regional_advisories').aggregate(rankFusionPipeline).toArray();
    if (results && results.length > 0) {
      return results.map((d) => ({ ...d, searchMode: 'hybrid-native' }));
    }
  } catch (rankFusionErr) {
    console.log('ℹ️ Native $rankFusion not supported or skipped, executing parallel RRF fusion:', rankFusionErr.message);
  }

  // Attempt 2: Dual Parallel Retrieval + Node.js Reciprocal Rank Fusion (RRF)
  try {
    const [vectorResults, textResults] = await Promise.all([
      // 1. Vector Search
      (async () => {
        const stage = {
          $vectorSearch: {
            index: 'embedding',
            path: 'embedding',
            queryVector,
            numCandidates: Math.max(k * 10, 30),
            limit: Math.max(k * 2, 10),
            ...(filter ? { filter } : {}),
          },
        };
        return await searchDb
          .collection('regional_advisories')
          .aggregate([stage, { $project: { embedding: 0 } }])
          .toArray();
      })(),

      // 2. Full-Text Search via Atlas Search
      (async () => {
        const textStage = {
          $search: {
            index: 'advisory_text_index',
            text: {
              query: queryText,
              path: 'ragContextChunk',
            },
          },
        };
        return await searchDb
          .collection('regional_advisories')
          .aggregate([textStage, { $limit: Math.max(k * 2, 10) }, { $project: { embedding: 0 } }])
          .toArray();
      })().catch((err) => {
        console.warn('⚠️ Text search pipeline failed:', err.message);
        return [];
      }),
    ]);

    if (textResults.length > 0) {
      return reciprocalRankFusion(vectorResults, textResults, k, 0.6, 0.4);
    } else if (vectorResults.length > 0) {
      return vectorResults.slice(0, k).map((d) => ({ ...d, searchMode: 'vector-fallback' }));
    }
  } catch (parallelErr) {
    console.warn('⚠️ Parallel hybrid search failed, falling back to pure vector search:', parallelErr.message);
  }

  // Fallback: Pure vector search
  return await vectorSearch('regional_advisories', queryVector, 'embedding', filter, k);
}

module.exports = {
  vectorSearch,
  searchAdvisories,
  reciprocalRankFusion,
};