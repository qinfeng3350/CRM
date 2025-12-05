const express = require('express');
const router = express.Router();
const {
  getFollowUps,
  createFollowUp,
  updateFollowUp,
  deleteFollowUp
} = require('../controllers/followUpController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', getFollowUps);
router.post('/', createFollowUp);
router.put('/:id', updateFollowUp);
router.delete('/:id', deleteFollowUp);

module.exports = router;

