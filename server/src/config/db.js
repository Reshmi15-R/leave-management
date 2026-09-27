import mongoose from 'mongoose';

export default async function connectDB(retries = 5) {
  mongoose.set('strictQuery', true);
  for (let attempt = 1; ; attempt++) {
    try {
      await mongoose.connect(process.env.MONGO_URI, {
        dbName: process.env.DB_NAME || 'leave-management',
        serverSelectionTimeoutMS: 15000,
      });
      console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
      return;
    } catch (err) {
      if (attempt >= retries) throw err;
      console.warn(`MongoDB connection attempt ${attempt} failed (${err.message}); retrying in 3s…`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}
