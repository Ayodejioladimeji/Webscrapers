// lib/watermark.ts
import sharp from 'sharp';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

/**
 * Downloads an image from a remote URL, applies a watermark, and returns a buffer.
 */
export async function applyWatermarkToImage(url: string): Promise<Buffer> {
    try {
        // 1. Download remote image
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const inputImage = Buffer.from(response.data, 'binary');

        // 2. Read watermark image from local path
        const watermarkPath = path.resolve('./public/watermark.png');
        const watermarkImage = fs.readFileSync(watermarkPath);

        // 3. Resize watermark relative to main image
        const metadata = await sharp(inputImage).metadata();
        const resizedWatermark = await sharp(watermarkImage)
            .resize({ width: Math.round((metadata.width || 800) * 0.3) })
            .flatten({ background: { r: 255, g: 255, b: 255 } }) 
            .png()
            .toBuffer();

        // 4. Composite watermark on image (bottom-right)
        const watermarkedBuffer = await sharp(inputImage)
            .composite([
                {
                    input: resizedWatermark,
                    gravity: 'center',
                    blend: 'over', 
                },
            ])
            .png()
            .toBuffer();

        return watermarkedBuffer;
    } catch (error: any) {
        console.error('Error applying watermark:', error.message);
        throw new Error('Failed to apply watermark');
    }
}
