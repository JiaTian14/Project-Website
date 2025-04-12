const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const app = express();
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const bodyParser = require('body-parser');
const session = require('express-session');
const Wholesale = require('./Assessment2/models/wholesale');
const Product = require('./Assessment2/models/product'); // Corrected the path to the Product model
const cartRoutes = require('./Assessment2/routes/cartRoutes'); // Import cart routes
const http = require('http');
const WebSocket = require('ws');

// Middleware
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
const corsOptions = {
    origin: 'http://127.0.0.1:5501',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'sellerId', 'Authorization'],
    credentials: true
};
app.use(cors(corsOptions));

const uri = "mongodb+srv://Tan:1234@assessment.2jgmj.mongodb.net/?retryWrites=true&w=majority&appName=Assessment";
let client;

// Connect to MongoDB using Mongoose
mongoose.connect(uri, {
    serverSelectionTimeoutMS: 30000, // Increase the timeout to 30 seconds
}).then(() => {
    console.log('Mongoose connected to MongoDB');
}).catch((err) => {
    console.error('Mongoose connection error:', err);
});

// Create HTTP server and WebSocket server
const server = http.createServer(app);
const wss = new WebSocket.Server({ server }); // Remove path for WebSocket

// WebSocket connection handler
wss.on('connection', (ws) => {
    console.log('New WebSocket connection');

    ws.on('message', (message) => {
        console.log('Received message:', message);
        // Broadcast message to all connected clients
        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });

    ws.on('close', () => {
        console.log('WebSocket connection closed');
    });
});

// Start the server only after a successful Mongoose connection
if (process.env.NODE_ENV !== 'test') {
    mongoose.connection.once('open', () => {
        console.log('Mongoose connection is open');
        const PORT = process.env.PORT || 3000;
        server.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    });
}

// Connect to MongoDB
async function connectDB() {
    if (!client) {
        client = new MongoClient(uri, { serverSelectionTimeoutMS: 30000 }); // Increase the timeout to 30 seconds
        await client.connect();
        console.log('Connected to MongoDB');
    }
    return client;
}

// Helper function for error handling
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// Middleware to check Mongoose connection
app.use((req, res, next) => {
    if (mongoose.connection.readyState !== 1) {
        return res.status(500).json({ success: false, message: 'Database connection error' });
    }
    next();
});

// Use cart routes
app.use('/api/cart', cartRoutes);

// ---------- GET Routes ----------
// Get default homepage
app.get('/', (req, res) => res.json({ message: 'Welcome to the E-commerce API' }));

// Get user orders
app.get('/api/orders/:userId', asyncHandler(async (req, res) => {
    const client = await connectDB();
    const orders = client.db("techmart").collection("orders");
    const userOrders = await orders.find({ userId: req.params.userId }).toArray();
    res.json(userOrders);
}));

// Get user's cart
app.get('/api/cart/:userId', asyncHandler(async (req, res) => {
    const { userId } = req.params;
    console.log('Received userId:', userId);

    try {
        // Validate if userId is a valid ObjectId (if it's supposed to be an ObjectId)
        if (!ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID format'
            });
        }

        const client = await connectDB();
        const db = client.db("techmart");
        const users = db.collection("users");
        const carts = db.collection("carts");

        const user = await users.findOne({ _id: new ObjectId(userId) });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        console.log('Found user:', user); // Log the found user data

        const cart = await carts.findOne({ userId: userId.toString() });
        if (!cart) {
            return res.status(404).json({
                success: false,
                message: 'Cart not found for the given user ID'
            });
        }

        // Return the cart data
        return res.json({
            success: true,
            data: {
                cart,
                user: {
                    userId: user._id.toString(),
                    email: user.email
                }
            }
        });
    } catch (error) {
        console.error('Error retrieving cart data:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}));

app.get('/api/test-db', async (req, res) => {
    try {
        const client = await connectDB();
        console.log('[DEBUG] Database connection test successful');
        return res.status(200).json({ success: true, message: "Database connected successfully" });
    } catch (error) {
        console.error('[ERROR] Database connection test failed:', error);
        return res.status(500).json({ success: false, message: "Database connection failed", error: error.message });
    }
});

// Get checkout details
app.get('/api/checkout', asyncHandler(async (req, res) => {
    // Placeholder data for checkout
    res.json({ message: 'Checkout details here.' });
}));

// Get order history
app.get('/api/orderHistory', asyncHandler(async (req, res) => {
    const client = await connectDB();
    const orders = client.db("techmart").collection("orders");
    const allOrders = await orders.find().toArray();
    res.json(allOrders);
}));

// Get specific order
app.get('/api/orderHistory/:orderId', asyncHandler(async (req, res) => {
    const client = await connectDB();
    const orders = client.db("techmart").collection("orders");
    const order = await orders.findOne({ _id: new ObjectId(req.params.orderId) });
    if (!order) throw new Error('Order not found');
    res.json(order);
}));

// Get user profile
app.get('/api/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'User ID is required'
        });
    }  
    const client = await connectDB();
    const database = client.db("techmart");

    const profiles = database.collection("profiles");

    // Fetch profile and user data
    const profile = await profiles.findOne({ userId });
        
    if (!profile) {
      return res.status(404).json({
          success: false,
          message: 'Profile not found'
      });
  }

  res.json({
      success: true,
      data: profile,
          
  });
} catch (error) {
  console.error('Error fetching profile:', error);
  res.status(500).json({
      success: false,
      message: 'Error fetching profile',
      error: error.message
  });
}
});

