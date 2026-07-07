const { getDb } = require('../db/connect');

/**
 * Run a $vectorSearch aggregation against a MongoDB Atlas collection.
 *
 * @param {string}   collectionName  - e.g. 'regional_advisories'
 * @param {number[]} queryVector     - 3072-float embedding of the user's question
 * @param {string}   indexName       - Atlas vector index name on that collection
 * @param {object}   [filter]        - Optional MQL filter applied before vector search
 *                                     e.g. { districtId: "22" }
 * @param {number}   [k=3]           - Number of results to return
 * @returns {Promise<object[]>}       - Matched documents (embedding field stripped)
 */
async function vectorSearch(collectionName, queryVector, indexName, filter = null, k = 3) {
  const db = getDb();

  const vectorSearchStage = {
    $vectorSearch: {
      index: indexName,
      path: 'embedding',
      queryVector,
      numCandidates: k * 10, // search wider, return narrower
      limit: k,
    },
  };

  // Atlas $vectorSearch supports a 'filter' key for pre-filtering
  // Only add it when a filter is actually provided
  if (filter) {
    vectorSearchStage.$vectorSearch.filter = filter;
  }

  const pipeline = [
    vectorSearchStage,
    {
      // Never return raw embedding vectors to the app layer — they're huge and useless outside DB
      $project: { embedding: 0 },
    },
    {
      // Attach a relevance score so callers can log/debug retrieval quality
      $addFields: {
        searchScore: { $meta: 'vectorSearchScore' },
      },
    },
  ];

  return await db.collection(collectionName).aggregate(pipeline).toArray();
}

module.exports = { vectorSearch };