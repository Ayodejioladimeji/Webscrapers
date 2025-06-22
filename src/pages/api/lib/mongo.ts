// lib/mongo.ts
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI as string;

if (!MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

// Global cached connection object
let cached = (global as any).mongoose;

if (!cached) {
    cached = (global as any).mongoose = { conn: null, promise: null };
}

export async function connectDB(): Promise<typeof mongoose> {
    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
        cached.promise = mongoose.connect(MONGODB_URI, {
            bufferCommands: false, // Recommended for serverless environments
        }).catch((err) => {
            // Catch connection errors early and re-throw
            console.error("MongoDB connection error:", err);
            cached.promise = null; // Clear promise so next attempt retries connection
            throw err;
        });
    }

    cached.conn = await cached.promise;
    return cached.conn;
}