// 修改获取所有产品的路由
app.get('/api/products', async (req, res) => {
    try {
        console.log('Fetching products...');
        const client = await connectDB();
        const database = client.db("techmart");
        const products = database.collection("products");

        // 获取所有产品
        const allProducts = await products.find({}).toArray();
        console.log(`Found ${allProducts.length} products`);

        // 如果没有产品，添加示例产品
        if (allProducts.length === 0) {
            const sampleProducts = [
                {
                    name: "Gaming Laptop",
                    category: "Laptops",
                    price: 1499.99,
                    stock: 10,
                    description: "High-performance gaming laptop",
                    image: "https://via.placeholder.com/300x250"
                },
                {
                    name: "iPhone 15",
                    category: "Phones",
                    price: 999.99,
                    stock: 15,
                    description: "Latest iPhone with advanced features",
                    image: "https://via.placeholder.com/300x250"
                },
                {
                    name: "Sony WH-1000XM4",
                    category: "Audio",
                    price: 349.99,
                    stock: 20,
                    description: "Premium wireless noise-cancelling headphones",
                    image: "https://via.placeholder.com/300x250"
                },
                {
                    name: "iPad Pro",
                    category: "Tablets",
                    price: 799.99,
                    stock: 12,
                    description: "Powerful tablet for professionals",
                    image: "https://via.placeholder.com/300x250"
                },
                {
                    name: "MacBook Air",
                    category: "Laptops",
                    price: 1299.99,
                    stock: 8,
                    description: "Thin and light laptop with M2 chip",
                    image: "https://via.placeholder.com/300x250"
                }
            ];

            await products.insertMany(sampleProducts);
            console.log('Added sample products');
            
            // 重新获取产品列表
            const updatedProducts = await products.find({}).toArray();
            return res.json({
                success: true,
                data: updatedProducts
            });
        }

        // 返回找到的产品
        return res.json({
            success: true,
            data: allProducts
        });

    } catch (error) {
        console.error('Error in /api/products:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching products',
            error: error.message
        });
    }
});

// 添加获取单个产品的路由
app.get('/api/products/:id', async (req, res) => {
    const productId = req.params.id;

    try {
        // ✅ Validate the ID format
        if (!ObjectId.isValid(productId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID format"
            });
        }

        const client = await connectDB();
        const database = client.db("techmart");
        const products = database.collection("products");

        const product = await products.findOne({ _id: new ObjectId(productId) });

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        res.json({
            success: true,
            data: product
        });

    } catch (error) {
        console.error("Error fetching product:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching product",
            error: error.message
        });
    }
});
// ---------- POST Routes ----------
class APIError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
    }
}
// Register a new user
app.post('/api/register', asyncHandler(async (req, res) => {
    const { username, email, password } = req.body;

  if (!username || !email || !password) {
    throw new APIError(400, 'All fields are required.');
  }
    const client = await connectDB();
    const users = client.db("techmart").collection("users");
    const existingUser = await users.findOne({ email });
    if (existingUser) {
    throw new APIError(400, 'Email already in use.');
    }
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
     // 保存用户
  const newUser = {
    username,
    email,
    password: hashedPassword,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await users.insertOne(newUser);
  res.json({
    success: true,
    message: 'User registered successfully.',
    data: { id: result.insertedId, username, email },
  });
}));

// User login
app.post('/api/users/login', async (req, res) => {
    try {
        console.log('Login request received:', req.body);
        const { email, password } = req.body;
        
        // Input validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        const client = await connectDB();
        const database = client.db("techmart");
        const users = database.collection("users");
        
        // Find user by email
        const user = await users.findOne({ email });
        
        // Check if user exists
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Validate password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        console.log('Password validation:', isPasswordValid ? 'Valid' : 'Invalid');

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Prepare user data to send back (excluding sensitive information)
        const userData = {
            _id: user._id,
            username: user.username,
            email: user.email,
            createdAt: user.createdAt
        };

        // Send successful response
        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: userData
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Error during login',
            error: error.message
        });
    }
});

