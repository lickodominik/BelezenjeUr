const signupForm = document.getElementById("signupForm");
const welcomeTitle = document.getElementById("welcomeTitle");

// Če je uporabnik že prijavljen, pokaži pozdrav
const savedUser = localStorage.getItem("username");
if (savedUser) {
  showWelcome(savedUser);
}

// 🔹 Ob kliku na "Ustvari račun"
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("username").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const response = await fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password }),
  });

  const result = await response.json();
  alert(result.message);

  if (response.ok) {
    localStorage.setItem("username", username);
    localStorage.setItem("userEmail", email);
    localStorage.setItem("email", email);
    showWelcome(username);
    window.location.href = "home.html";
  }
});

// 🔹 Funkcija za prikaz pozdrava
function showWelcome(username) {
  signupForm.style.display = "none"; // skrije formo
  const loginLink = document.getElementById("loginLinkText");
  if (loginLink) loginLink.style.display = "none"; // skrije link na prijavo
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
