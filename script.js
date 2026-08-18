// Paste your deployed Google Apps Script Web App URL here
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbxBoZRdoxMPa09e2Dla8IMxlkaGO3xAOe6U9acbyx13QJfSCjOZcxBQaY4R7z6LzjHZ/exec";

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

function showAlert(message) {
  document.getElementById("modalMessage").innerText = message;
  document.getElementById("appModal").style.display = "flex";
}

function closeModal() {
  document.getElementById("appModal").style.display = "none";
}

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
}

function initPasswordToggle() {
  const toggle = document.getElementById("togglePassword");
  const field = document.getElementById("password");
  toggle.addEventListener("click", () => {
    const type = field.type === "password" ? "text" : "password";
    field.type = type;
    toggle.classList.toggle("fa-eye-slash");
  });
}

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

      const teacher = JSON.parse(localStorage.getItem("snec_teacher"));
      if (teacher) {
        loadStudents(teacher.affiliationNo, selectedClass);
      }
    } else {
      document.getElementById("studentTableBody").innerHTML = `<tr><td colspan="4" style="text-align:center;">Select Class filter to view students</td></tr>`;
    }
  });
}

async function loadStudents(affiliationNo, selectedClass) {
  try {
    const tbody = document.getElementById("studentTableBody");
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Loading students...</td></tr>`;

    const res = await fetch(GAS_API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "getStudents", affiliationNo, selectedClass })
    });
    const data = await res.json();
    
    if (data.success) {
      renderTable(data.students);
    }
  } catch (err) {
    showAlert("Failed to retrieve student records.");
  }
}

function renderTable(students) {
  const tbody = document.getElementById("studentTableBody");
  tbody.innerHTML = "";

  if (!students || students.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">No students found for this class</td></tr>`;
    return;
  }

  students.forEach(s => {
    tbody.innerHTML += `
      <tr>
        <td><strong>${s.admissionNo}</strong></td>
        <td>${s.name}</td>
        <td><span style="background:#e2e8f0; padding:3px 8px; border-radius:12px; font-size:0.85rem;">${s.class}</span></td>
        <td>
          <input type="number" class="mark-input" data-id="${s.admissionNo}" data-name="${s.name}" placeholder="Mark" style="width:90px; padding:0.4rem 0.8rem; border-radius:15px; border:1px solid #cbd5e1; outline:none;">
        </td>
      </tr>
    `;
  });
}

async function handleSaveMarks() {
  const teacher = JSON.parse(localStorage.getItem("snec_teacher"));
  const className = document.getElementById("classSelect").value;
  const examType = document.getElementById("examSelect").value;
  const subject = document.getElementById("subjectSelect").value;
  const maxMarks = document.getElementById("maxMarksInput").value || "50";
  const examDate = document.getElementById("examDateInput").value || "";

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
        examDate: examDate,
        admissionNo: input.dataset.id,
        studentName: input.dataset.name,
        className,
        examType,
        subject,
        mark: input.value,
        maxMarks: maxMarks
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