app.post('/api/wholesalecart/:userId/add', async (req, res) => {
    try {
        const { userId } = req.params;
        const { productId, quantity } = req.body;

        // Input validation
        if (!userId || !productId || !quantity) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: userId, productId, or quantity'
            });
        }

        if (quantity <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Quantity must be greater than 0'
            });
        }

        const client = await connectDB();
        const db = client.db("techmart");
        const carts = db.collection("carts");
        const wholesales = db.collection("wholesales"); // Use wholesale collection

        // Check if the product exists in wholesales collection
        const wholesaleProduct = await wholesales.findOne({ _id: new ObjectId(productId) });

        if (!wholesaleProduct) {
            return res.status(404).json({
                success: false,
                message: 'Wholesale product not found'
            });
        }

        // Check stock availability
        if (wholesaleProduct.stock < quantity) {
            return res.status(400).json({
                success: false,
                message: 'Not enough stock available'
            });
        }

        // Check if user already has a cart
        let cart = await carts.findOne({ userId });
        const updatedCart = cart || {
            userId,
            products: [],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Check if product is already in the cart
        const existingIndex = updatedCart.products.findIndex(p => p.productId === productId);

        if (existingIndex !== -1) {
            // Update quantity if already in cart
            const newQuantity = updatedCart.products[existingIndex].quantity + quantity;

            if (newQuantity > wholesaleProduct.stock) {
                return res.status(400).json({
                    success: false,
                    message: 'Quantity exceeds stock limit'
                });
            }

            updatedCart.products[existingIndex].quantity = newQuantity;
        } else {
            // Add new wholesale product to cart
            const cartProduct = {
                productId,
                name: wholesaleProduct.name,
                price: wholesaleProduct.price,
                image: wholesaleProduct.image || "",
                quantity,
                stock: wholesaleProduct.stock
            };
            updatedCart.products.push(cartProduct);
        }

        // Update or insert the cart
        await carts.updateOne(
            { userId },
            { $set: { products: updatedCart.products, updatedAt: new Date() } },
            { upsert: true }
        );

        res.json({
            success: true,
            message: 'Wholesale product added to cart successfully',
            data: updatedCart
        });

    } catch (error) {
        console.error('Error adding wholesale product to cart:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});
app.post('/api/cart/addreorder', async (req, res) => {
    const { userId, products } = req.body;

    if (!userId || !products || !Array.isArray(products)) {
        return res.status(400).json({ success: false, message: 'Invalid request data.' });
    }

    try {
        const client = await connectDB();
        const db = client.db("techmart");
        const carts = db.collection("carts");

        // Find the existing cart for the user
        const existingCart = await carts.findOne({ userId });

        if (existingCart) {
            // If cart exists, update the products array
            for (const product of products) {
                const existingProduct = existingCart.products.find(p => p._id.toString() === product._id.toString());

                if (existingProduct) {
                    // If the product already exists, increase the quantity
                    existingProduct.quantity += product.quantity;
                } else {
                    // If the product does not exist, add it to the products array
                    existingCart.products.push({
                        _id: product._id,
                        name: product.name,
                        price: product.price,
                        quantity: product.quantity
                    });
                }
            }

            // Update the cart with the new products
            await carts.updateOne(
                { userId },
                { $set: { products: existingCart.products, updatedAt: new Date() } }
            );
        } else {
            // If the cart does not exist, create a new cart
            await carts.insertOne({
                userId,
                products: products.map(product => ({
                    _id: product._id,
                    name: product.name,
                    price: product.price,
                    quantity: product.quantity
                })),
                total: products.reduce((sum, product) => sum + product.price * product.quantity, 0),
                addedAt: new Date(),
                updatedAt: new Date()
            });
        }

        res.json({ success: true, message: "Products added to cart." });
    } catch (err) {
        console.error('Error adding to cart:', err);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});


// 添加到购物车
app.post('/api/cart/:userId/add', async (req, res) => {
  try {
      const { userId } = req.params;
      const { productId, quantity } = req.body;

      // 输入验证
      if (!userId || !productId || !quantity) {
          return res.status(400).json({
              success: false,
              message: 'Missing required fields: userId, productId, or quantity'
          });
      }

      if (quantity <= 0) {
          return res.status(400).json({
              success: false,
              message: 'Quantity must be greater than 0'
          });
      }

      const client = await connectDB();
      const database = client.db("techmart");
      const carts = database.collection("carts");
      const products = database.collection("products");

      // 获取产品信息
      const product = await products.findOne({ _id: new ObjectId(productId) });
      if (!product) {
          return res.status(404).json({
              success: false,
              message: 'Product not found'
          });
      }

      // 检查库存
      if (product.stock < quantity) {
          return res.status(400).json({
              success: false,
              message: 'Not enough stock available'
          });
      }

      // Find cart for the user
      let cart = await carts.findOne({ userId });
      const updatedCart = cart || { userId, products: [], createdAt: new Date(), updatedAt: new Date() };

      // Check if the product is already in the cart
      const existingProductIndex = updatedCart.products.findIndex(p => p.productId === productId);
      if (existingProductIndex !== -1) {
          // Update quantity
          const newQuantity = updatedCart.products[existingProductIndex].quantity + quantity;
          if (newQuantity > product.stock) {
              return res.status(400).json({
                  success: false,
                  message: 'Quantity exceeds stock limit'
              });
          }
          updatedCart.products[existingProductIndex].quantity = newQuantity;
      } else {
          // 添加新产品
          const cartProduct = {
              productId,
              name: product.name,
              price: product.price,
              image: product.image,
              quantity,
              stock: product.stock
          };
          updatedCart.products.push(cartProduct);
      }

      await carts.updateOne(
          { userId },
          { $set: { products: updatedCart.products, updatedAt: new Date() } },
          { upsert: true }
      );

      res.json({
          success: true,
          message: 'Product added to cart successfully',
          data: updatedCart
      });

  } catch (error) {
      console.error('Error adding to cart:', error);
      res.status(500).json({
          success: false,
          message: 'Error adding to cart',
          error: error.message
      });
  }
});


// 从购物车中移除商品
app.delete('/api/cart/remove', async (req, res) => {
    const { userId, productId } = req.body;

    if (!userId || !productId) {
        return res.status(400).json({ success: false, message: 'Invalid data' });
    }

    try {
        const client = await connectDB();
        const db = client.db("techmart");
        const carts = db.collection("carts");

        const result = await carts.updateOne(
            { userId },
            { $pull: { products: { _id: productId } } }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        res.json({ success: true, message: 'Product removed successfully' });

    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Submit checkout
app.post('/api/checkout/submit', asyncHandler(async (req, res) => {
    const client = await connectDB();
    const orders = client.db("techmart").collection("orders");
    const result = await orders.insertOne(req.body);
    res.json({ message: 'Order submitted successfully', orderId: result.insertedId });
}));

// Update profile
app.post('/api/profile/update', async (req, res) => {
    try {
        const { userId, updateData } = req.body;
        console.log('Updating profile for user:', userId);
        console.log('Update data:', updateData);

        const client = await connectDB();
        const database = client.db("techmart");
        const users = database.collection("users");

        // 如果包含密码，需要加密
        if (updateData.password && updateData.password.trim() !== '') {
          const salt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash(updateData.password, salt);
          updateData.password = hashedPassword;
      } else {
          // 如果密码为空，删除密码字段
          delete updateData.password;
      }

        // 确保 userId 是有效的 ObjectId
        const userObjectId = new ObjectId(userId);

        // 更新用户数据
        const result = await users.findOneAndUpdate(
            { _id: userObjectId },
            { 
              $set: {
                  ...updateData,
                  updatedAt: new Date()
              }
          },
          { returnDocument: 'after' } // 返回更新后的文档
        );

        if (!result.value) {
          console.log('User not found:', userId);
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

         // 返回更新后的用户数据（不包含密码）
         const updatedUser = result.value;
         delete updatedUser.password;
 
         console.log('Profile updated successfully:', updatedUser);

         
        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: updatedUser
        });

    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error updating profile: ' + error.message
        });
    }
});

// Change password
app.post('/api/profile/changePassword', asyncHandler(async (req, res) => {
    const client = await connectDB();
    const users = client.db("techmart").collection("users");
    const { userId, newPassword } = req.body;
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await users.updateOne({ _id: new ObjectId(userId) }, { $set: { password: hashedPassword } });
    res.json({ message: 'Password changed successfully' });
}));


app.post('/api/users', async (req, res) => {
    try {
        const {name, email } = req.body;

        if (!name || !email) {
            return res.status(400).json({
                success: false,
                message: 'Missing required user information'
            });
        }

        const client = await connectDB();
        const database = client.db("techmart");

        // Collections
        const users = database.collection("users");
        const profiles = database.collection("profiles");
        const carts = database.collection("carts");

        // Generate userId - This can be a unique identifier (using MongoDB's ObjectId or custom ID generation)
        const userId = new ObjectId().toString(); // If using MongoDB ObjectId

        // Check if user already exists
        const existingUser = await users.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists'
            });
        }

        // Create user
        const newUser = {name, email, createdAt: new Date() };
        await users.insertOne(newUser);

        res.status(201).json({
          success: true,
          data: { user: result.ops[0] },
      });

      // Create cart for the user
      const newCart = {
        userId: userId,
        products: [],
        createdAt: new Date()
    };
    await carts.insertOne(newCart);

    // Create profile for the user
    const newProfile = {
        userId: userId,
        name,
        email,
        createdAt: new Date(),
        avatar: ''
    };
    await profiles.insertOne(newProfile);

    res.status(201).json({
            success: true,
            message: 'User, cart, and profile created successfully',
            data: {
                user: newUser,
                cart: newCart,
                profile: newProfile
            }
        });
        
  } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({
          success: false,
          message: 'Error creating user',
          error: error.message,
      });
  }
});

