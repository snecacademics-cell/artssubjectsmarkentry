const GAS_API_URL = "https://script.google.com/macros/s/AKfycbxBoZRdoxMPa09e2Dla8IMxlkaGO3xAOe6U9acbyx13QJfSCjOZcxBQaY4R7z6LzjHZ/exec"; // ബാക്ക്-എൻഡ് വബ്ബ് ആപ്പ് URL മാറ്റി പേസ്റ്റ് ചെയ്യുക

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

let pendingSaveData = null;

document.addEventListener("DOMContentLoaded", () => {
  initAuth();
  initDynamicDropdowns();

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

      // Load Students INSTANTLY upon Class Selection
      const teacher = JSON.parse(localStorage.getItem("snec_teacher"));
      if (teacher) {
        loadStudents(teacher.affiliationNo, selectedClass, "", "");
      }
    } else {
      document.getElementById("studentTableBody").innerHTML = `<tr><td colspan="5" style="text-align:center;">Select Class to load students</td></tr>`;
    }
  });

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

  const maxMarksVal = document.getElementById("maxMarksInput").value;
  const maxMarks = parseFloat(maxMarksVal);

  students.forEach((s, index) => {
    let percText = "-";
    if (s.existingMark !== "" && !isNaN(s.existingMark) && !isNaN(maxMarks) && maxMarks > 0) {
      percText = ((parseFloat(s.existingMark) / maxMarks) * 100).toFixed(1) + "%";
    }

    tbody.innerHTML += `
      <tr>
        <td style="color: #64748b; font-weight: 600;">${index + 1}</td>
        <td><strong>${s.uid}</strong></td>
        <td>${s.name}</td>
        <td>
          <input type="number" class="mark-input" data-id="${s.uid}" data-name="${s.name}" value="${s.existingMark}" placeholder="Mark" style="width:80px; padding:0.4rem 0.6rem; border-radius:15px; border:1px solid #cbd5e1; outline:none;">
        </td>
        <td class="perc-cell" style="font-weight:600; color:#2a5298;">${percText}</td>
      </tr>
    `;
  });

  document.querySelectorAll(".mark-input").forEach(input => {
    input.addEventListener("input", function() {
      validateAndCalculatePercentage(this);
    });
  });
}

function validateAndCalculatePercentage(inputElem) {
  const maxMarksInput = document.getElementById("maxMarksInput");
  const maxMarksVal = maxMarksInput.value.trim();
  const maxMarks = parseFloat(maxMarksVal);
  const row = inputElem.closest("tr");
  const percCell = row.querySelector(".perc-cell");

  if (!maxMarksVal || isNaN(maxMarks) || maxMarks <= 0) {
    showAlert("Please enter a valid Total Max Marks first.");
    inputElem.value = "";
    percCell.innerText = "-";
    maxMarksInput.focus();
    return;
  }

  const val = parseFloat(inputElem.value);

  if (!isNaN(val)) {
    if (val > maxMarks) {
      showAlert(`Mark cannot be greater than Total Max Marks (${maxMarks})!`);
      inputElem.value = "";
      percCell.innerText = "-";
    } else {
      const perc = ((val / maxMarks) * 100).toFixed(1);
      percCell.innerText = `${perc}%`;
    }
  } else {
    percCell.innerText = "-";
  }
}

function recalculateAllPercentages() {
  const markInputs = document.querySelectorAll(".mark-input");
  markInputs.forEach(input => validateAndCalculatePercentage(input));
}

function handleSaveMarksClick() {
  const teacher = JSON.parse(localStorage.getItem("snec_teacher"));
  const className = document.getElementById("classSelect").value;
  const examType = document.getElementById("examSelect").value;
  const subject = document.getElementById("subjectSelect").value;
  const maxMarksVal = document.getElementById("maxMarksInput").value.trim();
  const examDate = document.getElementById("examDateInput").value || "";

  if (!className) {
    showAlert("Please select Class first.");
    return;
  }

  if (!examType) {
    showAlert("Please select Exam name.");
    return;
  }

  if (!subject) {
    showAlert("Please select Subject.");
    return;
  }

  if (!maxMarksVal || isNaN(parseFloat(maxMarksVal)) || parseFloat(maxMarksVal) <= 0) {
    showAlert("Please enter Total Max Marks before saving.");
    return;
  }

  const markInputs = document.querySelectorAll(".mark-input");
  const totalStudents = markInputs.length;
  const marksData = [];

  markInputs.forEach(input => {
    if (input.value !== "") {
      const markVal = parseFloat(input.value);
      const percVal = ((markVal / parseFloat(maxMarksVal)) * 100).toFixed(1) + "%";

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
        maxMarks: maxMarksVal,
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

    // Reset Form Data After Success
    document.getElementById("classSelect").value = "";
    document.getElementById("examSelect").innerHTML = '<option value="">Select Exam</option>';
    document.getElementById("subjectSelect").innerHTML = '<option value="">Select Subject</option>';
    document.getElementById("examDateInput").value = "";
    document.getElementById("maxMarksInput").value = "";
    document.getElementById("studentTableBody").innerHTML = `<tr><td colspan="5" style="text-align:center;">Select Class to load students</td></tr>`;
    
    pendingSaveData = null;

  } catch (err) {
    showAlert("Error saving marks. Please try again.");
  }
}
