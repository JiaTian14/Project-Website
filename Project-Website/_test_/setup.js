const { MongoClient } = require('mongodb');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let connection;
let db;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  connection = await MongoClient.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  
  db = connection.db();
  // Make the db instance available globally for tests
  global.__MONGO_DB__ = db;
  global.__MONGO_CONNECTION__ = connection;
  // Set environment variable for your application to use test database
  process.env.MONGODB_URI = mongoUri;
});

afterAll(async () => {
  await connection.close();
  await mongoServer.stop();
});