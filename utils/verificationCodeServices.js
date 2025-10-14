const VerificationCode = require('../models/verificationCode');

class VerificationCodeService {
    constructor() {
        this.characters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    }

    // 生成单个随机验证码
    generateSingleCode(length = 6) {
        let code = '';
        for (let i = 0; i < length; i++) {
            const randomIndex = Math.floor(Math.random() * this.characters.length);
            code += this.characters[randomIndex];
        }
        return code;
    }

    // 生成唯一且不重复的验证码
    async generateUniqueCode(maxRetries = 10) {
        let retries = 0;
        
        while (retries < maxRetries) {
            try {
                const code = this.generateSingleCode();
                
                // 检查是否已存在
                const existingCode = await VerificationCode.findOne({ code });
                if (!existingCode) {
                    // 创建新的验证码记录
                    const verificationCode = new VerificationCode({
                        code,
                        isUsed: false
                    });
                    
                    await verificationCode.save();
                    return code;
                }
                
                retries++;
            } catch (error) {
                if (error.code === 11000) {
                    // 唯一约束冲突，重试
                    retries++;
                    continue;
                }
                throw error;
            }
        }
        
        throw new Error(`无法生成唯一验证码，已达到最大重试次数: ${maxRetries}`);
    }

    // 验证验证码有效性
    async validateCode(code) {
        if (!code || code.length !== 6) {
            return {
                isValid: false,
                message: '验证码格式错误，应为6位字符'
            };
        }

        try {
            const codeRecord = await VerificationCode.findOne({ 
                code,
            });

            if (!codeRecord) {
                return {
                    isValid: false,
                    message: '验证码不存在'
                };
            }

            if (codeRecord.isUsed) {
                return {
                    isValid: false,
                    message: '验证码已被使用'
                };
            }

            return {
                isValid: true,
                codeRecord
            };

        } catch (error) {
            console.error('验证验证码时出错:', error);
            return {
                isValid: false,
                message: '验证码验证失败'
            };
        }
    }
}

module.exports = new VerificationCodeService();
