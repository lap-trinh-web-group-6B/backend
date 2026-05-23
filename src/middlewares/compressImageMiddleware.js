import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const processImage = async (req, width, height) => {
    if (!req.file) return;

    const originalPath = req.file.path;
    const dirname = path.dirname(originalPath);
    const filenameWithoutExt = path.parse(req.file.filename).name;
    const newFilename = `${filenameWithoutExt}.webp`;
    const newPath = path.join(dirname, newFilename);

    try {
        const originalInfo = fs.statSync(originalPath);
        await sharp(originalPath)
            .resize({ width, height, fit: 'cover' })
            .webp({ quality: 80 })
            .toFile(newPath);

        const newInfo = fs.statSync(newPath);
        console.log(`[Image Optimization] ${req.file.fieldname} - Origin: ${(originalInfo.size / 1024).toFixed(2)} KB -> Webp: ${(newInfo.size / 1024).toFixed(2)} KB`);
        if (originalPath !== newPath) {
            fs.unlinkSync(originalPath);
        }
        req.file.path = newPath;
        req.file.filename = newFilename;
        req.file.mimetype = 'image/webp';

    } catch (error) {
        console.error('[Sharp Optimization Error]:', error);
        throw error;
    }
};

export const compressAvatarMiddleware = async (req, res, next) => {
    try {
        await processImage(req, 256, 256);
        next();
    } catch (error) {
        return res.status(500).json({ message: 'Lỗi trong quá trình tối ưu hình ảnh avatar' });
    }
};

export const compressIconMiddleware = async (req, res, next) => {
    try {
        await processImage(req, 128, 128);
        next();
    } catch (error) {
        return res.status(500).json({ message: 'Lỗi trong quá trình tối ưu hình ảnh icon' });
    }
};
