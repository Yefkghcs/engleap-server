const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const UserWordSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: [true, "用户ID是必需的"],
    },
    // 新增业务字段
    wordCategory: {
        type: String,
        required: [true, "单词分类是必需的"],
    },
    wordSubcategory: {
        type: String,
        required: [true, "单词子分类是必需的"],
    },
    wordId: {
        type: String,
        required: [true, "单词业务ID是必需的"],
    },
    status: {
        type: String,
        enum: ["unmarked", "unknown", "known"], // 状态可能为：未标记 / 不认识 / 认识
        default: "unmarked",
    },
    mistakes: { // 错误列表，计入每一次错误的时间，用于根据时间筛选当天的错误单词
        type: [String],
        default: [],
    },
}, {
    timestamps: true
});

// 复合索引，确保每个用户对同一个单词只有一条记录（基于业务字段）
UserWordSchema.index({ 
    user: 1, 
    wordCategory: 1, 
    wordSubcategory: 1, 
    wordId: 1 
}, { unique: true });

// 为查询优化添加的索引
UserWordSchema.index({ user: 1, status: 1 });
UserWordSchema.index({ 
    user: 1, 
    wordCategory: 1, 
    wordSubcategory: 1 
});
UserWordSchema.index({ 
    user: 1, 
    status: 1, 
    wordSubcategory: 1 
});

UserWordSchema.index({ user: 1, mistakes: 1 });
UserWordSchema.index({ 
    user: 1, 
    mistakes: { $exists: true } 
});

module.exports = mongoose.model('UserWord', UserWordSchema);