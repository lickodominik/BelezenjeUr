const signupForm = document.getElementById("signupForm");
const welcomeTitle = document.getElementById("welcomeTitle");

// 🔹 Ustvari element za prikaz sporočil
const messageBox = document.createElement("div");
messageBox.id = "messageBox";
messageBox.style.marginTop = "10px";
messageBox.style.padding = "10px";
messageBox.style.borderRadius = "8px";
messageBox.style.display = "none";
messageBox.style.fontWeight = "bold";
signupForm.appendChild(messageBox);

// Če je uporabnik že prijavljen, pokaži pozdrav
const savedUser = localStorage.getItem("username");
if (savedUser) {
  showWelcome(savedUser);
}

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

// 🔹 Ob kliku na "Ustvari račun"
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("username").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!username || !email || !password) {
    return showMessage("Prosim izpolni vsa polja.", "error");
  }

  try {
    const response = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });

    const result = await response.json();

    if (!response.ok) {
      return showMessage(result.message || "Napaka pri registraciji.", "error");
    }

    showMessage("Registracija uspešna! Preusmerjam...", "success");

    // Shrani podatke in preusmeri
    localStorage.setItem("username", username);
    localStorage.setItem("userEmail", email);
    localStorage.setItem("email", email);

    setTimeout(() => {
      window.location.href = "home.html";
    }, 1500);

  } catch (err) {
    console.error("Napaka pri registraciji:", err);
    showMessage("Prišlo je do napake. Poskusi znova.", "error");
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
