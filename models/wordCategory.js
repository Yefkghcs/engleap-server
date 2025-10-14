const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const WordCategorySchema = new Schema({
    category: { type: String, required: true },
    categoryName: { type: String, required: true },
    subcategory: { type: String, required: true },
    subcategoryName: { type: String, required: true },
});

module.exports = mongoose.model("WordCategory", WordCategorySchema);