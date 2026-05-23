import fs from 'fs';
import path from 'path';
export const deleteFile = (fileUrl) => {
    if (!fileUrl) return;
    try {
        const relativePath = fileUrl.startsWith('/') ? fileUrl.substring(1) : fileUrl;
        const absolutePath = path.resolve(process.cwd(), relativePath);
        if (fs.existsSync(absolutePath)) {
            fs.unlinkSync(absolutePath);
            console.log(`[File Delete] Removed local file: ${absolutePath}`);
        }
    } catch (err) {
        console.error(`[File Delete] Lỗi xóa file ${fileUrl}:`, err.message);
    }
};
