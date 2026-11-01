const form = document.getElementById("adminLoginForm");
const errorMessage = document.getElementById("loginError");
const demoAdmin = { phone: "88665428", password: "GaNq123@" };

document.getElementById("demoAdminLogin").addEventListener("click", () => {
  form.elements.phone.value = demoAdmin.phone;
  form.elements.password.value = demoAdmin.password;
  form.requestSubmit();
});

function useLocalDemoLogin() {
  if (form.elements.phone.value.trim() !== demoAdmin.phone
    || form.elements.password.value !== demoAdmin.password) {
    return false;
  }
  sessionStorage.setItem("nomad-demo-admin", "true");
  window.location.assign("index.html?demoAdmin=1#admin");
  return true;
}

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
      if ([404, 501].includes(response.status) && useLocalDemoLogin()) {
        return;
      }
      errorMessage.textContent = response.status === 429
        ? "Хэт олон удаа оролдлоо. Түр хүлээгээд дахин оролдоно уу."
        : "Нэвтрэх нэр эсвэл нууц үг буруу байна.";
      return;
    }

    window.location.replace("/admin");
  } catch (error) {
    if (useLocalDemoLogin()) {
      return;
    }

    console.error("Could not authenticate admin.", error);
    errorMessage.textContent = "Сервертэй холбогдож чадсангүй. Дахин оролдоно уу.";
  } finally {
    submitButton.disabled = false;
  }
});
