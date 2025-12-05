const express = require('express');
const router = express.Router();
const {
  getLeads,
  getLead,
  createLead,
  updateLead,
  deleteLead,
  convertLead,
  updateLeadStatus,
  getCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  getCampaignStats
} = require('../controllers/marketingController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/leads', getLeads);
router.get('/leads/:id', getLead);
router.post('/leads', createLead);
router.put('/leads/:id', updateLead);
router.delete('/leads/:id', deleteLead);
router.post('/leads/:id/convert', convertLead);
router.post('/leads/:id/status', updateLeadStatus);

router.get('/campaigns', getCampaigns);
router.get('/campaigns/:id', getCampaign);
router.post('/campaigns', createCampaign);
router.put('/campaigns/:id', updateCampaign);
router.delete('/campaigns/:id', deleteCampaign);
router.get('/campaigns/:id/stats', getCampaignStats);

module.exports = router;

