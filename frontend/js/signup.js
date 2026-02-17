const signupForm = document.getElementById("signupForm");

const messageBox = document.createElement("div");
messageBox.id = "messageBox";
messageBox.style.marginTop = "10px";
messageBox.style.padding = "10px";
messageBox.style.borderRadius = "8px";
messageBox.style.display = "none";
messageBox.style.fontWeight = "bold";
signupForm.appendChild(messageBox);

function showMessage(text, type = "info") {
  messageBox.textContent = text;
  messageBox.style.display = "block";
  messageBox.style.backgroundColor =
    type === "success" ? "#d4edda" : type === "error" ? "#f8d7da" : "#cce5ff";
  messageBox.style.color =
    type === "success" ? "#155724" : type === "error" ? "#721c24" : "#004085";

  setTimeout(() => {
    messageBox.style.display = "none";
  }, 3500);
}

// Če je že prijavljen (cookie), ga preusmeri
(async function () {
  try {
    const res = await fetch("/api/me", { credentials: "include" });
    if (res.ok) window.location.href = "home.html";
  } catch {
    // ignore
  }
})();

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
      credentials: "include",
      body: JSON.stringify({ username, email, password }),
    });

    // robustno branje (da ne crkne, če backend vrne HTML)
    const text = await response.text();
    let result = {};
    try {
      result = text ? JSON.parse(text) : {};
    } catch {
      result = { message: text || "Neveljaven odgovor strežnika." };
    }

    if (!response.ok) {
      return showMessage(result.message || "Napaka pri registraciji.", "error");
    }

    // samo za UI
    localStorage.setItem("username", result.username || username);

    showMessage("Registracija uspešna! Preusmerjam ...", "success");
    setTimeout(() => (window.location.href = "home.html"), 700);
  } catch (err) {
    console.error("Napaka pri registraciji:", err);
    showMessage("Prišlo je do napake. Poskusi znova.", "error");
  }
});
