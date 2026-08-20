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
      info: { Title: 'KrishiNexus Report', Author: 'KrishiNexus Platform' }
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

    // --- Helper Functions for Styling ---
    const drawHeader = (title) => {
      doc.rect(50, doc.y, 495, 30).fill('#0f766e'); // Teal 700 background
      doc.fillColor('#ffffff').fontSize(14).text(title, 60, doc.y + 8);
      doc.moveDown(1.5);
      doc.fillColor('#334155'); // Slate 700
    };

    // --- Page 1: Overview ---
    doc.rect(0, 0, 595, 120).fill('#022c22'); // Emerald 950 header
    doc.fillColor('#34d399').fontSize(26).text('KrishiNexus Mission Control', 50, 40, { align: 'center' });
    doc.fillColor('#94a3b8').fontSize(14).text('Automated Intelligence Report', 50, 75, { align: 'center' });
    
    doc.y = 150;
    doc.fillColor('#0f172a').fontSize(20).text(`Target: ${targetDoc.name || targetDoc.bnName || targetId} (${reportType.toUpperCase()})`);
    doc.fontSize(12).fillColor('#64748b').text(`Generated on: ${new Date().toLocaleDateString()}`);
    
    doc.moveDown(1);
    
    // Risk Status Box
    const riskColor = targetDoc.riskStatus === 'red' ? '#ef4444' : (targetDoc.riskStatus === 'yellow' ? '#f59e0b' : '#10b981');
    doc.rect(50, doc.y, 495, 40).fill(riskColor);
    doc.fillColor('#ffffff').fontSize(16).text(`Current Risk Status: ${targetDoc.riskStatus ? targetDoc.riskStatus.toUpperCase() : 'UNKNOWN'}`, 60, doc.y + 12);
    doc.moveDown(2);
    
    if (includeWeather && targetDoc.liveWeather) {
      drawHeader('Weather Summary (Today)');
      const w = targetDoc.liveWeather;
      
      doc.fontSize(12);
      doc.text(`Max Temperature: `, { continued: true }).font('Helvetica-Bold').text(`${w.tempMaxToday || '--'}°C`).font('Helvetica');
      doc.moveDown(0.5);
      doc.text(`Min Temperature: `, { continued: true }).font('Helvetica-Bold').text(`${w.tempMinToday || '--'}°C`).font('Helvetica');
      doc.moveDown(0.5);
      doc.text(`Max Humidity: `, { continued: true }).font('Helvetica-Bold').text(`${w.humidityMaxToday || '--'}%`).font('Helvetica');
      doc.moveDown(0.5);
      
      let precipSum = 0;
      if (w.precipitationSum7Day && w.precipitationSum7Day.length > 0) {
        precipSum = w.precipitationSum7Day[0];
      }
      doc.text(`Precipitation (Today): `, { continued: true }).font('Helvetica-Bold').text(`${precipSum} mm`).font('Helvetica');
      doc.moveDown(2);
    }

    // --- Page 2: Alerts & Crops ---
    if (includeAdvisory && ((targetDoc.activeAlerts && targetDoc.activeAlerts.length > 0) || (targetDoc.activeCrops && targetDoc.activeCrops.length > 0))) {
      doc.addPage();
      
      if (targetDoc.activeAlerts && targetDoc.activeAlerts.length > 0) {
        drawHeader('Active Alerts');
        targetDoc.activeAlerts.forEach((alert, idx) => {
          doc.rect(50, doc.y, 495, doc.heightOfString(alert.message || alert.label || alert.alertType) + 40).fill('#fef2f2').stroke('#fca5a5');
          doc.fillColor('#b91c1c').fontSize(14).font('Helvetica-Bold').text(`${alert.label || alert.type || 'Alert'} (Severity: ${alert.severity || 'Unknown'})`, 60, doc.y + 10);
          doc.fillColor('#7f1d1d').fontSize(12).font('Helvetica').text(alert.triggerReason || alert.message || '', 60, doc.y + 5);
          doc.moveDown(1.5);
        });
      }

      if (targetDoc.activeCrops && targetDoc.activeCrops.length > 0) {
        doc.moveDown(1);
        drawHeader('Active Crops');
        doc.fillColor('#334155').fontSize(12);
        targetDoc.activeCrops.forEach(c => {
          const cropName = typeof c === 'string' ? c : c.crop;
          const stage = typeof c === 'string' ? '' : ` (Stage: ${c.stage})`;
          doc.text(`• ${cropName}${stage}`);
          doc.moveDown(0.5);
        });
      }
    }

    // --- Page 3: Logistics ---
    if (includeLogistics && dispatches.length > 0) {
      doc.addPage();
      drawHeader('Recent Logistics Dispatches (Last 3)');
      
      dispatches.forEach(d => {
        const dDate = new Date(d.dispatchedAt || d.createdAt).toLocaleDateString();
        doc.rect(50, doc.y, 495, 60).fill('#f8fafc').stroke('#cbd5e1');
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(14).text(`${d.crop} — ${d.cargoWeightMtons || d.totalMtons} Mtons`, 60, doc.y + 10);
        doc.fillColor('#475569').font('Helvetica').fontSize(12).text(`Date: ${dDate}  |  Source Division ID: ${d.fromDivisionId || 'N/A'}`, 60, doc.y + 5);
        doc.moveDown(1.5);
      });
    }

    // --- Page 4: Market ---
    if (includeMarket && marketPrices.length > 0) {
      doc.addPage();
      drawHeader('Market Price Snapshot (Last 7 Days)');
      
      // Simple table header
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a');
      doc.text('Date', 60, doc.y, { continued: true, width: 100 });
      doc.text('Commodity', 160, doc.y, { continued: true, width: 200 });
      doc.text('Price/Kg (BDT)', 360, doc.y);
      doc.moveDown(0.5);
      
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#cbd5e1');
      doc.moveDown(0.5);

      doc.font('Helvetica').fillColor('#334155');
      marketPrices.forEach(mp => {
        const mpDate = new Date(mp.date).toLocaleDateString();
        const startY = doc.y;
        doc.text(mpDate, 60, startY, { width: 100 });
        doc.text(mp.commodity, 160, startY, { width: 200 });
        doc.text(`৳ ${mp.pricePerKg}`, 360, startY);
        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#f1f5f9');
        doc.moveDown(0.5);
      });
    }

    doc.end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
