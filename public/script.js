/* =========================================
   TNHSAFE - AUTHENTICATION AND REPORTING
========================================= */

const pages = document.querySelectorAll(".page");

let step = 0;
let answers = {};
let finalMessage = "";
let isSending = false;

let auth = null;
let db = null;
let usernameToEmail = null;
let firebaseSignIn = null;
let firebaseSignOut = null;
let firebaseAuthReady = false;

let currentUser = null;
let currentProfile = null;
let guestMode = false;


/* =========================================
   ORIGINAL EMERGENCY QUESTIONS
========================================= */

const questions = [
    {
        key: "reporter",
        question: "Enter Your Name",
        subtitle:
            "Please provide your name to continue with the emergency report.",
        icon: "👤",
        placeholder: "e.g. Juan Dela Cruz",
        type: "input"
    },
    {
        key: "type",
        question: "Select Emergency Type",
        subtitle:
            "Choose the type of incident so we can route it to the right responders.",
        icon: "🚨",
        options: [
            {
                value: "Trauma",
                description:
                    "Injuries, accidents, bleeding, falls, etc.",
                icon: "🚶‍♂️"
            },
            {
                value: "Medical",
                description:
                    "Illness, fainting, allergic reactions, cardiac issues, etc.",
                icon: "✚"
            }
        ]
    },
    {
        key: "patients",
        question: "Number of Patients",
        subtitle:
            "How many people need assistance?",
        icon: "👥",
        placeholder: "Enter number of patients",
        type: "input",
        inputMode: "numeric"
    },
    {
        key: "conscious",
        question: "Is Patient Conscious?",
        subtitle:
            "Select the patient's current level of consciousness.",
        icon: "🧠",
        options: ["Yes", "No"]
    },
    {
        key: "breathing",
        question: "Is Patient Breathing?",
        subtitle:
            "Select the patient's current breathing status.",
        icon: "🫁",
        options: ["Yes", "No"]
    },
    {
        key: "sex",
        question: "Sex of Patient",
        subtitle:
            "Select the patient's sex.",
        icon: "👤",
        options: ["Male", "Female"]
    },
    {
        key: "condition",
        question: "Select Condition",
        subtitle:
            "Choose the patient's reported condition.",
        icon: "🩹",
        options: [
            "Severe bleeding",
            "Fracture",
            "Burns",
            "Unconscious",
            "Difficulty breathing",
            "None",
            "Other"
        ]
    },
    {
        key: "sceneSafe",
        question: "Is Scene Safe?",
        subtitle:
            "Assess whether the scene appears safe for responders to approach.",
        icon: "🛡️",
        options: ["Yes", "No"]
    },
    {
        key: "location",
        question: "Enter Your Specific Location",
        subtitle:
            "Provide the exact school area where assistance is needed.",
        icon: "📍",
        placeholder: "e.g. Grade 10 Building, Room 204",
        type: "input"
    }
];

let activeQuestions = questions;


/* =========================================
   PAGE ELEMENTS
========================================= */

const backContainer = document.getElementById("backContainer");

const questionTitle = document.getElementById("questionTitle");
const questionSubtitle = document.getElementById("questionSubtitle");
const questionIcon = document.getElementById("questionIcon");
const stepIndicator = document.getElementById("stepIndicator");

const optionsContainer = document.getElementById("optionsContainer");

const summaryText = document.getElementById("summaryText");
const sendButton = document.getElementById("sendButton");


/* =========================================
   PAGE NAVIGATION
========================================= */

function showPage(id) {
    closeSidebar();

    pages.forEach(page => {
        page.classList.remove("active");
    });

    const targetPage = document.getElementById(id);

    if (targetPage) {
        targetPage.classList.add("active");
    }

    window.scrollTo({
        top: 0,
        behavior: "auto"
    });
}


/* =========================================
   SAFE FORM MESSAGES
========================================= */

function showMessage(elementId, message) {
    const element = document.getElementById(elementId);

    if (!element) {
        return;
    }

    element.textContent = message;
    element.hidden = !message;
}

function clearMessages(...elementIds) {
    elementIds.forEach(id => showMessage(id, ""));
}