// 添加卖家注册路由
app.post('/api/sellers/register', async (req, res) => {
    try {
        const client = await connectDB();
        const database = client.db("techmart");
        const sellers = database.collection("sellers");
        
        const { name, email, password } = req.body;

        // 验证必填字段
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // 检查邮箱是否已存在
        const existingSeller = await sellers.findOne({ email });
        if (existingSeller) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            });
        }

        // 加密密码
        const hashedPassword = await bcrypt.hash(password, 10);

        // 创建新卖家
        const newSeller = {
            name,
            email,
            password: hashedPassword,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // 保存到数据库
        await sellers.insertOne(newSeller);
        
        // 返回成功消息（不包含密码）
        const sellerWithoutPassword = { ...newSeller };
        delete sellerWithoutPassword.password;
        
        res.status(201).json({
            success: true,
            message: 'Seller registered successfully',
            seller: sellerWithoutPassword
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Error registering seller'
        });
    }
});

// Use express-session middleware
app.use(session({
    secret: 'b896fc7c8b4e3b764cf45744bd24e02a99a03cd1b784209c1fc282e19a9b1b10',  // Replace with a strong secret key
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set secure: true for HTTPS
}));

// 添加卖家登录路由
app.post('/api/sellers/login', asyncHandler(async (req, res) => {
  const client = await connectDB();
  const database = client.db("techmart");
  const sellers = database.collection("sellers");
  
  const { email, password } = req.body;

  // 查找卖家
  const seller = await sellers.findOne({ email });
  if (!seller) {
    throw new APIError(401, 'Invalid email or password');
  }

  // 验证密码
  const isValidPassword = await bcrypt.compare(password, seller.password);
  if (!isValidPassword) {
    throw new APIError(401, 'Invalid email or password');
  }

  // 不要在响应中包含密码
  const sellerWithoutPassword = { ...seller };
  delete sellerWithoutPassword.password;

// Save seller's ID in the session
req.session.sellerId = seller._id;

  res.json({
    success: true,
    message: 'Login successful'
  });
}));


