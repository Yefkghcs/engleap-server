const mongoose = require('mongoose');
const UserWord = require('../../models/userWord');
const Word = require('../../models/word');
const { CustomWord } = require('../../models/customWord');
const jwtFunc = require('../../utils/jwt');

exports.getTotalData = async (req, res) => {
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

        const [mistakeTotal, learnedTotal] = await Promise.all([
            UserWord.countDocuments({
                user: userId,
                mistakes: { $exists: true, $ne: [] }
            }),
            UserWord.countDocuments({
                user: userId,
                status: { $exists: true, $ne: 'unmarked' }
            }),
        ]);

        res.json({
            code: 200,
            success: true,
            total: {
                mistake: mistakeTotal,
                learned: learnedTotal
            },
        });
    } catch (error) {
        console.error('获取用户单词列表错误:', error);
        res.json({
            code: 500,
            success: false,
            message: '获取单词统计数据失败'
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
        const { _id, __v, ...wordData } = word.toObject ? word.toObject() : word;
        
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

// 按照创建时间排序
const mergeWordDataByTime = (words, userWords) => {
    const userWordMap = new Map();
    
    // 使用业务字段作为键：category + subcategory + id
    userWords.forEach(uw => {
        const businessKey = `${uw.wordCategory}|${uw.wordSubcategory}|${uw.wordId}`;
        userWordMap.set(businessKey, uw);
    });

    // 首先处理所有 words，创建基础结果
    const allWordsResult = words.map(word => {
        // 使用相同的业务字段组合作为键
        const businessKey = `${word.category}|${word.subcategory}|${word.id}`;
        const userWord = userWordMap.get(businessKey);
        
        // 创建不包含 _id 的 word 对象
        const { _id, __v, ...wordData } = word.toObject ? word.toObject() : word;
        
        if (userWord) {
            return {
                ...wordData,
                status: userWord.status,
                mistakes: userWord.mistakes,
                // 添加 userWord 的创建时间用于排序
                _userWordCreatedAt: userWord.createdAt
            };
        } else {
            return {
                ...wordData,
                status: 'unmarked',
                mistakes: [],
                // 对于没有 userWord 的数据，使用一个很晚的时间确保排在后面
                _userWordCreatedAt: new Date(0)
            };
        }
    });

    // 按照 userWords 的创建时间排序
    return allWordsResult.sort((a, b) => {
        // 有 userWord 的数据按照创建时间倒序
        if (a._userWordCreatedAt && b._userWordCreatedAt) {
            return new Date(b._userWordCreatedAt) - new Date(a._userWordCreatedAt);
        }
        // 有 userWord 的排在前面
        if (a._userWordCreatedAt.getTime() > 0 && b._userWordCreatedAt.getTime() === 0) {
            return -1;
        }
        if (a._userWordCreatedAt.getTime() === 0 && b._userWordCreatedAt.getTime() > 0) {
            return 1;
        }
        // 都没有 userWord 的保持原顺序
        return 0;
    }).map(item => {
        // 移除临时排序字段
        const { _userWordCreatedAt, ...result } = item;
        return result;
    });
};

// 获取当前用户的所有单词（合并 Word 表和 UserWord 表）
exports.getAllUserWords = async (req, res) => {
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
            status, // 可选过滤：unmarked, unknown, known
            subcategory, // 按分类过滤
        } = req.body || {};

        const skip = (page - 1) * limit;
        
        // 构建 Word 查询条件
        let wordQuery = {};
        if (subcategory) {
            wordQuery.subcategory = subcategory;
        }

        // 获取所有单词（分页）
        const words = await Word.find(wordQuery)
            .sort({ id: 1 })
            .skip(skip)
            .limit(parseInt(limit));

        const totalWords = await Word.countDocuments(wordQuery);

        // 获取用户已有的 UserWord 记录（使用业务字段关联）
        const userWords = await UserWord.find({
            user: userId,
            $or: (words || []).map(word => ({
                wordCategory: word.category,
                wordSubcategory: word.subcategory,
                wordId: word.id
            }))
        });
        
        // 合并数据
        const mergedWords = mergeWordData(words, userWords);

        // 如果指定了状态过滤，在内存中过滤
        let filteredWords = mergedWords;
        if (status && status !== 'all') {
            filteredWords = mergedWords.filter(word => word.status === status);
        }

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
                words: filteredWords,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: totalWords,
                    pages: Math.ceil(totalWords / limit)
                },
                stats
            }
        });

    } catch (error) {
        console.error('获取用户单词列表错误:', error);
        res.json({
            code: 500,
            success: false,
            message: '获取单词列表失败'
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

        if (status === 'unmarked') {
            // 情况1：查询未标记的单词（Words中存在但UserWords中不存在的单词）
            
            // 构建Word查询条件
            const wordQuery = {};
            if (subcategory) {
                wordQuery.subcategory = subcategory;
            }

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
                words = await Word.find({
                    ...wordQuery,
                    $nor: excludeConditions
                })
                .sort({ id: 1 })
                .skip(skip)
                .limit(parseInt(limit));
                
                total = await Word.countDocuments({
                    ...wordQuery,
                    $nor: excludeConditions
                });
            } else {
                // 如果没有已标记的单词，直接查询所有单词
                words = await Word.find(wordQuery)
                    .sort({ id: 1 })
                    .skip(skip)
                    .limit(parseInt(limit));
                
                total = await Word.countDocuments(wordQuery);
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
                words = await Word.find({
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

// 获取当前用户指定状态的单词（不区分类别）
exports.getAllWordsByStatus = async (req, res) => {
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
            limit = 30,
            statusList,
        } = req.body;

        const skip = (page - 1) * limit;

        // 查询UserWords
        const userWords = await UserWord.find({ 
            user: userId,
            $or: statusList.map(status => ({
                status,
            }))
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

        const total = await UserWord.countDocuments({ 
            user: userId,
            $or: statusList.map(status => ({
                status,
            }))
        });

        let words = [];
        // 同时从Word和CustomWord数据库查询对应的单词数据
        if (userWords.length > 0) {
            // 创建查询条件
            const queryConditions = userWords.map(userWord => ({
                category: userWord.wordCategory,
                subcategory: userWord.wordSubcategory,
                id: userWord.wordId
            }));

            // 并行查询Word和CustomWord数据库
            const [wordResults, customWordResults] = await Promise.all([
                Word.find({
                    $or: queryConditions
                }),
                CustomWord.find({
                    $or: queryConditions,
                    user: userId // CustomWord通常需要关联用户
                })
            ]);

            const filterCustomWords = customWordResults?.map?.((item) => {
                const itemObj = item.toObject ? item.toObject() : item;
                const { createdAt, updatedAt, user, ...wordData } = itemObj;
                return wordData;
            });

            // 合并结果
            words = [...wordResults, ...filterCustomWords];
        }

        const mergedWords = mergeWordDataByTime(words, userWords);

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

// 获取当前用户的所有错过的单词
exports.getAllMistakeWords = async (req, res) => {
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
            limit = 30,
        } = req.body;

        const skip = (page - 1) * limit;
        
        // 查询有错误记录的单词
        const userWords = await UserWord.find({ 
            user: userId, 
            mistakes: { $exists: true, $ne: [] }
        })
        .sort({ updatedAt: -1, })
        .skip(skip)
        .limit(parseInt(limit));

        const total = await UserWord.countDocuments({ 
            user: userId, 
            mistakes: { $exists: true, $ne: [] }
        });

        let words = [];
        // 同时从Word和CustomWord数据库查询对应的单词数据
        if (userWords.length > 0) {
            // 创建查询条件
            const queryConditions = userWords.map(userWord => ({
                category: userWord.wordCategory,
                subcategory: userWord.wordSubcategory,
                id: userWord.wordId
            }));

            // 并行查询Word和CustomWord数据库
            const [wordResults, customWordResults] = await Promise.all([
                Word.find({
                    $or: queryConditions
                }),
                CustomWord.find({
                    $or: queryConditions,
                    user: userId // CustomWord通常需要关联用户
                })
            ]);

            const filterCustomWords = customWordResults?.map?.((item) => {
                const itemObj = item.toObject ? item.toObject() : item;
                const { createdAt, updatedAt, user, ...wordData } = itemObj;
                return wordData;
            });

            // 合并结果
            words = [...wordResults, ...filterCustomWords];
        }

        const mergedWords = mergeWordDataByTime(words, userWords);

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
                },
            }
        });

    } catch (error) {
        console.error('获取错题单词错误:', error);
        res.json({
            code: 500,
            success: false,
            message: '获取错题单词失败'
        });
    }
};

// 获取当前用户在指定日期里错过的单词
exports.getMistakeWordsByDate = async (req, res) => {
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
            limit = 30,
            dates,
        } = req.body;

        const skip = (page - 1) * limit;
        
        // 查询有错误记录的单词
        const userWords = await UserWord.find({ 
            user: userId, 
            mistakes: {
                $in: dates
            }
        })
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

        const total = await UserWord.countDocuments({ 
            user: userId, 
            mistakes: {
                $in: dates
            }
        });

        if (userWords?.length > 0) {
            const words = await Word.find({
                $or: userWords.map(userWord => ({
                    category: userWord.wordCategory,
                    subcategory: userWord.wordSubcategory,
                    id: userWord.wordId
                }))
            });

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
                    },
                }
            });
        } else {
            res.json({
                code: 200,
                success: true,
                data: {
                    words: [],
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit)
                    },
                }
            });
        }
    } catch (error) {
        console.error('获取错题单词错误:', error);
        res.json({
            code: 500,
            success: false,
            message: '获取错题单词失败'
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
        const word = await Word.findOne({
            category, subcategory, id
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
        const word = await Word.findOne({
            category, subcategory, id
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

// 删除单词的错误记录
exports.deleteWordMistake = async (req, res) => {
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

        const { words } = req.body;

        if (!words || !Array.isArray(words) || words.length === 0) {
            return res.json({
                code: 400,
                success: false,
                message: '参数ids是必需的且必须是非空数组'
            });
        }

        // 查找或创建 UserWord 记录
        const userWords = await UserWord.find({
            user: userId,
            $or: words.map(wordInfo => ({
                wordCategory: wordInfo.category,
                wordSubcategory: wordInfo.subcategory,
                wordId: wordInfo.id
            }))
        });

        const deletePromises = [];
        const updatePromises = [];

        for (const userWord of userWords) {
            if (userWord.status === 'unmarked') {
                // 状态为unmarked，删除记录
                deletePromises.push(
                    UserWord.deleteOne({
                        user: userId,
                        wordCategory: userWord.wordCategory,
                        wordSubcategory: userWord.wordSubcategory,
                        wordId: userWord.wordId
                    })
                );
            } else {
                // 其他情况，清空mistakes数组
                userWord.mistakes = [];
                updatePromises.push(userWord.save());
            }
        }

        // 并行执行所有操作
        const [deleteResult, updateResult] = await Promise.all([
            Promise.all(deletePromises),
            Promise.all(updatePromises)
        ]);

        const deletedCount = deleteResult.length;
        const updatedCount = updateResult.length;

        res.json({
            code: 200,
            success: true,
            message: `成功处理 ${words.length} 个单词，删除 ${deletedCount} 条记录，清空 ${updatedCount} 个单词的错误记录`,
            data: {
                totalWords: words.length,
                deletedRecords: deletedCount,
                updatedRecords: updatedCount,
                notFoundRecords: words.length - userWords.length
            }
        });
    } catch (error) {
        console.error('删除单词错误错误:', error);
        res.json({
            code: 500,
            success: false,
            message: '删除单词错误失败'
        });
    }
};
