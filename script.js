// Paste your deployed Google Apps Script Web App URL here
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbxBoZRdoxMPa09e2Dla8IMxlkaGO3xAOe6U9acbyx13QJfSCjOZcxBQaY4R7z6LzjHZ/exec";

// Academic Mapping Strategy
const ACADEMIC_MAP = {
  "S1": {
    exams: ["First Terminal/Onam Exam", "Second Terminal/Christmas Exam", "Annual Exam"],
    subjects: ["First Language Paper-1", "First Language Paper-2(MAL)", "English", "Hindi", "Basic Science", "Social Science", "Mathematics"]
  },
  "S2": {
    exams: ["First Terminal/Onam Exam", "Second Terminal/Christmas Exam", "Annual Exam"],
    subjects: ["First Language Paper-1", "First Language Paper-2(MAL)", "English", "Hindi", "Physics", "Chemistry", "Biology", "Social Science", "Mathematics"]
  },
  "S3": {
    exams: ["First Terminal/Onam Exam", "Second Terminal/Christmas Exam", "SSLC Model Exam", "SSLC Public Exam"],
    subjects: ["First Language Paper-1 (ARB)", "First Language Paper-2(MAL)", "English", "Hindi", "Physics", "Chemistry", "Biology", "Social Science", "Mathematics"]
  }
};

let deferredPrompt;

document.addEventListener("DOMContentLoaded", () => {
  initAuth();
  initPasswordToggle();
  initDynamicDropdowns();
  initKeyboardNavigation();
  initPWA();

  document.getElementById("loginForm").addEventListener("submit", handleLoginSubmit);
  document.getElementById("logoutBtn").addEventListener("click", instantLogout);
  document.getElementById("saveMarksBtn").addEventListener("click", handleSaveMarks);
  document.getElementById("modalCloseBtn").addEventListener("click", closeModal);
});

/* Native Modal Handling */
function showAlert(message) {
  document.getElementById("modalMessage").innerText = message;
  document.getElementById("appModal").style.display = "flex";
}
function closeModal() {
  document.getElementById("appModal").style.display = "none";
}

/* Authentication & Instant Logout */
function initAuth() {
  const teacher = JSON.parse(localStorage.getItem("snec_teacher"));
  if (teacher) {
    showDashboard(teacher);
  }
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const teacherId = document.getElementById("teacherId").value;
  const password = document.getElementById("password").value;

  try {
    const res = await fetch(GAS_API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "login", teacherId, password })
    });
    const data = await res.json();

    if (data.success) {
      localStorage.setItem("snec_teacher", JSON.stringify(data.teacher));
      showDashboard(data.teacher);
    } else {
      showAlert(data.message);
    }
  } catch (err) {
    showAlert("Network connection error.");
  }
}

function instantLogout() {
  localStorage.removeItem("snec_teacher");
  document.getElementById("appContainer").style.display = "none";
  document.getElementById("authScreen").style.display = "flex";
  document.getElementById("loginForm").reset();
}

function showDashboard(teacher) {
  document.getElementById("authScreen").style.display = "none";
  document.getElementById("appContainer").style.display = "flex";
  document.getElementById("profileName").innerText = teacher.name;
  document.getElementById("profileCollege").innerText = teacher.college;
  loadStudents(teacher.affiliationNo);
}

/* Password View Eye Toggle */
function initPasswordToggle() {
  const toggle = document.getElementById("togglePassword");
  const field = document.getElementById("password");
  toggle.addEventListener("click", () => {
    const type = field.type === "password" ? "text" : "password";
    field.type = type;
    toggle.classList.toggle("fa-eye-slash");
  });
}

/* Academic Selections & Dynamic UI Update */
function initDynamicDropdowns() {
  const classSelect = document.getElementById("classSelect");
  const examSelect = document.getElementById("examSelect");
  const subjectSelect = document.getElementById("subjectSelect");

  classSelect.addEventListener("change", (e) => {
    const selectedClass = e.target.value;
    examSelect.innerHTML = '<option value="">Select Exam</option>';
    subjectSelect.innerHTML = '<option value="">Select Subject</option>';

    if (selectedClass && ACADEMIC_MAP[selectedClass]) {
      ACADEMIC_MAP[selectedClass].exams.forEach(ex => {
        examSelect.innerHTML += `<option value="${ex}">${ex}</option>`;
      });
      ACADEMIC_MAP[selectedClass].subjects.forEach(sub => {
        subjectSelect.innerHTML += `<option value="${sub}">${sub}</option>`;
      });
    }
  });
}

/* Fetch Students List */
async function loadStudents(affiliationNo) {
  try {
    const res = await fetch(GAS_API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "getStudents", affiliationNo })
    });
    const data = await res.json();
    
    if (data.success) {
      window.currentStudents = data.students;
      renderTable();
    }
  } catch (err) {
    showAlert("Failed to retrieve student records.");
  }
}

function renderTable() {
  const classVal = document.getElementById("classSelect").value;
  const tbody = document.getElementById("studentTableBody");
  tbody.innerHTML = "";

  const filtered = (window.currentStudents || []).filter(s => !classVal || s.class === classVal);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">No students matched</td></tr>`;
    return;
  }

  filtered.forEach(s => {
    tbody.innerHTML += `
      <tr>
        <td>${s.admissionNo}</td>
        <td>${s.name}</td>
        <td>${s.class}</td>
        <td>
          <input type="number" class="mark-input" data-id="${s.admissionNo}" data-name="${s.name}" style="width:80px; padding:0.4rem; border-radius:10px; border:1px solid #ccc;">
        </td>
      </tr>
    `;
  });
}

/* Save Batch Marks */
async function handleSaveMarks() {
  const teacher = JSON.parse(localStorage.getItem("snec_teacher"));
  const className = document.getElementById("classSelect").value;
  const examType = document.getElementById("examSelect").value;
  const subject = document.getElementById("subjectSelect").value;

  if (!className || !examType || !subject) {
    showAlert("Please select Class, Exam, and Subject.");
    return;
  }

  const markInputs = document.querySelectorAll(".mark-input");
  const marksData = [];

  markInputs.forEach(input => {
    if (input.value !== "") {
      marksData.push({
        affiliationNo: teacher.affiliationNo,
        teacherId: teacher.id,
        admissionNo: input.dataset.id,
        studentName: input.dataset.name,
        className,
        examType,
        subject,
        mark: input.value
      });
    }
  });

  if (marksData.length === 0) {
    showAlert("Please enter marks for at least one student.");
    return;
  }

  const res = await fetch(GAS_API_URL, {
    method: "POST",
    body: JSON.stringify({ action: "saveMarks", marksData })
  });
  const data = await res.json();
  showAlert(data.message);
}

/* Advanced Keyboard Navigation: Shift focus on Enter Key */
function initKeyboardNavigation() {
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.tagName === "INPUT") {
      e.preventDefault();
      const focusable = Array.from(document.querySelectorAll("input, select, button"));
      const index = focusable.indexOf(e.target);
      if (index > -1 && index + 1 < focusable.length) {
        focusable[index + 1].focus();
      }
    }
  });
}

/* PWA App Install Logic */
function initPWA() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = document.getElementById("pwaInstallBtn");
    btn.style.display = "block";
    btn.addEventListener("click", () => {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => {
        btn.style.display = "none";
      });
    });
  });
}
