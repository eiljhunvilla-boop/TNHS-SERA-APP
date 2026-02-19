const pages = document.querySelectorAll(".page");
let step = 0;
let answers = {};
let finalMessage = "";

const questions = [
  { key: "reporter", question: "Enter Your Name", type: "input" },
  { key: "type", question: "Select Emergency Type", options: ["Trauma", "Medical", "Fire"] },

  // --- FIRE QUESTIONS ---
  { key: "fireType", question: "Select Fire Type", options: ["Residential", "Commercial", "Vehicle", "Wildfire", "Other"], dependsOn: "type", dependsValue: "FIRE" },
  { key: "location", question: "ENTER YOUR SPECIFIC LOCATION", type: "input", dependsOn: "type", dependsValue: "FIRE" },
  { key: "patientsPresent", question: "Are there Patients?", options: ["Yes", "No"], dependsOn: "type", dependsValue: "FIRE" },
  { key: "numPatients", question: "Number of People at Risk", options: ["Unknown"], type: "input", inputMode: "numeric", dependsOn: "patientsPresent", dependsValue: "YES" },
  { key: "trapped", question: "Are People Trapped?", options: ["Yes", "No"], dependsOn: "patientsPresent", dependsValue: "YES" },
  { key: "fireStatus", question: "Fire Status", options: ["Spreading", "Contained", "Out of Control"], dependsOn: "type", dependsValue: "FIRE" },
  { key: "sceneSafe", question: "Is Scene Safe?", options: ["Yes", "No"] }
];

// --- MEDICAL/TRAMA QUESTIONS added dynamically if patients are present ---
const patientQuestions = [
  { key: "conscious", question: "Is Patient Conscious?", options: ["Yes", "No"] },
  { key: "breathing", question: "Is Patient Breathing?", options: ["Yes", "No"] },
  { key: "sex", question: "Sex of Patient", options: ["Male", "Female"] },
  { key: "condition", question: "Select Condition", options: [
      "Severe bleeding",
      "Fracture",
      "Burns",
      "Unconscious",
      "Difficulty breathing",
      "None",
      "Other"
    ]
  }
];

const backContainer = document.getElementById("backContainer");

function showPage(id){
  pages.forEach(p => p.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

function startApp(){
  showPage("questionPage");
  step = 0;
  answers = {};
  loadQuestion();
}

function loadQuestion(){
  // Skip questions that have dependency not met
  while (questions[step] && questions[step].dependsOn && answers[questions[step].dependsOn] !== questions[step].dependsValue) {
    step++;
  }

  // If finished main questions
  if(step >= questions.length){
    // If Fire and patients present, insert patientQuestions
    if(answers.type === "FIRE" && answers.patientsPresent === "YES"){
      questions.push(...patientQuestions);
      loadQuestion();
      return;
    }
    generateSummary();
    return;
  }

  const q = questions[step];
  const container = document.getElementById("optionsContainer");
  container.innerHTML = "";
  document.getElementById("questionTitle").innerText = q.question;

  // BACK BUTTON
  backContainer.innerHTML = "";
  if(step > 0){
    const backBtn = document.createElement("button");
    backBtn.className = "back-btn";
    backBtn.innerHTML = "← <span>Back</span>";
    backBtn.onclick = () => {
      step--;
      loadQuestion();
    };
    backContainer.appendChild(backBtn);
  }

  // INPUT TYPE
  if(q.type === "input"){
    const input = document.createElement("input");
    input.id = "inputAnswer";
    input.required = true;
    if(q.inputMode) input.type = "number";
    if(answers[q.key]) input.value = answers[q.key];
    container.appendChild(input);

    // Unknown option for numeric fields
    if(q.options && q.options.includes("Unknown")){
      const unknownBtn = document.createElement("button");
      unknownBtn.innerText = "Unknown";
      unknownBtn.className = "option-btn";
      unknownBtn.onclick = () => {
        answers[q.key] = "UNKNOWN";
        step++;
        loadQuestion();
      };
      container.appendChild(unknownBtn);
    }

    const confirmBtn = document.createElement("button");
    confirmBtn.innerText = "Confirm";
    confirmBtn.className = "confirm-btn";
    confirmBtn.onclick = () => {
      if(!input.value.trim()) return alert("Required field.");
      answers[q.key] = input.value.trim().toUpperCase();
      step++;
      loadQuestion();
    };
    container.appendChild(confirmBtn);
    input.focus();

  } else { // OPTIONS TYPE
    q.options.forEach(option => {
      const btn = document.createElement("button");
      btn.innerText = option;
      btn.className = "option-btn";

      btn.onclick = () => {
        if(option === "Other"){
          container.innerHTML = "";
          const input = document.createElement("input");
          input.placeholder = "Specify condition";
          if(answers[q.key] && answers[q.key] !== "OTHER") input.value = answers[q.key];
          container.appendChild(input);

          const confirmBtn = document.createElement("button");
          confirmBtn.innerText = "Confirm";
          confirmBtn.className = "confirm-btn";
          confirmBtn.onclick = () => {
            if(!input.value.trim()) return alert("Required field.");
            answers[q.key] = input.value.trim().toUpperCase();
            step++;
            loadQuestion();
          };
          container.appendChild(confirmBtn);
          input.focus();
          return;
        }

        answers[q.key] = option.toUpperCase();
        step++;
        loadQuestion();
      };

      container.appendChild(btn);
    });
  }
}

function generateSummary(){
  const time = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});

  if(answers.type === "FIRE"){
    finalMessage = `🚨 FIRE REPORT 🚨

Fire Type: ${answers.fireType || "-"}
Location: ${answers.location || "-"}
Patients Present: ${answers.patientsPresent || "-"}
${answers.patientsPresent === "YES" ? 
`Number of People at Risk: ${answers.numPatients || "-"}
Primary Patient:
Conscious: ${answers.conscious || "-"}
Breathing: ${answers.breathing || "-"}
Sex: ${answers.sex || "-"}
Condition: ${answers.condition || "-"}` : ""}
Trapped: ${answers.trapped || "-"}
Fire Status: ${answers.fireStatus || "-"}
Scene Safe: ${answers.sceneSafe || "-"}
Time: ${time}
Reporter: ${answers.reporter || "-"}`;
  } else { // Trauma / Medical
    finalMessage = `🚨 EMERGENCY REPORT 🚨

Type: ${answers.type}
Patients: ${answers.numPatients || "-"}
Primary Patient:
Conscious: ${answers.conscious || "-"}
Breathing: ${answers.breathing || "-"}
Sex: ${answers.sex || "-"}
Condition: ${answers.condition || "-"}
Scene Safe: ${answers.sceneSafe || "-"}
Location: ${answers.location || "-"}
Time: ${time}
Reporter: ${answers.reporter || "-"}`;
  }

  document.getElementById("summaryText").textContent = finalMessage.toUpperCase();
  showPage("summaryPage");
}

function confirmSend(){
  fetch("/api/send", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({message: finalMessage})
  })
  .then(res => res.json())
  .then(() => {
    alert("Alert Sent Successfully!");
    location.reload();
  })
  .catch(() => alert("Failed to send."));
}
