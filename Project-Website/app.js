const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const cors = require('cors');

const corsOptions = {
    origin: 'http://127.0.0.1:5501',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'sellerId', 'Authorization'],
    credentials: true
};
app.use(cors(corsOptions));

const uri = "mongodb+srv://Tan:1234@assessment.2jgmj.mongodb.net/?retryWrites=true&w=majority&appName=Assessment";
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// Middleware to parse JSON bodies
app.use(express.json());

// Get cart by userId
app.get('/api/cart/:userId', async (req, res) => {
  try {
    await client.connect();
    const database = client.db("techmart"); // 替换成你的数据库名称
    const cartsCollection = database.collection("carts");
    
    const userId = req.params.userId;
    
    const cart = await cartsCollection.findOne({ 
      userId: userId 
    });
    
    if (!cart) {
      return res.status(404).json({ message: "Cart not found for this user" });
    }
    
    res.status(200).json(cart);
    
  } catch (error) {
    console.error("Error fetching cart:", error);
    res.status(500).json({ message: "Error fetching cart", error: error.message });
  } finally {
    // 注意：在实际生产环境中，你可能不想在每个请求后都关闭连接
    // await client.close();
  }
});

// Update cart item quantity
app.post('/api/cart/:userId/update', async (req, res) => {
    try {
      await client.connect();
      const database = client.db("techmart");
      const carts = database.collection("carts");
      const products = database.collection("products");
  
      const { userId } = req.params;
      const { productId, newQuantity } = req.body;
  
      // Input validation
      if (!userId || !productId || typeof newQuantity !== 'number') {
        return res.status(400).json({
          success: false,
          message: 'Missing or invalid required fields'
        });
      }
  
      // Check for negative quantity
      if (newQuantity < 0) {
        return res.status(400).json({
          success: false,
          message: 'Quantity cannot be negative'
        });
      }
  
      // Check product existence and stock
      const product = await products.findOne({ _id: new ObjectId(productId) });
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }
  
      // Verify stock availability
      if (newQuantity > product.stock) {
        return res.status(400).json({
          success: false,
          message: 'Requested quantity exceeds available stock'
        });
      }
  
      let updateResult;
      if (newQuantity === 0) {
        // Remove product from cart if quantity is 0
        updateResult = await carts.updateOne(
          { userId },
          { 
            $pull: { products: { productId } },
            $set: { updatedAt: new Date() }
          }
        );
      } else {
        // Update product quantity
        updateResult = await carts.updateOne(
          { 
            userId, 
            "products.productId": productId 
          },
          { 
            $set: { 
              "products.$.quantity": newQuantity,
              updatedAt: new Date()
            }
          }
        );
      }
  
      // Check if update was successful
      if (updateResult.matchedCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'Cart not found or product not in cart'
        });
      }
  
      // Get updated cart
      const updatedCart = await carts.findOne({ userId });
  
      // Return success response
      res.json({
        success: true,
        message: 'Cart updated successfully',
        data: updatedCart
      });
  
    } catch (error) {
      console.error('Error updating cart:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating cart',
        error: error.message
      });
    }
  });



  app.post('/api/orders', async (req, res) => {
    try {
      await client.connect();
      const database = client.db("techmart");
      const orders = database.collection("orders");
      const carts = database.collection("carts");
      const products = database.collection("products");
  
      const {
        userId,
        shippingInfo,
        paymentMethod,
        orderTotal,
        shippingFee
      } = req.body;
  
      // Input validation
      if (!userId || !shippingInfo || !paymentMethod) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        });
      }
  
      // Validate shipping info
      if (!shippingInfo.fullName || !shippingInfo.address ||
          !shippingInfo.city || !shippingInfo.postalCode) {
        return res.status(400).json({
          success: false,
          message: 'Incomplete shipping information'
        });
      }
  
      // Get user's cart
      const cart = await carts.findOne({ userId });
      if (!cart || !cart.products || cart.products.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cart is empty'
        });
      }
  
      // Initialize validProducts and subtotal
      let validProducts = [];
      let subtotal = 0;
  
      // Verify stock availability for all products
      for (const cartItem of cart.products) {
        const product = await products.findOne({ _id: new ObjectId(cartItem.productId) });
        if (!product) {
          console.warn(`Product with ID ${cartItem.productId} not found. Skipping...`);
          continue;
        }
        if (product.stock < cartItem.quantity) {
          console.warn(`Insufficient stock for product ${cartItem.productId}. Skipping...`);
          continue;
        }
  
        // Include valid product and calculate subtotal
        validProducts.push(cartItem);
        subtotal += cartItem.price * cartItem.quantity;
      }
  
      // Abort if no valid items
      if (validProducts.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid products to place an order.'
        });
      }
  
      // Create order using valid items and recalculated totals
      const newOrder = {
        userId,
        products: validProducts,
        subtotal,
        total: subtotal + (shippingFee || 0),
        shippingInfo,
        paymentMethod,
        status: "Pending", // Initial status
        date: new Date(),
      };
  
      // Insert order into database
      const result = await orders.insertOne(newOrder);
  
      if (result.acknowledged) {
        // Update stock for valid products
        for (const item of validProducts) {
          await products.updateOne(
            { _id: new ObjectId(item.productId) },
            { $inc: { stock: -item.quantity } }
          );
        }
  
        // Clear user's cart after successful order
        await carts.updateOne(
          { userId },
          { $set: { products: [], total: 0 } }
        );
  
        // Return success response
        res.status(201).json({
          success: true,
          message: 'Order created successfully',
          data: {
            orderId: result.insertedId,
            ...newOrder
          }
        });
      } else {
        throw new Error('Failed to create order');
      }
  
    } catch (error) {
      console.error('Error creating order:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating order',
        error: error.message
      });
    }
  });
  
  
  

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something broke!", error: err.message });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});