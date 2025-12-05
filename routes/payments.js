const express = require('express');
const router = express.Router();
const {
  getPaymentPlans,
  createPaymentPlan,
  updatePaymentPlan,
  deletePaymentPlan,
  getPayments,
  createPayment,
  updatePayment,
  deletePayment,
  getFinancialSummary
} = require('../controllers/paymentController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// 回款计划
router.get('/plans', getPaymentPlans);
router.post('/plans', createPaymentPlan);
router.put('/plans/:id', updatePaymentPlan);
router.delete('/plans/:id', deletePaymentPlan);

// 回款记录
router.get('/', getPayments);
router.post('/', createPayment);
router.put('/:id', updatePayment);
router.delete('/:id', deletePayment);

// 财务统计
router.get('/summary', getFinancialSummary);

module.exports = router;

