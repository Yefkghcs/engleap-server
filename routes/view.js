const express = require("express");

const router = express.Router();

// 词库
const word_controllers = require("../controllers/view/wordControllers");
router.get("/words", word_controllers.view_word_list);
router.get("/wordUpload", word_controllers.words_upload_get);
router.post("/wordUpload", word_controllers.words_upload_post);
router.get('/wordDeleteAll', word_controllers.words_delete_all_get);
router.post('/wordDeleteAll', word_controllers.words_delete_all_post);
router.get('/wordDeleteByCategory', word_controllers.words_delete_by_category_get);
router.post('/wordDeleteByCategory', word_controllers.words_delete_by_category_post);

// 单词分类
const word_category_controllers = require("../controllers/view/wordCategoryControllers");
router.get("/wordCategoryUpload", word_category_controllers.word_category_upload_get);
router.post("/wordCategoryUpload", word_category_controllers.word_category_upload_post);
router.get("/wordCategoryDelete", word_category_controllers.word_category_delete_get);
router.post("/wordCategoryDelete", word_category_controllers.word_category_delete_post);

// 验证码
const verification_controllers = require("../controllers/view/verificationControllers");
router.get("/generateCode", verification_controllers.generate_code_get);
router.post("/generateCode", verification_controllers.generate_code_post);
router.get("/validateCode/:code", verification_controllers.validate_code);
router.get("/codes", verification_controllers.code_list);

module.exports = router;
