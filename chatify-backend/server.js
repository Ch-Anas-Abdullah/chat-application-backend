const bodyParser = require("body-parser");
const express = require("express");
const app = express();
// const functions = require("firebase-functions");
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const port = process.env.PORT || 5000; //added
const mongoose = require("mongoose");
const key = require("./key");
const userController = require("./controller/user_controller");
const { CLIENT_RENEG_LIMIT } = require("tls");
const { Console } = require("console");
const User = mongoose.model("User");
//mongoose connection
// mongoose.connect(key.MONGO_URL, {
//   useNewUrlParser: true,
// });

// mongoose.connection.on("connected", () => console.log("Connected to mongodb"));

// mongoose.connection.on("error", (err) =>
//   console.log("Error on connection ", err)
// );

const databaseUrl = 'mongodb://localhost:27017/whatsappClone';

mongoose.connect(databaseUrl, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => {
    console.log('Connected to MongoDB successfully!');
    // Your code here
  })
  .catch((err) => {
    console.error('Error connecting to MongoDB:', err.message);
  });

require("./models/user");
require("./models/message");
require("./models/pending_message");

app.use(express.json());

app.use(express.static("uploads"));

app.use(bodyParser.urlencoded({ extended: true }));

//set io to req.io for access from all routes
//set server ip to access from every where
app.use((req, res, next) => {
  req.io = io;
  req.serverIp = `http://${req.headers.host}/`;
  return next();
});

//api routes
app.use(require("./routes/auth"));
app.use(require("./routes/user"));
app.use(require("./routes/message"));

//invalid api
app.get("*", (req, res) => {
  console.log("invalid request ", req.method, " ", req.url);
  res.status(401).json({ error: "Invalid Request" });
});

app.post("*", (req, res) => {
  console.log("invalid request ", req.method, " ", req.url);
  res.status(401).json({ error: "Invalid Request" });
});

app.delete("*", (req, res) => {
  console.log("invalid request ", req.method, " ", req.url);
  res.status(401).json({ error: "Invalid Request" });
});

app.put("*", (req, res) => {
  console.log("invalid request ", req.method, " ", req.url);
  res.status(401).json({ error: "Invalid Request" });
});

//socket middleware
io.use(require("./middleware/socket_auth"));
const activeCalls = new Map();
//socket connection
io.on("connection", (socket) => {
  //update user status and socket id
  userController.onUserConnect(socket, io);

  socket.on("connect_error", (err) =>
    console.log(`connect_error due to ${err.message}`)
  );


  socket.on('call:initiate', async (calleeId) => {
    // Handle call initiation logic
    let data = await User.findOne({ _id: calleeId })
    console.log("call initiated by ", socket.id, " to ", data.socketId);
    io.to(data.socketId).emit('call:incoming', calleeId);
  });

  socket.on('call:accept', (callerId) => {
    // Check if the call still exists and the caller is still waiting for acceptance
    if (activeCalls.has(callerId) && activeCalls.get(callerId).state === 'pending') {
      const calleeId = socket.id;
      // Update the call state to 'accepted'
      activeCalls.get(callerId).state = 'accepted';
      activeCalls.get(calleeId).state = 'accepted';
      // Inform the caller that the call is accepted
      io.to(callerId).emit('call:accepted', calleeId);
      // Inform the callee that the call is accepted
      io.to(calleeId).emit('call:accepted', callerId);
    }
  });

  socket.on('call:decline', async (callerId) => {
    let data = await User.findOne({ _id: callerId })
    // Check if the call still exists and the caller is still waiting for acceptance
    if (activeCalls.has(callerId) && activeCalls.get(callerId).state === 'pending') {
      const calleeId = socket.id;
      // Update the call state to 'declined'
      activeCalls.get(callerId).state = 'declined';
      activeCalls.get(calleeId).state = 'declined';
      // Inform the caller that the call is declined
      io.to(data.socketId).emit('call:declined', calleeId);
      // Inform the callee that the call is declined
      io.to(calleeId).emit('call:declined', callerId);
    }
  });

  // Remove the call entry when a user disconnects
  socket.on('disconnect', () => {
    //update last seen, status, socketId
    userController.disconnectUser(socket, io);
    const userId = socket.id;
    if (activeCalls.has(userId)) {
      const call = activeCalls.get(userId);
      const peerId = call.callerId === userId ? call.calleeId : call.callerId;
      io.to(peerId).emit('call:ended');
      activeCalls.delete(userId);
    }
  });

  //socket connection
});

http.listen(port, () => {
  console.log("server started",http.address());
});
// exports.app = functions.https.onRequest(app, () => {
//   console.log("connected to fb functions")
//  });