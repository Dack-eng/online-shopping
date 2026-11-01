const form = document.getElementById("adminLoginForm");
const errorMessage = document.getElementById("loginError");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorMessage.textContent = "";
  const submitButton = form.querySelector("button[type='submit']");
  submitButton.disabled = true;

  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: new FormData(form).get("phone"),
        password: new FormData(form).get("password"),
      }),
    });

    if (!response.ok) {
      errorMessage.textContent = response.status === 429
        ? "Хэт олон удаа оролдлоо. Түр хүлээгээд дахин оролдоно уу."
        : "Нэвтрэх нэр эсвэл нууц үг буруу байна.";
      return;
    }

    window.location.replace("/admin");
  } catch (error) {
    console.error("Could not authenticate admin.", error);
    errorMessage.textContent = "Сервертэй холбогдож чадсангүй. Дахин оролдоно уу.";
  } finally {
    submitButton.disabled = false;
  }
});
