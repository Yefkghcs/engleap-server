const User = require('../../models/user');
const VerificationCode = require('../../models/verificationCode');
const verificationCodeService = require('../../utils/verificationCodeServices');
const jwtFunc = require('../../utils/jwt');

// 密码要求验证函数
const validatePassword = (password) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    
    return password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers;
};

// 用户注册
exports.register = async (req, res) => {
    try {
        const { email, password, confirmPassword, verificationCode } = req.body;

        // 检查必填字段
        if (!email || !password || !confirmPassword || !verificationCode) {
            return res.json({
                code: 400,
                success: false,
                message: '所有字段都是必需的'
            });
        }

        // 验证邮箱格式
        const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
        if (!emailRegex.test(email)) {
            return res.json({
                code: 400,
                success: false,
                message: '请输入有效的邮箱地址'
            });
        }

        // 验证密码匹配
        if (password !== confirmPassword) {
            return res.json({
                code: 400,
                success: false,
                message: '密码和确认密码不匹配'
            });
        }

        // 验证密码强度
        if (!validatePassword(password)) {
            return res.json({
                code: 400,
                success: false,
                message: '密码必须至少8个字符，包含大小写字母和数字'
            });
        }

        // 检查邮箱是否已注册
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.json({
                code: 400,
                success: false,
                message: '该邮箱已被注册'
            });
        }

        // 验证验证码
        const validation = await verificationCodeService.validateCode(verificationCode);

        if (!validation.isValid) {
            return res.json({
                code: 400,
                success: false,
                message: validation.message
            });
        }

        // 标记验证码为已使用
        await VerificationCode.findOneAndUpdate(
            { code: verificationCode },
            { 
                isUsed: true,
                usedByEmail: email.toLowerCase(),
                usedAt: new Date()
            }
        );

        // 创建新用户
        const user = new User({
            email: email.toLowerCase(),
            password,
            verificationCode: verificationCode
        });

        await user.save();

        // 生成令牌
        const token = jwtFunc.generateToken(user._id);

        // 设置Cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30天
            sameSite: 'none'
        });

        res.json({
            code: 200,
            success: true,
            message: '注册成功',
            user: {
                id: user._id,
                email: user.email
            }
        });

    } catch (error) {
        console.error('注册错误:', error);
        
        // 处理MongoDB唯一约束错误
        if (error.code === 11000) {
            return res.json({
                code: 400,
                success: false,
                message: '该邮箱已被注册'
            });
        }

        res.json({
            code: 500,
            success: false,
            message: '服务器错误，请稍后重试'
        });
    }
};

// 用户登录
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // 检查必填字段
        if (!email || !password) {
            return res.json({
                code: 400,
                success: false,
                message: '邮箱和密码是必需的'
            });
        }

        // 查找用户并包含密码字段
        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
        if (!user) {
            return res.json({
                code: 400,
                success: false,
                message: '邮箱未注册'
            });
        }

        // 验证密码
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return res.json({
                code: 400,
                success: false,
                message: '邮箱或密码错误'
            });
        }

        // 生成令牌
        const token = jwtFunc.generateToken(user._id);

        // 设置Cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30天
            sameSite: 'none'
        });

        res.json({
            code: 200,
            success: true,
            message: '登录成功',
            user: {
                id: user._id,
                email: user.email
            }
        });

    } catch (error) {
        console.error('登录错误:', error);
        res.json({
            code: 500,
            success: false,
            message: '服务器错误，请稍后重试'
        });
    }
};

// 用户登出
exports.logout = (req, res) => {
    res.clearCookie('token');
    res.json({
        code: 200,
        success: true,
        message: '登出成功'
    });
};

// 获取当前用户信息
exports.getCurrentUser = async (req, res) => {
    try {
        // 从cookie中获取token
        const token = req.cookies.token;
        
        if (!token) {
            return res.json({
                code: 301,
                success: false,
                message: '用户未登录'
            });
        }

        // 验证token
        const { valid, user, error } = await jwtFunc.verifyToken(token);

        if (!valid || !user) {
            return res.json({
                code: 301,
                success: false,
                message: error || '用户未登录'
            });
        }

        res.json({
            code: 200,
            success: true,
            user: {
                email: user.email || '',
            },
        });

    } catch (error) {
        console.error('获取用户信息错误:', error);
        res.json({
            code: 401,
            success: false,
            message: '令牌无效'
        });
    }
};

exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmNewPassword } = req.body;

        // 检查必填字段
        if (!currentPassword || !newPassword || !confirmNewPassword) {
            return res.json({
                code: 400,
                success: false,
                message: '所有字段都是必需的'
            });
        }

        // 验证新密码和确认密码是否匹配
        if (newPassword !== confirmNewPassword) {
            return res.json({
                code: 400,
                success: false,
                message: '新密码和确认密码不匹配'
            });
        }

        // 验证新密码强度
        if (!validatePassword(newPassword)) {
            return res.json({
                code: 400,
                success: false,
                message: '新密码必须至少8个字符，包含大小写字母和数字'
            });
        }

        // 检查新密码是否与旧密码相同
        if (currentPassword === newPassword) {
            return res.json({
                code: 400,
                success: false,
                message: '新密码不能与当前密码相同'
            });
        }

        // 从token中获取用户ID
        const token = req.cookies.token;
        if (!token) {
            return res.json({
                code: 301,
                success: false,
                message: '用户未登录'
            });
        }

        // 验证token
        const { valid, user: userFromToken, error } = await jwtFunc.verifyToken(token);
        if (!valid || !userFromToken) {
            return res.json({
                code: 301,
                success: false,
                message: error || '用户未登录或令牌无效'
            });
        }

        // 查找用户并包含密码字段
        const user = await User.findById(userFromToken.id).select('+password');
        if (!user) {
            return res.json({
                code: 404,
                success: false,
                message: '用户不存在'
            });
        }

        // 验证当前密码
        const isCurrentPasswordValid = await user.comparePassword(currentPassword);
        if (!isCurrentPasswordValid) {
            return res.json({
                code: 400,
                success: false,
                message: '当前密码错误'
            });
        }

        // 更新密码
        user.password = newPassword;
        await user.save();

        res.json({
            code: 200,
            success: true,
            message: '密码修改成功'
        });

    } catch (error) {
        console.error('修改密码错误:', error);
        res.json({
            code: 500,
            success: false,
            message: '服务器错误，请稍后重试'
        });
    }
};