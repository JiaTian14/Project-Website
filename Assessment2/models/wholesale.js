const mongoose = require('mongoose');
const { Schema } = mongoose;

// Define the wholesale product schema
const wholesaleSchema = new Schema({
    name: String,
    description: String,
    price: Number,
    stock: Number,
    minOrder: Number,
    category: String,
    image: String
});

// Create the model
const Wholesale = mongoose.model('Wholesale', wholesaleSchema);

module.exports = Wholesale;  // Export the Wholesale model
