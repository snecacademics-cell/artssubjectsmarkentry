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
let pendingSaveData = null;

document.addEventListener("DOMContentLoaded", () => {
  initAuth();
  initPasswordToggle();
  initDynamicDropdowns();
  initKeyboardNavigation();
  initPWA();

  document.getElementById("loginForm").addEventListener("submit", handleLoginSubmit);
  document.getElementById("logoutBtn").addEventListener("click", instantLogout);
  document.getElementById("saveMarksBtn").addEventListener("click", handleSaveMarksClick);
  document.getElementById("modalCloseBtn").addEventListener("click", closeModal);
  document.getElementById("confirmYesBtn").addEventListener("click", executePendingSave);
  document.getElementById("confirmNoBtn").addEventListener("click", () => {
    document.getElementById("confirmModal").style.display = "none";
  });
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

  const triggerFetch = () => {
    const selectedClass = classSelect.value;
    const examType = examSelect.value;
    const subject = subjectSelect.value;

    if (selectedClass && examType && subject) {
      const teacher = JSON.parse(localStorage.getItem("snec_teacher"));
      if (teacher) {
        loadStudents(teacher.affiliationNo, selectedClass, examType, subject);
      }
    } else {
      document.getElementById("studentTableBody").innerHTML = `<tr><td colspan="5" style="text-align:center;">Select Class, Exam & Subject to load students</td></tr>`;
    }
  };

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
    triggerFetch();
  });

  examSelect.addEventListener("change", triggerFetch);
  subjectSelect.addEventListener("change", triggerFetch);
  document.getElementById("maxMarksInput").addEventListener("input", recalculateAllPercentages);
}

async function loadStudents(affiliationNo, selectedClass, examType, subject) {
  try {
    const tbody = document.getElementById("studentTableBody");
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Loading students data...</td></tr>`;

    const res = await fetch(GAS_API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "getStudents", affiliationNo, selectedClass, examType, subject })
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
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No students found for this class</td></tr>`;
    return;
  }

  const maxMarks = parseFloat(document.getElementById("maxMarksInput").value) || 100;

  students.forEach((s, index) => {
    let percText = "-";
    if (s.existingMark !== "" && !isNaN(s.existingMark)) {
      percText = ((parseFloat(s.existingMark) / maxMarks) * 100).toFixed(1) + "%";
    }

    tbody.innerHTML += `
      <tr>
        <td style="color: #64748b; font-weight: 600;">${index + 1}</td>
        <td><strong>${s.uid}</strong></td>
        <td>${s.name}</td>
        <td>
          <input type="number" class="mark-input" data-id="${s.uid}" data-name="${s.name}" value="${s.existingMark}" placeholder="Mark" style="width:75px; padding:0.4rem 0.6rem; border-radius:15px; border:1px solid #cbd5e1; outline:none;" oninput="updateRowPercentage(this)">
        </td>
        <td class="perc-cell" style="font-weight:600; color:#2a5298;">${percText}</td>
      </tr>
    `;
  });
}

function updateRowPercentage(inputElem) {
  const row = inputElem.closest("tr");
  const percCell = row.querySelector(".perc-cell");
  const maxMarks = parseFloat(document.getElementById("maxMarksInput").value) || 100;
  const val = parseFloat(inputElem.value);

  if (!isNaN(val) && maxMarks > 0) {
    const perc = ((val / maxMarks) * 100).toFixed(1);
    percCell.innerText = `${perc}%`;
  } else {
    percCell.innerText = "-";
  }
}

function recalculateAllPercentages() {
  const markInputs = document.querySelectorAll(".mark-input");
  markInputs.forEach(input => updateRowPercentage(input));
}

function handleSaveMarksClick() {
  const teacher = JSON.parse(localStorage.getItem("snec_teacher"));
  const className = document.getElementById("classSelect").value;
  const examType = document.getElementById("examSelect").value;
  const subject = document.getElementById("subjectSelect").value;
  const maxMarks = document.getElementById("maxMarksInput").value || "100";
  const examDate = document.getElementById("examDateInput").value || "";

  if (!className || !examType || !subject) {
    showAlert("Please select Class, Exam, and Subject first.");
    return;
  }

  const markInputs = document.querySelectorAll(".mark-input");
  const totalStudents = markInputs.length;
  const marksData = [];

  markInputs.forEach(input => {
    if (input.value !== "") {
      const markVal = parseFloat(input.value);
      const percVal = ((markVal / parseFloat(maxMarks)) * 100).toFixed(1) + "%";

      marksData.push({
        affiliationNo: teacher.affiliationNo,
        teacherId: teacher.id,
        examDate: examDate,
        admissionNo: input.dataset.id,
        studentName: input.dataset.name,
        className,
        examType,
        subject,
        mark: markVal,
        maxMarks: maxMarks,
        percentage: percVal
      });
    }
  });

  if (marksData.length === 0) {
    showAlert("Please enter marks for at least one student before saving.");
    return;
  }

  pendingSaveData = marksData;

  if (marksData.length < totalStudents) {
    document.getElementById("confirmMessage").innerText = `You have entered marks for ${marksData.length} out of ${totalStudents} students.\n\nDo you want to submit partial marks now and enter the remaining students later?`;
    document.getElementById("confirmModal").style.display = "flex";
  } else {
    executePendingSave();
  }
}

async function executePendingSave() {
  document.getElementById("confirmModal").style.display = "none";
  if (!pendingSaveData) return;

  try {
    const res = await fetch(GAS_API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "saveMarks", marksData: pendingSaveData })
    });
    const data = await res.json();
    showAlert(data.message);

    // Clear filters and fields after successful submission
    document.getElementById("subjectSelect").value = "";
    document.getElementById("studentTableBody").innerHTML = `<tr><td colspan="5" style="text-align:center;">Select Class, Exam & Subject to load students</td></tr>`;
    pendingSaveData = null;

  } catch (err) {
    showAlert("Error saving marks. Please try again.");
  }
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
