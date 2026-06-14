import { prisma } from '../config/database.js';

export const systemConfigKeys = {
    PREMIUM_PRICE: 'premium_price',
    BANK_BIN: 'bank_bin',
    BANK_ACCOUNT: 'bank_account',
    BANK_NAME: 'bank_name',
    BANK_OWNER_NAME: 'bank_owner_name'
};

export const configService = {
    /**
     * Lấy giá trị cấu hình theo Key
     * @param {string} key Key cấu hình
     * @param {string} defaultValue Giá trị mặc định nếu không tìm thấy trong DB
     * @returns {Promise<string>} Giá trị cấu hình
     */
    get: async (key, defaultValue = '') => {
        try {
            const config = await prisma.system_configs.findUnique({
                where: { key }
            });
            return config ? config.value : defaultValue;
        } catch (error) {
            console.error(`[ConfigService] Lỗi khi lấy cấu hình cho key: ${key}`, error);
            return defaultValue;
        }
    },

    /**
     * Lấy nhiều cấu hình cùng lúc
     * @param {Object} keysMap Bản đồ chứa các key cần lấy và giá trị mặc định của chúng
     * @returns {Promise<Object>} Object chứa kết quả các key và value
     */
    getMany: async (keysMap) => {
        try {
            const keys = Object.keys(keysMap);
            const configs = await prisma.system_configs.findMany({
                where: {
                    key: { in: keys }
                }
            });

            const result = { ...keysMap };
            configs.forEach(config => {
                result[config.key] = config.value;
            });
            return result;
        } catch (error) {
            console.error('[ConfigService] Lỗi khi lấy nhiều cấu hình:', error);
            return keysMap;
        }
    },

    /**
     * Cập nhật hoặc tạo mới một cấu hình
     * @param {string} key Key cấu hình
     * @param {string} value Giá trị mới
     * @returns {Promise<Object>} Đối tượng cấu hình đã cập nhật
     */
    set: async (key, value) => {
        try {
            return await prisma.system_configs.upsert({
                where: { key },
                update: { value: String(value) },
                create: { key, value: String(value) }
            });
        } catch (error) {
            console.error(`[ConfigService] Lỗi khi lưu cấu hình cho key: ${key}`, error);
            throw error;
        }
    }
};
