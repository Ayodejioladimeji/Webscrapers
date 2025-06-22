import puppeteer, { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';
import { setTimeout } from 'node:timers/promises';

import { uploadImageToCloudinary, bulkUploadImagesToCloudinary } from './cloudinary';
import { Listing } from '../models/listings'; // IMPORT THE LISTING MODEL HERE

export interface ScrapedListing {
    title: string | null;
    image: string | null;
    price: number | null;
    pricePeriod: string | null;
    location: string | null;
    listingUrl: string | null;
    bedrooms: number | null;
    toilets: number | null;
    bathrooms: number | null;
    description: string | null;
    Images: string[] | null | undefined;
    agentName: string | null;
    agentPhones: string[] | null;
    agentAddress: string | null;
}

function parsePrice(priceString: string): number | null {
    if (!priceString) return null;
    const cleaned = priceString.replace(/[₦$,]/g, '').trim();
    const match = cleaned.match(/(\d[\d,]*\.?\d*)/);
    if (match && match[1]) {
        const parsed = parseFloat(match[1].replace(/,/g, ''));
        return isNaN(parsed) ? null : parsed;
    }
    return null;
}

async function safeGoto(page: Page, url: string, retries = 3): Promise<boolean> {
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`Attempt ${i + 1} to navigate to ${url}`);
            await page.goto(url, { waitUntil: 'load', timeout: 90000 });
            return true;
        } catch (error: any) {
            console.error(`Error navigating to ${url} (Attempt ${i + 1}):`, error.message);
            if (error.message.includes('Navigating frame was detached') || error.message.includes('Timeout')) {
                if (i < retries - 1) {
                    console.log('Retrying navigation after a delay...');
                    await setTimeout(5000);
                }
            } else {
                throw error;
            }
        }
    }
    return false;
}

async function scrapeListingDetails(page: Page, detailUrl: string): Promise<Partial<ScrapedListing>> {
    const details: Partial<ScrapedListing> = {};

    try {
        const navigationSuccessful = await safeGoto(page, detailUrl);
        if (!navigationSuccessful) {
            console.error(`Failed to navigate to detail page ${detailUrl}. Skipping details.`);
            return details;
        }

        await page.waitForSelector('.panel-body, #imageGallery, p[itemprop="description"]', { timeout: 45000 });

        const html = await page.content();
        const $ = cheerio.load(html);

        details.agentName = $('div.panel-body a[href*="/agents/"] strong').text().trim() || null;

        const whatsappNumbers: string[] = [];
        const whatsappP = $('div.panel-body p:has(i.fab.fa-whatsapp)');
        if (whatsappP.length > 0) {
            const rawNumberText = whatsappP.text().replace(/[\s\S]*?(?:i.fab.fa-whatsapp\s*|fa-fw\s*|\s*&nbsp;)/, '').trim();
            if (rawNumberText) {
                const numbers = rawNumberText.match(/\d+/g);
                if (numbers) {
                    whatsappNumbers.push(...numbers);
                }
            }
        }
        details.agentPhones = whatsappNumbers.length > 0 ? whatsappNumbers : null;

        const addr = $('div.panel-body p:has(i.fa-map-marker)').text().trim();
        details.agentAddress = addr ? addr.replace(/^\s*(?:[\w\W\s]*\s*&nbsp;)?\s*/, '').trim() : null;

        const imgs: string[] = [];
        $('#imageGallery li').each((_i, el) => {
            const src = $(el).attr('data-src');
            if (src) imgs.push(src);
        });
        details.Images = imgs.length > 0 ? imgs : null;

        details.description = $('p[itemprop="description"]').text().trim() || null;
    } catch (err: any) {
        console.error(`Error scraping details for ${detailUrl}:`, err.message);
    }

    return details;
}

