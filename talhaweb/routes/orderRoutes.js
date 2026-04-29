const express = require('express');
const router = express.Router();
const {
  createOrder, getMyOrders, getAllOrders,
  getOrder, updateOrderStatus, updatePaymentStatus
} = require('../controllers/orderController');
const { protect, adminOnly, optionalAuth } = require('../middleware/authMiddleware');

router.post('/',                    optionalAuth, createOrder);
router.get('/my',                   protect, getMyOrders);
router.get('/',                     protect, adminOnly, getAllOrders);
router.get('/:id',                  protect, getOrder);
router.put('/:id/status',           protect, adminOnly, updateOrderStatus);
router.put('/:id/payment-status',   protect, adminOnly, updatePaymentStatus);

module.exports = router;
