const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Verify JWT token and attach user to request
const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

// Require admin role
const adminOnly = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

// Require admin or faculty role
const adminOrFaculty = (req, res, next) => {
  if (req.user.role !== "admin" && req.user.role !== "faculty") {
    return res.status(403).json({ message: "Admin or Faculty access required" });
  }
  next();
};

// Require user role
const userOnly = (req, res, next) => {
  if (req.user.role !== "user") {
    return res.status(403).json({ message: "User access required" });
  }
  next();
};

module.exports = { auth, adminOnly, adminOrFaculty, userOnly };
