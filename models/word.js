const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const WordSchema = new Schema({
    id: { type: Number, required: true },
    category: { type: String, required: true },
    subcategory: { type: String, required: true },
    word: { type: String, required: true },
    meaning: { type: String, required: true },
    phonetic: { type: String, required: true },
    // audio: { type: String, required: true },
    audio: { type: String },
    partOfSpeech: {
        type: [String],
        required: true,
        default: [],
        // validate: {
        //     validator: function(array) {
        //         // TODO 词库确认后，完善词性列表
        //         const allowedValues = ["n.", "v.", "adj.", "adv.", "pron.", "prep.", "conj.", "interj.", "phrase"];

        //         const uniqueItems = [...new Set(array)];
        //         const noDuplicates = array.length === uniqueItems.length;

        //         const allValid = array.every(item => allowedValues.includes(item));

        //         if (Array.isArray(array) && noDuplicates) return allValid;
        //         return false;
        //     },
        //     message: props => `部分词性值 '${props.value}' 不在允许的列表中，或存在重复值。允许的值: noun, verb, adjective, adverb, pronoun, preposition, conjunction`
        // }
    },
    example: { type: String, required: true },
    exampleCn: { type: String, required: true },
    // exampleAudio: { type: String, required: true },
    exampleAudio: { type: String },
    // collocation: { type: String, required: true },
    // collocationCn: { type: String, required: true },
    // collocationAudio: { type: String, required: true },
    // collocationAudio: { type: String },
});

module.exports = mongoose.model("Word", WordSchema);
