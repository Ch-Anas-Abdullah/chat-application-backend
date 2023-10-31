const router = require("express").Router();

const controller = require("../controller/message_controller");

const auth = require("../middleware/api_auth");
const multer = require("multer");
const path = require("path");
const fs = require('fs');


//sendMessage
router.post("/sendMessage", auth, controller.sendMessage);

//messageReceived
router.put("/receivedMessageUpdate", auth, controller.messageReceived);

//messageOpened
router.put("/openedMessageUpdate", auth, controller.messageOpened);




const storage = multer.diskStorage({
  destination: "chatFiles/",
  filename: (req, file, cb) => {
    // const newFileName = req.user._id;
    const newFileName = Date.now();

    cb(null, "WA" + newFileName + path.extname(file.originalname));
  },
});
const upload = multer({
  storage: storage,
});

router.post(
  "/userFiles",
  auth,
  upload.single("file"),
  controller.uploadChatFile
);
router.get("/chatFiles/:fileName", auth, controller.getChatFile);
module.exports = router;



const directoryPath = '/path/to/your/directory';

// Function to calculate the date 30 days ago
function getDateThirtyDaysAgo() {
  const currentDate = new Date();
  currentDate.setDate(currentDate.getDate() - 30);
  return currentDate;
}

// Function to recursively delete files older than 30 days
function deleteFiles(directory) {
  fs.readdir(directory, (err, files) => {
    if (err) throw err;

    for (const file of files) {
      const filePath = path.join(directory, file);
      fs.stat(filePath, (err, stat) => {
        if (err) throw err;

        const thirtyDaysAgo = getDateThirtyDaysAgo();
        if (stat.isFile() && stat.mtime < thirtyDaysAgo) {
          fs.unlink(filePath, (err) => {
            if (err) throw err;
            console.log(`Deleted ${filePath}`);
          });
        } else if (stat.isDirectory()) {
          deleteFiles(filePath); 
        }
      });
    }
  });
}