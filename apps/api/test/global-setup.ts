import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod: MongoMemoryServer | undefined;

/** Un solo mongod en memoria para todas las pruebas; cada archivo usa su propia base. */
export async function setup() {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_TEST_URI = mongod.getUri();
}

export async function teardown() {
  await mongod?.stop();
}
