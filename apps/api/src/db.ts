import mongoose from 'mongoose';

mongoose.set('strictQuery', true);

/** Conecta a MongoDB con un pool pequeño (el cluster M0 de Atlas limita conexiones). */
export async function conectarDB(uri: string, dbName?: string) {
  await mongoose.connect(uri, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 15_000,
    ...(dbName ? { dbName } : {}),
  });
  return mongoose.connection;
}

export async function desconectarDB() {
  await mongoose.disconnect();
}
