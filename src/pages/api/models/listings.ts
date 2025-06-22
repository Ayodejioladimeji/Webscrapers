// models/Listing.ts
import mongoose from 'mongoose';

// Define the Mongoose Schema for a Listing
const ListingSchema = new mongoose.Schema({
    // Basic fields from the main listing page
    title: { type: String, required: true },
    image: { type: String, default: null }, 
    price: { type: Number, default: null },
    pricePeriod: { type: String, default: null },
    location: { type: String, default: null },
    listingUrl: { type: String, required: true, unique: true }, // Crucial for identifying unique listings

    // Basic property characteristics (from list page)
    bedrooms: { type: Number, default: null },
    toilets: { type: Number, default: null },
    bathrooms: { type: Number, default: null },

    // Detailed fields from the listing's detail page
    description: { type: String, default: null },
    Images: { type: [String], default: null }, // Array of strings for image URLs
    agentName: { type: String, default: null },
    agentPhones: { type: [String], default: null }, // Array of strings for phone numbers
    agentAddress: { type: String, default: null },

}, {
    timestamps: true, // Automatically adds createdAt and updatedAt fields
});

// Export the Listing model
// This checks if the model already exists to prevent Mongoose from re-registering it
export const Listing = mongoose.models.Listing || mongoose.model('Listing', ListingSchema);