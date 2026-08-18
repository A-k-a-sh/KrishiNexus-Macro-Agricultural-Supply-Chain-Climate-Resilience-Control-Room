const fs = require('fs');
const https = require('https');

// Helper to fetch data
const fetchJson = (url) => {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
};

async function buildMap() {
  console.log('Fetching bdapi districts...');
  const res = await fetchJson('https://bdapi.vercel.app/api/v.1/district');
  const districts = res.data;
  
  // Normalize district names to lowercase for matching
  const districtNameMap = {};
  districts.forEach(d => {
    districtNameMap[d.name.toLowerCase()] = d.id;
  });
  
  console.log('Reading wfp csv...');
  const csvContent = fs.readFileSync('../../wfp_food_prices_bgd.csv', 'utf8');
  const lines = csvContent.split('\n').filter(Boolean);
  
  const headers = lines[0].split(',');
  const marketIndex = headers.indexOf('market');
  
  if (marketIndex === -1) {
    console.error('Market column not found!');
    return;
  }
  
  const markets = new Set();
  let startIdx = 1;
  if (lines[1].startsWith('#')) startIdx = 2;
  
  for (let i = startIdx; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length > marketIndex) {
      markets.add(cols[marketIndex]);
    }
  }
  
  const wfpMarketMap = {};
  const unmatched = [];
  
  console.log('Matching...');
  Array.from(markets).forEach(market => {
    let cleanMarket = market.toLowerCase()
      .replace(' sadar', '')
      .replace(' division', '')
      .replace(' municipality market', '')
      .replace(' market', '')
      .replace(' 1 no.', '')
      .trim();
    
    // Some manual spelling adjustments based on BD common spellings
    if (cleanMarket === 'brahmonbaria') cleanMarket = 'brahmanbaria';
    if (cleanMarket === 'chittagong') cleanMarket = 'chattogram';
    if (cleanMarket === 'comilla') cleanMarket = 'cumilla';
    if (cleanMarket === 'gopalgonj') cleanMarket = 'gopalganj';
    if (cleanMarket === 'habigonj') cleanMarket = 'habiganj';
    if (cleanMarket === 'kishoregonj') cleanMarket = 'kishoreganj';
    if (cleanMarket === 'maulavibazar') cleanMarket = 'moulvibazar';
    if (cleanMarket === 'mymensing') cleanMarket = 'mymensingh';
    if (cleanMarket === 'nawabgonj') cleanMarket = 'chapainawabganj';
    if (cleanMarket === 'sirajgonj') cleanMarket = 'sirajganj';
    if (cleanMarket === 'sunamgonj') cleanMarket = 'sunamganj';
    if (cleanMarket === 'jaipurhat') cleanMarket = 'joypurhat';
    if (cleanMarket === 'kawran bazar dhaka') cleanMarket = 'dhaka';
    if (cleanMarket === 'bogra') cleanMarket = 'bogra'; // bdapi has Bogura? Let's check
    
    // Attempt match
    let matchedId = districtNameMap[cleanMarket];
    
    // Fuzzy fallback (if cleanMarket is inside a district name, or vice versa)
    if (!matchedId) {
      for (const dName in districtNameMap) {
        if (dName.includes(cleanMarket) || cleanMarket.includes(dName)) {
          matchedId = districtNameMap[dName];
          break;
        }
      }
    }
    
    if (matchedId) {
      wfpMarketMap[market] = matchedId;
    } else {
      unmatched.push(market);
    }
  });
  
  fs.writeFileSync('wfpMarketMap.json', JSON.stringify(wfpMarketMap, null, 2));
  console.log('Saved wfpMarketMap.json with', Object.keys(wfpMarketMap).length, 'matches.');
  console.log('\nUnmatched markets (these might be Upazilas):');
  console.log(unmatched.join(', '));
}

buildMap().catch(console.error);
