const { Router } = require('express');
const { generateText } = require('../services/geminiGenerate');

const router = Router();

const MANIFEST_SYSTEM_PROMPT = `You are a logistics officer for Bangladesh's national food supply chain authority.
Write formal, precise cargo dispatch orders.
Use professional supply-chain language.
Do not add preamble, sign-offs, or markdown formatting.
Return only the manifest text itself.`;

/**
 * POST /api/manifest
 * Body: { fromDivision, toDistrict, crop, cargoWeightMtons, reason }
 *
 * Calls Gemini to generate a 3-sentence formal cargo manifest.
 */
router.post('/', async (req, res, next) => {
  try {
    const { fromDivision, toDistrict, crop, cargoWeightMtons, reason } = req.body;

    if (!fromDivision || !toDistrict || !crop || !cargoWeightMtons) {
      return res.status(400).json({
        ok: false,
        message: '`fromDivision`, `toDistrict`, `crop`, and `cargoWeightMtons` are required',
      });
    }

    const userPrompt = `Generate a formal 3-sentence cargo manifest dispatch order for the following shipment:
- Origin: ${fromDivision} Division warehouse
- Destination: ${toDistrict} District distribution hub
- Commodity: ${crop}
- Cargo weight: ${cargoWeightMtons} metric tons
- Reason for dispatch: ${reason || 'Climate-induced regional production deficit'}
- Dispatch authority: KrishiNexus National Supply Chain Command`;

    const manifestText = await generateText(MANIFEST_SYSTEM_PROMPT, userPrompt);

    res.json({ ok: true, manifestText });
  } catch (err) {
    next(err);
  }
});

module.exports = router;