const mongoose = require('mongoose');
const { Schema } = mongoose;

// Define the wholesale product schema
const wholesaleSchema = new Schema({
    name: String,
    description: String,
    price: Number,
    minOrder: Number,
    stock: Number,
    category: String,
    type: String,
    image: String,
  }, {
    timestamps: true,
    collection: 'wholesales' // Make sure this matches your MongoDB collection
  });

// Create the model
const Wholesale = mongoose.model('Wholesale', wholesaleSchema);

module.exports = Wholesale;  // Export the Wholesale model
