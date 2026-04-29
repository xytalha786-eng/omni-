const express = require('express');
const router = express.Router();
const {
  getStats, getUsers, updateUserRole,
  getCategories, createCategory, updateCategory, deleteCategory
} = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// All admin routes require auth + admin role
router.use(protect, adminOnly);

router.get('/stats',                getStats);
router.get('/users',                getUsers);
router.put('/users/:id/role',       updateUserRole);
router.get('/categories',           getCategories);
router.post('/categories',          createCategory);
router.put('/categories/:id',       updateCategory);
router.delete('/categories/:id',    deleteCategory);

module.exports = router;
