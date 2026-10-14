import {
  adminAuth,
  adminDb,
} from "../lib/firebaseAdmin.js";

const ALLOWED_ROLES = ["Student", "Teacher", "Staff"];

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");

    return res.status(405).json({
      success: false,
      message: "Method not allowed.",
    });
  }

  const authorization = req.headers.authorization || "";

  if (!authorization.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  const idToken = authorization.slice(7).trim();

  if (!idToken) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  let decodedToken;

  // First, verify the Firebase Authentication token.
  try {
    decodedToken = await adminAuth.verifyIdToken(idToken, true);
  } catch (error) {
    console.error(
      "TNHSafe token verification failed:",
      error?.code || "UNKNOWN_ERROR"
    );

    return res.status(401).json({
      success: false,
      message: "Your session is invalid or expired. Please log in again.",
    });
  }

  // Then, retrieve the user's profile from Firestore.
  let userSnapshot;

  try {
    userSnapshot = await adminDb
      .collection("users")
      .doc(decodedToken.uid)
      .get();
  } catch (error) {
    console.error(
      "TNHSafe profile database request failed:",
      error?.code || "UNKNOWN_ERROR"
    );

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve your profile. Please try again later.",
    });
  }

  if (!userSnapshot.exists) {
    return res.status(404).json({
      success: false,
      message: "Account profile not found.",
    });
  }

  const user = userSnapshot.data();

  if (user.status !== "active") {
    return res.status(403).json({
      success: false,
      message: "This account is not active.",
    });
  }

  if (!ALLOWED_ROLES.includes(user.role)) {
    return res.status(403).json({
      success: false,
      message: "Account role is invalid.",
    });
  }

  // Verify the trusted server-assigned role.
  if (decodedToken.role !== user.role) {
    return res.status(403).json({
      success: false,
      message: "Account permissions need to be refreshed.",
    });
  }

  const profile = {
    uid: decodedToken.uid,
    fullName: user.fullName,
    username: user.username,
    role: user.role,
  };

  // Student details are only returned for student accounts.
  if (user.role === "Student") {
    profile.lrn = user.lrn;
    profile.grade = user.grade;
    profile.section = user.section;
  }

  return res.status(200).json({
    success: true,
    profile,
  });
}