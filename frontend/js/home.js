const username = localStorage.getItem("username");
const email = localStorage.getItem("userEmail");

if (!username || !email) {
  window.location.href = "login.html";
} else {
  document.getElementById("welcomeMsg").textContent = `Pozdravljen, ${username}!`;
}

document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "login.html";
});

const jobForm = document.getElementById("addJobForm");
const jobList = document.getElementById("jobList");

let jobs = [];

// 🔹 1. Naloži vse službe uporabnika
async function loadJobs() {
  const res = await fetch(`/api/jobs/${email}`);
  const data = await res.json();
  jobs = data.jobs || [];
  renderJobs();
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
  const res = await fetch("/api/time", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, jobName, action }),
  });

  const data = await res.json();
  alert(data.message);
  if (res.ok) {
    jobs = data.jobs;
    renderJobs();
  }
}

// 🔹 Odstrani službo
async function handleDelete(jobName) {
  if (!confirm(`Ali res želiš odstraniti službo "${jobName}"?`)) return;

  const res = await fetch("/api/jobs", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, name: jobName }),
  });

  const data = await res.json();
  alert(data.message);

  if (res.ok) {
    jobs = data.jobs;
    renderJobs();
  }
}

// 🔹 4. Dodaj novo službo
jobForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("jobName").value.trim();
  if (!name) return alert("Vnesi ime službe!");

  const response = await fetch("/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, name }),
  });

  const result = await response.json();
  alert(result.message);

  if (response.ok) {
    jobs = result.jobs;
    renderJobs();
    document.getElementById("jobName").value = "";
  }
});

// 📥 Prenos Excel datoteke
document.getElementById("downloadExcel").addEventListener("click", () => {
  const email = localStorage.getItem("email");
  if (!email) return alert("Napaka: uporabnik ni prijavljen!");

  // ustvari sklic na backend datoteko
  const url = `/api/download/${encodeURIComponent(email)}`;

  // sproži prenos
  window.location.href = url;
});

// 🚪 Odjava
document.getElementById("logoutBtn").addEventListener("click", () => {
  if (confirm("Si prepričan, da se želiš odjaviti?")) {
    localStorage.removeItem("username");
    localStorage.removeItem("email");
    window.location.href = "login.html";
  }
});


// 🔹 5. Naloži ob začetku
loadJobs();
