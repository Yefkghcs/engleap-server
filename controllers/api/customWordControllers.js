const mongoose = require('mongoose');

const { CustomWord, CustomWordCategory } = require("../../models/customWord");
const UserWord = require('../../models/userWord');

const jwtFunc = require('../../utils/jwt');

// 新增自定义词库
exports.createCustomCategory = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const token = req.cookies.token;
        const { valid, user, error } = await jwtFunc.verifyToken(token);
        const userId = user._id;

        if (!valid || !user) {
            await session.abortTransaction();
            return res.json({
                code: 301,
                success: false,
                message: error || '用户未登录'
            });
        }

        const { 
            category, 
            categoryName, 
            subcategory, 
            subcategoryName, 
            emoji,
            words,
        } = req.body;

        // 验证必填字段
        if (!category || !categoryName || !subcategory || !subcategoryName || !emoji) {
            await session.abortTransaction();
            return res.json({
                code: 400,
                success: false,
                message: '所有字段都是必需的: category, categoryName, subcategory, subcategoryName, emoji'
            });
        }

        // 验证 words 参数格式
        if (words && !Array.isArray(words)) {
            await session.abortTransaction();
            return res.json({
                code: 400,
                success: false,
                message: 'words 必须是数组'
            });
        }

        // 检查是否已存在相同的词库
        const existingCategory = await CustomWordCategory.findOne({
            user: userId,
            subcategory
        });

        if (existingCategory) {
            await session.abortTransaction();
            return res.json({
                code: 400,
                success: false,
                message: '已存在相同分类和子分类的词库'
            });
        }

        // 创建新词库
        const newCategory = new CustomWordCategory({
            user: userId,
            category,
            categoryName,
            subcategory,
            subcategoryName,
            emoji
        });

        await newCategory.save();

        const newWords = words?.map?.((item) =>({
            ...(item || {}),
            user: userId,
            category,
            subcategory
        })) || [];

        await CustomWord.insertMany(newWords, { session });

        await session.commitTransaction();

        res.json({
            code: 200,
            success: true,
            message: '自定义词库创建成功',
            data: {
                category: newCategory?.category,
                categoryName: newCategory?.categoryName,
                subcategory: newCategory?.subcategory,
                subcategoryName: newCategory?.subcategoryName,
                emoji: newCategory?.emoji,
                wordCount: newWords?.length || 0,
            },
        });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }

        console.error('创建自定义词库错误:', error);
        
        // 处理 MongoDB 重复键错误
        if (error.code === 11000) {
            return res.json({
                code: 400,
                success: false,
                message: '已存在相同分类和子分类的词库'
            });
        }

        res.json({
            code: 500,
            success: false,
            message: '创建自定义词库失败'
        });
    } finally {
        session.endSession();
    }
};

// 删除自定义词库
exports.deleteCustomCategory = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const token = req.cookies.token;
        const { valid, user, error } = await jwtFunc.verifyToken(token);
        const userId = user._id;

        if (!valid || !user) {
            await session.abortTransaction();
            return res.json({
                code: 301,
                success: false,
                message: error || '用户未登录'
            });
        }

        const { category, subcategory } = req.body;

        if (!category || !subcategory) {
            await session.abortTransaction();
            return res.json({
                code: 400,
                success: false,
                message: 'categoryId 是必需的'
            });
        }

        // 验证词库是否存在且属于当前用户
        const categoryCheck = await CustomWordCategory.findOne({
            category,
            subcategory,
            user: userId
        });

        if (!categoryCheck) {
            await session.abortTransaction();
            return res.json({
                code: 404,
                success: false,
                message: '词库不存在或无权访问'
            });
        }

        await Promise.all([
            CustomWord.deleteMany({ // 删除该词库下的所有单词
                user: userId,
                category,
                subcategory,
            }),
            UserWord.deleteMany({ // 删除用户词库中的记录
                user: userId,
                wordCategory: category,
                wordSubcategory: subcategory,
            }),
            CustomWordCategory.deleteOne({ // 删除词库
                category,
                subcategory,
                user: userId
            })
        ]);

        await session.commitTransaction();

        res.json({
            code: 200,
            success: true,
            message: '自定义词库删除成功',
        });
    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        console.error('删除自定义词库错误:', error);
        res.json({
            code: 500,
            success: false,
            message: '删除自定义词库失败'
        });
    } finally {
        session.endSession();
    }
};