// API endpoint to fetch dashboard data for the logged-in seller
app.get('/api/sellers/dashboard', async (req, res) => {
    try {
        const sellerObjectId = req.sellerId; 
        // Fetch the dashboard data from the database directly
        const client = await connectDB();
        const database = client.db("techmart");

        const ordersCollection = database.collection('orders');
        const productsCollection = database.collection('products');

        // Fetch required data for the dashboard
         const [totalSalesResult, totalOrders, totalProducts, distinctCustomers, recentOrders] = await Promise.all([
            ordersCollection.aggregate([
                { $match: { sellerId: sellerObjectId } },
                { $group: { _id: null, totalSales: { $sum: "$total" } } }
            ]).toArray(),
            ordersCollection.countDocuments({ sellerId: sellerObjectId }),
            productsCollection.countDocuments({ sellerId: sellerObjectId }),
            ordersCollection.distinct('customerName', { sellerId: sellerObjectId }),
            ordersCollection.find({ sellerId: sellerObjectId })
                .sort({ createdAt: -1 })
                .limit(5)
                .toArray()
        ]);

        // Send the dashboard data as a response
        res.json({
            totalSales: totalSalesResult[0]?.totalSales || 0,
            totalOrders,
            totalProducts,
            totalCustomers: distinctCustomers.length,
            recentOrders
        });
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({ message: 'Failed to load dashboard data', error: error.message });
    }
});




// Update product endpoint
app.put('/api/products/:id', async (req, res) => {
    try {
        const productId = req.params.id;
        const updateData = req.body;
        
        console.log('Updating product:', productId); // Debug log
        console.log('Update data:', updateData); // Debug log

        const client = await connectDB();
        const database = client.db("techmart");
        const products = database.collection("products");

        // Make sure we have a valid ObjectId
        if (!ObjectId.isValid(productId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid product ID format'
            });
        }

        // Convert string ID to ObjectId
        const objectId = new ObjectId(productId);

        // First check if the product exists
        const existingProduct = await products.findOne({ _id: objectId });
        if (!existingProduct) {
            console.log('Product not found:', productId); // Debug log
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        const result = await products.findOneAndUpdate(
            { _id: objectId },
            { $set: {
                ...updateData,
                updatedAt: new Date()
            }},
            { returnDocument: 'after' }
        );

        console.log('Update result:', result); // Debug log

        if (!result.value) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        res.json({
            success: true,
            data: result.value,
            message: 'Product updated successfully'
        });

    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating product',
            error: error.message
        });
    }
});



// DELETE a product by ID
app.delete('/api/products/:id', async (req, res) => {
    try {
        const productId = req.params.id;
        const client = await connectDB();
        const database = client.db("techmart");
        const products = database.collection("products");

        const result = await products.deleteOne({
            _id: new ObjectId(productId)
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        res.json({
            success: true,
            message: 'Product deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete product',
            error: error.message
        });
    }
});

// Notify users when a new product is added
app.post('/api/products', async (req, res) => {
    try {
        const client = await connectDB();
        const database = client.db("techmart");
        const products = database.collection("products");

        const newProduct = {
            ...req.body,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await products.insertOne(newProduct);
        
        if (!result.insertedId) {
            throw new Error('Failed to insert product');
        }

        // Notify all connected WebSocket clients about the new product
        const productData = {
            _id: result.insertedId,
            ...newProduct
        };
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: 'NEW_PRODUCT',
                    data: productData
                }));
            }
        });

        res.status(201).json({
            success: true,
            data: productData
        });

    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add product',
            error: error.message
        });
    }
});

