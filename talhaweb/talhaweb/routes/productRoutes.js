const express = require('express');
const router = express.Router();
const {
  getProducts, getProduct, createProduct,
  updateProduct, deleteProduct, uploadProductImage
} = require('../controllers/productController');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.get('/',           getProducts);
router.get('/:id',        getProduct);
router.post('/',          protect, adminOnly, createProduct);
router.put('/:id',        protect, adminOnly, updateProduct);
router.delete('/:id',     protect, adminOnly, deleteProduct);
router.post('/:id/image', protect, adminOnly, upload.single('image'), uploadProductImage);

module.exports = router;