// 获取用户的所有自定义词库
exports.getUserCustomCategories = async (req, res) => {
    try {
        const token = req.cookies.token;
        const { valid, user, error } = await jwtFunc.verifyToken(token);
        const userId = user._id;

        if (!valid || !user) {
            return res.json({
                code: 301,
                success: false,
                message: error || '用户未登录'
            });
        }

        const categories = await CustomWordCategory.find({
            user: userId
        }).sort({ createdAt: -1 });

        // 获取每个词库的单词数量
        const categoriesWithWordCount = await Promise.all(
            categories.map(async (category) => {
                const wordCount = await CustomWord.countDocuments({
                    user: userId,
                    category: category?.category,
                    subcategory: category?.subcategory,
                });
                
                return {
                    category: category?.category,
                    categoryName: category?.categoryName,
                    subcategory: category?.subcategory,
                    subcategoryName: category?.subcategoryName,
                    emoji: category?.emoji,
                    wordCount
                };
            })
        );

        res.json({
            code: 200,
            success: true,
            data: categoriesWithWordCount
        });

    } catch (error) {
        console.error('获取自定义词库错误:', error);
        res.json({
            code: 500,
            success: false,
            message: '获取自定义词库失败'
        });
    }
};

// 辅助函数：合并 Word 数据和 UserWord 状态（使用业务字段关联）
const mergeWordData = (words, userWords) => {
    const userWordMap = new Map();
    
    // 使用业务字段作为键：category + subcategory + id
    userWords.forEach(uw => {
        const businessKey = `${uw.wordCategory}|${uw.wordSubcategory}|${uw.wordId}`;
        userWordMap.set(businessKey, uw);
    });

    return words.map(word => {
        // 使用相同的业务字段组合作为键
        const businessKey = `${word.category}|${word.subcategory}|${word.id}`;
        const userWord = userWordMap.get(businessKey);
        
        // 创建不包含 _id 的 word 对象
        const { _id, __v, createdAt, updatedAt, user, ...wordData } = word.toObject ? word.toObject() : word;
        
        if (userWord) {
            return {
                ...wordData,
                status: userWord.status,
                mistakes: userWord.mistakes,
            };
        } else {
            return {
                ...wordData,
                status: 'unmarked',
                mistakes: [],
            };
        }
    });
};

