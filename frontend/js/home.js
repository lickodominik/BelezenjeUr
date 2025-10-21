const username = localStorage.getItem("username");
const email = localStorage.getItem("userEmail");

// 🔹 Če uporabnik ni prijavljen, ga preusmerimo
if (!username || !email) {
  window.location.href = "login.html";
} else {
  document.getElementById("welcomeMsg").textContent = `Pozdravljen, ${username}!`;
}

// 🔹 Odjava
document.getElementById("logoutBtn").addEventListener("click", () => {
  showConfirm("Si prepričan, da se želiš odjaviti?", () => {
    localStorage.clear();
    window.location.href = "login.html";
  });
});

const jobForm = document.getElementById("addJobForm");
const jobList = document.getElementById("jobList");

// 🔹 Dodamo polje za sporočila
const messageBox = document.createElement("div");
messageBox.id = "messageBox";
messageBox.style.marginTop = "10px";
messageBox.style.padding = "10px";
messageBox.style.borderRadius = "8px";
messageBox.style.display = "none";
messageBox.style.fontWeight = "bold";
jobForm.parentElement.insertBefore(messageBox, jobForm);

// 🔹 Funkcija za prikaz sporočil
function showMessage(text, type = "info") {
  messageBox.textContent = text;
  messageBox.style.display = "block";
  messageBox.style.backgroundColor =
    type === "success" ? "#d4edda" :
    type === "error" ? "#f8d7da" :
    "#cce5ff";
  messageBox.style.color =
    type === "success" ? "#155724" :
    type === "error" ? "#721c24" :
    "#004085";
  setTimeout(() => { messageBox.style.display = "none"; }, 3000);
}

// 🔹 Funkcija za potrditvena okna (namesto confirm)
function showConfirm(message, onConfirm) {
  const confirmBox = document.createElement("div");
  confirmBox.style.position = "fixed";
  confirmBox.style.top = "50%";
  confirmBox.style.left = "50%";
  confirmBox.style.transform = "translate(-50%, -50%)";
  confirmBox.style.background = "#fff";
  confirmBox.style.border = "1px solid #ccc";
  confirmBox.style.padding = "20px";
  confirmBox.style.borderRadius = "10px";
  confirmBox.style.boxShadow = "0 4px 8px rgba(0,0,0,0.2)";
  confirmBox.style.zIndex = "1000";
  confirmBox.innerHTML = `
    <p style="margin-bottom: 10px;">${message}</p>
    <button id="confirmYes">Da</button>
    <button id="confirmNo" style="margin-left: 10px;">Ne</button>
  `;
  document.body.appendChild(confirmBox);

  document.getElementById("confirmYes").addEventListener("click", () => {
    confirmBox.remove();
    onConfirm();
  });
  document.getElementById("confirmNo").addEventListener("click", () => {
    confirmBox.remove();
  });
}

let jobs = [];

// 🔹 1. Naloži vse službe uporabnika
async function loadJobs() {
  try {
    const res = await fetch(`/api/jobs/${email}`);
    const data = await res.json();
    jobs = data.jobs || [];
    renderJobs();
  } catch {
    showMessage("Napaka pri nalaganju služb.", "error");
  }
}

// 🔹 2. Prikaži službe
function renderJobs() {
  jobList.innerHTML = "";
  if (jobs.length === 0) {
    jobList.innerHTML = "<p>Trenutno še nimaš dodanih služb.</p>";
    return;
  }

  jobs.forEach((job) => {
    const div = document.createElement("div");
    div.className = "job-item";

    const active = job.sessions?.some((s) => !s.end);

    const title = document.createElement("h3");
    title.textContent = job.name + " " + (active ? "🟢 aktivno" : "⚪ neaktivno");

    const startBtn = document.createElement("button");
    startBtn.textContent = "Začni";
    startBtn.disabled = active;

    const stopBtn = document.createElement("button");
    stopBtn.textContent = "Ustavi";
    stopBtn.style.marginLeft = "10px";
    stopBtn.disabled = !active;

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "🗑 Odstrani";
    deleteBtn.style.marginLeft = "10px";
    deleteBtn.style.backgroundColor = "#ff4d4d";
    deleteBtn.style.color = "white";

    startBtn.addEventListener("click", () => handleTime(job.name, "start"));
    stopBtn.addEventListener("click", () => handleTime(job.name, "stop"));
    deleteBtn.addEventListener("click", () => handleDelete(job.name));

    div.appendChild(title);
    div.appendChild(startBtn);
    div.appendChild(stopBtn);
    div.appendChild(deleteBtn);
    jobList.appendChild(div);
  });
}

// 🔹 3. Pošlji "Začni" ali "Ustavi" na strežnik
async function handleTime(jobName, action) {
  try {
    const res = await fetch("/api/time", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, jobName, action }),
    });

    const data = await res.json();
    if (!res.ok) return showMessage(data.message || "Napaka pri posodobitvi.", "error");

    showMessage(data.message, "success");
    jobs = data.jobs;
    renderJobs();
  } catch {
    showMessage("Napaka pri komunikaciji s strežnikom.", "error");
  }
}

// 🔹 4. Odstrani službo
async function handleDelete(jobName) {
  showConfirm(`Ali res želiš odstraniti službo "${jobName}"?`, async () => {
    try {
      const res = await fetch("/api/jobs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: jobName }),
      });

      const data = await res.json();
      if (!res.ok) return showMessage(data.message || "Napaka pri brisanju.", "error");

      showMessage("Služba odstranjena.", "success");
      jobs = data.jobs;
      renderJobs();
    } catch {
      showMessage("Napaka pri komunikaciji s strežnikom.", "error");
    }
  });
}

// 🔹 5. Dodaj novo službo
jobForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("jobName").value.trim();
  if (!name) return showMessage("Vnesi ime službe!", "error");

  try {
    const response = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name }),
    });

    const result = await response.json();

    if (!response.ok) return showMessage(result.message || "Napaka pri dodajanju.", "error");

    showMessage("Služba dodana!", "success");
    jobs = result.jobs;
    renderJobs();
    document.getElementById("jobName").value = "";
  } catch {
    showMessage("Napaka pri dodajanju službe.", "error");
  }
});

// 📥 Prenos Excel datoteke
document.getElementById("downloadExcel").addEventListener("click", () => {
  const email = localStorage.getItem("email");
  if (!email) return showMessage("Napaka: uporabnik ni prijavljen!", "error");

  const url = `/api/download/${encodeURIComponent(email)}`;
  window.location.href = url;
});

// 🔹 6. Naloži ob začetku
loadJobs();
