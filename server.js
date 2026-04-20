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

        // 🎯 assign avatar based on name
        let avatar = "/images/default.png";

        if (data.name === "Amir") avatar = "/images/amir.jpg";
        if (data.name === "Casper") avatar = "/images/casper.jpg";
        if (data.name === "John") avatar = "/images/john.jpg";
        if (data.name === "Lina") avatar = "/images/lina.jpg";
        if (data.name === "Mustafa") avatar = "/images/mustafa.jpg";
        if (data.name === "Sara") avatar = "/images/sara.jpg";
        if (data.name === "Yasin") avatar = "/images/yasin.jpg";

        let user = await User.findOne({ name: data.name });

        if (!user) {
            user = await User.create({
                name: data.name,
                status: "Available",
                note: "",
                role: data.role,
                avatar: avatar   // ✅ SAVE IT
            });
        } else {
            user.role = data.role;
            user.avatar = avatar; // update if needed
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
        io.emit("leaderMessage", msg);
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
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});