const asyncHandler = require('express-async-handler');
const Cart = require('../models/Cart');

// @desc    Get user's cart
// @route   GET /api/cart
// @access  Private
const getCart = asyncHandler(async (req, res) => {
    const cart = await Cart.findOne({ user: req.user._id });
    res.json(cart ? cart.items : []);
});

// @desc    Save/update user's cart
// @route   PUT /api/cart
// @access  Private
const saveCart = asyncHandler(async (req, res) => {
    const { items } = req.body;

    let cart = await Cart.findOne({ user: req.user._id });
    if (cart) {
        cart.items = items;
        await cart.save();
    } else {
        cart = await Cart.create({ user: req.user._id, items });
    }
    res.json(cart.items);
});

// @desc    Clear user's cart
// @route   DELETE /api/cart
// @access  Private
const clearCart = asyncHandler(async (req, res) => {
    await Cart.findOneAndDelete({ user: req.user._id });
    res.json({ message: 'Cart cleared' });
});

module.exports = { getCart, saveCart, clearCart };
