require("dotenv").config();

const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const server = http.createServer(app);
const io = new Server(server);

// MongoDB
mongoose.connect(process.env.MONGO_URI);

const UserSchema = new mongoose.Schema({
    name: String,
    status: String,
    note: String,
    role: String,
    avatar: String
});

const User = mongoose.model("User", UserSchema);

// 🔑 Track online users
const onlineUsers = {};

// SOCKET
io.on("connection", async (socket) => {
    console.log("User connected");

    const users = await User.find();
    socket.emit("init", users);

    socket.on("login", async (data) => {
        socket.userName = data.name;
        onlineUsers[data.name] = socket.id;

        const displayName =
            data.name.charAt(0).toUpperCase() +
            data.name.slice(1).toLowerCase();

        let user = await User.findOne({ name: displayName });

        if (!user) {
            user = await User.create({
                name: displayName,
                status: "Available",
                note: "",
                role: data.role,
                avatar: "/images/default.png"
            });
        }

        const users = await User.find();
        io.emit("refresh", users);
    });

    socket.on("updateStatus", async (data) => {
        await User.findOneAndUpdate(
            { name: data.name },
            { status: data.status }
        );

        io.emit("refresh", await User.find());
    });

    socket.on("updateNote", async (data) => {
        await User.findOneAndUpdate(
            { name: data.name },
            { note: data.note }
        );

        io.emit("refresh", await User.find());
    });

    // 🔔 Broadcast message
    socket.on("leaderMessage", (msg) => {
        const messageData = {
            text: msg,
            time: new Date()
        };

        io.emit("leaderMessage", messageData);
    });

    // 📌 Assign task to specific user
    socket.on("assignTask", ({ text, target }) => {
        const taskData = {
            text,
            time: new Date()
        };

        const targetSocket = onlineUsers[target];

        if (targetSocket) {
            io.to(targetSocket).emit("taskAssigned", taskData);
        }
    });

    socket.on("disconnect", async () => {
        if (socket.userName) {
            delete onlineUsers[socket.userName];
            await User.deleteOne({ name: socket.userName });

            io.emit("refresh", await User.find());
        }
    });
});

server.listen(3000, () => {
    console.log("Server running on port 3000");
});