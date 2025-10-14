const VerificationCode = require('../../models/verificationCode');
const verificationCodeService = require('../../utils/verificationCodeServices');

// 生成单个验证码（客服使用）
exports.generate_code_get = async (req, res) => {
    res.render("generate_code", {
        title: "生成验证码",
    });
};
exports.generate_code_post = async (req, res) => {
    try {
        const code = await verificationCodeService.generateUniqueCode();
        
        // res.json({
        //     success: true,
        //     message: '验证码生成成功',
        //     code,
        //     instructions: '请将此验证码提供给购买产品的用户用于注册'
        // });
        res.render("generate_code", {
            title: "生成验证码",
            code,
        });

    } catch (error) {
        console.error('生成验证码错误:', error);
        res.json({
            code: 500,
            success: false,
            message: error.message || '生成验证码失败'
        });
    }
};

// 验证验证码状态
exports.validate_code = async (req, res) => {
    try {
        const { code } = req.params;
        const validation = await verificationCodeService.validateCode(code);

        if (!validation.isValid) {
            res.json({
                success: false,
                isValid: false,
                message: validation.message
            });
            return;
        }

        res.json({
            success: true,
            isValid: true,
            message: '验证码有效',
            code: validation.codeRecord.code,
            isUsed: validation.codeRecord.isUsed,
            createdAt: validation.codeRecord.createdAt
        });

    } catch (error) {
        console.error('验证验证码状态错误:', error);
        res.json({
            code: 500,
            success: false,
            message: '验证验证码状态失败'
        });
    }
};

// 获取验证码列表（分页）
exports.code_list = async (req, res) => {
    try {
        const { page = 1, limit = 20, used } = req.query;
        const skip = (page - 1) * limit;
        
        let query = {};
        if (used !== undefined) {
            query.isUsed = used === 'true';
        }

        const codes = await VerificationCode.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .select('code isUsed usedByEmail usedAt createdAt');

        const total = await VerificationCode.countDocuments(query);

        // res.json({
        //     success: true,
        //     codes,
        //     pagination: {
        //         page: parseInt(page),
        //         limit: parseInt(limit),
        //         total,
        //         pages: Math.ceil(total / limit)
        //     }
        // });
        res.render("code_list", {
            title: "查询验证码",
            codes,
            total,
        });

    } catch (error) {
        console.error('获取验证码列表错误:', error);
        res.json({
            code: 500,
            success: false,
            message: '获取验证码列表失败'
        });
    }
};
