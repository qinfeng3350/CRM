const express = require('express');
const router = express.Router();
const {
  getSalesTeam,
  getSalesPerson,
  createSalesPerson,
  updateSalesPerson,
  deleteSalesPerson,
  getSalesPerformance,
  getSalesActivities,
  createActivity,
  updateActivity,
  getSalesTasks,
  getSalesRanking
} = require('../controllers/salesController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/team', getSalesTeam);
router.get('/performance', getSalesPerformance);
router.get('/activities', getSalesActivities);
router.get('/tasks', getSalesTasks);
router.get('/ranking', getSalesRanking);
router.get('/:id', getSalesPerson);
router.post('/person', authorize('admin', 'sales_manager'), createSalesPerson);
router.put('/:id', authorize('admin', 'sales_manager'), updateSalesPerson);
router.delete('/:id', authorize('admin'), deleteSalesPerson);
router.post('/activities', createActivity);
router.put('/activities/:id', updateActivity);

module.exports = router;

