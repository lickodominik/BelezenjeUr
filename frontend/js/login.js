const loginForm = document.getElementById("loginForm");
const messageBox = document.createElement("div");
messageBox.id = "messageBox";
loginForm.appendChild(messageBox);

const savedUser = localStorage.getItem("username");
if (savedUser) {
  window.location.href = "home.html";
}

// 🔹 Prikaz sporočila (uspeh / napaka)
function showMessage(text, type = "error") {
  messageBox.textContent = text;
  messageBox.className = `message ${type}`; // npr. message success ali message error
  messageBox.style.opacity = "1";

  // Po 3 sekundah se sporočilo počasi skrije
  setTimeout(() => {
    messageBox.style.opacity = "0";
  }, 3000);
}

// 🔹 Ob oddaji prijavnega obrazca
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    showMessage("Vnesi e-naslov in geslo!", "error");
    return;
  }

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const result = await response.json();

    if (!response.ok) {
      showMessage(result.message || "Napačen e-naslov ali geslo.", "error");
      return;
    }

    showMessage("Prijava uspešna! Preusmerjam ...", "success");

    localStorage.setItem("username", result.username);
    localStorage.setItem("userEmail", email);
    localStorage.setItem("email", email);

    // Po 1 sekundi preusmeri na home.html
    setTimeout(() => {
      window.location.href = "home.html";
    }, 1000);

  } catch (err) {
    console.error("Napaka pri prijavi:", err);
    showMessage("Napaka pri povezavi s strežnikom.", "error");
  }
});
