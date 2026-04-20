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
// mongoose.connect("mongodb://127.0.0.1:27017/dashboard");
mongoose.connect(process.env.MONGO_URI);
const UserSchema = new mongoose.Schema({
    name: String,
    status: String,
    note: String,
    role: String,  // 👈 NEW
    avatar: String   // ✅ ADD THIS

});

const User = mongoose.model("User", UserSchema);


// SOCKET
io.on("connection", async (socket) => {
    console.log("User connected");

    const users = await User.find();
    socket.emit("init", users);

    // ✅ LOGIN (ADD THIS)
    socket.on("login", async (data) => {

        socket.userName = data.name;

        // 👇 normalize for logic
        const key = data.name.toLowerCase();

        // 🎯 avatar map
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

        // 👇 FIX display name (capitalized)
        const displayName =
            data.name.charAt(0).toUpperCase() + data.name.slice(1).toLowerCase();

        let user = await User.findOne({ name: displayName });

        if (!user) {
            user = await User.create({
                name: displayName,   // ✅ store clean name
                status: "Available",
                note: "",
                role: data.role,
                avatar: avatar
            });
        } else {
            user.role = data.role;
            user.avatar = avatar;
            await user.save();
        }

        const users = await User.find();
        io.emit("refresh", users);
    });

    // UPDATE STATUS
    socket.on("updateStatus", async (data) => {
        await User.findOneAndUpdate(
            { name: data.name },
            { status: data.status }
        );

        const users = await User.find();
        io.emit("refresh", users);
    });

    // UPDATE NOTE
    socket.on("updateNote", async (data) => {
        await User.findOneAndUpdate(
            { name: data.name },
            { note: data.note }
        );

        const users = await User.find();
        io.emit("refresh", users);
    });

    // LEADER MESSAGE
    socket.on("leaderMessage", (msg) => {
        const messageData = {
            text: msg,
            time: new Date()
        };
        io.emit("leaderMessage", messageData);
    });

    socket.on("disconnectUser", async (name) => {
        await User.deleteOne({ name });

        const users = await User.find();
        io.emit("refresh", users);
    });
    socket.on("disconnect", async () => {
        if (socket.userName) {
            await User.deleteOne({ name: socket.userName });

            const users = await User.find();
            io.emit("refresh", users);
        }
    });
    socket.on("assignTask", ({ text, target }) => {
        const taskData = {
            text,
            time: new Date(),
            from: "Leader"
        };

        const targetSocket = onlineUsers[target];

        if (targetSocket) {
            io.to(targetSocket).emit("taskAssigned", taskData);
        }
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});