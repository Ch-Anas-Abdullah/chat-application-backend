const mongoose = require("mongoose");

const User = mongoose.model("User");
const Message = mongoose.model("Message");
const PendingMessage = mongoose.model("PendingMessage");
const fs = require("fs");
const sendMessage = (req, res) => {
  try {
    const { id, message, from, to, createdAt, filePath, messageType } =
      req.body;
    if(from != null || from != "undefined"){
      const messageData = new Message({
        _id: id,
        message: message == null || message == "undefined" ? " " : message,
        from: from??"",
        to: to,
        messageType: messageType,
        filePath: filePath,
        createdAt: createdAt,
      });
  
      //save message to server db
      messageData.save().then((newMessage) => {
        const pendingMessageData = new PendingMessage({
          _id: id,
          toUserId: to,
        });
  
        //add message id with to user id
        pendingMessageData.save().then((newPendingMessageData) => {
          const io = req.io;
          //get user socket id from db
          User.findById(to).then((userData) => {
            const socketId = userData.socketId;
            //using req.io emit message to the socket id
            const data = {
              id: id,
              message: message,
              from: from??"",
              to: to,
              messageType: messageType,
              filePath: filePath,
              createdAt: createdAt,
            };
            io.to(socketId).emit("message", data);
  
            console.log(req.url, " ", req.method, "", { message: "Success" });
  
            return res.json({ message: "Success" });
          });
        });
      });
    }
    
  } catch (e) {
    console.log("send message error ", e);
    return res.status(500).json({ status: false, message: "something wrong" });
  }
};

const messageReceived = (req, res) => {
  try {
    const { id, fromId, receivedAt } = req.body;
    Message.findByIdAndRemove(id, (error) => {
      if (error) console.log("message remove error ", error);

      PendingMessage.findByIdAndRemove(id, (err) => {
        if (err) console.log("pending delete error ", err);

        const io = req.io;

        User.findById(fromId).then((userData) => {
          const socketId = userData.socketId;

          io.to(socketId).emit("messageReceived", {
            messageId: id,
            receivedAt: receivedAt,
          });

          console.log(req.url, " ", req.method, "", { message: "Success" });

          return res.json({ message: "Success" });
        });
      });
    });
  } catch (e) {
    console.log("receive message error ", e);
    return res.status(500).json({ status: false, message: "something wrong" });
  }
};

const messageOpened = (req, res) => {
  try {
    const { id, fromId, openedAt } = req.body;

    const io = req.io;

    User.findById(fromId).then((userData) => {
      const socketId = userData.socketId;

      io.to(socketId).emit("messageOpened", {
        messageId: id,
        openedAt: openedAt,
      });

      console.log(req.url, " ", req.method, "", { message: "Success" });

      return res.json({ message: "Success" });
    });
  } catch (e) {
    console.log("OpenedAt message error ", e);
    return res.status(500).json({ status: false, message: "something wrong" });
  }
};
const uploadChatFile = (req, res) => {
  const file = req.file;
  if (file != undefined) {
    res.status(200).json({ status: true, message: "image uploaded", fileName: file.filename });
  } else {
    res.status(400).json({ status: false, message: "file is missing" });
  }
}

const getChatFile = async (req, res) => {
  const fileName = req.params.fileName;
  fs.readFile("chatFiles/" + fileName, (err,data) => {
    if (err) {
      res.status(404).json({ status: false, message: "File not found or Deleted" });
    } else {
      res.download("chatFiles/"+fileName);
    }
  });
  console.log("heyyyyyy")
}
module.exports = {
  sendMessage,
  messageReceived,
  messageOpened,
  uploadChatFile,
  getChatFile
};
