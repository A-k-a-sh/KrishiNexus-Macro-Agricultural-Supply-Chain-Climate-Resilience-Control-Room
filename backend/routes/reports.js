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

    let dispatches = [];
    if (includeLogistics) {
      dispatches = await db.collection('dispatch_records')
        .find({ toDistrictId: targetDoc._id })
        .sort({ dispatchedAt: -1 })
        .limit(3)
        .toArray();
    }

    let marketPrices = [];
    if (includeMarket) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      marketPrices = await db.collection('market_prices')
        .find({ districtId: targetDoc._id, date: { $gte: sevenDaysAgo } })
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
    
    // Fill background on every new page
    doc.on('pageAdded', () => {
      doc.rect(0, 0, 595, 842).fill('#f1f5f9');
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
    doc.rect(0, 0, 595, 842).fill('#f1f5f9');

    // --- Helper Functions ---
    const checkSpace = (requiredSpace) => {
      if (doc.y + requiredSpace > 780) {
        doc.addPage();
        return true;
      }
      return false;
    };

    const drawHeader = (title) => {
      checkSpace(60);
      doc.rect(50, doc.y, 495, 30).fill('#0f766e'); // Teal 700
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(14).text(title, 60, doc.y + 8);
      doc.moveDown(1.5);
      doc.fillColor('#334155').font('Helvetica');
    };

    // --- Page 1: Header ---
    doc.rect(0, 0, 595, 120).fill('#022c22'); // Emerald 950
    doc.fillColor('#34d399').font('Helvetica-Bold').fontSize(28).text('KrishiNexus Mission Control', 0, 35, { align: 'center' });
    doc.fillColor('#94a3b8').font('Helvetica').fontSize(12).text('Automated Intelligence & Logistics Report', 0, 70, { align: 'center', characterSpacing: 2 });
    
    doc.y = 150;
    
    // Metadata block
    doc.rect(50, doc.y, 495, 80).fill('#ffffff').stroke('#e2e8f0');
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(22).text(`Target: ${targetDoc.name || targetDoc.bnName || targetId} (${reportType.toUpperCase()})`, 70, doc.y + 20);
    doc.fontSize(12).fillColor('#64748b').font('Helvetica').text(`Generated on: ${new Date().toLocaleString()}`, 70, doc.y + 10);
    
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
      
      doc.rect(50, doc.y, 495, 80).fill('#ffffff').stroke('#e2e8f0');
      const startY = doc.y + 15;
      
      doc.fillColor('#475569').fontSize(10).text('MAX TEMP', 70, startY);
      doc.fillColor('#0f172a').fontSize(16).font('Helvetica-Bold').text(`${w.tempMaxToday || '--'}°C`, 70, startY + 15).font('Helvetica');
      
      doc.fillColor('#475569').fontSize(10).text('MIN TEMP', 190, startY);
      doc.fillColor('#0f172a').fontSize(16).font('Helvetica-Bold').text(`${w.tempMinToday || '--'}°C`, 190, startY + 15).font('Helvetica');
      
      doc.fillColor('#475569').fontSize(10).text('HUMIDITY', 310, startY);
      doc.fillColor('#0f172a').fontSize(16).font('Helvetica-Bold').text(`${w.humidityMaxToday || '--'}%`, 310, startY + 15).font('Helvetica');
      
      let precipSum = w.precipitationSum7Day && w.precipitationSum7Day.length > 0 ? w.precipitationSum7Day[0] : 0;
      doc.fillColor('#475569').fontSize(10).text('RAINFALL', 430, startY);
      doc.fillColor('#0f172a').fontSize(16).font('Helvetica-Bold').text(`${precipSum} mm`, 430, startY + 15).font('Helvetica');
      
      doc.y = startY + 65;
    }

    // --- Alerts & Crops ---
    if (includeAdvisory && ((targetDoc.activeAlerts && targetDoc.activeAlerts.length > 0) || (targetDoc.activeCrops && targetDoc.activeCrops.length > 0))) {
      
      if (targetDoc.activeAlerts && targetDoc.activeAlerts.length > 0) {
        drawHeader('ACTIVE CLIMATE ALERTS');
        targetDoc.activeAlerts.forEach((alert) => {
          const content = alert.triggerReason || alert.message || 'No additional details provided.';
          const boxHeight = doc.heightOfString(content, { width: 455 }) + 45;
          checkSpace(boxHeight);
          
          doc.rect(50, doc.y, 495, boxHeight).fill('#fef2f2').stroke('#fca5a5');
          doc.fillColor('#b91c1c').fontSize(14).font('Helvetica-Bold').text(`⚠ ${alert.label || alert.type || 'Alert'} (Severity: ${alert.severity || 'Unknown'})`, 70, doc.y + 12);
          doc.fillColor('#7f1d1d').fontSize(11).font('Helvetica').text(content, 70, doc.y + 6, { width: 455 });
          doc.moveDown(2);
        });
      }

      if (targetDoc.activeCrops && targetDoc.activeCrops.length > 0) {
        drawHeader('ACTIVE REGIONAL CROPS');
        doc.rect(50, doc.y, 495, (targetDoc.activeCrops.length * 20) + 20).fill('#ffffff').stroke('#e2e8f0');
        doc.fillColor('#334155').fontSize(12).font('Helvetica');
        doc.y += 10;
        targetDoc.activeCrops.forEach(c => {
          const cropName = typeof c === 'string' ? c : c.crop;
          const stage = typeof c === 'string' ? '' : ` (Stage: ${c.stage})`;
          doc.text(`• ${cropName}${stage}`, 70, doc.y);
        });
        doc.y += 25;
      }
    }

    // --- Logistics ---
    if (includeLogistics && dispatches.length > 0) {
      drawHeader('RECENT LOGISTICS DISPATCHES');
      dispatches.forEach(d => {
        checkSpace(70);
        const dDate = new Date(d.dispatchedAt || d.createdAt).toLocaleDateString();
        doc.rect(50, doc.y, 495, 60).fill('#ffffff').stroke('#cbd5e1');
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(14).text(`${d.crop} — ${d.cargoWeightMtons || d.totalMtons} Metric Tons`, 70, doc.y + 12);
        doc.fillColor('#64748b').font('Helvetica').fontSize(11).text(`Dispatched: ${dDate}  |  Origin Division ID: ${d.fromDivisionId || 'N/A'}`, 70, doc.y + 8);
        doc.moveDown(2.5);
      });
    }

    // --- Market Prices ---
    if (includeMarket && marketPrices.length > 0) {
      drawHeader('MARKET PRICE SNAPSHOT');
      
      checkSpace(40);
      doc.rect(50, doc.y, 495, 30).fill('#e2e8f0');
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#334155');
      doc.text('Date', 70, doc.y + 10, { continued: true, width: 100 });
      doc.text('Commodity', 170, doc.y, { continued: true, width: 200 });
      doc.text('Price / Kg', 370, doc.y);
      doc.moveDown(1.5);
      
      doc.font('Helvetica').fillColor('#0f172a');
      marketPrices.forEach((mp, i) => {
        checkSpace(30);
        const startY = doc.y;
        
        if (i % 2 === 0) doc.rect(50, startY - 5, 495, 25).fill('#ffffff');
        else doc.rect(50, startY - 5, 495, 25).fill('#f8fafc');
        
        doc.fillColor('#334155');
        const mpDate = new Date(mp.date).toLocaleDateString();
        doc.text(mpDate, 70, startY, { width: 100 });
        doc.text(mp.commodity, 170, startY, { width: 200 });
        doc.font('Helvetica-Bold').fillColor('#059669').text(`BDT ${mp.pricePerKg}`, 370, startY);
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
