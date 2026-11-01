const accountStatus = document.getElementById("accountStatus");
const accountWelcome = document.getElementById("accountWelcome");
const accountForms = document.getElementById("accountForms");
const loginForm = document.getElementById("customerLoginForm");
const registerForm = document.getElementById("customerRegisterForm");
const loginError = document.getElementById("loginError");
const registerError = document.getElementById("registerError");

document.getElementById("showLogin").addEventListener("click", () => showForm("login"));
document.getElementById("showRegister").addEventListener("click", () => showForm("register"));
document.getElementById("customerLogout").addEventListener("click", logout);
loginForm.addEventListener("submit", (event) => submitAuth(event, "login"));
registerForm.addEventListener("submit", (event) => submitAuth(event, "register"));

loadAccount();

function showForm(name) {
  const isLogin = name === "login";
  loginForm.classList.toggle("hidden", !isLogin);
  registerForm.classList.toggle("hidden", isLogin);
  document.getElementById("showLogin").setAttribute("aria-selected", String(isLogin));
  document.getElementById("showRegister").setAttribute("aria-selected", String(!isLogin));
  loginError.textContent = "";
  registerError.textContent = "";
}

async function submitAuth(event, action) {
  event.preventDefault();
  const form = action === "login" ? loginForm : registerForm;
  const errorElement = action === "login" ? loginError : registerError;
  const submitButton = form.querySelector("button[type='submit']");
  submitButton.disabled = true;
  errorElement.textContent = "";

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  try {
    const response = await fetch(`/api/customer/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();

    if (!response.ok) {
      errorElement.textContent = response.status === 429
        ? "Хэт олон удаа оролдлоо. Түр хүлээгээд дахин оролдоно уу."
        : response.status === 409
          ? "Энэ и-мэйлээр бүртгэл үүссэн байна. Нэвтэрнэ үү."
          : action === "register" && response.status === 400
            ? "Мэдээллээ шалгана уу. Нууц үг 12-128 тэмдэгт байх ёстой."
            : action === "login" && response.status === 401
              ? "И-мэйл эсвэл нууц үг буруу байна."
              : "Үйлдэл амжилтгүй боллоо. Дахин оролдоно уу.";
      return;
    }

    showSignedIn(result);
  } catch (error) {
    console.error("Could not complete customer authentication.", error);
    errorElement.textContent = "Сервертэй холбогдож чадсангүй. Дахин оролдоно уу.";
  } finally {
    submitButton.disabled = false;
  }
}

async function loadAccount() {
  try {
    const response = await fetch("/api/customer/me");
    if (!response.ok) {
      throw new Error(`Account request failed with status ${response.status}`);
    }
    const result = await response.json();
    if (result.authenticated) {
      showSignedIn(result);
    }
  } catch (error) {
    console.error("Could not load customer session.", error);
    loginError.textContent = "Бүртгэлийн мэдээлэл уншиж чадсангүй. Хуудсыг дахин ачаална уу.";
  }
}

function showSignedIn(customer) {
  accountForms.classList.add("hidden");
  accountStatus.classList.remove("hidden");
  accountWelcome.textContent = `${customer.name} (${customer.email}) хаягаар нэвтэрсэн байна.`;
}

async function logout() {
  const button = document.getElementById("customerLogout");
  button.disabled = true;
  try {
    const response = await fetch("/api/customer/logout", { method: "POST" });
    if (!response.ok) {
      throw new Error(`Logout failed with status ${response.status}`);
    }
    accountStatus.classList.add("hidden");
    accountForms.classList.remove("hidden");
    loginForm.reset();
    registerForm.reset();
    showForm("login");
  } catch (error) {
    console.error("Could not end customer session.", error);
    accountWelcome.textContent = "Гарах үйлдэл амжилтгүй боллоо. Дахин оролдоно уу.";
  } finally {
    button.disabled = false;
  }
}
