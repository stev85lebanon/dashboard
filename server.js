// LEAVE MANUALLY
socket.on("disconnectUser", async (name) => {

    // remove from mongodb
    await User.deleteOne({
        name: new RegExp("^" + name + "$", "i")
    });

    // remove from online users
    delete onlineUsers[name.toLowerCase()];

    // ✅ clear tasks if nobody online
    if (Object.keys(onlineUsers).length === 0) {
        tasks = [];
        taskId = 0;

        console.log("All users left → tasks cleared");
    }

    // refresh all clients
    io.emit("refresh", await User.find());
    io.emit("taskUpdate", tasks);
});


// AUTO DISCONNECT (tab close / internet lost / refresh)
socket.on("disconnect", async () => {

    if (socket.userName) {

        // remove from online users
        delete onlineUsers[socket.userName];

        // remove from mongodb
        await User.deleteOne({
            name: new RegExp("^" + socket.userName + "$", "i")
        });

        // ✅ clear tasks if nobody online
        if (Object.keys(onlineUsers).length === 0) {
            tasks = [];
            taskId = 0;

            console.log("All users disconnected → tasks cleared");
        }

        // refresh all clients
        io.emit("refresh", await User.find());
        io.emit("taskUpdate", tasks);
    }
});