// 获取指定自定义词库下的所有单词（分页）
exports.getWordsByCustomCategory = async (req, res) => {
    try {
        const token = req.cookies.token;
        const { valid, user, error } = await jwtFunc.verifyToken(token);
        const userId = user._id;

        if (!valid || !user) {
            return res.json({
                code: 301,
                success: false,
                message: error || '用户未登录'
            });
        }

        const {
            category,
            subcategory,
            page = 1, 
            limit = 20,
        } = req.body;

        if (!category || !subcategory) {
            return res.json({
                code: 400,
                success: false,
                message: 'categoryId 是必需的'
            });
        }

        // 验证词库是否存在且属于当前用户
        const categoryCheck = await CustomWordCategory.findOne({
            category,
            subcategory,
            user: userId
        });

        if (!categoryCheck) {
            return res.json({
                code: 404,
                success: false,
                message: '词库不存在或无权访问'
            });
        }

        const skip = (page - 1) * limit;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);

        // 查询单词数据
        const words = await CustomWord.find({
            user: userId,
            category,
            subcategory,
        })
        .sort({ id: 1 })
        .skip(skip)
        .limit(limitNum);

        // 获取总数量
        const totalWords = await CustomWord.countDocuments({
            user: userId,
            category,
            subcategory,
        });

        const filterWords = words?.map?.((item) => ({
            id: item?.id,
            category: item?.category,
            subcategory: item?.subcategory,
            word: item?.word,
            meaning: item?.meaning,
            example: item?.example || '',
            exampleCn: item?.exampleCn || '',
        })) || [];

        const userWords = await UserWord.find({
            user: userId,
            wordCategory: category,
            wordSubcategory: subcategory,
        });

        const mergedWords = mergeWordData(filterWords, userWords);

        // 获取统计信息
        const userWordStats = await UserWord.aggregate([
            {
                $match: {
                    user: new mongoose.Types.ObjectId(userId),
                    wordSubcategory: subcategory,
                } 
            },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        const stats = {
            total: totalWords,
            unmarked: totalWords,
            unknown: 0,
            known: 0
        };

        userWordStats.forEach(stat => {
            stats[stat._id] = stat.count;
            stats.unmarked = totalWords - stats.unknown - stats.known;
        });

        res.json({
            code: 200,
            success: true,
            data: {
                words: mergedWords,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total: totalWords,
                    pages: Math.ceil(totalWords / limitNum),
                },
                stats,
            }
        });

    } catch (error) {
        console.error('获取自定义词库单词错误:', error);
        res.json({
            code: 500,
            success: false,
            message: '获取单词失败'
        });
    }
};