export async function scrapeListingsFromURL(
    initialUrl: string,
    startPage: number = 1,
    endPage: number = Infinity
): Promise<void> {
    let browser: Browser | null = null;
    let mainPage: Page | null = null;
    let detailPage: Page | null = null;

    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        mainPage = await browser.newPage();
        await mainPage.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        );

        mainPage.on('pageerror', (err) => {
            console.error(`Page error detected: ${err.message}`);
        });
        mainPage.on('error', (err) => {
            console.error(`Page crashed: ${err.message}`);
        });

        detailPage = await browser.newPage();

        let currentPageUrl: string;
        let pageCounter = startPage;

        if (startPage > 1) {
            const urlObj = new URL(initialUrl);
            urlObj.searchParams.set('page', startPage.toString());
            currentPageUrl = urlObj.href;
        } else {
            currentPageUrl = initialUrl;
        }

        let hasNextPage = true;

        while (hasNextPage && pageCounter <= endPage) {
            console.log(`Navigating to listing page ${pageCounter}: ${currentPageUrl}`);
            const navigationSuccessful = await safeGoto(mainPage, currentPageUrl);
            if (!navigationSuccessful) {
                console.error(`Failed to navigate to ${currentPageUrl} after multiple retries. Ending pagination for this branch.`);
                hasNextPage = false;
                break;
            }

            try {
                await mainPage.waitForSelector('.wp-block.property.list', { timeout: 45000 });
            } catch (selectorError: any) {
                console.warn(`No listing blocks found on page ${pageCounter} (${currentPageUrl}) within timeout:`, selectorError.message);
                hasNextPage = false;
                break;
            }

            const html = await mainPage.content();
            const $ = cheerio.load(html);

            const blocks = $('.wp-block.property.list');
            if (blocks.length === 0) {
                console.warn(`No listing blocks found on page ${pageCounter}. Ending pagination.`);
                hasNextPage = false;
                break;
            }

            for (const el of blocks.get()) {
                const $el = $(el);

                const title =
                    $el.find('h4.content-title').text().trim() ||
                    $el.find('.wp-block-title h3[itemprop="name"]').text().trim() || null;

                const image = $el.find('.wp-block-img img[itemprop="image"]').attr('src') || null;

                let price: number | null = null;
                const priceContent = $el.find('span.price[content]').last().attr('content');
                if (priceContent) {
                    price = parseFloat(priceContent);
                    if (isNaN(price)) price = null;
                } else {
                    price = parsePrice($el.find('span.price').last().text().trim());
                }

                const pricePeriod = $el.find('.period').text().trim() || null;

                const locationText = $el.find('address.voffset-bottom-10 strong').text().trim();
                const location = locationText.replace(/^\s*(?:[\w\W\s]*\s*&nbsp;)?\s*/, '').trim() || null;

                const relativeUrl =
                    $el.find('.wp-block-title a[itemprop="url"]').attr('href') ||
                    $el.find('.wp-block-img a').attr('href') || null;

                const listingUrl = relativeUrl ? new URL(relativeUrl, currentPageUrl).href : null;

                const bedroomsText = $el.find('ul.aux-info li:has(i.fa-bed) span').first().text().trim();
                const bedrooms = bedroomsText ? parseInt(bedroomsText, 10) : null;

                const bathroomsText = $el.find('ul.aux-info li:has(i.fa-bath) span').first().text().trim();
                const bathrooms = bathroomsText ? parseInt(bathroomsText, 10) : null;

                const toiletsText = $el.find('ul.aux-info li:has(i.fa-toilet) span').first().text().trim();
                const toilets = toiletsText ? parseInt(toiletsText, 10) : null;

                if (title && listingUrl) {
                    let basicListing: ScrapedListing = {
                        title,
                        image,
                        price,
                        pricePeriod,
                        location,
                        listingUrl,
                        bedrooms,
                        toilets,
                        bathrooms,
                        description: null,
                        Images: null,
                        agentName: null,
                        agentPhones: null,
                        agentAddress: null,
                    };

                    const detailData = await scrapeListingDetails(detailPage, basicListing.listingUrl!);
                    const fullListing = { ...basicListing, ...detailData };

                    let existingListing: ScrapedListing | null = null; // Explicitly type existingListing
                    try {
                        // Ensure .lean() is used for a plain JavaScript object
                        existingListing = await Listing.findOne({ listingUrl: fullListing.listingUrl }).lean() as ScrapedListing | null;
                    } catch (dbFindError: any) {
                        console.error(`Error checking existing listing for ${fullListing.listingUrl}:`, dbFindError.message);
                    }

                    if (existingListing) {
                        console.log(`Listing ${fullListing.listingUrl} already exists in DB. Skipping Cloudinary uploads.`);
                        // If it exists, use its existing image URLs. Handle potential null/undefined for images safely.
                        fullListing.image = existingListing.image ?? fullListing.image;
                        fullListing.Images = existingListing.Images ?? fullListing.Images;
                    } else {
                        console.log(`Listing ${fullListing.listingUrl} is new. Uploading images to Cloudinary.`);
                        if (fullListing.image) {
                            const uploadedMainImage = await uploadImageToCloudinary(fullListing.image);
                            if (uploadedMainImage) fullListing.image = uploadedMainImage;
                        }

                        if (fullListing.Images && Array.isArray(fullListing.Images)) {
                            const uploadedImages: (string | null)[] = await bulkUploadImagesToCloudinary(fullListing.Images);
                            fullListing.Images = uploadedImages.filter((img): img is string => img !== null);
                        }
                    }

                    try {
                        await Listing.findOneAndUpdate(
                            { listingUrl: fullListing.listingUrl },
                            { $set: fullListing },
                            { upsert: true, new: true, setDefaultsOnInsert: true }
                        );
                        console.log(`Successfully saved/updated listing: ${fullListing.title} (${fullListing.listingUrl})`);
                    } catch (dbError: any) {
                        console.error(`Error saving listing ${fullListing.listingUrl} to DB:`, dbError.message);
                    }
                }
            }

            const nextButton = $('div.pPagination ul.pagination li a[rel="next"]');
            const nextHref = nextButton.attr('href');

            if (nextHref) {
                currentPageUrl = new URL(nextHref, initialUrl).href;
                pageCounter++;
            } else {
                hasNextPage = false;
                console.log('No next page found. Ending pagination.');
            }
        }

        console.log(`Scraping process completed for ${initialUrl}. All listings processed and saved individually.`);
        return;

    } catch (err: any) {
        console.error(`Error during main scraping process for ${initialUrl}:`, err.message);
        return;
    } finally {
        if (mainPage) await mainPage.close();
        if (detailPage) await detailPage.close();
        if (browser) await browser.close();
    }
}