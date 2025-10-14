const Word  = require("../../models/word");
const jwtFunc = require("../../utils/jwt");

exports.word_list = async function(req, res, next) {
    try {
        const token = req.cookies.token;
        const { valid } = await jwtFunc.verifyToken(token);
        if (!valid) {
            return res.json({
                code: 301,
                success: false,
                message: error || '用户未登录'
            });
        }
        const words = await Word.find().exec();
        res.json({
            words,
        });
    } catch (err) {
        return next(err);
    }
};