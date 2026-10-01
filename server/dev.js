// Local API server. With no MONGODB_URI it starts a throwaway in-memory
// MongoDB, so `npm run dev` works without installing Mongo.
import 'dotenv/config';

if (!process.env.MONGODB_URI) {
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('depot-wms');
  console.log('Using in-memory MongoDB (data resets on restart)');
}

const { default: app } = await import('./app.js');
const port = process.env.API_PORT || 5001;
app.listen(port, () => console.log(`API on http://localhost:${port}`));
