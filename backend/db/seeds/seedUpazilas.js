require('dotenv').config({ path: __dirname + '/../../.env' });
const { connectDb } = require('../connect');
const fs = require('fs');
const path = require('path');

function getApproximateCentroid(feature) {
  let pts = [];
  function extractCoords(arr) {
    if (typeof arr[0] === 'number') {
      pts.push(arr);
    } else {
      arr.forEach(extractCoords);
    }
  }
  extractCoords(feature.geometry.coordinates);
  
  if (pts.length === 0) return null;
  const lon = pts.reduce((sum, p) => sum + p[0], 0) / pts.length;
  const lat = pts.reduce((sum, p) => sum + p[1], 0) / pts.length;
  return { lat, lon };
}

async function seedUpazilas() {
  const db = await connectDb();
  const upazilasCollection = db.collection('upazilas');
  const districtsCollection = db.collection('districts');

  console.log('Fetching districts from MongoDB...');
  const districts = await districtsCollection.find({}).toArray();

  console.log('Loading GeoJSON for coordinates...');
  const geojsonPath = path.join(__dirname, '../../../frontend/public/bd-upazilas.geojson');
  const rawGeoJson = fs.readFileSync(geojsonPath, 'utf8');
  const geojson = JSON.parse(rawGeoJson);

  let totalUpazilasInserted = 0;
  const geoNameMap = {}; 

  for (const district of districts) {
    const districtId = district._id;
    console.log(`Fetching upazilas for district ${district.name} (ID: ${districtId})...`);
    
    try {
      await new Promise(r => setTimeout(r, 600)); // Delay to prevent 429 Too Many Requests

      const response = await fetch(`https://bdapis.pro.bd/geo/v2.0/upazilas/${districtId}`);
      if (!response.ok) {
        console.warn(`Failed to fetch API for district ${districtId}: ${response.status}`);
        continue;
      }

      const resData = await response.json();
      if (!resData.success || !resData.data) continue;

      const upazilas = resData.data; 

      for (const uz of upazilas) {
        const normalize = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const uzNameNorm = normalize(uz.name);
        
        let match = geojson.features.find(f => normalize(f.properties.shapeName) === uzNameNorm);

        if (!match) {
          match = geojson.features.find(f => 
            normalize(f.properties.shapeName).includes(uzNameNorm) || 
            uzNameNorm.includes(normalize(f.properties.shapeName))
          );
        }

        let lat = district.lat; 
        let lon = district.lon;

        if (match) {
          const centroid = getApproximateCentroid(match);
          if (centroid) {
            lat = centroid.lat;
            lon = centroid.lon;
          }
          geoNameMap[match.properties.shapeName] = uz.id;
        } else {
          console.warn(`⚠️ Warning: No GeoJSON match found for upazila: ${uz.name}. Falling back to district coords.`);
        }

        const newDoc = {
          _id: uz.id,
          name: uz.name,
          bnName: uz.bn_name,
          districtId: districtId,
          divisionId: district.divisionId,
          lat: lat,
          lon: lon,
          liveWeather: {},
          riskStatus: "green",
          activeAlerts: []
        };

        await upazilasCollection.updateOne(
          { _id: newDoc._id },
          { $set: newDoc },
          { upsert: true }
        );
        totalUpazilasInserted++;
      }
    } catch (e) {
      console.error(`Error fetching for district ${districtId}:`, e.message);
    }
  }

  console.log(`\n✅ Seeding complete! Processed ${totalUpazilasInserted} upazilas.`);

  const mapPath = path.join(__dirname, '../../../frontend/src/data/upazilaGeoNameMap.json');
  fs.mkdirSync(path.dirname(mapPath), { recursive: true });
  fs.writeFileSync(mapPath, JSON.stringify(geoNameMap, null, 2));
  console.log(`✅ Generated frontend upazilaGeoNameMap.json with ${Object.keys(geoNameMap).length} matched entries.`);

  process.exit(0);
}

seedUpazilas().catch(console.error);
