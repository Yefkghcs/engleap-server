const express = require("express");
const router = express.Router();

// 登录
const auth_controllers = require("../controllers/api/authControllers");
router.post("/user/register", auth_controllers.register);
router.post("/user/login", auth_controllers.login);
router.post("/user/logout", auth_controllers.logout);
router.get("/user/current", auth_controllers.getCurrentUser);
router.post("/user/changePwd", auth_controllers.changePassword);

// 打卡
const check_controllers = require("../controllers/api/userCheckControllers");
router.post("/user/check/get", check_controllers.getCheckData);
router.post("/user/check/add", check_controllers.addUserCheck);

// 词库
const word_controllers = require("../controllers/api/wordControllers");
const word_category_controllers = require("../controllers/api/wordCategoryControllers");
router.get("/words/get", word_controllers.word_list);
router.post("/words/get", word_controllers.word_list);
router.get("/wordCategories/get", word_category_controllers.word_category_list);

// 用户词库
const user_word_controllers = require("../controllers/api/userWordControllers");
router.post("/userWords/total/get", user_word_controllers.getTotalData);
router.post("/userWords/get", user_word_controllers.getAllUserWords);
router.post("/userWords/status/all/get", user_word_controllers.getAllWordsByStatus);
router.post("/userWords/status/get", user_word_controllers.getWordsByStatus);
router.post("/userWords/mark", user_word_controllers.markWordStatus);
router.post("/userWords/mark", user_word_controllers.markWordStatus);
router.post("/userWords/mistakes/add", user_word_controllers.recordWordMistake);
router.post("/userWords/mistakes/get", user_word_controllers.getAllMistakeWords);
router.post("/userWords/mistakes/date/get", user_word_controllers.getMistakeWordsByDate);
router.post("/userWords/mistakes/delete", user_word_controllers.deleteWordMistake);

module.exports = router;
