const accountStatus = document.getElementById("accountStatus");
const accountWelcome = document.getElementById("accountWelcome");
const accountForms = document.getElementById("accountForms");
const loginForm = document.getElementById("customerLoginForm");
const registerForm = document.getElementById("customerRegisterForm");
const loginError = document.getElementById("loginError");
const registerError = document.getElementById("registerError");
const DEMO_CUSTOMER = {
  identifier: "72445428",
  password: "GaNq123@",
  name: "Demo customer",
  email: "demo-customer@nomad.local",
  phone: "72445428",
};

document.getElementById("showLogin").addEventListener("click", () => showForm("login"));
document.getElementById("showRegister").addEventListener("click", () => showForm("register"));
document.getElementById("customerLogout").addEventListener("click", logout);
document.getElementById("demoCustomerLogin").addEventListener("click", () => {
  loginForm.elements.identifier.value = DEMO_CUSTOMER.identifier;
  loginForm.elements.password.value = DEMO_CUSTOMER.password;
  loginForm.requestSubmit();
});
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
      if ([404, 501].includes(response.status) && action === "login" && useDemoCustomer(payload)) {
        return;
      }

      errorElement.textContent = response.status === 429
        ? "Хэт олон удаа оролдлоо. Түр хүлээгээд дахин оролдоно уу."
        : response.status === 409
          ? "Энэ и-мэйлээр бүртгэл үүссэн байна. Нэвтэрнэ үү."
          : action === "register" && response.status === 400
            ? "Мэдээллээ шалгана уу. Нууц үг 12-128 тэмдэгт байх ёстой."
            : action === "login" && response.status === 401
              ? "И-мэйл/утас эсвэл нууц үг буруу байна."
              : "Үйлдэл амжилтгүй боллоо. Дахин оролдоно уу.";
      return;
    }

    showSignedIn(result);
  } catch (error) {
    if (action === "login" && useDemoCustomer(payload)) {
      return;
    }

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
    const savedDemo = sessionStorage.getItem("nomad-demo-customer");
    if (savedDemo) {
      showSignedIn(JSON.parse(savedDemo), true);
    } else {
      loginError.textContent = "Demo-оор орохын тулд “Demo хэрэглэгчээр нэвтрэх” товчийг дарна уу.";
    }
  }
}

function useDemoCustomer(payload) {
  if (payload.identifier !== DEMO_CUSTOMER.identifier || payload.password !== DEMO_CUSTOMER.password) {
    return false;
  }
  const demoCustomer = {
    name: DEMO_CUSTOMER.name,
    email: DEMO_CUSTOMER.email,
    phone: DEMO_CUSTOMER.phone,
  };
  sessionStorage.setItem("nomad-demo-customer", JSON.stringify(demoCustomer));
  showSignedIn(demoCustomer, true);
  return true;
}

function showSignedIn(customer, isDemo = false) {
  accountForms.classList.add("hidden");
  accountStatus.classList.remove("hidden");
  accountWelcome.textContent = `${customer.name} (${customer.phone || customer.email}) хаягаар нэвтэрсэн байна.${isDemo ? " Local demo горим." : ""}`;
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
    if (sessionStorage.getItem("nomad-demo-customer")) {
      sessionStorage.removeItem("nomad-demo-customer");
      accountStatus.classList.add("hidden");
      accountForms.classList.remove("hidden");
      loginForm.reset();
      registerForm.reset();
      showForm("login");
      return;
    }

    console.error("Could not end customer session.", error);
    accountWelcome.textContent = "Гарах үйлдэл амжилтгүй боллоо. Дахин оролдоно уу.";
  } finally {
    button.disabled = false;
  }
}
