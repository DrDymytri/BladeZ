const bcrypt = require("bcryptjs");

async function verifyPassword(enteredPassword, storedHash) {
  const isMatch = await bcrypt.compare(enteredPassword, storedHash);
  return isMatch;
}

// Example usage: Replace with actual database value
const storedHashFromDB =
  "$2b$10$d2tiT.4zioaWzyuobzMA2.9o2JaSxjDwgHJFeP59R1VfSomEh5Gyu"; // Retrieved from DB
verifyPassword("Admin123!", storedHashFromDB).then((match) => {
  if (match) {
    console.log("✅ Password is correct! User logged in.");
  } else {
    console.log("❌ Incorrect password!");
  }
});
