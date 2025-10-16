const User = require('../../models/user');
const jwtFunc = require('../../utils/jwt');

exports.addUserCheck = async (req, res) => {
    try {
        const token = req.cookies.token;
        const { valid, user, error } = await jwtFunc.verifyToken(token);

        if (!valid || !user) {
            res.json({
                code: 301,
                success: false,
                message: error || '用户未登录',
            });
            return;
        }

        const { date } = req.body;

        const checkList = user.checkStatus || [];
        if (checkList.includes(date)) {
            res.json({
                code: 200,
                success: true,
                message: '当日已打卡',
                data: checkList,
            });
            return;
        }

        user.checkStatus = [
            ...(user.checkStatus || []),
            date,
        ];
        await user.save();

        res.json({
            code: 200,
            success: true,
            message: '新增打卡成功',
            data: user.checkStatus,
        });
    } catch (error) {
        console.error('打卡异常:', error);
        res.json({
            code: 500,
            success: false,
            message: '服务器错误，请稍后重试'
        });
    }
};

exports.getCheckData = async (req, res) => {
    try {
        const token = req.cookies.token;
        const { valid, user, error } = await jwtFunc.verifyToken(token);

        if (!valid || !user) {
            res.json({
                code: 301,
                success: false,
                message: error || '用户未登录',
            });
            return;
        }

        res.json({
            code: 200,
            success: true,
            data: user.checkStatus || [],
        });
    } catch (error) {
        console.error('打卡异常:', error);
        res.json({
            code: 500,
            success: false,
            message: '服务器错误，请稍后重试'
        });
    }
};
