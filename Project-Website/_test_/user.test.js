const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const bcrypt = require('bcryptjs'); // Use bcryptjs as per your dependencies

beforeAll(async () => {
    const db = global.__MONGO_DB__;
    await db.collection('users').insertOne({
        email: 'ii@gmail.com',
        password: await bcrypt.hash('1234', 10), // Ensure password is hashed
        username: 'Test User',
        createdAt: new Date(),
        updatedAt: new Date()
    });
});

afterAll(async () => {
    await mongoose.connection.close();
});

describe('User API Integration Tests', () => {
    describe('POST /api/users/login', () => {
        it('should return 200 for valid credentials', async () => {
            const response = await request(app).post('/api/users/login').send({
                email: 'ii@gmail.com',
                password: '1234',
            });

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Login successful');
        });

        it('should return 401 for invalid credentials', async () => {
            const response = await request(app).post('/api/users/login').send({
                email: 'wrong@example.com',
                password: 'wrongPassword',
            });

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Invalid email or password');
        });
    });
});