/* =========================================
   PASSWORD VISIBILITY TOGGLES
========================================= */

function initializePasswordToggles() {
    const toggleButtons = document.querySelectorAll(
        "[data-password-toggle]"
    );

    toggleButtons.forEach(button => {
        // Avoid attaching duplicate event listeners.
        if (button.dataset.toggleInitialized === "true") {
            return;
        }

        button.dataset.toggleInitialized = "true";

        button.addEventListener("click", () => {
            const inputId = button.dataset.passwordToggle;
            const passwordInput = document.getElementById(inputId);

            if (!passwordInput) {
                console.warn(
                    `Password input not found: ${inputId}`
                );
                return;
            }

            const shouldShow = passwordInput.type === "password";

            passwordInput.type = shouldShow ? "text" : "password";

            const label = shouldShow
                ? "Hide password"
                : "Show password";

            button.setAttribute("aria-label", label);
            button.setAttribute("title", label);
            button.setAttribute(
                "aria-pressed",
                String(shouldShow)
            );

            button.classList.toggle(
                "is-visible",
                shouldShow
            );

            // Update the icon to match the current visibility state.
            button.innerHTML = shouldShow
                ? `
                    <svg
                        class="eye-icon"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        focusable="false"
                    >
                        <path d="M3 3l18 18"></path>
                        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"></path>
                        <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a15.8 15.8 0 0 1-4.1 4.8"></path>
                        <path d="M6.2 6.2C3.5 8 2 12 2 12s3.6 7 10 7c1.1 0 2.1-.2 3-.5"></path>
                    </svg>
                `
                : `
                    <svg
                        class="eye-icon"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        focusable="false"
                    >
                        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                `;
        });
    });
}


/* =========================================
   FIREBASE INITIALIZATION
========================================= */

/*
 * Firebase is loaded dynamically so a Firebase configuration
 * or network failure does not prevent guest reporting from
 * initializing.
 */

