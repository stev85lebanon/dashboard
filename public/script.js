const socket = io();

let currentUser = "";
let isLeader = false;
let leaderMessages = [];
let myTasks = [];
let team = [];

// LOGIN
function login() {
    const name = document.getElementById("userName").value;

    if (!name) return;

    currentUser = name;
    isLeader = name === "casper";

    socket.emit("login", {
        name,
        role: isLeader ? "leader" : "employee"
    });

    document.getElementById("login").style.display = "none";
    document.getElementById("app").style.display = "block";

    if (!isLeader) {
        document.getElementById("leaderPanel").style.display = "none";
    }
}

// SOCKET EVENTS
socket.on("init", (data) => {
    team = data;
    render();
});

socket.on("refresh", (data) => {
    team = data;
    render();
});

// 🔔 leader messages
socket.on("leaderMessage", (msg) => {
    leaderMessages.push(msg);

    if (leaderMessages.length > 20) {
        leaderMessages.shift();
    }

    renderLeaderMessages();
});

// 📌 tasks
socket.on("taskAssigned", (task) => {
    myTasks.push(task);
    renderTasks();
});

// RENDER MESSAGES
function renderLeaderMessages() {
    const container = document.getElementById("leaderMessages");

    let html = "";
    let lastLabel = "";

    leaderMessages.forEach(msg => {
        const d = new Date(msg.time);

        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);

        let label = d.toLocaleDateString();

        if (d.toDateString() === today.toDateString()) {
            label = "Today";
        } else if (d.toDateString() === yesterday.toDateString()) {
            label = "Yesterday";
        }

        if (label !== lastLabel) {
            html += `<div class="date-label">${label}</div>`;
            lastLabel = label;
        }

        const time = d.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        });

        html += `
            <div class="msg">
                <span>${time}</span> 👨‍💼 ${msg.text}
            </div>
        `;
    });

    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

// RENDER TASKS
function renderTasks() {
    const container = document.getElementById("tasks");

    container.innerHTML = myTasks.map(t => `
        <div class="task">
            📌 ${t.text}
            <span>${new Date(t.time).toLocaleTimeString()}</span>
        </div>
    `).join("");
}

// SEND BROADCAST
function sendInstruction() {
    const input = document.getElementById("leaderInput");

    if (!input.value.trim()) return;

    socket.emit("leaderMessage", input.value);
    input.value = "";
}

// SEND TASK
function assignTask() {
    const input = document.getElementById("taskInput");
    const user = document.getElementById("taskUser").value;

    if (!input.value.trim()) return;

    socket.emit("assignTask", {
        text: input.value,
        target: user
    });

    input.value = "";
}

// POPULATE USERS
function render() {
    const select = document.getElementById("taskUser");

    if (!select) return;

    select.innerHTML = "";

    team.forEach(u => {
        if (u.role !== "leader") {
            select.innerHTML += `
                <option value="${u.name}">${u.name}</option>
            `;
        }
    });
}