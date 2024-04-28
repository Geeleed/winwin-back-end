const jwt = require("jsonwebtoken");
function generateToken(userData) {
  const secretKey = process.env.secretKey;
  const token = jwt.sign(userData, secretKey, { expiresIn: "1h" });
  return token;
}
function verifyToken(token) {
  const secretKey = process.env.secretKey;
  try {
    const decoded = jwt.verify(token, secretKey);
    return decoded;
  } catch (error) {
    console.error(error);
    throw new Error("Invalid token");
  }
}
module.exports = { generateToken, verifyToken };
