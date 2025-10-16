const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const CustomWordSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: [true, "用户ID是必需的"],
    },
    id: {
        type: Number,
        required: true
    },
    word: {
        type: String,
        required: true,
        trim: true
    },
    meaning: {
        type: String,
        required: true,
        trim: true
    },
    example: {
        type: String,
        trim: true
    },
    exampleCn: {
        type: String,
        trim: true
    },
    category: {
        type: String,
        required: true
    },
    subcategory: {
        type: String,
        required: true
    },
}, {
    timestamps: true
});

const CustomWordCategorySchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: [true, "用户ID是必需的"],
        index: true,
    },
    category: {
        type: String,
        required: true,
        trim: true,
    },
    categoryName: {
        type: String,
        required: true,
        trim: true
    },
    subcategory: {
        type: String,
        required: true,
        trim: true,
    },
    subcategoryName: {
        type: String,
        required: true,
        trim: true
    },
    emoji: {
        type: String,
        required: true,
        trim: true
    },
}, {
    timestamps: true
});

CustomWordSchema.index({ user: 1, category: 1, subcategory: 1});
CustomWordSchema.index({ user: 1, subcategory: 1});
CustomWordSchema.index({ user: 1, category: 1, subcategory: 1, id: 1 }, { unique: true });

CustomWordCategorySchema.index({ user: 1, subcategory: 1 }, { unique: true });
CustomWordCategorySchema.index({ user: 1, category: 1, subcategory: 1 }, { unique: true });

module.exports = {
    CustomWord: mongoose.model('CustomWord', CustomWordSchema),
    CustomWordCategory: mongoose.model('CustomWordCategory', CustomWordCategorySchema),
};