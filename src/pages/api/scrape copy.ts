import type { NextApiRequest, NextApiResponse } from 'next';
import { scrapeListingsFromURL } from './lib/scrape'; // Assuming lib/scrape.ts path
import { connectDB } from './lib/mongo'; // Correct path to your DB connection
import { Listing } from './models/listings'; // Import the Listing model and interface

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const { url, startPage, endPage } = req.body;

        // Basic input validation
        if (!url) {
            return res.status(400).json({ error: 'URL is required.' });
        }

        // Enforce the URL if this API is only for a specific site
        if (url !== 'https://nigeriapropertycentre.com/for-rent') {
            return res.status(400).json({ error: 'This scraper is currently configured only for https://nigeriapropertycentre.com/for-rent.' });
        }

        try {
            // 1. Connect to MongoDB
            await connectDB();
            console.log('Successfully connected to MongoDB.');

            // 2. Scrape the listings
            const scrapedListings = await scrapeListingsFromURL(url, startPage, endPage);

            if (scrapedListings.length === 0) {
                return res.status(200).json({ listings: [], message: 'No new listings found or scraped.' });
            }

            // 3. Save each listing to the database using upsert
            const saveResults = await Promise.allSettled(
                scrapedListings.map(async (listingData) => {
                    // Use findOneAndUpdate with upsert: true to either update if listingUrl exists
                    // or insert a new document if it doesn't.
                    return Listing.findOneAndUpdate(
                        { listingUrl: listingData.listingUrl }, // Query: Find by the unique listing URL
                        { $set: listingData }, // Update: Set all fields from the scraped data
                        { upsert: true, new: true, setDefaultsOnInsert: true } // Options:
                    );
                })
            );

            // Tally successful and failed saves
            const successfulSaves = saveResults.filter(result => result.status === 'fulfilled').length;
            const failedSaves = saveResults.filter(result => result.status === 'rejected');

            if (failedSaves.length > 0) {
                console.warn(`Encountered ${failedSaves.length} errors while saving listings:`);
                failedSaves.forEach((fail: any) => console.error('  - Reason:', fail.reason));
            }

            // 4. Respond with results
            res.status(200).json({
                message: 'Scraping and saving process completed.',
                totalListingsScraped: scrapedListings.length,
                successfullySavedOrUpdated: successfulSaves,
                failedToSave: failedSaves.length,
                
            });

        } catch (error: any) {
            console.error('API Error: Scraping or database operation failed:', error);
            res.status(500).json({ error: 'Failed to scrape and save listings.', details: error.message });
        }
    } else {
        // Handle non-POST requests
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}