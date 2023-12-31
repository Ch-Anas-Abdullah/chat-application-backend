const mongoose = require("mongoose");
require("../models/user");
require("../models/message");
require("../models/pending_message");
const fs = require("fs");

const User = mongoose.model("User");
const Message = mongoose.model("Message");
const PendingMessage = mongoose.model("PendingMessage");

const moment = require("moment");

const onUserConnect = (socket, io) => {
  updateSocketId(socket);
  checkPendingMessages(socket);
};

function updateSocketId(socket) {
  User.findByIdAndUpdate(socket.data.userId, {
    $set: { socketId: socket.id },
  }).exec((error) => {
    if (error) return console.log(error);
  });
}

function checkPendingMessages(socket) {
  PendingMessage.find({ toUserId: socket.data.userId })
    .then((data) => {
      data.forEach((element) => {
        //get message content by element._id

        Message.findById(element._id).then((messageData) => {
          if (messageData == null) {
            Message.findByIdAndRemove(element._id);
          } else {
            const data = {
              id: messageData._id,
              message: messageData.message,
              from: messageData.from,
              to: messageData.to,
              messageType: messageData.messageType,
              filePath: messageData.filePath,
              createdAt: messageData.createdAt,
            };

            //send by socket

            socket.emit("message", data);
          }
          //remove from pending
          PendingMessage.findByIdAndRemove(element._id);
        });
      });
    })
    .catch((error) => console.log("check pending error ", error));
}

const disconnectUser = (socket, io) => {
  User.findByIdAndUpdate(socket.data.userId, {
    $set: { socketId: "" },
  }).exec((error) => {
    if (error) return console.log(error);

    let eventString = "/user_status" + socket.data.userId;

    io.emit(eventString, { "status": false, "typing": "" });

    console.log("socket disconnected by ", socket.data.userName);
  });
};

const getUsers = (req, res) => {
  User.find({ _id: { $ne: req.user._id } })
    .select("-__v")
    .then((data) => {
      const result = {
        createdAt: moment().format(),
      };

      result.users = data;

      console.log(req.url, " ", req.method, " ", result);
      return res.json(result);
    })
    .catch((error) =>
      res.status(500).json({ error: "Internal Server Error" + error })
    );
};

const userStatus = (req, res) => {
  const id = req.params.id;

  User.findById(id)
    .select("-__v")
    .then((userData) => {
      const result = {
        createdAt: moment().format(),
        typing: userData.typing ?? '',
        lastSeen: userData.lastSeen ?? '',
        status: userData.status ?? '',
      };

      if (userData) {
        console.log(req.url, " ", req.method, " ", result);

        return res.json(result);
      } else {
        console.log(req.url, " ", req.method, " ", {
          createdAt: moment().format(),
          message: "Invalid user id",
        });

        return res.status(401).json({
          createdAt: moment().format(),
          message: "Invalid user id",
        });
      }
    });
};

const updateUserStatus = (req, res) => {
  const { status, typing } = req.body;
  const userId = req.user._id;

  const io = req.io;

  let updateData = { status: status, typing: typing };

  if (status == "false")
    updateData = { status: false, typing: userId, lastSeen: moment().format() };

  User.findByIdAndUpdate(userId, {
    $set: updateData,
  }).exec((error) => {
    if (error) {
      console.log(req.url, " ", req.method, " ", error);
      return res.status(400).json({
        status: false,
        message: "unable to update",
      });
    } else {
      let eventString = "/user_status" + userId;

      let userStatus = false;

      if (status == "true") userStatus = true;

      io.emit(eventString, { "status": status, "typing": typing });

      const resultData = {
        status: true,
        message: "Successfully updated",
      };
      console.log(req.url, " ", req.method, " ", resultData);

      return res.json(resultData);
    }
  });
};
const checkContactsList = async (req, res) => {
  const { phoneNumbers } = req.body;

  // console.log(req.body);
  // console.log(typeof phoneNumbers);
  let errorMap = {};
  let avalibleContacts = [];
  if (!phoneNumbers) {
    errorMap.error = "Please add phoneNumber List";
    console.log(req.url, " ", req.method, "", errorMap);
    return res.status(422).json(errorMap);
  } else {


    for (let index = 0; index < phoneNumbers.length; index++) {
      let contact = String(phoneNumbers[index]).split("@#%");

      // console.log("Parsed",contact);
      const phoneNumber = contact[0];

      if (phoneNumber.length > 5) {
        let data = await User.findOne({
          $or: [
            { phoneWithDialCode: phoneNumber },
          ],
        });
        if (data != null) {
          let imageUrl;
          if (data.image != undefined) imageUrl = req.serverIp + data.image;
          const result = {
            id: data._id,
            displayName: data.name,
            name: contact[1],
            phoneNumber: contact[0],
            image: imageUrl ?? null,
            about: data.about ?? null,

            createdAt: moment().format(),
          };
          avalibleContacts = [...avalibleContacts, result];
          // console.log("avalible list:", avalibleContacts);
        }
      }

    }
    console.log("Response: ", avalibleContacts);
    return res.status(200).json(avalibleContacts);
  }

};
const getUserDetailsByPhoneNumber = (req, res) => {
  const phoneNumber = req.params.phone;

  if (phoneNumber.length > 5) {
    User.findOne({ phoneWithDialCode: phoneNumber }, (error, data) => {
      if (data != null) {
        let imageUrl;
        if (data.image != undefined) imageUrl = req.serverIp + data.image;
        const result = {
          id: data._id,
          name: data.name,
          phoneNumber: data.phoneNumber,
          image: imageUrl,
          about: data.about,
          createdAt: moment().format(),
        };

        console.log(req.url, " ", req.method, " ", result);
        return res.json(result);
      } else {
        const result = { status: false, message: "User not found" };

        console.log(req.url, " ", req.method, " ", result);
        return res.status(404).json(result);
      }
    });
  } else {
    const result = { status: false, message: "Invalid number" };

    console.log(req.url, " ", req.method, " ", result);
    return res.status(400).json(result);
  }
};

