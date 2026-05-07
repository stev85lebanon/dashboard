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

const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

// ======================
// MONGODB
// ======================

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB connected"))
    .catch(err => console.log(err));

// ======================
// USER MODEL
// ======================

const UserSchema = new mongoose.Schema({
    name: String,
    status: String,
    note: String,
    role: String,
    avatar: String,
    location: {
        type: String,
        default: "On-site"
    }
});

const User = mongoose.model("User", UserSchema);

// ======================
// MEMORY STORAGE
// ======================

const onlineUsers = {};

let tasks = [];
let taskId = 0;

// ======================
// SOCKET CONNECTION
// ======================

io.on("connection", async (socket) => {

    console.log("User connected");

    // SEND INITIAL DATA
    socket.emit("init", await User.find());
    socket.emit("taskUpdate", tasks);

    // ======================
    // LOGIN
    // ======================

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

        const avatar =
            avatars[key] || "/images/default.png";

        const displayName =
            data.name.charAt(0).toUpperCase() +
            data.name.slice(1).toLowerCase();

        let user = await User.findOne({
            name: displayName
        });

        if (!user) {

            await User.create({
                name: displayName,
                status: "Available",
                note: "",
                role: data.role,
                avatar,
                location: "On-site"
            });

        } else {

            user.role = data.role;
            user.avatar = avatar;

            await user.save();
        }

        io.emit("refresh", await User.find());
    });

    // ======================
    // UPDATE STATUS
    // ======================

    socket.on("updateStatus", async (data) => {

        await User.findOneAndUpdate(
            { name: data.name },
            { status: data.status }
        );

        io.emit("refresh", await User.find());
    });

    // ======================
    // UPDATE NOTE
    // ======================

    socket.on("updateNote", async (data) => {

        await User.findOneAndUpdate(
            { name: data.name },
            { note: data.note }
        );

        io.emit("refresh", await User.find());
    });

    // ======================
    // UPDATE LOCATION
    // ======================

    socket.on("updateLocation", async ({ name, location }) => {

        await User.findOneAndUpdate(
            {
                name: new RegExp("^" + name + "$", "i")
            },
            {
                location
            }
        );

        io.emit("refresh", await User.find());
    });

    // ======================
    // LEADER MESSAGE
    // ======================

    socket.on("leaderMessage", (msg) => {

        io.emit("leaderMessage", {
            text: msg,
            time: new Date()
        });
    });

    // ======================
    // ASSIGN TASK
    // ======================

    socket.on("assignTask", ({ text, target }) => {

        const task = {
            id: taskId++,
            text,
            target,
            status: "pending",
            time: new Date()
        };

        tasks.unshift(task);

        io.emit("taskUpdate", tasks);
    });

    // ======================
    // COMPLETE TASK
    // ======================

    socket.on("completeTask", (id) => {

        tasks = tasks.filter(t => t.id !== id);

        io.emit("taskUpdate", tasks);
    });

    // ======================
    // BLOCK TASK
    // ======================

    socket.on("blockTask", ({ id, reason }) => {

        tasks = tasks.filter(t => t.id !== id);

        io.emit("taskUpdate", tasks);

        const blockedTask =
            tasks.find(t => t.id === id);

        if (blockedTask) {

            const leaderSocket =
                onlineUsers["casper"];

            if (leaderSocket) {

                io.to(leaderSocket).emit(
                    "leaderMessage",
                    {
                        text:
                            `${blockedTask.target} cannot complete "${blockedTask.text}" → ${reason}`,
                        time: new Date()
                    }
                );
            }
        }
    });

    // ======================
    // PRIVATE MESSAGE
    // ======================

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
            io.to(targetSocket).emit(
                "privateMessage",
                message
            );
        }

        // send back to sender
        socket.emit("privateMessage", message);
    });

    // ======================
    // USER LEAVE
    // ======================

    socket.on("disconnectUser", async (name) => {

        await User.deleteOne({
            name: new RegExp("^" + name + "$", "i")
        });

        delete onlineUsers[name.toLowerCase()];

        // REMOVE USER TASKS
        tasks = tasks.filter(
            t => t.target !== name.toLowerCase()
        );

        io.emit("taskUpdate", tasks);

        io.emit("refresh", await User.find());
    });

    // ======================
    // DISCONNECT
    // ======================

    socket.on("disconnect", async () => {

        if (socket.userName) {

            delete onlineUsers[socket.userName];

            await User.deleteOne({
                name: new RegExp(
                    "^" + socket.userName + "$",
                    "i"
                )
            });

            // REMOVE USER TASKS
            tasks = tasks.filter(
                t => t.target !== socket.userName
            );

            io.emit("taskUpdate", tasks);

            io.emit("refresh", await User.find());
        }

        console.log("User disconnected");
    });

});

// ======================
// SERVER
// ======================

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {

    console.log(
        "Server running on port " + PORT
    );

});