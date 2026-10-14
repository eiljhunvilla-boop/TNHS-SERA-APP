import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminAuth,
  adminDb,
} from "../lib/firebaseAdmin.js";

const ALLOWED_ROLES = ["Student", "Teacher", "Staff"];

const VALID_GRADES = [
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "Grade 11",
  "Grade 12",
];

function usernameToEmail(username) {
  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error("Firebase project ID is not configured.");
  }

  return `${username}@${projectId}.firebaseapp.com`;
}

function cleanText(value, maxLength = 120) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function validUsername(username) {
  // 3–20 characters.
  // Begins and ends with a letter or number.
  // Periods, underscores, and hyphens are allowed internally.
  return /^[a-z0-9][a-z0-9._-]{1,18}[a-z0-9]$/i.test(username);
}

function validPassword(password) {
  return (
    typeof password === "string" &&
    password.length >= 8 &&
    password.length <= 128
  );
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return res.status(405).json({
      success: false,
      message: "Method not allowed.",
    });
  }

  const body =
    req.body && typeof req.body === "object"
      ? req.body
      : {};

  const fullName = cleanText(body.fullName);
  const role = cleanText(body.role, 20);
  const username = cleanText(body.username, 20).toLowerCase();

  const password = body.password;
  const confirmPassword = body.confirmPassword;

  let lrn = "";
  let grade = "";
  let section = "";

  if (fullName.length < 2) {
    return res.status(400).json({
      success: false,
      message: "Please enter your full name.",
    });
  }

  if (!ALLOWED_ROLES.includes(role)) {
    return res.status(400).json({
      success: false,
      message: "Please select a valid account role.",
    });
  }

  if (!validUsername(username)) {
    return res.status(400).json({
      success: false,
      message:
        "Username must be 3–20 characters, start and end with a letter or number, and contain only letters, numbers, periods, underscores, or hyphens.",
    });
  }

  if (!validPassword(password)) {
    return res.status(400).json({
      success: false,
      message: "Password must be between 8 and 128 characters.",
    });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({
      success: false,
      message: "Passwords do not match.",
    });
  }

  if (role === "Student") {
    lrn = cleanText(body.lrn, 12);
    grade = cleanText(body.grade, 20);
    section = cleanText(body.section, 40);

    if (!/^\d{12}$/.test(lrn)) {
      return res.status(400).json({
        success: false,
        message: "Student LRN must contain exactly 12 digits.",
      });
    }

    if (!VALID_GRADES.includes(grade)) {
      return res.status(400).json({
        success: false,
        message: "Please select a valid grade level.",
      });
    }

    if (
      section.length < 1 ||
      !/^[a-zA-Z0-9][a-zA-Z0-9 ._-]{0,39}$/.test(section)
    ) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid section.",
      });
    }
  }

  const usernameRef = adminDb
    .collection("usernames")
    .doc(username);

  const reservationId = randomUUID();
  const now = Date.now();

  let reservationAcquired = false;
  let createdUser = null;

  try {
    // Reserve the username transactionally to prevent duplicates.
    reservationAcquired = await adminDb.runTransaction(
      async (transaction) => {
        const snapshot = await transaction.get(usernameRef);

        if (snapshot.exists) {
          return false;
        }

        transaction.set(usernameRef, {
          username,
          status: "pending",
          reservationId,
          createdAtMs: Date.now(),
        });

        return true;
      }
    );

    if (!reservationAcquired) {
      return res.status(409).json({
        success: false,
        message: "That username is already taken.",
      });
    }

    // Firebase Authentication uses a synthetic email for username login.
    createdUser = await adminAuth.createUser({
      email: usernameToEmail(username),
      password,
      displayName: fullName,
      disabled: false,
    });

    // Public registration cannot create an administrator account.
    await adminAuth.setCustomUserClaims(createdUser.uid, {
      role,
    });

    const userProfile = {
      uid: createdUser.uid,
      fullName,
      username,
      role,
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (role === "Student") {
      userProfile.lrn = lrn;
      userProfile.grade = grade;
      userProfile.section = section;
    }

    await adminDb
      .collection("users")
      .doc(createdUser.uid)
      .set(userProfile);

    await usernameRef.set({
      username,
      uid: createdUser.uid,
      status: "active",
      reservationId,
      createdAtMs: now,
    });

    return res.status(201).json({
      success: true,
      message:
        "Registration successful. You can now log in with your username and password.",
    });
  } catch (error) {
    // Log the diagnostic code without exposing credentials or secrets.
    console.error(
      "TNHSafe registration failed:",
      error?.code || error?.message || "UNKNOWN_ERROR"
    );

    if (createdUser) {
      try {
        await adminDb
          .collection("users")
          .doc(createdUser.uid)
          .delete();
      } catch (cleanupError) {
        console.error(
          "Registration profile cleanup failed:",
          cleanupError?.code || "UNKNOWN_ERROR"
        );
      }

      try {
        await adminAuth.deleteUser(createdUser.uid);
      } catch (cleanupError) {
        console.error(
          "Registration Auth cleanup failed:",
          cleanupError?.code || "UNKNOWN_ERROR"
        );
      }
    }

    if (reservationAcquired) {
      try {
        await adminDb.runTransaction(async (transaction) => {
          const snapshot = await transaction.get(usernameRef);

          if (
            snapshot.exists &&
            snapshot.data().reservationId === reservationId
          ) {
            transaction.delete(usernameRef);
          }
        });
      } catch (cleanupError) {
        console.error(
          "Registration username cleanup failed:",
          cleanupError?.code || "UNKNOWN_ERROR"
        );
      }
    }

    return res.status(500).json({
      success: false,
      message:
        "Registration could not be completed. Please try again later.",
    });
  }
}