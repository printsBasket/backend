const mongoose = require('mongoose');

const cartItemSchema = mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    title: { type: String, required: true },
    image: { type: String, default: '' },
    price: { type: Number, required: true },
    countInStock: { type: Number, default: 0 },
    slug: { type: String, default: '' },
    qty: { type: Number, required: true, default: 1 },
});

const cartSchema = mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: [cartItemSchema],
}, { timestamps: true });

module.exports = mongoose.model('Cart', cartSchema);
