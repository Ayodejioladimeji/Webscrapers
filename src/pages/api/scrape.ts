import type { NextApiRequest, NextApiResponse } from 'next';
import { scrapeListingsFromURL } from './lib/scrape';
import { connectDB } from './lib/mongo';
// Removed 'Listing' import as it's no longer used directly in this file for saving

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const { url, startPage, endPage } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL is required.' });
        }

        if (url !== 'https://nigeriapropertycentre.com/for-rent') {
            return res.status(400).json({ error: 'This scraper is currently configured only for https://nigeriapropertycentre.com/for-rent.' });
        }

        try {
            await connectDB();
            console.log('Successfully connected to MongoDB.');

            // Call the scraping function. It now handles individual saving to the DB.
            // It no longer returns a list of scraped listings.
            await scrapeListingsFromURL(url, startPage, endPage);

            // The saving is now handled inside scrapeListingsFromURL.
            // This API endpoint simply initiates the process and confirms.
            res.status(200).json({
                message: 'Scraping and individual saving process initiated. Check server logs for status.',
                status: 'processing',
            });

        } catch (error: any) {
            console.error('API Error: Scraping or database operation failed:', error);
            res.status(500).json({ error: 'Failed to initiate scraping and saving process.', details: error.message });
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}