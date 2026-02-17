const welcomeMsg = document.getElementById("welcomeMsg");
const logoutBtn = document.getElementById("logoutBtn");
const jobForm = document.getElementById("addJobForm");
const jobList = document.getElementById("jobList");
const downloadBtn = document.getElementById("downloadExcel");

// 🔹 Message box
const messageBox = document.createElement("div");
messageBox.id = "messageBox";
messageBox.style.marginTop = "10px";
messageBox.style.padding = "10px";
messageBox.style.borderRadius = "8px";
messageBox.style.display = "none";
messageBox.style.fontWeight = "bold";
jobForm.parentElement.insertBefore(messageBox, jobForm);

function showMessage(text, type = "info") {
  messageBox.textContent = text;
  messageBox.style.display = "block";
  messageBox.style.backgroundColor =
    type === "success" ? "#d4edda" : type === "error" ? "#f8d7da" : "#cce5ff";
  messageBox.style.color =
    type === "success" ? "#155724" : type === "error" ? "#721c24" : "#004085";
  setTimeout(() => {
    messageBox.style.display = "none";
  }, 3000);
}

// ✅ Varno confirm okno (brez innerHTML → manj XSS tveganja)
function showConfirm(message, onConfirm) {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.right = "0";
  overlay.style.bottom = "0";
  overlay.style.background = "rgba(0,0,0,0.35)";
  overlay.style.zIndex = "999";

  const box = document.createElement("div");
  box.style.position = "fixed";
  box.style.top = "50%";
  box.style.left = "50%";
  box.style.transform = "translate(-50%, -50%)";
  box.style.background = "#fff";
  box.style.border = "1px solid #ccc";
  box.style.padding = "18px";
  box.style.borderRadius = "10px";
  box.style.boxShadow = "0 4px 10px rgba(0,0,0,0.2)";
  box.style.zIndex = "1000";
  box.style.minWidth = "280px";

  const p = document.createElement("p");
  p.style.marginBottom = "12px";
  p.textContent = message;

  const yes = document.createElement("button");
  yes.textContent = "Da";

  const no = document.createElement("button");
  no.textContent = "Ne";
  no.style.marginLeft = "10px";

  box.appendChild(p);
  box.appendChild(yes);
  box.appendChild(no);

  function cleanup() {
    box.remove();
    overlay.remove();
  }

  yes.addEventListener("click", () => {
    cleanup();
    onConfirm();
  });

  no.addEventListener("click", cleanup);

  document.body.appendChild(overlay);
  document.body.appendChild(box);
}

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, { credentials: "include", ...options });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

let jobs = [];

// ✅ 0) Preveri sejo in naloži uporabnika
async function loadMeOrRedirect() {
  const { res, data } = await fetchJSON("/api/me");
  if (!res.ok) {
    window.location.href = "login.html";
    return null;
  }
  return data; // { email, username }
}

// ✅ 1) Naloži službe
async function loadJobs() {
  try {
    const { res, data } = await fetchJSON("/api/jobs");
    if (!res.ok) {
      if (res.status === 401) window.location.href = "login.html";
      else showMessage(data.message || "Napaka pri nalaganju služb.", "error");
      return;
    }
    jobs = data.jobs || [];
    renderJobs();
  } catch {
    showMessage("Napaka pri nalaganju služb.", "error");
  }
}

// ✅ 2) Prikaži službe
function renderJobs() {
  jobList.innerHTML = "";

  if (!jobs.length) {
    const p = document.createElement("p");
    p.textContent = "Trenutno še nimaš dodanih služb.";
    jobList.appendChild(p);
    return;
  }

  for (const job of jobs) {
    const div = document.createElement("div");
    div.className = "job-item";

    const title = document.createElement("h3");
    title.textContent = `${job.name} ${job.active ? "🟢 aktivno" : "⚪ neaktivno"}`;

    const startBtn = document.createElement("button");
    startBtn.textContent = "Začni";
    startBtn.disabled = !!job.active;

    const stopBtn = document.createElement("button");
    stopBtn.textContent = "Ustavi";
    stopBtn.style.marginLeft = "10px";
    stopBtn.disabled = !job.active;

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
  }
}

// ✅ 3) Začni / ustavi
async function handleTime(jobName, action) {
  try {
    const { res, data } = await fetchJSON("/api/time", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobName, action }),
    });

    if (!res.ok) {
      if (res.status === 401) return (window.location.href = "login.html");
      return showMessage(data.message || "Napaka pri posodobitvi.", "error");
    }

    showMessage(data.message || "OK", "success");
    // po start/stop backend trenutno vrača samo message → osvežimo seznam
    await loadJobs();
  } catch {
    showMessage("Napaka pri komunikaciji s strežnikom.", "error");
  }
}

// ✅ 4) Odstrani službo
async function handleDelete(jobName) {
  showConfirm(`Ali res želiš odstraniti službo "${jobName}"?`, async () => {
    try {
      const { res, data } = await fetchJSON("/api/jobs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: jobName }),
      });

      if (!res.ok) {
        if (res.status === 401) return (window.location.href = "login.html");
        return showMessage(data.message || "Napaka pri brisanju.", "error");
      }

      showMessage(data.message || "Služba odstranjena.", "success");
      jobs = data.jobs || [];
      renderJobs();
    } catch {
      showMessage("Napaka pri komunikaciji s strežnikom.", "error");
    }
  });
}

// ✅ 5) Dodaj službo
jobForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("jobName").value.trim();
  if (!name) return showMessage("Vnesi ime službe!", "error");

  try {
    const { res, data } = await fetchJSON("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (!res.ok) {
      if (res.status === 401) return (window.location.href = "login.html");
      return showMessage(data.message || "Napaka pri dodajanju.", "error");
    }

    showMessage(data.message || "Služba dodana!", "success");
    jobs = data.jobs || [];
    renderJobs();
    document.getElementById("jobName").value = "";
  } catch {
    showMessage("Napaka pri dodajanju službe.", "error");
  }
});

// ✅ 6) Download excel (cookie auth; brez email parametra)
downloadBtn.addEventListener("click", () => {
  window.location.href = "/api/download";
});

// ✅ 7) Odjava (backend cookie clear)
logoutBtn.addEventListener("click", () => {
  showConfirm("Si prepričan, da se želiš odjaviti?", async () => {
    try {
      await fetch("/api/logout", { method: "POST", credentials: "include" });
    } catch {
      // ignore
    } finally {
      // samo UI podatki
      localStorage.removeItem("username");
      window.location.href = "login.html";
    }
  });
});

// ✅ Init
(async function init() {
  const me = await loadMeOrRedirect();
  if (!me) return;

  const storedUsername = localStorage.getItem("username");
  const displayName = storedUsername || me.username || "Uporabnik";
  welcomeMsg.textContent = `Pozdravljen, ${displayName}!`;

  await loadJobs();
})();
