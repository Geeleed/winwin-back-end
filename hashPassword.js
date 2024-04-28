const bcrypt = require("bcrypt");
const saltRounds = 10; // จำนวนรอบในการแฮช
// ฟังก์ชันสำหรับแฮชพาสเวิร์ด
async function hashPassword(password) {
  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    return hashedPassword;
  } catch (error) {
    console.error(error);
    throw new Error("Error hashing password");
  }
}
// ฟังก์ชันสำหรับตรวจสอบว่าพาสเวิร์ดตรงกับแฮชหรือไม่
async function comparePassword(password, hashedPassword) {
  try {
    const match = await bcrypt.compare(password, hashedPassword);
    return match;
  } catch (error) {
    console.error(error);
    throw new Error("Error comparing passwords");
  }
}

module.exports = { hashPassword, comparePassword };