async function initializeFirebase() {
    try {
        const firebaseConfigModule =
            await import("./firebase-config.js");

        const firebaseAuthModule =
            await import(
                "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js"
            );

        auth = firebaseConfigModule.auth;
        db = firebaseConfigModule.db;
        usernameToEmail = firebaseConfigModule.usernameToEmail;

        firebaseSignIn =
            firebaseAuthModule.signInWithEmailAndPassword;

        firebaseSignOut =
            firebaseAuthModule.signOut;

        const onAuthStateChanged =
            firebaseAuthModule.onAuthStateChanged;

        if (
            !auth ||
            typeof usernameToEmail !== "function"
        ) {
            throw new Error(
                "Firebase configuration is incomplete."
            );
        }

        firebaseAuthReady = true;

        onAuthStateChanged(auth, async user => {
            currentUser = user;

            if (!user) {
                currentProfile = null;
                updateAccountInterface();
                return;
            }

            /*
             * Retrieve the account profile from the trusted server.
             * Do not trust role information supplied by the browser.
             */

            try {
                const token = await user.getIdToken();

                const response = await fetch("/api/me", {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${token}`
                    },
                    cache: "no-store"
                });

                const result = await response
                    .json()
                    .catch(() => ({}));

                if (!response.ok || !result.profile) {
                    throw new Error(
                        result.message ||
                        "Unable to retrieve your account profile."
                    );
                }

                currentProfile = result.profile;
                guestMode = false;

                updateAccountInterface();
                showPage("homePage");
            } catch (error) {
                console.error(
                    "TNHSafe profile initialization failed:",
                    error
                );

                currentProfile = null;

                /*
                 * If the account profile cannot be verified,
                 * do not grant access to the authenticated interface.
                 */

                try {
                    await firebaseSignOut(auth);
                } catch (signOutError) {
                    console.error(
                        "TNHSafe session cleanup failed:",
                        signOutError
                    );
                }

                currentUser = null;
                guestMode = false;

                updateAccountInterface();
                showPage("loginPage");

                showMessage(
                    "loginError",
                    "We could not verify your account. Please try again."
                );
            }
        });
    } catch (error) {
        firebaseAuthReady = false;

        console.error(
            "TNHSafe Firebase initialization failed:",
            error
        );

        /*
         * Keep the login page available.
         * Guest emergency reporting must not depend on Firebase.
         */

        updateAccountInterface();
    }
}


/* =========================================
   ACCOUNT INTERFACE
========================================= */

function updateAccountInterface() {
    const topbar = document.getElementById("appTopbar");

    if (!topbar) {
        return;
    }

    const isAuthenticated =
        Boolean(currentUser && currentProfile && !guestMode);

    topbar.hidden = !isAuthenticated;

    const topbarUser = document.getElementById("topbarUser");

    const sidebarFullName =
        document.getElementById("sidebarFullName");

    const sidebarRole =
        document.getElementById("sidebarRole");

    const sidebarAvatarInitial =
        document.getElementById("sidebarAvatarInitial");

    if (!isAuthenticated) {
        return;
    }

    if (topbarUser) {
        topbarUser.textContent = currentProfile.fullName || "";
    }

    if (sidebarFullName) {
        sidebarFullName.textContent = currentProfile.fullName || "";
    }

    if (sidebarRole) {
        sidebarRole.textContent = currentProfile.role || "";
    }

    if (sidebarAvatarInitial) {
        sidebarAvatarInitial.textContent =
            currentProfile.fullName?.trim().charAt(0).toUpperCase() || "U";
    }

    populateProfilePage();
}


/* =========================================
   REGISTRATION
========================================= */

const registerForm = document.getElementById("registerForm");
const registerRole = document.getElementById("registerRole");
const studentFields = document.getElementById("studentFields");

function updateStudentFields() {
    if (!registerRole || !studentFields) {
        return;
    }

    const isStudent = registerRole.value === "Student";

    studentFields.hidden = !isStudent;

    const lrn = document.getElementById("registerLRN");
    const grade = document.getElementById("registerGrade");
    const section = document.getElementById("registerSection");

    [lrn, grade, section].forEach(field => {
        if (!field) {
            return;
        }

        field.required = isStudent;
        field.disabled = !isStudent;

        if (!isStudent) {
            field.value = "";
        }
    });
}

registerRole?.addEventListener("change", updateStudentFields);

updateStudentFields();


document.getElementById("showRegisterButton")
    ?.addEventListener("click", () => {
        clearMessages(
            "loginError",
            "loginSuccess",
            "registerError",
            "registerSuccess"
        );

        showPage("registerPage");
    });

document.getElementById("showLoginButton")
    ?.addEventListener("click", () => {
        clearMessages(
            "loginError",
            "loginSuccess",
            "registerError",
            "registerSuccess"
        );

        showPage("loginPage");
    });

document.getElementById("registerBackButton")
    ?.addEventListener("click", () => {
        clearMessages(
            "loginError",
            "loginSuccess",
            "registerError",
            "registerSuccess"
        );

        showPage("loginPage");
    });


registerForm?.addEventListener("submit", async event => {
    event.preventDefault();

    clearMessages("registerError", "registerSuccess");

    const registerButton =
        document.getElementById("registerButton");

    const fullName =
        document.getElementById("registerFullName").value.trim();

    const role = registerRole.value;

    const username =
        document.getElementById("registerUsername").value.trim();

    const password =
        document.getElementById("registerPassword").value;

    const confirmPassword =
        document.getElementById("registerConfirmPassword").value;

    const payload = {
        fullName,
        role,
        username,
        password,
        confirmPassword
    };

    if (role === "Student") {
        payload.lrn =
            document.getElementById("registerLRN").value.trim();

        payload.grade =
            document.getElementById("registerGrade").value;

        payload.section =
            document.getElementById("registerSection").value.trim();
    }

    if (password !== confirmPassword) {
        showMessage(
            "registerError",
            "Passwords do not match."
        );
        return;
    }

    if (!firebaseAuthReady) {
        showMessage(
            "registerError",
            "Registration is temporarily unavailable because Firebase could not be initialized. You can still use guest emergency reporting."
        );
        return;
    }

    if (registerButton) {
        registerButton.disabled = true;
        registerButton.textContent = "Creating Account...";
    }

    try {
        const response = await fetch("/api/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const result = await response
            .json()
            .catch(() => ({}));

        if (!response.ok || !result.success) {
            throw new Error(
                result.message ||
                "Registration failed. Please try again."
            );
        }

        registerForm.reset();
        updateStudentFields();

        clearMessages(
            "loginError",
            "loginSuccess",
            "registerError",
            "registerSuccess"
        );

        showPage("loginPage");

        showMessage(
            "loginSuccess",
            "Account created successfully. You can now log in with your username and password."
        );

        const loginUsername =
            document.getElementById("loginUsername");

        if (loginUsername) {
            loginUsername.value = username;
            loginUsername.focus();
        }

        const loginPassword =
            document.getElementById("loginPassword");

        if (loginPassword) {
            loginPassword.value = "";
            loginPassword.type = "password";
        }
    } catch (error) {
        console.error(
            "TNHSafe registration request failed:",
            error
        );

        showMessage(
            "registerError",
            error.message ||
            "Unable to register right now. Please try again."
        );
    } finally {
        if (registerButton) {
            registerButton.disabled = false;
            registerButton.textContent = "Create Account";
        }
    }
});


/* =========================================
   LOGIN
========================================= */

const loginForm = document.getElementById("loginForm");

loginForm?.addEventListener("submit", async event => {
    event.preventDefault();

    clearMessages("loginError", "loginSuccess");

    const loginButton =
        document.getElementById("loginButton");

    const username =
        document.getElementById("loginUsername").value.trim();

    const password =
        document.getElementById("loginPassword").value;

    if (!username || !password) {
        showMessage(
            "loginError",
            "Please enter your username and password."
        );
        return;
    }

    if (!firebaseAuthReady || !auth || !usernameToEmail) {
        showMessage(
            "loginError",
            "Login is temporarily unavailable. You can still report an emergency without an account."
        );
        return;
    }

    if (loginButton) {
        loginButton.disabled = true;
        loginButton.textContent = "Logging In...";
    }

    try {
        const email = usernameToEmail(username.toLowerCase());

        await firebaseSignIn(auth, email, password);

        /*
         * The Firebase authentication listener retrieves and verifies
         * the profile through /api/me before opening the account home.
         */

        document.getElementById("loginPassword").value = "";
        document.getElementById("loginPassword").type = "password";
    } catch (error) {
        console.error(
            "TNHSafe login failed:",
            error?.code || "UNKNOWN_ERROR"
        );

        let message =
            "Unable to log in. Check your username and password.";

        if (error?.code === "auth/too-many-requests") {
            message =
                "Too many login attempts. Please wait before trying again.";
        } else if (
            error?.code === "auth/network-request-failed"
        ) {
            message =
                "A network error occurred. Check your connection or report as a guest.";
        }

        showMessage("loginError", message);
    } finally {
        if (loginButton) {
            loginButton.disabled = false;
            loginButton.textContent = "Log In";
        }
    }
});


/* =========================================
   GUEST REPORTING
========================================= */

document.getElementById("guestReportButton")
    ?.addEventListener("click", () => {
        guestMode = true;
        currentProfile = null;

        updateAccountInterface();

        startApp();
    });


/* =========================================
   SIDEBAR NAVIGATION
========================================= */

const appSidebar = document.getElementById("appSidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const menuToggle = document.getElementById("menuToggle");

function openSidebar() {
    if (!currentUser || !currentProfile || guestMode) {
        return;
    }

    appSidebar?.classList.add("open");

    if (appSidebar) {
        appSidebar.setAttribute("aria-hidden", "false");
        appSidebar.inert = false;
    }

    if (sidebarOverlay) {
        sidebarOverlay.hidden = false;
    }

    menuToggle?.setAttribute("aria-expanded", "true");
}

function closeSidebar() {
    appSidebar?.classList.remove("open");

    if (appSidebar) {
        appSidebar.setAttribute("aria-hidden", "true");
        appSidebar.inert = true;
    }

    if (sidebarOverlay) {
        sidebarOverlay.hidden = true;
    }

    menuToggle?.setAttribute("aria-expanded", "false");
}

menuToggle?.addEventListener("click", openSidebar);

document.getElementById("sidebarClose")
    ?.addEventListener("click", closeSidebar);

sidebarOverlay?.addEventListener("click", closeSidebar);


function requireAuthenticatedProfile() {
    return Boolean(
        currentUser &&
        currentProfile &&
        !guestMode
    );
}

function openAccountPage(pageId) {
    if (!requireAuthenticatedProfile()) {
        showPage("loginPage");
        return;
    }

    showPage(pageId);
}

document.getElementById("profileMenuButton")
    ?.addEventListener("click", () => {
        populateProfilePage();
        openAccountPage("profilePage");
    });

document.getElementById("settingsMenuButton")
    ?.addEventListener("click", () => {
        openAccountPage("settingsPage");
    });

document.getElementById("problemMenuButton")
    ?.addEventListener("click", () => {
        openAccountPage("problemPage");
    });

document.getElementById("profileBackButton")
    ?.addEventListener("click", () => showPage("homePage"));

document.getElementById("settingsBackButton")
    ?.addEventListener("click", () => showPage("homePage"));

document.getElementById("problemBackButton")
    ?.addEventListener("click", () => showPage("homePage"));


/* =========================================
   PROFILE DISPLAY
========================================= */

function populateProfilePage() {
    if (!currentProfile) {
        return;
    }

    const profile = currentProfile;

    const fields = {
        profileFullName: profile.fullName,
        profileUsername: profile.username,
        profileRole: profile.role
    };

    Object.entries(fields).forEach(([id, value]) => {
        const element = document.getElementById(id);

        if (element) {
            element.textContent = value || "";
        }
    });

    const isStudent = profile.role === "Student";

    const studentRows = [
        ["profileLRNRow", "profileLRN", profile.lrn],
        ["profileGradeRow", "profileGrade", profile.grade],
        ["profileSectionRow", "profileSection", profile.section]
    ];

    studentRows.forEach(([rowId, valueId, value]) => {
        const row = document.getElementById(rowId);
        const valueElement = document.getElementById(valueId);

        if (row) {
            row.hidden = !isStudent;
        }

        if (valueElement) {
            valueElement.textContent =
                isStudent ? value || "" : "";
        }
    });
}


/* =========================================
   LOGOUT
========================================= */

async function logOut() {
    const confirmed = window.confirm(
        "Are you sure you want to log out?"
    );

    if (!confirmed) {
        return;
    }

    try {
        if (auth && currentUser && firebaseSignOut) {
            await firebaseSignOut(auth);
        }
    } catch (error) {
        console.error("TNHSafe logout failed:", error);

        alert(
            "The session could not be closed cleanly. Please try again."
        );

        return;
    }

    currentUser = null;
    currentProfile = null;
    guestMode = false;

    answers = {};
    finalMessage = "";
    step = 0;

    loginForm?.reset();

    const loginPassword =
        document.getElementById("loginPassword");

    if (loginPassword) {
        loginPassword.type = "password";
    }

    clearMessages(
        "loginError",
        "loginSuccess",
        "registerError",
        "registerSuccess"
    );

    updateAccountInterface();
    showPage("loginPage");
}

document.getElementById("logoutButton")
    ?.addEventListener("click", logOut);

document.getElementById("settingsLogoutButton")
    ?.addEventListener("click", logOut);


/* =========================================
   REPORT A PROBLEM
========================================= */

const problemForm = document.getElementById("problemForm");

problemForm?.addEventListener("submit", async event => {
    event.preventDefault();

    clearMessages("problemError", "problemSuccess");

    if (!requireAuthenticatedProfile()) {
        showMessage(
            "problemError",
            "Please log in before submitting feedback."
        );
        return;
    }

    const submitButton =
        document.getElementById("problemSubmitButton");

    const category =
        document.getElementById("problemCategory").value;

    const description =
        document.getElementById("problemDescription").value.trim();

    if (description.length < 10) {
        showMessage(
            "problemError",
            "Please provide at least 10 characters describing the problem."
        );
        return;
    }

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Submitting...";
    }

    try {
        const token = await currentUser.getIdToken();

        const response = await fetch("/api/problem-report", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                category,
                description
            })
        });

        const result = await response
            .json()
            .catch(() => ({}));

        if (!response.ok || !result.success) {
            throw new Error(
                result.message ||
                "Your feedback could not be submitted."
            );
        }

        problemForm.reset();

        showMessage(
            "problemSuccess",
            "Your feedback was submitted successfully."
        );
    } catch (error) {
        console.error(
            "TNHSafe problem report failed:",
            error
        );

        showMessage(
            "problemError",
            error.message ||
            "Unable to submit feedback. Please try again later."
        );
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = "Submit Feedback";
        }
    }
});


/* =========================================
   START EMERGENCY REPORT
========================================= */

function startApp() {
    step = 0;
    answers = {};
    finalMessage = "";
    isSending = false;

    /*
     * Authenticated users use their verified profile.
     * Guests must answer the reporter-name question.
     */

    const authenticated =
        Boolean(currentUser && currentProfile && !guestMode);

    activeQuestions = authenticated
        ? questions.filter(question => question.key !== "reporter")
        : questions;

    if (authenticated) {
        answers.reporter = currentProfile.fullName;
        answers.reporterRole = currentProfile.role;

        if (currentProfile.role === "Student") {
            answers.reporterGrade = currentProfile.grade;
            answers.reporterSection = currentProfile.section;
            answers.reporterLRN = currentProfile.lrn;
        }
    } else {
        answers.reporterRole = "Guest";
    }

    if (sendButton) {
        sendButton.disabled = false;
        sendButton.textContent = "Confirm & Send →";
    }

    showPage("questionPage");
    loadQuestion();
}


/* =========================================
   LOAD QUESTION
========================================= */

function loadQuestion() {
    if (step >= activeQuestions.length) {
        generateSummary();
        return;
    }

    const question = activeQuestions[step];

    optionsContainer.innerHTML = "";
    backContainer.innerHTML = "";

    questionTitle.textContent = question.question;
    questionSubtitle.textContent = question.subtitle || "";
    questionIcon.textContent = question.icon || "📋";

    stepIndicator.textContent =
        `STEP ${step + 1} OF ${activeQuestions.length}`;

    optionsContainer.classList.remove("emergency-type-options");

    const backButton = document.createElement("button");

    backButton.type = "button";
    backButton.className = "back-btn";
    backButton.innerHTML = "← <span>Back</span>";

    backButton.addEventListener("click", () => {
        if (step === 0) {
            showPage("homePage");
            return;
        }

        step--;
        loadQuestion();
        showPage("questionPage");
    });

    backContainer.appendChild(backButton);

    if (question.type === "input") {
        renderInputQuestion(question);
        return;
    }

    if (question.key === "type") {
        renderEmergencyTypeQuestion(question);
        return;
    }

    renderOptionQuestion(question);
}


/* =========================================
   INPUT QUESTIONS
========================================= */

function renderInputQuestion(question) {
    const isReporter = question.key === "reporter";
    const isPatientCount = question.key === "patients";

    const input = document.createElement("input");

    input.id = "inputAnswer";
    input.required = true;
    input.type = isPatientCount ? "number" : "text";
    input.placeholder = question.placeholder || "Enter your answer";
    input.autocomplete = isReporter ? "name" : "off";

    input.setAttribute("aria-label", question.question);

    if (isPatientCount) {
        input.inputMode = "numeric";
        input.min = "1";
        input.step = "1";
    }

    if (answers[question.key] !== undefined) {
        input.value = answers[question.key];
    }

    optionsContainer.appendChild(input);

    if (isReporter) {
        const infoBox = document.createElement("div");

        infoBox.className = "reporter-info";

        infoBox.innerHTML = `
            <span class="reporter-info-icon" aria-hidden="true">ⓘ</span>
            <span>
                Your name helps responders identify who reported the incident.
            </span>
        `;

        optionsContainer.appendChild(infoBox);
    }

    const confirmButton = document.createElement("button");

    confirmButton.type = "button";
    confirmButton.className = "confirm-btn";
    confirmButton.textContent = isReporter ? "Next →" : "Confirm →";

    confirmButton.addEventListener("click", () => {
        const value = input.value.trim();

        if (!value) {
            alert("Please complete the required field.");
            input.focus();
            return;
        }

        if (isPatientCount) {
            const patientCount = Number(value);

            if (!Number.isInteger(patientCount) || patientCount < 1) {
                alert("Please enter a valid number of patients.");
                input.focus();
                return;
            }

            answers[question.key] = String(patientCount);
        } else if (isReporter || question.key === "location") {
            answers[question.key] = value;
        } else {
            answers[question.key] = value.toUpperCase();
        }

        step++;
        loadQuestion();
    });

    optionsContainer.appendChild(confirmButton);

    input.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            confirmButton.click();
        }
    });

    input.focus();
}


/* =========================================
   EMERGENCY TYPE QUESTION
========================================= */

function renderEmergencyTypeQuestion(question) {
    optionsContainer.classList.add("emergency-type-options");

    const selectedValue = answers[question.key] || "";

    question.options.forEach(option => {
        const card = document.createElement("button");

        card.type = "button";
        card.className = "option-btn emergency-type-card";

        card.setAttribute(
            "aria-pressed",
            String(selectedValue === option.value.toUpperCase())
        );

        if (selectedValue === option.value.toUpperCase()) {
            card.classList.add("selected");
        }

        const icon = document.createElement("span");

        icon.className = "emergency-type-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = option.icon;

        const content = document.createElement("span");

        content.className = "emergency-type-content";

        const title = document.createElement("span");

        title.className = "emergency-type-title";
        title.textContent = option.value;

        const description = document.createElement("span");

        description.className = "emergency-type-description";
        description.textContent = option.description;

        content.appendChild(title);
        content.appendChild(description);

        const indicator = document.createElement("span");

        indicator.className = "selection-indicator";
        indicator.setAttribute("aria-hidden", "true");
        indicator.textContent = "✓";

        card.appendChild(icon);
        card.appendChild(content);
        card.appendChild(indicator);

        card.addEventListener("click", () => {
            answers[question.key] = option.value.toUpperCase();

            optionsContainer
                .querySelectorAll(".emergency-type-card")
                .forEach(otherCard => {
                    otherCard.classList.remove("selected");
                    otherCard.setAttribute("aria-pressed", "false");
                });

            card.classList.add("selected");
            card.setAttribute("aria-pressed", "true");
        });

        optionsContainer.appendChild(card);
    });

    const nextButton = document.createElement("button");

    nextButton.type = "button";
    nextButton.className = "confirm-btn emergency-type-next";
    nextButton.textContent = "Next →";

    nextButton.addEventListener("click", () => {
        if (!answers[question.key]) {
            alert("Please select an emergency type first.");
            return;
        }

        step++;
        loadQuestion();
    });

    optionsContainer.appendChild(nextButton);
}


/* =========================================
   STANDARD OPTION QUESTIONS
========================================= */

function renderOptionQuestion(question) {
    question.options.forEach(option => {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "option-btn";
        button.textContent = option;

        button.addEventListener("click", () => {
            if (
                question.key === "condition" &&
                option === "Other"
            ) {
                renderOtherCondition();
                return;
            }

            answers[question.key] = option.toUpperCase();

            step++;
            loadQuestion();
        });

        optionsContainer.appendChild(button);
    });
}


/* =========================================
   OTHER CONDITION
========================================= */

function renderOtherCondition() {
    optionsContainer.innerHTML = "";

    const input = document.createElement("input");

    input.type = "text";
    input.id = "inputAnswer";
    input.placeholder = "Specify the patient's condition";
    input.setAttribute(
        "aria-label",
        "Specify the patient's condition"
    );
    input.required = true;

    if (answers.condition && answers.condition !== "OTHER") {
        input.value = answers.condition;
    }

    optionsContainer.appendChild(input);

    const confirmButton = document.createElement("button");

    confirmButton.type = "button";
    confirmButton.className = "confirm-btn";
    confirmButton.textContent = "Confirm →";

    confirmButton.addEventListener("click", () => {
        const value = input.value.trim();

        if (!value) {
            alert("Please specify the patient's condition.");
            input.focus();
            return;
        }

        answers.condition = value.toUpperCase();

        step++;
        loadQuestion();
    });

    optionsContainer.appendChild(confirmButton);

    input.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            confirmButton.click();
        }
    });

    input.focus();
}


/* =========================================
   GENERATE REPORT SUMMARY
========================================= */

function generateSummary() {
    const date = new Date();

    const timestamp = date.toLocaleString("en-PH", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
    });

    const reporterName = answers.reporter || "Not provided";
    const reporterRole = answers.reporterRole || "Guest";

    const reporterLines = [
        "===REPORTER INFORMATION===",
        `Name: ${reporterName}`
    ];

    if (reporterRole === "Student") {
        reporterLines.push(
            `Grade & Section: ${answers.reporterGrade || "Not provided"} - ${answers.reporterSection || "Not provided"}`,
            `LRN: ${answers.reporterLRN || "Not provided"}`
        );
    }

    reporterLines.push(`Role: ${reporterRole}`);

    const incidentLines = [
        "",
        "===INCIDENT INFORMATION===",
        `Type: ${answers.type || "Not provided"}`,
        `Patients: ${answers.patients || "Not provided"}`,
        "Primary Patient:",
        `Conscious: ${answers.conscious || "Not provided"}`,
        `Breathing: ${answers.breathing || "Not provided"}`,
        `Sex: ${answers.sex || "Not provided"}`,
        `Condition: ${answers.condition || "Not provided"}`,
        `Scene Safe: ${answers.sceneSafe || "Not provided"}`,
        `Location: ${answers.location || "Not provided"}`,
        `Date & Time: ${timestamp}`
    ];

    finalMessage = [
        "🚨 EMERGENCY REPORT 🚨",
        "",
        ...reporterLines,
        ...incidentLines
    ].join("\n");

    summaryText.textContent = finalMessage;

    isSending = false;

    if (sendButton) {
        sendButton.disabled = false;
        sendButton.textContent = "Confirm & Send →";
    }

    showPage("summaryPage");
}


/* =========================================
   EDIT REPORT
========================================= */

function editReport() {
    if (isSending) {
        return;
    }

    step = activeQuestions.length - 1;

    loadQuestion();
    showPage("questionPage");
}


/* =========================================
   SEND EMERGENCY REPORT
========================================= */

async function confirmSend() {
    if (isSending) {
        return;
    }

    if (!finalMessage) {
        alert("There is no completed report to send.");
        return;
    }

    isSending = true;

    if (sendButton) {
        sendButton.disabled = true;
        sendButton.textContent = "Sending report...";
    }

    try {
        const response = await fetch("/api/send", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: finalMessage
            })
        });

        const result = await response
            .json()
            .catch(() => ({}));

        if (!response.ok || result.success !== true) {
            throw new Error(
                result.error ||
                result.message ||
                "The server could not send the report."
            );
        }

        alert("Alert Sent Successfully!");

        /*
         * Reset only the report workflow.
         * Keep the current authentication session intact.
         */

        step = 0;
        answers = {};
        finalMessage = "";
        isSending = false;

        if (sendButton) {
            sendButton.disabled = false;
            sendButton.textContent = "Confirm & Send →";
        }

        if (currentUser && currentProfile && !guestMode) {
            showPage("homePage");
        } else {
            guestMode = true;
            startApp();
        }
    } catch (error) {
        console.error(
            "TNHSafe report submission failed:",
            error
        );

        alert(
            "Failed to send the emergency report. Please check your connection and try again."
        );

        isSending = false;

        if (sendButton) {
            sendButton.disabled = false;
            sendButton.textContent = "Confirm & Send →";
        }
    }
}


/* =========================================
   INLINE HTML HANDLER COMPATIBILITY
========================================= */

window.startApp = startApp;
window.confirmSend = confirmSend;
window.editReport = editReport;


/* =========================================
   STARTUP
========================================= */

/*
 * Initialize password toggles immediately.
 * The script is loaded as a module, so the HTML elements
 * are available when this code executes.
 */

initializePasswordToggles();

/*
 * Initialize the interface first.
 * Firebase initialization is allowed to fail without disabling
 * guest emergency reporting.
 */

updateAccountInterface();
closeSidebar();
initializeFirebase();