const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const db = require("../db"); // Assuming you have a database connection module

// Signup endpoint
router.post("/signup", async (req, res) => {
  const { firstName, lastName, email, password, phone, address } = req.body;

  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save the user to the database
    await db.query(
      "INSERT INTO users (first_name, last_name, email, password, phone, address) VALUES (?, ?, ?, ?, ?, ?)",
      [firstName, lastName, email, hashedPassword, phone, address]
    );

    res.status(201).json({ message: "User created successfully!" });
  } catch (error) {
    console.error("Error during signup:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Login endpoint
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Fetch the user from the database
    const [user] = await db.query("SELECT * FROM users WHERE email = ?", [email]);

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Compare the provided password with the hashed password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Generate a token (assuming you use JWT for authentication)
    const token = generateToken(user.id); // Replace with your token generation logic

    res.status(200).json({ token });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;

// Ensure this file is correctly imported and used in your server entry point (e.g., server.js or app.js)
