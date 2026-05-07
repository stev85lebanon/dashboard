const socket = io();

let currentUser = "";
let isLeader = false;
let leaderMessages = [];
let team = [];
let allTasks = [];

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
    <span class="location-icon">
        ${p.location === "Remote" ? "🏠" : "🏢"}
    </span>
    <span class="location-text">
        ${p.location === "Remote" ? "Remote" : "On-site"}
    </span>
</div>

    <div class="note-box">
        ${p.note || "No update"}
    </div>

    ${isMe ? `
        <input placeholder="Write update"
            onkeydown="handleNote(event, '${p.name}')">

        <select onchange="updateStatus('${p.name}', this.value)">
            ${statuses.map(s =>
            `<option ${s === p.status ? "selected" : ""}>${s}</option>`
        ).join("")}
        </select>

       <div class="actions">
    <button class="location-btn onsite"
        onclick="updateLocation('${p.name}','On-site')">
        🏢
    </button>

    <button class="location-btn remote"
        onclick="updateLocation('${p.name}','Remote')">
        🏠
    </button>
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

    const container =
        document.getElementById("taskList");

    let visibleTasks = isLeader
        ? allTasks
        : allTasks.filter(
            t => t.target === currentUser
        );

    container.innerHTML =
        visibleTasks.map(task => {

            const taskTime =
                new Date(task.time)
                    .toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit"
                    });

            const completedTime =
                task.completedAt
                    ? new Date(task.completedAt)
                        .toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit"
                        })
                    : "";

            const blockedTime =
                task.blockedAt
                    ? new Date(task.blockedAt)
                        .toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit"
                        })
                    : "";

            return `
        <div class="task-card
            ${task.status === "done"
                    ? "done-task"
                    : ""}
            ${task.status === "blocked"
                    ? "blocked-task"
                    : ""}
        ">

            ${isLeader
                    ? `
                <div class="task-user">
                    👤 ${task.target}
                </div>
            `
                    : ""
                }

            <div class="task-text">
                ${task.text}
            </div>

            <div class="task-time">
                🕒 ${taskTime}
            </div>

            ${task.status === "pending"
                    && !isLeader
                    ? `
                <div class="task-actions">

                    <button
                        class="btn done-btn"
                        onclick="completeTask(${task.id})"
                    >
                        ✅ Done
                    </button>

                    <button
                        class="btn block-btn"
                        onclick="blockTask(${task.id})"
                    >
                        ❌ Not possible
                    </button>

                </div>
            `
                    : ""
                }

            ${task.status === "done"
                    ? `
                <div class="task-status done-status">
                    ✔ Completed at ${completedTime}
                </div>
            `
                    : ""
                }

            ${task.status === "blocked"
                    ? `
                <div class="task-status blocked-status">
                    ❌ Not possible at ${blockedTime}

                    <div class="blocked-reason">
                        ${task.reason}
                    </div>
                </div>
            `
                    : ""
                }

        </div>
        `;
        }).join("");
}

// COMPLETE TASK
function completeTask(id) {
    socket.emit("completeTask", id);
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
window.addEventListener("beforeunload", () => {
    socket.emit("disconnectUser", currentUser);
});