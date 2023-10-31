const router = require("express").Router();

const controller = require("../controller/auth_controller");

const auth = require("../middleware/api_auth");
const multer = require('multer')
const upload = multer()
//create user
router.post("/user", (upload.none()),controller.createUser);

//create user by phone number
router.post("/userRegistration", (upload.none()),controller.userRegistration);

//myData
router.get("/myDetails", auth, controller.myDetails);

module.exports = router;
