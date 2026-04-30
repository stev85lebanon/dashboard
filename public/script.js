const socket = io();

let currentUser = "";
let isLeader = false;
let leaderMessages = [];
let team = [];
let allTasks = [];
let currentChatUser = "";
let chats = {}; // store messages per user
let unread = {}; // { user: count }
const statuses = ["Available", "Busy", "Focused", "In Meeting"];

// LOGIN
function login() {
    const name = document.getElementById("userName").value;

    if (!name) return alert("Select a user");

    currentUser = name.toLowerCase();
    isLeader = currentUser === "casper";

    socket.emit("login", {
        name,
        role: isLeader ? "leader" : "employee"
    });

    document.getElementById("login").style.display = "none";
    document.getElementById("app").style.display = "block";

    if (!isLeader) {
        document.getElementById("leaderPanel").style.display = "none";
    }
    if (!isLeader) {
        document.getElementById("chatToggle").style.display = "inline-block";
    }
}

// SOCKET
socket.on("init", (data) => {
    team = data;
    render();
});

socket.on("refresh", (data) => {
    team = data;
    render();
});

socket.on("taskUpdate", (tasks) => {
    allTasks = tasks;
    renderTasks();
});

socket.on("leaderMessage", (msg) => {
    leaderMessages.unshift(msg);

    if (leaderMessages.length > 10) {
        leaderMessages.pop();
    }

    renderLeaderMessages();
});

socket.on("privateMessage", (msg) => {
    const otherUser =
        msg.from === currentUser ? msg.to : msg.from;

    if (!chats[otherUser]) chats[otherUser] = [];

    chats[otherUser].push(msg);

    // ✅ IMPORTANT: add this back
    if (otherUser !== currentChatUser) {
        unread[otherUser] = (unread[otherUser] || 0) + 1;

        // 🔊 sound
        new Audio("https://www.soundjay.com/buttons/sounds/button-3.mp3").play();

        // 🔔 notification
        if (Notification.permission === "granted") {
            const n = new Notification("💬 " + msg.from, {
                body: msg.text,
                tag: msg.from + "-" + Date.now(),
                renotify: true
            });

            n.onclick = () => {
                window.focus();
                openChat(otherUser);
            };
        }
    }

    render();

    if (otherUser === currentChatUser) {
        renderChat();
    }
});
// RENDER USERS
function render() {
    const container = document.getElementById("dashboard");
    container.innerHTML = "";

    // ✅ ADD THIS
    let available = 0;
    let busy = 0;
    let focused = 0;

    team.forEach((p) => {
        const isMe = p.name.toLowerCase() === currentUser;

        // ✅ COUNT STATUS
        if (p.status === "Available") available++;
        if (p.status === "Busy") busy++;
        if (p.status === "Focused") focused++;

        if (p.role === "leader") return;

        const card = document.createElement("div");
        card.className = "card " + (isMe ? "me" : "");

        const statusClass = p.status.toLowerCase().replace(/\s+/g, "-");

        card.innerHTML = `
<div class="user-header">
    <div class="avatar">
        <img src="${p.avatar || '/images/default.png'}"/>
    </div>

    <h3>
        ${p.name}
        ${isMe ? `<span class="you-badge">YOU</span>` : ""}
    </h3>
</div>

<div class="status status-${statusClass}">
    ${p.status}
</div>

<div class="location-badge">
    ${p.location === "Remote" ? "🏠 Remote" : "🏢 On-site"}
</div>

<div class="note-box">
    ${p.note || "No update"}
</div>

${!isMe ? `
    <div class="card-actions">
        <button class="chat-btn" onclick="openChat('${p.name.toLowerCase()}')">
    💬 Message
    ${unread[p.name.toLowerCase()] ? `
        <span class="badge">${unread[p.name.toLowerCase()]}</span>
    ` : ""}
</button>
    </div>
` : ""}

${isMe ? `
    <input placeholder="Write update"
        onkeydown="handleNote(event, '${p.name}')">

    <select onchange="updateStatus('${p.name}', this.value)">
        ${statuses.map(s =>
            `<option ${s === p.status ? "selected" : ""}>${s}</option>`
        ).join("")}
    </select>

    <div class="actions">
        <button onclick="updateLocation('${p.name}','On-site')">🏢</button>
        <button onclick="updateLocation('${p.name}','Remote')">🏠</button>
    </div>
` : ""}
`;

        container.appendChild(card);
    });

    // ✅ UPDATE UI
    document.getElementById("available").innerText = available;
    document.getElementById("busy").innerText = busy;
    document.getElementById("focused").innerText = focused;

    populateTaskUsers();

}

// STATUS
function updateStatus(name, status) {
    socket.emit("updateStatus", { name, status });
}

// NOTE
function handleNote(e, name) {
    if (e.key === "Enter") {
        socket.emit("updateNote", {
            name,
            note: e.target.value
        });
        e.target.value = "";
    }
}

