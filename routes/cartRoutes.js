const express = require('express');
const router = express.Router();
const { getCart, saveCart, clearCart } = require('../controllers/cartController');
const { protect } = require('../middleware/authMiddleware');

router.route('/').get(protect, getCart).put(protect, saveCart).delete(protect, clearCart);

module.exports = router;
