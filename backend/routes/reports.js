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

    // Build PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const safeName = targetDoc.name ? targetDoc.name.replace(/\s+/g, '-').toLowerCase() : targetId;
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `krishinexus-report-${safeName}-${dateStr}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Error handling for stream
    doc.on('error', (err) => {
      console.error('PDFKit generation error:', err);
      // Can't use next(err) if headers are already sent, but we can try to close stream
      if (!res.headersSent) {
        next(err);
      } else {
        res.end();
      }
    });

    doc.pipe(res);

    // --- Page 1: Overview ---
    doc.fontSize(20).text('KrishiNexus District Report', { align: 'center' });
    doc.moveDown();
    
    doc.fontSize(16).text(`Target: ${targetDoc.name || targetDoc.bnName || targetId} (${reportType})`);
    doc.fontSize(12).text(`Date: ${new Date().toLocaleDateString()}`);
    doc.text(`Risk Status: ${targetDoc.riskStatus || 'N/A'}`);
    
    if (includeWeather && targetDoc.liveWeather) {
      doc.moveDown();
      doc.fontSize(14).text('Weather Summary', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12).text(`Temperature: ${targetDoc.liveWeather.temperature}°C`);
      doc.text(`Humidity: ${targetDoc.liveWeather.humidity}%`);
      doc.text(`Rainfall: ${targetDoc.liveWeather.rainfall} mm`);
    }

    // --- Page 2: Alerts & Crops ---
    if (includeAdvisory && ((targetDoc.activeAlerts && targetDoc.activeAlerts.length > 0) || targetDoc.activeCrops)) {
      doc.addPage();
      
      if (targetDoc.activeAlerts && targetDoc.activeAlerts.length > 0) {
        doc.fontSize(16).text('Active Alerts');
        doc.moveDown();
        targetDoc.activeAlerts.forEach(alert => {
          doc.fontSize(12).text(`• ${alert.alertType || 'Alert'}: ${alert.message || ''} (Severity: ${alert.severity || 'Unknown'})`);
          doc.moveDown(0.5);
        });
      }

      if (targetDoc.activeCrops) {
        doc.moveDown();
        doc.fontSize(16).text('Active Crops');
        doc.moveDown();
        doc.fontSize(12).text(targetDoc.activeCrops.join(', '));
      }
    }

    // --- Page 3: Logistics ---
    if (includeLogistics && dispatches.length > 0) {
      doc.addPage();
      doc.fontSize(16).text('Recent Logistics Dispatches (Last 3)');
      doc.moveDown();
      dispatches.forEach(d => {
        const dDate = new Date(d.dispatchedAt).toLocaleDateString();
        doc.fontSize(12).text(`• ${dDate}: ${d.crop} (${d.totalMtons} Mtons) from Division ${d.fromDivisionId}`);
        doc.moveDown(0.5);
      });
    }

    // --- Page 4: Market ---
    if (includeMarket && marketPrices.length > 0) {
      doc.addPage();
      doc.fontSize(16).text('Market Price Snapshot (Last 7 Days)');
      doc.moveDown();
      marketPrices.forEach(mp => {
        const mpDate = new Date(mp.date).toLocaleDateString();
        doc.fontSize(12).text(`• ${mpDate}: ${mp.commodity} - ${mp.pricePerKg} BDT/kg`);
        doc.moveDown(0.5);
      });
    }

    doc.end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