// POPULATE USERS
function populateTaskUsers() {
    const select = document.getElementById("taskUserSelect");
    if (!select) return;

    select.innerHTML = "";

    team.forEach(user => {
        if (user.role !== "leader") {
            const option = document.createElement("option");
            option.value = user.name.toLowerCase();
            option.textContent = user.name;
            select.appendChild(option);
        }
    });
}

// ASSIGN TASK
function assignTask() {
    const input = document.getElementById("taskInput");
    const user = document.getElementById("taskUserSelect").value;

    if (!input.value.trim()) return;

    socket.emit("assignTask", {
        text: input.value,
        target: user
    });

    input.value = "";
}

// RENDER TASKS
function renderTasks() {
    const container = document.getElementById("taskList");

    let visibleTasks = isLeader
        ? allTasks
        : allTasks.filter(t => t.target === currentUser);

    container.innerHTML = visibleTasks.map(task => {

        // ✅ calculate times per task (CORRECT place)
        const doneTime = task.completedAt
            ? new Date(task.completedAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            })
            : "";

        const blockedTime = task.blockedAt
            ? new Date(task.blockedAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            })
            : "";

        return `
        <div style="
            padding:10px;
            margin:6px;
            border-radius:8px;
            background:
                ${task.status === "done" ? "#d4edda" :
                task.status === "blocked" ? "#f8d7da" : "#fff"};
        ">
            ${isLeader ? `<b>${task.target}</b>: ` : ""}

            <div class="task-text">
                ${task.text}
            </div>

            <div class="task-time">
                🕒 ${new Date(task.time).toLocaleString()}
            </div>

            ${task.status === "pending" && !isLeader ? `
                <div class="task-actions">
                    <button class="btn done-btn" onclick="completeTask(${task.id})">
                        ✅ Done
                    </button>

                    <button class="btn block-btn" onclick="blockTask(${task.id})">
                        ❌ Not possible
                    </button>
                </div>
            ` : ""}

            ${task.status === "done" ? `
                <div style="color:green;font-weight:bold;">
                    ✔ Completed at ${doneTime}
                </div>
            ` : ""}

            ${task.status === "blocked" ? `
                <div style="color:red;font-weight:bold;">
                    ❌ Not possible at ${blockedTime}<br/>
                    <small>${task.reason}</small>
                </div>
            ` : ""}
        </div>
        `;
    }).join("");
}

// COMPLETE TASK
function completeTask(id) {
    socket.emit("completeTask", id);
}
function blockTask(id) {
    const reason = prompt("Why is this task not possible?");

    if (!reason) return;

    socket.emit("blockTask", {
        id,
        reason
    });
}
// LEAVE
function leave() {
    const confirmLeave = confirm("Are you sure you want to leave?");
    if (!confirmLeave) return;
    socket.emit("disconnectUser", currentUser);
    location.reload();
}
function sendInstruction() {
    const input = document.getElementById("leaderInput");
    const msg = input.value;

    if (!msg.trim()) return;

    socket.emit("leaderMessage", msg);

    input.value = "";
}
function renderLeaderMessages() {
    const container = document.getElementById("leaderMessages");

    container.innerHTML = leaderMessages.map(msg => {
        const time = new Date(msg.time);

        const formattedTime = time.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
            <div class="leader-message-item">
                <div class="msg-text">👨‍💼 ${msg.text}</div>
                <div class="msg-time">${formattedTime}</div>
            </div>
        `;
    }).join("");
}
function updateLocation(name, location) {
    socket.emit("updateLocation", { name, location });
}

function openChat(user) {
    currentChatUser = user;

    // ✅ reset unread
    unread[user] = 0;

    document.getElementById("chatBox").style.display = "block";
    document.getElementById("chatTitle").innerText =
        "Chat with " + user;

    render(); // refresh UI
    renderChat();
}
function sendMessage() {
    const input = document.getElementById("chatInput");
    const text = input.value;

    if (!text.trim()) return;

    socket.emit("privateMessage", {
        to: currentChatUser,
        text
    });

    input.value = "";
}
function renderChat() {
    const container = document.getElementById("chatMessages");

    const messages = chats[currentChatUser] || [];

    container.innerHTML = messages.map(m => `
        <div style="
            text-align:${m.from === currentUser ? "right" : "left"};
            margin:5px;
        ">
            <span style="
                background:${m.from === currentUser ? "#4a6cf7" : "#eee"};
                color:${m.from === currentUser ? "white" : "black"};
                padding:6px 10px;
                border-radius:10px;
                display:inline-block;
            ">
                ${m.text}
            </span>
        </div>
    `).join("");
    const box = document.getElementById("chatMessages");
    box.scrollTop = box.scrollHeight;
}
function toggleChatList() {
    openChat("casper");
}
window.addEventListener("load", () => {
    if ("Notification" in window) {
        Notification.requestPermission();
    }
});