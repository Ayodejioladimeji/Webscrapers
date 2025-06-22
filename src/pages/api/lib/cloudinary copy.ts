

import { v2 as cloudinary } from 'cloudinary';
import { applyWatermarkToImage } from './watermark';
import streamifier from 'streamifier';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
    api_key: process.env.CLOUDINARY_API_KEY!,
    api_secret: process.env.CLOUDINARY_API_SECRET!,
});

export async function uploadImageToCloudinary(
    url: string,
    folder: string = 'listings'
): Promise<string | null> {
    try {
        const watermarkedBuffer = await applyWatermarkToImage(url);

        // Extract a base filename from the URL
        const baseName = path.basename(new URL(url).pathname); // e.g., 'image1.jpg'
        const nameWithoutExt = baseName.replace(/\.[^/.]+$/, ''); // Remove .jpg
        const uniqueId = uuidv4(); // Create a unique suffix
        const publicId = `${folder}/${uniqueId}-${nameWithoutExt}`;

        const uploadedUrl = await new Promise<string | null>((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    public_id: publicId,
                    overwrite: true,
                    use_filename: true,
                    unique_filename: false,
                },
                (error, result) => {
                    if (error) {
                        console.error('Cloudinary upload error:', error);
                        reject(error);
                    } else {
                        resolve(result?.secure_url || null);
                    }
                }
            );

            streamifier.createReadStream(watermarkedBuffer).pipe(uploadStream);
        });

        return uploadedUrl;
    } catch (err: any) {
        console.error(`Failed to upload image: ${url}`, err.message);
        return null;
    }
}

export async function bulkUploadImagesToCloudinary(
    urls: string[],
    folder: string = 'listings',
    concurrency = 3
): Promise<string[]> {
    const results: string[] = [];
    let index = 0;

    async function worker() {
        while (index < urls.length) {
            const currentIndex = index++;
            const result = await uploadImageToCloudinary(urls[currentIndex], folder);
            if (result) results.push(result);
        }
    }

    const workers = Array.from({ length: concurrency }, () => worker());
    await Promise.all(workers);

    return results;
}
