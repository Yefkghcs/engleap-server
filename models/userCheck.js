const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const UserCheckSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: [true, "用户ID是必需的"],
        index: true
    },
    total: {
        type: Number,
        required: true,
    },
    weekStatus: {
        type: [Boolean],
        required: true,
    },
});

// 添加索引以提高查询性能
UserCheckSchema.index({ user: 1 });

module.exports = mongoose.model('UserCheck', UserCheckSchema);
