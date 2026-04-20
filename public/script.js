const socket = io();

let currentUser = "";
let isLeader = false;

const statuses = ["Available", "Busy", "Focused", "In Meeting"];

// =======================
// LOGIN
// =======================
function login() {
    const name = document.getElementById("userName").value.trim();
    const role = document.getElementById("role").value;

    if (!name) return alert("Enter your name");

    currentUser = name;
    isLeader = role === "leader";

    socket.emit("login", { name, role });

    document.getElementById("login").style.display = "none";
    document.getElementById("app").style.display = "block";

    if (!isLeader) {
        document.getElementById("leaderPanel").style.display = "none";
    }
}


// =======================
// SOCKET EVENTS
// =======================

// initial data
socket.on("init", (data) => {
    team = data;
    render();
});

// refresh data
socket.on("refresh", (data) => {
    team = data;
    render();
});

// leader message
socket.on("leaderMessage", (msg) => {
    document.getElementById("leaderMessage").innerText =
        "👨‍💼 Leader: " + msg;

    highlightCards();
});


// =======================
// RENDER UI
// =======================
function render() {
    const container = document.getElementById("dashboard");
    container.innerHTML = "";

    let available = 0;
    let busy = 0;
    let focused = 0;

    team.forEach((p) => {

        // count overview
        if (p.status === "Available") available++;
        if (p.status === "Busy") busy++;
        if (p.status === "Focused") focused++;
        const canEdit = isLeader || p.name === currentUser;

        const statusClass = p.status
            .toLowerCase()
            .replace(/\s+/g, "-");
        if (p.role === "leader") return;

        const card = document.createElement("div");
        card.className = "card";

        //         card.innerHTML = `
        // <h3>${p.name} ${p.role === "leader" ? "👨‍💼" : ""}</h3>
        //             <div class="status status-${statusClass}">
        //                 ${p.status}
        //             </div>

        //             <div class="note">
        //                 ${p.note ? "💬 " + p.note : "<i>No update</i>"}
        //             </div>

        //             ${canEdit ? `
        //                 <select onchange="updateStatus('${p.name}', this.value)">
        //                     ${statuses.map(s =>
        //             `<option ${s === p.status ? "selected" : ""}>${s}</option>`
        //         ).join("")}
        //                 </select>
        //             ` : ""}

        //             ${p.name === currentUser ? `
        //                 <input placeholder="Write update..."
        //                     onkeydown="handleNote(event, '${p.name}')">

        //                 <button onclick="needHelp('${p.name}')">Help</button>
        //                 <button onclick="urgent('${p.name}')">Urgent</button>
        //             ` : ""}
        //         `;
        card.innerHTML = `
  <div class="user-header">
    <div class="avatar">
      <img src="${p.avatar || 'images/default.png'}" />
      <span class="dot ${p.online ? "online" : "offline"}"></span>
    </div>

    <h3>${p.name}</h3>
  </div>

  <div class="status status-${statusClass}">
    ${p.status}
  </div>

  <div class="note-box">
    ${p.note ? p.note : "No update yet..."}
  </div>

  ${canEdit ? `
    <select onchange="updateStatus('${p.name}', this.value)">
      ${statuses.map(s =>
            `<option ${s === p.status ? "selected" : ""}>${s}</option>`
        ).join("")}
    </select>
  ` : ""}

  ${p.name === currentUser ? `
    <input placeholder="Write update..."
      onkeydown="handleNote(event, '${p.name}')">

    <div class="actions">
      <button class="help" onclick="needHelp('${p.name}')">Help</button>
      <button class="urgent" onclick="urgent('${p.name}')">Urgent</button>
    </div>
  ` : ""}
`;
        container.appendChild(card);
    });

    // update overview
    document.getElementById("available").innerText = available;
    document.getElementById("busy").innerText = busy;
    document.getElementById("focused").innerText = focused;
}


// =======================
// USER ACTIONS
// =======================

// change status
function updateStatus(name, status) {
    socket.emit("updateStatus", { name, status });
}
function leave() {
    socket.emit("disconnectUser", currentUser);

    document.getElementById("app").style.display = "none";
    document.getElementById("login").style.display = "block";
}
window.addEventListener("beforeunload", () => {
    socket.emit("disconnectUser", currentUser);
});
// write note
function handleNote(e, name) {
    if (e.key === "Enter") {
        socket.emit("updateNote", {
            name,
            note: e.target.value
        });

        e.target.value = "";
    }
}

// quick buttons
function needHelp(name) {
    socket.emit("updateNote", {
        name,
        note: "⚠️ Needs help"
    });
}

function urgent(name) {
    socket.emit("updateNote", {
        name,
        note: "🚨 URGENT!"
    });
}


// =======================
// LEADER ACTION
// =======================
function sendInstruction() {
    const input = document.getElementById("leaderInput");
    const msg = input.value;

    if (!msg.trim()) return;

    socket.emit("leaderMessage", msg);

    input.value = "";
}


// =======================
// VISUAL FEEDBACK
// =======================
function highlightCards() {
    document.querySelectorAll(".card").forEach(card => {
        card.style.transition = "0.3s";
        card.style.background = "#ffe0e0";

        setTimeout(() => {
            card.style.background = "white";
        }, 800);
    });
}