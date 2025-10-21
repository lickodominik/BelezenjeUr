const loginForm = document.getElementById("loginForm");
const welcomeTitle = document.getElementById("welcomeTitle");
const registerLinkText = document.getElementById("registerLinkText");

// Če je uporabnik že prijavljen, prikažemo pozdrav
const savedUser = localStorage.getItem("username");
if (savedUser) {
  showWelcome(savedUser);
}

// 🔹 Ob kliku na "Prijava"
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const result = await response.json();
  alert(result.message);

  if (response.ok) {
    localStorage.setItem("username", result.username);
    localStorage.setItem("userEmail", email);
    localStorage.setItem("email", email);
    showWelcome(result.username);
    window.location.href = "home.html";
  }
});

// 🔹 Funkcija za prikaz pozdrava
function showWelcome(username) {
  loginForm.style.display = "none"; // skrijemo formo
  if (registerLinkText) registerLinkText.style.display = "none"; // skrijemo link “Še nimaš računa?”
  welcomeTitle.textContent = `Pozdravljen, ${username}!`;

  const logoutBtn = document.createElement("button");
  logoutBtn.textContent = "Odjava";
  logoutBtn.style.marginTop = "20px";
  logoutBtn.addEventListener("click", () => {
    localStorage.clear();
    location.reload();
  });

  document.body.appendChild(logoutBtn);
}