const getUserDetailsById = (req, res) => {
  const id = req.params.id;

  User.findOne({ _id: id }, (error, data) => {
    if (data != null) {
      let imageUrl;
      if (data.image != undefined) imageUrl = req.serverIp + data.image;
      const result = {
        id: data._id,
        name: data.name,
        phoneNumber: data.phoneNumber,
        image: imageUrl,
        about: data.about,
        createdAt: moment().format(),
      };

      console.log(req.url, " ", req.method, " ", result);
      return res.json(result);
    } else {
      const result = { status: false, message: "User not found" };

      console.log(req.url, " ", req.method, " ", result);
      return res.status(404).json(result);
    }
  });
};

const uploadProfileImage = async (req, res, next) => {
  const file = req.file;
  const serverIp = req.serverIp;
  const userId = req.user._id;
  const fileName = file.filename;
  if (file != undefined) {
    var data = await User.findOne({ _id: userId });
    fs.unlink("uploads/" + data.image, (err) => {
      if (err) {

      } else {
        console.log("Delete File successfully.");
      }
    });
    User.findByIdAndUpdate(userId, {
      $set: { image: fileName },
    }).exec((error) => {
      if (error) {
        const result = {
          status: false,
          message: "Unable to upload image",
          error,
        };

        console.log(req.url, " ", req.method, "", result, error);

        return res.json(result);
      } else {
        const result = {
          status: true,
          message: "Successfully updated",
          ImageUrl: serverIp + fileName,
        };

        console.log(req.url, " ", req.method, "", result);

        return res.json(result);
      }
    });
  } else {
    const result = {
      status: false,
      message: "file is missing",
    };

    console.log(req.url, " ", req.method, "", result);

    return res.status(404).json(result);
  }
};

const userNameUpdate = (req, res) => {
  const { name } = req.body;
  const userId = req.user._id;

  let updateData = { name: name };

  User.findByIdAndUpdate(userId, {
    $set: updateData,
  }).exec((error) => {
    if (error) {
      const result = {
        status: false,
        message: "Unable to update user name",
      };

      console.log(req.url, " ", req.method, "", result, error);

      return res.json(result);
    } else {
      const result = {
        status: true,
        message: "User name update successfully",
        name,
      };

      console.log(req.url, " ", req.method, "", result);

      return res.json(result);
    }
  });
};

const userAboutUpdate = (req, res) => {
  const { name } = req.body;
  const userId = req.user._id;

  let updateData = { about: name };

  User.findByIdAndUpdate(userId, {
    $set: updateData,
  }).exec((error) => {
    if (error) {
      const result = {
        status: false,
        message: "Unable to update user about",
      };

      console.log(req.url, " ", req.method, "", result, error);

      return res.json(result);
    } else {
      const result = {
        status: true,
        message: "User about update successfully",
        name,
      };

      console.log(req.url, " ", req.method, "", result);

      return res.json(result);
    }
  });
};

module.exports = {
  onUserConnect,
  disconnectUser,
  getUsers,
  userStatus,
  checkContactsList,
  updateUserStatus,
  userNameUpdate,
  getUserDetailsByPhoneNumber,
  getUserDetailsById,
  uploadProfileImage,
  userAboutUpdate
};
