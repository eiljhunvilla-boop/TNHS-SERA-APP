const pages = document.querySelectorAll(".page");
let step = 0;
let answers = {};
let finalMessage = "";

// Trauma & Medical Questions
const questions = [
  { key: "reporter", question: "Enter Your Name", type: "input" },
  { key: "type", question: "Select Emergency Type", options: ["Trauma", "Medical"] },
  { key: "patients", question: "Number of Patients", type: "input", inputMode: "numeric" },
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
  },
  { key: "sceneSafe", question: "Is Scene Safe?", options: ["Yes", "No"] },
  { key: "location", question: "ENTER YOUR SPECIFIC LOCATION", type: "input" }
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
  if(step >= questions.length){
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

  if(q.type === "input"){
    const input = document.createElement("input");
    input.id = "inputAnswer";
    input.required = true;
    if(q.inputMode) input.type = "number";
    if(answers[q.key]) input.value = answers[q.key];
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

  } else { // options
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
  finalMessage = `🚨 EMERGENCY REPORT 🚨

Type: ${answers.type}
Patients: ${answers.patients}
Primary Patient:
Conscious: ${answers.conscious}
Breathing: ${answers.breathing}
Sex: ${answers.sex}
Condition: ${answers.condition}
Scene Safe: ${answers.sceneSafe}
Location: ${answers.location}
Time: ${time}
Reporter: ${answers.reporter}`;

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
