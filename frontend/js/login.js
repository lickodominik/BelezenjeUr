const loginForm = document.getElementById("loginForm");
const messageBox = document.createElement("div");
messageBox.id = "messageBox";
loginForm.appendChild(messageBox);

function showMessage(text, type = "error") {
  messageBox.textContent = text;
  messageBox.className = `message ${type}`;
  messageBox.style.opacity = "1";
  setTimeout(() => (messageBox.style.opacity = "0"), 3000);
}

(async function () {
  try {
    const res = await fetch("/api/me", { credentials: "include" });
    if (res.ok) window.location.href = "home.html";
  } catch {}
})();

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  if (!email || !password) return showMessage("Vnesi e-naslov in geslo!", "error");

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    const text = await response.text();
    let result = {};
    try { result = text ? JSON.parse(text) : {}; } catch { result = { message: text }; }

    if (!response.ok) return showMessage(result.message || "Napačen e-naslov ali geslo.", "error");

    if (result.username) localStorage.setItem("username", result.username);
    showMessage("Prijava uspešna! Preusmerjam ...", "success");
    setTimeout(() => (window.location.href = "home.html"), 600);
  } catch (err) {
    console.error(err);
    showMessage("Napaka pri povezavi s strežnikom.", "error");
  }
});
