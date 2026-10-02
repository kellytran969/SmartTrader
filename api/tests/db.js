const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

let mongod;

async function connectTestDb() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}

async function closeTestDb() {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
}

async function clearDb() {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
}

module.exports = { connectTestDb, closeTestDb, clearDb };
