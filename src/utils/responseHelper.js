export const jsonResponse = (res, status, message, data = null) => {
    return res.status(status).json({
        status,
        message,
        data,
    });
};
