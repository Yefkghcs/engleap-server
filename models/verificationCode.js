const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const verificationCodeSchema = new Schema({
    code: {
        type: String,
        required: [true, '验证码是必需的'],
        unique: true,
        trim: true,
        match: [/^[0-9a-zA-Z]{6}$/, '验证码是6位数字和字母组合']
    },
    isUsed: {
        type: Boolean,
        default: false
    },
    usedByEmail: {
        type: String,
        trim: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, '请输入有效的邮箱地址']
    },
    usedAt: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now,
    }
});

// 添加索引以提高查询性能
verificationCodeSchema.index({ code: 1 });
verificationCodeSchema.index({ isUsed: 1 });
verificationCodeSchema.index({ createdAt: 1 });

module.exports = mongoose.model('VerificationCode', verificationCodeSchema);
