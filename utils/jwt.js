const jwt = require('jsonwebtoken');

const User = require('../models/user');

// 验证token函数
exports.verifyToken = async (token) => {
    if (!token) return {
        valid: false,
    };
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
        const user = await User.findById(decoded.id).select('-password');

        if (!user) {
            return {
                valid: false,
            };
        }
        
        return {
            valid: true,
            user
        };
    } catch (error) {
        return {
            valid: false,
            error: error.message
        };
    }
};

// 生成token函数
exports.generateToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET || 'your_jwt_secret', { 
        expiresIn: '30d' 
    });
};