// Get all orders for seller
app.get('/api/orders', asyncHandler(async (req, res) => {
    try {
        const client = await connectDB(); // Connect to MongoDB
        const ordersCollection = client.db("techmart").collection("orders");
        const allOrders = await ordersCollection.find().toArray(); // Fetch all orders
        res.json(allOrders); // Send orders as JSON
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ message: 'Error fetching orders' });
    }
}));

// Define routes
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const client = await connectDB();
        const users = client.db("techmart").collection("users");
        const user = await users.findOne({ email });

        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        return res.status(200).json({ token: 'dummy-token' });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post('/orders', async (req, res) => {
    try {
        const client = await connectDB();
        const orders = client.db("techmart").collection("orders");
        const result = await orders.insertOne(req.body);
        res.status(201).json(result.ops[0]);
    } catch (error) {
        console.error('Order creation error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// GET all wholesale products
// 修改获取所有批发产品的路由
app.get('/api/wholesales', async (req, res) => {
    try {
        console.log('Fetching wholesale products...');
        const client = await connectDB();
        const database = client.db("techmart"); // 连接到数据库
        const wholesalesCollection = database.collection("wholesales"); // 连接到 wholesales 集合

        // 获取所有批发产品
        const allWholesales = await wholesalesCollection.find({}).toArray();
        console.log(`Found ${allWholesales.length} wholesale products`);

            // 重新获取产品列表
            const updatedWholesales = await wholesalesCollection.find({}).toArray();
            return res.json({
                success: true,
                data: updatedWholesales
            });
        

        // 返回找到的批发产品
        return res.json({
            success: true,
            data: allWholesales
        });

    } catch (error) {
        console.error('Error in /api/wholesales:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching wholesale products',
            error: error.message
        });
    }
});

const wholesaleProductSchema = new mongoose.Schema({
    name: String,
    description: String,
    price: Number,
    minOrder: Number,
    stock: Number,
    category: String,
    type: String,
    image: String // Store as Base64 or a file URL
});

// 🔹 POST a New Wholesale Product
app.post('/api/wholesales', async (req, res) => {
    try {
        const client = await connectDB();
        const database = client.db("techmart");
        const wholesales = database.collection("wholesales");

        const newWholesaleProduct = {
            ...req.body,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await wholesales.insertOne(newWholesaleProduct);

        if (!result.insertedId) {
            throw new Error('Failed to insert wholesale product');
        }

        res.status(201).json({
            success: true,
            data: { _id: result.insertedId, ...newWholesaleProduct }
        });

    } catch (error) {
        console.error('Error adding wholesale product:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add wholesale product',
            error: error.message
        });
    }
});




app.post('/add-wholesale-product', async (req, res) => {
    try {
        const { name, description, price, minOrder, stock, category, type, image } = req.body;

        // Create a new wholesale product
        const newProduct = new WholesaleProduct({
            name,
            description,
            price,
            minOrder,
            stock,
            category,
            type,
            image
        });

        await newProduct.save();
        res.status(201).json({ message: 'Wholesale product added successfully!' });
    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).json({ message: 'Failed to add product', error });
    }
});




// 产品搜索 API 端点
app.get('/api/products/search', async (req, res) => {
    try {
      // 从查询中获取关键词数组
      const keywords = req.query['keywords[]'];
      
      // 确保关键词是数组形式
      const keywordArray = Array.isArray(keywords) ? keywords : [keywords];
      
      if (!keywordArray || keywordArray.length === 0) {
        return res.status(400).json({ success: false, message: '未提供搜索关键词' });
      }
      
      console.log('搜索关键词:', keywordArray);
      
      // 从数据库中搜索产品
      const products = await Product.find({
        $or: [
          // 在产品名称中搜索关键词
          { name: { $regex: new RegExp(keywordArray.join('|'), 'i') } },
          // 在产品类别中搜索关键词
          { category: { $regex: new RegExp(keywordArray.join('|'), 'i') } },
          // 在产品标签中搜索关键词
          { tags: { $in: keywordArray.map(kw => new RegExp(kw, 'i')) } }
        ]
      }).limit(10);
      
      // 为每个产品计算相似度分数
      const productsWithSimilarity = products.map(product => {
        const productObj = product.toObject();
        
        // 计算相似度（这是一个简单的实现，可以根据需要调整）
        let similarity = 0;
        const productName = productObj.name.toLowerCase();
        const productCategory = (productObj.category || '').toLowerCase();
        const productTags = (productObj.tags || []).map(tag => tag.toLowerCase());
        
        keywordArray.forEach(keyword => {
          const lowerKeyword = keyword.toLowerCase();
          
          // 检查名称中的关键词匹配
          if (productName.includes(lowerKeyword)) {
            similarity += 0.6;
          }
          
          // 检查类别中的关键词匹配
          if (productCategory.includes(lowerKeyword)) {
            similarity += 0.3;
          }
          
          // 检查标签中的关键词匹配
          if (productTags.some(tag => tag.includes(lowerKeyword))) {
            similarity += 0.1;
          }
        });
        
        // 将相似度标准化到0-1范围
        similarity = Math.min(1, similarity);
        
        return {
          ...productObj,
          similarity
        };
      });
      
      // 根据相似度对产品进行排序
      productsWithSimilarity.sort((a, b) => b.similarity - a.similarity);
      
      return res.json({
        success: true,
        products: productsWithSimilarity
      });
    } catch (error) {
      console.error('产品搜索错误:', error);
      return res.status(500).json({ success: false, message: '服务器错误' });
    }
  });
  app.post('/api/search', async (req, res) => {
    try {
      const client = await connectDB(); // Your MongoDB connection
      const db = client.db("techmart");
      const products = db.collection("products");
  
      const { predictedLabel } = req.body;
      console.log("🔍 Predicted label:", predictedLabel);
  
      // Search for products with similar name or description
      const matchingProducts = await products.find({
        $or: [
          { name: { $regex: predictedLabel, $options: 'i' } },
          { description: { $regex: predictedLabel, $options: 'i' } },
          { category: { $regex: predictedLabel, $options: 'i' } }
        ]
      }).toArray();
  
      if (matchingProducts.length === 0) {
        return res.status(404).json({ success: false, message: "No matching product found." });
      }
  
      // Optionally: get the first product or apply sorting
      const topProduct = matchingProducts[0];
  
      res.json({
        success: true,
        product: {
          name: topProduct.name,
          price: topProduct.price,
          image: topProduct.image,
          description: topProduct.description
        }
      });
    } catch (error) {
      console.error("❌ Error in /api/search:", error);
      res.status(500).json({ success: false, message: "Internal Server Error" });
    }
  });

app.post("/api/searchByLabel", async (req, res) => {
    const label = req.body.label;
    if (!label) return res.status(400).json({ success: false, message: "Label is required." });
  
    try {
      const client = await connectDB();
      const db = client.db(dbName);
      const products = db.collection("products");
  
      const product = await products.findOne({ name: { $regex: label, $options: "i" } });
  
      if (product) {
        res.json({ success: true, data: product });
      } else {
        res.json({ success: false, message: "No matching product found." });
      }
  
      await client.close();
    } catch (err) {
      console.error("Search error:", err);
      res.status(500).json({ success: false, message: "Server error", error: err.message });
    }
  });
  

app.get('/api/recommendations', async (req, res) => {
    try {
        const client = await connectDB();
        const database = client.db("techmart"); // Ensure correct DB name
        const products = database.collection("products"); // Ensure collection name is correct

        console.log("Connected to database successfully");

        // Check if the collection contains products
        const productCount = await products.countDocuments();
        console.log("Total products in collection:", productCount);

        if (productCount === 0) {
            return res.status(404).json({ error: "No products found in the database" });
        }

        // Fetch 5 random products using MongoDB's $sample
        const recommendedProducts = await products.aggregate([{ $sample: { size: 5 } }]).toArray();
        

        res.json({ success: true, data: recommendedProducts });

    } catch (error) {
        console.error("Error fetching recommendations:", error);
        res.status(500).json({ error: "Error fetching recommendations", details: error.message });
    }
});

app.get('/wholesaleProducts', async (req, res) => {
    try {
        const products = await WholesaleProduct.find(); // Fetch all products
        res.status(200).json(products);
    } catch (error) {
        console.error('Error fetching wholesale products:', error);
        res.status(500).json({ message: 'Failed to fetch wholesale products' });
    }
});

// Get a single wholesale product by ID
app.get('/api/wholesales/:id', async (req, res) => {
    const productId = req.params.id;

    try {
        const client = await connectDB();  // Ensure connection
        const database = client.db("techmart");
        const wholesalesCollection = database.collection("wholesales");

        if (!ObjectId.isValid(productId)) {
            return res.status(400).json({ success: false, message: 'Invalid product ID' });
        }

        const product = await wholesalesCollection.findOne({ _id: new ObjectId(productId) });

        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        res.json({ success: true, product });
    } catch (error) {
        console.error('Error fetching product:', error.message);
        res.status(500).json({ success: false, message: `Server error: ${error.message}` });
    }
});

// PUT request to update a wholesale product
app.put('/api/wholesales/:id', async (req, res) => {
    const productId = req.params.id;
    const updatedData = req.body;

    try {
        const client = await connectDB();
        const database = client.db("techmart");
        const wholesalesCollection = database.collection("wholesales");

        if (!ObjectId.isValid(productId)) {
            return res.status(400).json({ success: false, message: 'Invalid product ID' });
        }

        const result = await wholesalesCollection.updateOne(
            { _id: new ObjectId(productId) },
            { $set: updatedData }
        );

        if (result.modifiedCount === 0) {
            return res.status(400).json({ success: false, message: 'Product not found or no changes made' });
        }

        res.json({ success: true, message: 'Product updated successfully' });
    } catch (error) {
        console.error('Error updating product:', error.message);
        res.status(500).json({ success: false, message: `Server error: ${error.message}` });
    }
});



// Delete a wholesale product by ID
// Example route for deleting a wholesale product
app.delete('/api/wholesales/:id', async (req, res) => {
    const productId = req.params.id;

    try {
        // Connect to the database
        const client = await connectDB();
        const database = client.db("techmart");  // Access the 'techmart' database
        const wholesalesCollection = database.collection("wholesales"); // Access the 'wholesales' collection

        // Ensure that the productId is a valid ObjectId before attempting to delete
        const result = await wholesalesCollection.deleteOne({ _id: new ObjectId(productId) });

        if (result.deletedCount === 1) {
            res.json({ success: true, message: 'Product deleted successfully' });
        } else {
            res.json({ success: false, message: 'Product not found' });
        }
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Example: GET /api/wholesalesfilter?category=Kitchen
// GET /api/wholesalesfilter
app.get('/api/wholesalesfilter', async (req, res) => {
    const { category } = req.query;
  
    try {
      // Access the database and collection
      const database = client.db("techmart");
      const wholesalesCollection = database.collection("wholesales");
  
      // If category is not specified, return all products
      if (!category || category === 'All Categories') {
        const products = await wholesalesCollection.find().toArray();
        return res.json({ success: true, data: products });
      }
  
      // Otherwise, return products filtered by category
      const products = await wholesalesCollection.find({ category }).toArray();
      res.json({ success: true, data: products });
    } catch (err) {
      console.error('Error fetching products:', err);
      res.status(500).json({ success: false, message: "Server error while fetching products" });
    }
  });
  
  // GET all products or filter by category
  app.get('/api/productsfilter', async (req, res) => {
  const { category } = req.query;

  try {
    const database = client.db("techmart");
    const productsCollection = database.collection("products");

    if (!category || category === 'All Categories' || category === 'All Products') {
      const products = await productsCollection.find().toArray();
      return res.json({ success: true, data: products });
    }

    const products = await productsCollection.find({ category }).toArray();
    res.json({ success: true, data: products });

  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({
      success: false,
      message: "Server error while fetching products",
      error: err.message
    });
  }
});  

// API: Get Hawker Products
app.get('/api/hawker/products', async (req, res) => {
    try {
        const client = await connectDB();
        const database = client.db("techmart");
        const productsCollection = database.collection("products");
      
        console.log("🧐 Fetching products...");
      const hawkerProducts = await productsCollection.find({ category: 'Hawker' }).toArray();
      console.log("Fetched Hawker Products:", hawkerProducts); // Log fetched products
  
      if (hawkerProducts.length === 0) {
        console.log("No products found with category 'Hawker'.");
      }
  
      res.json(hawkerProducts); // Send products array as JSON
    } catch (err) {
      console.error("❌ Error fetching hawker products:", err);
      res.status(500).json({ error: "Failed to fetch hawker products" });
    }
  });
  
  // ✅ API: Get Hawker Wholesales
  app.get('/api/hawker/wholesales', async (req, res) => {
    try {
        const client = await connectDB();
        const database = client.db("techmart");
        const wholesalesCollection = database.collection("wholesales");console.log("🧐 Fetching wholesales...");
      const hawkerWholesales = await wholesalesCollection.find({ category: 'Hawker' }).toArray();
      console.log("Fetched Hawker Wholesales:", hawkerWholesales); // Log fetched wholesales
  
      if (hawkerWholesales.length === 0) {
        console.log("No wholesales found with category 'Hawker'.");
      }
  
      res.json(hawkerWholesales); // Send wholesales array as JSON
    } catch (err) {
      console.error("❌ Error fetching hawker wholesales:", err);
      res.status(500).json({ error: "Failed to fetch hawker wholesales" });
    }
  });
  
  app.get('/api/wholesales/:id', async (req, res) => {
  const id = req.params.id;
  const wholesale = await db.collection('wholesales').findOne({ _id: new ObjectId(id) });
  if (!wholesale) return res.status(404).json({ success: false, message: 'Product not found' });
  res.json({ success: true, data: wholesale });
});

app.post('/get-similar-product', async (req, res) => {
    const { predictedName } = req.body;
    
    try {
      const product = await Product.findOne({ name: predictedName });
      if (!product) return res.status(404).json({ message: 'Product not found' });
      
      res.json(product); // includes _id, stock, name, price, etc.
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  });  

// Export the app for testing
module.exports = app;

// ---------- Error Handling ----------
app.use((err, req, res, next) => {
    console.error(err.message);
});
