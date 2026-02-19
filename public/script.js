const pages = document.querySelectorAll(".page");
let reporter = "";
let finalMessage = "";

function showPage(id) {
  pages.forEach(p => p.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

function startReport() {
  const name = document.getElementById("reporterName").value.trim();
  if (!name) return alert("Name required");
  reporter = name;
  showPage("reportPage");
}

const emergencyType = document.getElementById("emergencyType");
const medicalSection = document.getElementById("medicalSection");
const fireSection = document.getElementById("fireSection");
const condition = document.getElementById("condition");
const otherCondition = document.getElementById("otherCondition");

emergencyType.addEventListener("change", () => {
  medicalSection.classList.add("hidden");
  fireSection.classList.add("hidden");

  if (emergencyType.value === "Fire") {
    fireSection.classList.remove("hidden");
  } else {
    medicalSection.classList.remove("hidden");
  }
});

condition.addEventListener("change", () => {
  if (condition.value === "Other") {
    otherCondition.classList.remove("hidden");
    otherCondition.required = true;
  } else {
    otherCondition.classList.add("hidden");
    otherCondition.required = false;
  }
});

document.getElementById("reportForm").addEventListener("submit", function(e){
  e.preventDefault();

  const time = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  const type = emergencyType.value;

  if(type === "Fire"){
    finalMessage =
`🚨 FIRE REPORT 🚨

Type: ${fireType.value}

Location: ${fireLocation.value}

Patients: ${firePatients.value}

Trapped: ${trapped.value}

Fire Status: ${fireStatus.value}

Time: ${time}

Reporter: ${reporter}`;
  } else {

    let injury = condition.value === "Other"
      ? otherCondition.value
      : condition.value;

    finalMessage =
`🚨 EMERGENCY REPORT 🚨

Type: ${type}

Patients: ${patients.value}

Primary Patient:

Conscious: ${conscious.value}

Breathing: ${breathing.value}

Sex: ${sex.value}

Condition: ${injury}

Scene Safe: ${sceneSafe.value}

Location: ${location.value}

Time: ${time}

Reporter: ${reporter}`;
  }

  document.getElementById("summaryText").textContent = finalMessage;
  showPage("summaryPage");
});

function sendReport(){
  fetch("/api/send",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({message:finalMessage})
  })
  .then(res=>res.json())
  .then(()=> {
    alert("Alert Sent Successfully!");
    location.reload();
  })
  .catch(()=> alert("Failed to send"));
}
