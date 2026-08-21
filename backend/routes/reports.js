const { Router } = require('express');
const { getDb } = require('../db/connect');
const PDFDocument = require('pdfkit');

const router = Router();

/**
 * POST /api/reports/generate
 * Generates a PDF report for a given district/upazila and streams it back.
 */
router.post('/generate', async (req, res, next) => {
  try {
    const db = getDb();
    const { 
      reportType = 'district', 
      targetId, 
      includeWeather, 
      includeAdvisory, 
      includeLogistics, 
      includeMarket 
    } = req.body;

    if (!targetId) {
      return res.status(400).json({ ok: false, message: 'targetId is required' });
    }

    const collectionName = reportType === 'upazila' ? 'upazilas' : 'districts';
    const targetDoc = await db.collection(collectionName).findOne({ _id: targetId });

    if (!targetDoc) {
      return res.status(404).json({ ok: false, message: 'Target document not found' });
    }

    // For upazilas, we need to fetch district-level data for logistics, market, and crops
    let parentDistrict = null;
    let queryDistrictId = targetDoc._id; // Default for district
    
    if (reportType === 'upazila' && targetDoc.districtId) {
      queryDistrictId = targetDoc.districtId;
      parentDistrict = await db.collection('districts').findOne({ _id: queryDistrictId });
      
      // Inherit active crops if upazila doesn't have them
      if (!targetDoc.activeCrops || targetDoc.activeCrops.length === 0) {
        if (parentDistrict && parentDistrict.activeCrops) {
          targetDoc.activeCrops = parentDistrict.activeCrops;
        }
      }
    }

    let dispatches = [];
    if (includeLogistics) {
      dispatches = await db.collection('dispatch_records')
        .find({ toDistrictId: queryDistrictId })
        .sort({ dispatchedAt: -1 })
        .limit(4)
        .toArray();
    }

    let marketPrices = [];
    if (includeMarket) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      marketPrices = await db.collection('market_prices')
        .find({ districtId: queryDistrictId, date: { $gte: sevenDaysAgo } })
        .sort({ date: -1 })
        .toArray();
    }

    // --- Document Setup ---
    const doc = new PDFDocument({ 
      size: 'A4', 
      margin: 50,
      bufferPages: true,
      info: { Title: 'KrishiNexus Report', Author: 'KrishiNexus Platform' }
    });
    
    // Fill background on every new page for Dark Theme
    doc.on('pageAdded', () => {
      doc.rect(0, 0, 595, 842).fill('#0f172a');
    });
    
    const safeName = targetDoc.name ? targetDoc.name.replace(/\s+/g, '-').toLowerCase() : targetId;
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `krishinexus-report-${safeName}-${dateStr}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    doc.on('error', (err) => {
      console.error('PDFKit generation error:', err);
      if (!res.headersSent) next(err);
      else res.end();
    });

    doc.pipe(res);

    // Initial background for page 1
    doc.rect(0, 0, 595, 842).fill('#0f172a');

    // --- Helper Functions ---
    const checkSpace = (requiredSpace) => {
      if (doc.y + requiredSpace > 760) {
        doc.addPage();
        return true;
      }
      return false;
    };

    const drawHeader = (title) => {
      checkSpace(60);
      doc.rect(50, doc.y, 495, 30).fill('#065f46'); // Emerald 800
      doc.fillColor('#f8fafc').font('Helvetica-Bold').fontSize(14).text(title, 60, doc.y + 8);
      doc.moveDown(1.5);
      doc.fillColor('#cbd5e1').font('Helvetica');
    };

    // --- Page 1: Header ---
    doc.rect(0, 0, 595, 120).fill('#022c22'); // Emerald 950
    doc.fillColor('#34d399').font('Helvetica-Bold').fontSize(28).text('KrishiNexus Mission Control', 0, 35, { align: 'center' });
    
    // Using string spacing instead of characterSpacing flag which might render poorly on some viewers
    doc.fillColor('#94a3b8').font('Helvetica').fontSize(12).text('A U T O M A T E D   I N T E L L I G E N C E   &   L O G I S T I C S   R E P O R T', 0, 70, { align: 'center' });
    
    doc.y = 150;
    
    // Metadata block
    const targetTitle = reportType === 'upazila' && parentDistrict 
      ? `${targetDoc.name} (${parentDistrict.name} District)` 
      : `${targetDoc.name} (${reportType.toUpperCase()})`;
      
    doc.rect(50, doc.y, 495, 80).fill('#1e293b').stroke('#334155');
    doc.fillColor('#f8fafc').font('Helvetica-Bold').fontSize(22).text(`Target: ${targetTitle}`, 70, doc.y + 20);
    doc.fontSize(12).fillColor('#94a3b8').font('Helvetica').text(`Generated on: ${new Date().toLocaleString()}`, 70, doc.y + 10);
    
    doc.y += 40;
    
    // Risk Status Box
    checkSpace(60);
    const riskColor = targetDoc.riskStatus === 'red' ? '#ef4444' : (targetDoc.riskStatus === 'yellow' ? '#f59e0b' : '#10b981');
    doc.rect(50, doc.y, 495, 45).fill(riskColor);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(18).text(`OVERALL RISK STATUS: ${targetDoc.riskStatus ? targetDoc.riskStatus.toUpperCase() : 'UNKNOWN'}`, 0, doc.y + 14, { align: 'center' });
    doc.moveDown(3);
    
    // --- Weather Summary ---
    if (includeWeather && targetDoc.liveWeather) {
      drawHeader('WEATHER SUMMARY (TODAY)');
      const w = targetDoc.liveWeather;
      
      doc.rect(50, doc.y, 495, 80).fill('#1e293b').stroke('#334155');
      const startY = doc.y + 15;
      
      doc.fillColor('#94a3b8').fontSize(10).text('MAX TEMP', 70, startY);
      doc.fillColor('#f8fafc').fontSize(16).font('Helvetica-Bold').text(`${w.tempMaxToday || '--'}°C`, 70, startY + 15).font('Helvetica');
      
      doc.fillColor('#94a3b8').fontSize(10).text('MIN TEMP', 190, startY);
      doc.fillColor('#f8fafc').fontSize(16).font('Helvetica-Bold').text(`${w.tempMinToday || '--'}°C`, 190, startY + 15).font('Helvetica');
      
      doc.fillColor('#94a3b8').fontSize(10).text('HUMIDITY', 310, startY);
      doc.fillColor('#f8fafc').fontSize(16).font('Helvetica-Bold').text(`${w.humidityMaxToday || '--'}%`, 310, startY + 15).font('Helvetica');
      
      let precipSum = w.precipitationSum7Day && w.precipitationSum7Day.length > 0 ? w.precipitationSum7Day[0] : 0;
      doc.fillColor('#94a3b8').fontSize(10).text('RAINFALL', 430, startY);
      doc.fillColor('#f8fafc').fontSize(16).font('Helvetica-Bold').text(`${precipSum} mm`, 430, startY + 15).font('Helvetica');
      
      doc.y = startY + 65;
    }

    // --- Alerts & Crops ---
    if (includeAdvisory && ((targetDoc.activeAlerts && targetDoc.activeAlerts.length > 0) || (targetDoc.activeCrops && targetDoc.activeCrops.length > 0))) {
      
      if (targetDoc.activeAlerts && targetDoc.activeAlerts.length > 0) {
        drawHeader('ACTIVE CLIMATE ALERTS');
        targetDoc.activeAlerts.forEach((alert) => {
          let content = alert.triggerReason || alert.message || 'No additional details provided.';
          // Fix annoying encoding issue with quote marks in PDF
          content = content.replace(/"/g, '"').replace(/"/g, '"').replace(/'/g, "'").replace(/'/g, "'");
          
          const boxHeight = doc.heightOfString(content, { width: 455 }) + 45;
          checkSpace(boxHeight);
          
          doc.rect(50, doc.y, 495, boxHeight).fill('#450a0a').stroke('#7f1d1d');
          doc.fillColor('#fca5a5').fontSize(14).font('Helvetica-Bold').text(`!  ${alert.label || alert.type || 'Alert'} (Severity: ${alert.severity || 'Unknown'})`, 70, doc.y + 12);
          doc.fillColor('#fecaca').fontSize(11).font('Helvetica').text(content, 70, doc.y + 6, { width: 455 });
          doc.moveDown(2);
        });
      }

      if (targetDoc.activeCrops && targetDoc.activeCrops.length > 0) {
        drawHeader(`ACTIVE CROPS IN REGION${reportType === 'upazila' ? ' (District Level)' : ''}`);
        
        // Draw grid for crops
        const cropCount = targetDoc.activeCrops.length;
        const cols = 2;
        const rows = Math.ceil(cropCount / cols);
        const cellHeight = 35;
        const tableHeight = rows * cellHeight;
        
        checkSpace(tableHeight + 20);
        
        doc.rect(50, doc.y, 495, tableHeight).fill('#1e293b').stroke('#334155');
        
        let startY = doc.y;
        doc.fillColor('#f8fafc').fontSize(12).font('Helvetica');
        
        targetDoc.activeCrops.forEach((c, index) => {
          const r = Math.floor(index / cols);
          const cIdx = index % cols;
          
          const cropName = typeof c === 'string' ? c : c.crop;
          const stage = typeof c === 'string' ? '' : ` — ${c.stage}`;
          
          const x = 70 + (cIdx * 240);
          const y = startY + (r * cellHeight) + 12;
          
          doc.font('Helvetica-Bold').text(`• ${cropName}`, x, y, { continued: true });
          doc.font('Helvetica').fillColor('#94a3b8').text(stage);
          doc.fillColor('#f8fafc');
        });
        
        doc.y = startY + tableHeight + 15;
      }
    }

    // --- Logistics ---
    if (includeLogistics && dispatches.length > 0) {
      drawHeader(`RECENT LOGISTICS DISPATCHES${reportType === 'upazila' ? ' (To Parent District)' : ''}`);
      dispatches.forEach(d => {
        checkSpace(70);
        const dDate = new Date(d.dispatchedAt || d.createdAt).toLocaleDateString();
        doc.rect(50, doc.y, 495, 60).fill('#1e293b').stroke('#334155');
        doc.fillColor('#f8fafc').font('Helvetica-Bold').fontSize(14).text(`${d.crop} — ${d.cargoWeightMtons || d.totalMtons} Metric Tons`, 70, doc.y + 12);
        doc.fillColor('#94a3b8').font('Helvetica').fontSize(11).text(`Dispatched: ${dDate}  |  Origin Division ID: ${d.fromDivisionId || 'N/A'}`, 70, doc.y + 8);
        doc.moveDown(2.5);
      });
    }

    // --- Market Prices ---
    if (includeMarket && marketPrices.length > 0) {
      drawHeader(`MARKET PRICE SNAPSHOT${reportType === 'upazila' ? ' (District Level)' : ''}`);
      
      checkSpace(40);
      doc.rect(50, doc.y, 495, 30).fill('#0f766e');
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#f8fafc');
      doc.text('Date', 70, doc.y + 10, { continued: true, width: 100 });
      doc.text('Commodity', 170, doc.y, { continued: true, width: 200 });
      doc.text('Price / Kg', 370, doc.y);
      doc.moveDown(1.5);
      
      doc.font('Helvetica').fillColor('#f8fafc');
      marketPrices.forEach((mp, i) => {
        checkSpace(30);
        const startY = doc.y;
        
        if (i % 2 === 0) doc.rect(50, startY - 5, 495, 25).fill('#1e293b');
        else doc.rect(50, startY - 5, 495, 25).fill('#334155');
        
        doc.fillColor('#f8fafc');
        const mpDate = new Date(mp.date).toLocaleDateString();
        doc.text(mpDate, 70, startY, { width: 100 });
        doc.text(mp.commodity, 170, startY, { width: 200 });
        doc.font('Helvetica-Bold').fillColor('#34d399').text(`BDT ${mp.pricePerKg}`, 370, startY);
        doc.font('Helvetica');
        doc.moveDown(1);
      });
      doc.y += 10;
    }

    // Add footers to all pages
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.rect(0, 800, 595, 42).fill('#1e293b');
      doc.fillColor('#94a3b8').fontSize(10).font('Helvetica').text(
        `KrishiNexus Confidential  |  Page ${i + 1} of ${range.count}`, 
        50, 815, { align: 'center' }
      );
    }

    doc.end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
