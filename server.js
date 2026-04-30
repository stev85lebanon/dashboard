require("dotenv").config();
// ✅ declare FIRST
let tasks = [];
let taskId = 0;
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

// MongoDB (local or Atlas)
mongoose.connect(process.env.MONGO_URI);
const UserSchema = new mongoose.Schema({
    name: String,
    status: String,
    note: String,
    role: String,
    avatar: String,
    location: { type: String, default: "On-site" } // ✅ ADD THIS

});

const User = mongoose.model("User", UserSchema);

// ✅ store online users
const onlineUsers = {};



io.on("connection", async (socket) => {
    console.log("User connected");

    socket.emit("init", await User.find());
    socket.emit("taskUpdate", tasks); // send tasks on connect

    // LOGIN
    socket.on("login", async (data) => {
        const key = data.name.toLowerCase();
        socket.userName = key;
        onlineUsers[key] = socket.id;

        const avatars = {
            amir: "/images/amir.jpg",
            casper: "/images/casper.jpg",
            john: "/images/john.jpg",
            lina: "/images/lina.jpg",
            mustafa: "/images/mustafa.jpg",
            sara: "/images/sara.jpg",
            yasin: "/images/yasin.jpg"
        };

        const avatar = avatars[key] || "/images/default.png";

        const displayName =
            data.name.charAt(0).toUpperCase() +
            data.name.slice(1).toLowerCase();

        let user = await User.findOne({ name: displayName });

        if (!user) {
            await User.create({
                name: displayName,
                status: "Available",
                note: "",
                role: data.role,
                avatar
            });
        } else {
            user.role = data.role;
            user.avatar = avatar;
            await user.save();
        }

        io.emit("refresh", await User.find());
    });

    // STATUS
    socket.on("updateStatus", async (data) => {
        await User.findOneAndUpdate(
            { name: data.name },
            { status: data.status }
        );
        io.emit("refresh", await User.find());
    });

    // NOTE
    socket.on("updateNote", async (data) => {
        await User.findOneAndUpdate(
            { name: data.name },
            { note: data.note }
        );
        io.emit("refresh", await User.find());
    });

    // LEADER MESSAGE
    socket.on("leaderMessage", (msg) => {
        io.emit("leaderMessage", {
            text: msg,
            time: new Date()
        });
    });

    // ✅ ASSIGN TASK (NEW)
    socket.on("assignTask", ({ text, target }) => {
        const task = {
            id: taskId++,
            text,
            target, // lowercase
            status: "pending",
            time: new Date()
        };

        tasks.unshift(task);

        io.emit("taskUpdate", tasks); // send to everyone
    });

    // ✅ COMPLETE TASK
    socket.on("completeTask", (id) => {
        tasks = tasks.map(t =>
            t.id === id
                ? { ...t, status: "done", completedAt: new Date() }
                : t
        );

        io.emit("taskUpdate", tasks);
    });
    socket.on("blockTask", ({ id, reason }) => {
        const task = tasks.find(t => t.id === id);

        tasks = tasks.map(t =>
            t.id === id
                ? {
                    ...t,
                    status: "blocked",
                    reason,
                    blockedAt: new Date()
                }
                : t
        );

        io.emit("taskUpdate", tasks);


    });

    // LEAVE
    socket.on("disconnectUser", async (name) => {
        await User.deleteOne({
            name: new RegExp("^" + name + "$", "i")
        });

        delete onlineUsers[name.toLowerCase()];
        io.emit("refresh", await User.find());
    });

    socket.on("disconnect", async () => {
        if (socket.userName) {
            delete onlineUsers[socket.userName];

            await User.deleteOne({
                name: new RegExp("^" + socket.userName + "$", "i")
            });

            io.emit("refresh", await User.find());
        }
    });

    socket.on("updateLocation", async ({ name, location }) => {
        await User.findOneAndUpdate(
            { name: new RegExp("^" + name + "$", "i") }, // ✅ case insensitive
            { location }
        );

        io.emit("refresh", await User.find());
    });
    socket.on("privateMessage", ({ to, text }) => {
        const targetSocket = onlineUsers[to];

        const message = {
            from: socket.userName,
            to,
            text,
            time: new Date()
        };

        // send to receiver
        if (targetSocket) {
            io.to(targetSocket).emit("privateMessage", message);
        }

        // send back to sender
        socket.emit("privateMessage", message);
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});