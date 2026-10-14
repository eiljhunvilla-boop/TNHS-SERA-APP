import { adminAuth, adminDb } from "../lib/firebaseAdmin.js";

const MAX_DESCRIPTION_LENGTH = 3000;
const MIN_DESCRIPTION_LENGTH = 10;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return res.status(405).json({
      success: false,
      message: "Method not allowed.",
    });
  }

  // Require an authenticated account for technical feedback.
  const authorization = req.headers.authorization || "";

  if (!authorization.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Please log in to submit feedback.",
    });
  }

  const idToken = authorization.slice(7).trim();

  if (!idToken) {
    return res.status(401).json({
      success: false,
      message: "Please log in to submit feedback.",
    });
  }

  let decodedToken;

  try {
    decodedToken = await adminAuth.verifyIdToken(idToken, true);
  } catch (error) {
    console.error(
      "TNHSafe feedback authentication failed:",
      error?.code || "UNKNOWN_ERROR"
    );

    return res.status(401).json({
      success: false,
      message: "Your session is invalid. Please log in again.",
    });
  }

  let profileSnapshot;

  try {
    profileSnapshot = await adminDb
      .collection("users")
      .doc(decodedToken.uid)
      .get();
  } catch (error) {
    console.error(
      "TNHSafe feedback profile lookup failed:",
      error?.code || "UNKNOWN_ERROR"
    );

    return res.status(500).json({
      success: false,
      message: "Unable to verify your account. Please try again later.",
    });
  }

  if (!profileSnapshot.exists) {
    return res.status(403).json({
      success: false,
      message: "Your account profile could not be verified.",
    });
  }

  const profile = profileSnapshot.data();

  if (
    profile.status !== "active" ||
    !["Student", "Teacher", "Staff"].includes(profile.role)
  ) {
    return res.status(403).json({
      success: false,
      message: "Your account is not authorized to submit feedback.",
    });
  }

  const category =
    typeof req.body?.category === "string"
      ? req.body.category.trim()
      : "";

  const description =
    typeof req.body?.description === "string"
      ? req.body.description.trim()
      : "";

  if (!category || category.length > 80) {
    return res.status(400).json({
      success: false,
      message: "Please select a valid feedback category.",
    });
  }

  if (
    description.length < MIN_DESCRIPTION_LENGTH ||
    description.length > MAX_DESCRIPTION_LENGTH
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Your description must contain 10 to 3000 characters.",
    });
  }

  const botToken = process.env.BOT_TOKEN;
  const chatId = process.env.CHAT_ID;

  if (!botToken || !chatId) {
    console.error("TNHSafe feedback Telegram configuration is missing.");

    return res.status(500).json({
      success: false,
      message: "The feedback service is temporarily unavailable.",
    });
  }

  const submittedAt = new Date().toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "medium",
  });

  // Plain text and a clear label distinguish feedback from emergencies.
  const message = [
    "TNHSAFE TECHNICAL FEEDBACK",
    "NOT AN EMERGENCY REPORT",
    "",
    "===REPORTER INFORMATION===",
    `Name: ${String(profile.fullName || "Unknown").slice(0, 120)}`,
    `Username: ${String(profile.username || "Unknown").slice(0, 40)}`,
    `Role: ${profile.role}`,
    "",
    "===FEEDBACK INFORMATION===",
    `Category: ${category}`,
    `Description:`,
    description,
    "",
    `Submitted: ${submittedAt}`,
  ].join("\n");

  try {
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
        }),
        signal: AbortSignal.timeout(10000),
      }
    );

    const telegramResult = await telegramResponse.json().catch(() => null);

    if (!telegramResponse.ok || telegramResult?.ok !== true) {
      console.error(
        "TNHSafe feedback Telegram delivery failed:",
        telegramResult?.error_code || telegramResponse.status
      );

      return res.status(502).json({
        success: false,
        message:
          "Feedback could not be delivered. Please try again later.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Your feedback has been submitted successfully.",
    });
  } catch (error) {
    console.error(
      "TNHSafe feedback delivery error:",
      error?.name || "UNKNOWN_ERROR"
    );

    return res.status(502).json({
      success: false,
      message:
        "The feedback service could not be reached. Please try again later.",
    });
  }
}