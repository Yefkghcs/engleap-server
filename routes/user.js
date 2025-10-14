const express = require('express');
const router = express.Router();

const auth_controllers = require("../controllers/api/authControllers");

// 用户注册
router.post("/register", auth_controllers.register);

// 用户登录
router.post("/login", auth_controllers.login);

// 用户登出
router.post("/logout", auth_controllers.logout);

// 获取当前用户信息
router.get("/me", auth_controllers.getCurrentUser);


module.exports = router;
