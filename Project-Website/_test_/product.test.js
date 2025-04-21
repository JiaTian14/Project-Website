const request = require('supertest');
const app = require('../server');

describe('Product API Integration Tests', () => {
    let db;
    let productsCollection;

    beforeAll(async () => {
        // Use the global database instance set up in your test setup file
        
        db = global.__MONGO_DB__;
        productsCollection = db.collection('products');

        // Clear the collection before running tests
        await productsCollection.deleteMany({});
        
        // Insert a known set of test data
        const testProducts = Array.from({ length: 25 }, (_, i) => ({
            name: `Test Product ${i + 1}`,
            category: 'Test Category',
            price: 100,
            stock: 10,
            description: `This is test product ${i + 1}`,
            image: 'https://via.placeholder.com/300x250'
        }));
        
        await productsCollection.insertMany(testProducts);
    });
    
    afterAll(async () => {
        // Clean up the products collection after tests
        await productsCollection.deleteMany({});
    });

    it('should create a new product', async () => {
        const product = {
            name: 'Test Product',
            category: 'Test Category',
            price: 100,
            stock: 10,
            description: 'This is a test product',
            image: 'https://via.placeholder.com/300x250'
        };

        const response = await request(app)
            .post('/api/products')
            .send(product);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe(product.name);
    });

    it('should retrieve all products', async () => {
        const response = await request(app)
            .get('/api/products');

        expect(response.status).toBe(200);
        expect(response.body.data.length).toBe(7);
    });
});