// 获取当前用户指定状态的单词（子分类下）
exports.getWordsByStatus = async (req, res) => {
    try {
        const token = req.cookies.token;
        const { valid, user, error } = await jwtFunc.verifyToken(token);
        const userId = user._id;

        if (!valid || !user) {
            return res.json({
                code: 301,
                success: false,
                message: error || '用户未登录'
            });
        }

        const { 
            page = 1, 
            limit = 20,
            status,
            subcategory,
        } = req.body;

        const skip = (page - 1) * limit;

        let words = [];
        let total = 0;
        let userWords = [];

        // 构建Word查询条件
        const wordQuery = { user: userId, };
        if (subcategory) {
            wordQuery.subcategory = subcategory;
        }

        if (status === 'unmarked') {
            // 情况1：查询未标记的单词（Words中存在但UserWords中不存在的单词）
            
            // 获取用户已标记的所有单词（用于排除）
            const markedUserWords = await UserWord.find({
                user: userId,
                status: { $ne: 'unmarked' },
                ...(subcategory && { wordSubcategory: subcategory })
            });

            // 构建排除条件
            const excludeConditions = markedUserWords.map(uw => ({
                category: uw.wordCategory,
                subcategory: uw.wordSubcategory,
                id: uw.wordId
            }));

            // 查询未标记的单词
            if (excludeConditions.length > 0) {
                // 如果有已标记的单词，需要排除它们
                words = await CustomWord.find({
                    ...wordQuery,
                    $nor: excludeConditions
                })
                .sort({ id: 1 })
                .skip(skip)
                .limit(parseInt(limit));
                
                total = await CustomWord.countDocuments({
                    ...wordQuery,
                    $nor: excludeConditions
                });
            } else {
                // 如果没有已标记的单词，直接查询所有单词
                words = await CustomWord.find(wordQuery)
                    .sort({ id: 1 })
                    .skip(skip)
                    .limit(parseInt(limit));
                
                total = await CustomWord.countDocuments(wordQuery);
            }

            // 对于unmarked状态，userWords始终为空数组
            userWords = [];

        } else if (status === 'unknown' || status === 'known') {
            // 情况2：查询已标记的单词（unknown或known状态）
            
            // 查询UserWords
            userWords = await UserWord.find({ 
                user: userId, 
                status,
                ...(subcategory && { wordSubcategory: subcategory })
            })
            .sort({ id: 1 })
            .skip(skip)
            .limit(parseInt(limit));

            total = await UserWord.countDocuments({ 
                user: userId, 
                status,
                ...(subcategory && { wordSubcategory: subcategory })
            });

            // 查询对应的Word数据
            if (userWords.length > 0) {
                words = await CustomWord.find({
                    ...wordQuery,
                    $or: userWords.map(userWord => ({
                        category: userWord.wordCategory,
                        subcategory: userWord.wordSubcategory,
                        id: userWord.wordId
                    }))
                });
            }
        } else {
            return res.json({
                code: 400,
                success: false,
                message: '状态值无效'
            });
        }

        const mergedWords = mergeWordData(words, userWords);

        res.json({
            code: 200,
            success: true,
            data: {
                words: mergedWords,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        console.error('获取单词错误:', error);
        res.json({
            code: 500,
            success: false,
            message: '获取单词失败'
        });
    }
};

// 标记单词状态（懒创建 UserWord 记录）
exports.markWordStatus = async (req, res) => {
    try {
        const token = req.cookies.token;
        const { valid, user, error } = await jwtFunc.verifyToken(token);
        const userId = user._id;

        if (!valid || !user) {
            return res.json({
                code: 301,
                success: false,
                message: error || '用户未登录'
            });
        }

        const { category, subcategory, id, status } = req.body;

        if (!['unmarked', 'unknown', 'known'].includes(status)) {
            return res.json({
                code: 400,
                success: false,
                message: '状态值无效'
            });
        }

        // 检查单词是否存在
        const word = await CustomWord.findOne({
            user: userId,
            category,
            subcategory,
            id,
        });
        if (!word) {
            return res.json({
                code: 404,
                success: false,
                message: '单词不存在'
            });
        }

        // 查找或创建 UserWord 记录
        let userWord = await UserWord.findOne({
            user: userId,
            wordCategory: category,
            wordSubcategory: subcategory,
            wordId: id,
        });

        if (!userWord) {
            // 只有非 unmarked 状态时才创建记录
            if (status !== 'unmarked') {
                userWord = new UserWord({
                    user: userId,
                    wordCategory: category,
                    wordSubcategory: subcategory,
                    wordId: id,
                    status: status,
                    mistakes: [],
                });
            }
        } else {
            userWord.status = status;
        }

        await userWord.save();

        res.json({
            code: 200,
            success: true,
            message: `单词状态已更新为 ${status}`,
        });

    } catch (error) {
        console.error('标记单词状态错误:', error);
        res.json({
            code: 500,
            success: false,
            message: '标记单词状态失败'
        });
    }
};

// 记录单词错误（懒创建 UserWord 记录）
exports.recordWordMistake = async (req, res) => {
    try {
        const token = req.cookies.token;
        const { valid, user, error } = await jwtFunc.verifyToken(token);
        const userId = user._id;

        if (!valid || !user) {
            return res.json({
                code: 301,
                success: false,
                message: error || '用户未登录'
            });
        }

        const { category, subcategory, id, mistakes } = req.body;

        // 检查单词是否存在
        const word = await CustomWord.findOne({
            user: userId, category, subcategory, id
        });
        if (!word) {
            return res.json({
                code: 404,
                success: false,
                message: '单词不存在'
            });
        }

        // 查找或创建 UserWord 记录
        let userWord = await UserWord.findOne({
            user: userId,
            wordCategory: category,
            wordSubcategory: subcategory,
            wordId: id,
        });

        if (!userWord) {
            // 创建新记录
            userWord = new UserWord({
                user: userId,
                wordCategory: category,
                wordSubcategory: subcategory,
                wordId: id,
                status: 'unmarked',
                mistakes: mistakes,
            });
        } else {
            userWord.mistakes = mistakes;
        }

        await userWord.save();

        res.json({
            code: 200,
            success: true,
            message: '单词错误已记录',
        });

    } catch (error) {
        console.error('记录单词错误错误:', error);
        res.json({
            code: 500,
            success: false,
            message: '记录单词错误失败'
        });
    }
};
