const express = require('express');
const router = express.Router();
const { uploadPaymentScreenshot, uploadProductImage } = require('../controllers/uploadController');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Payment screenshot — public (anyone who has the orderId can upload)
router.post('/payment-screenshot/:orderId', upload.single('screenshot'), uploadPaymentScreenshot);

// Product image — admin only
router.post('/product-image', protect, adminOnly, upload.single('image'), uploadProductImage);

module.exports = router;
