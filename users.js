const { hashPassword, comparePassword } = require("./hashPassword");
const { generateToken } = require("./token");
const { v4: uuidv4 } = require("uuid");
const express = require("express");
const db = require("./dbinit");
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage });
const checkAuth = require("./checkAuth");

const router = express.Router();

router.post("/signup", upload.any(), async (req, res) => {
  const { firstname, lastname, email, password, question, answer, phone } =
    req.body;
  const userId = uuidv4();
  const hashPw = await hashPassword(password);
  const hashAw = await hashPassword(answer);
  try {
    await db.query(
      "INSERT INTO Users (firstname, lastname, email, password, question, answer, phone, userId) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [firstname, lastname, email, hashPw, question, hashAw, phone, userId]
    );
    const token = generateToken({ userId });
    res.json({ message: "สมัครสำเร็จ", token, isOk: true });
  } catch (error) {
    console.error(error);
    res.json({
      error,
      message: "มีข้อผิดพลาด บัญชีนี้อาจถูกใช้งานแล้ว",
      isOk: false,
    });
  }
});

router.post("/signin", upload.any(), async (req, res) => {
  const { email, password } = req.body;
  const userData = (
    await db.query(`SELECT * FROM Users WHERE email = $1`, [email])
  ).rows[0];
  if (!userData) return res.json({ message: "ไม่มีบัญชีนี้ในระบบ" });
  try {
    if (await comparePassword(password, userData.password)) {
      const token = generateToken({ userId: userData.userid });
      res.json({ message: "เข้าระบบสำเร็จ", token, isOk: true });
    } else {
      res.json({ message: "รหัสผ่านไม่ถูกต้อง", isOk: false });
    }
  } catch (error) {
    console.error(error);
    res.json({ error, message: "บางอย่างไม่ถูกต้อง", isOk: false });
  }
});

router.get("/forgot/:email", upload.any(), async (req, res) => {
  try {
    const { email } = req.params;
    const data = (await db.query(`SELECT * FROM Users WHERE email=$1`, [email]))
      .rows[0];
    res.json({ data, message: "เปลี่ยนรหัสผ่านสำเร็จ", isOk: true });
  } catch (error) {
    console.error(error);
    res.json({ error, message: "กรุณาลองใหม่อีกครั้ง", isOk: false });
  }
});

router.post("/forgot", upload.any(), async (req, res) => {
  try {
    const { email, answer, newPassword } = req.body;
    const userData = (
      await db.query(`SELECT * FROM Users WHERE email=$1`, [email])
    ).rows[0];
    if (await comparePassword(answer, userData.answer)) {
      const newHash = await hashPassword(newPassword);
      await db.query(`UPDATE Users SET password='${newHash}' WHERE email=$1`, [
        email,
      ]);
      res.json({ message: "เปลี่ยนรหัสผ่านสำเร็จ", isOk: true });
    } else {
      res.json({ message: "คำตอบไม่ถูกต้อง" });
    }
  } catch (error) {
    console.error(error);
    res.json({ error, message: "กรุณาลองใหม่อีกครั้ง", isOk: false });
  }
});

router.put(
  "/profile",
  checkAuth,
  upload.any(),
  express.json(),
  async (req, res) => {
    try {
      const { firstname, lastname, question, answer, phone } = req.body;
      const hashAW = await hashPassword(answer);
      await db.query(
        `UPDATE Users SET firstname=$1, lastname=$2, question=$3, answer=$4, phone=$5 WHERE userId=$6`,
        [firstname, lastname, question, hashAW, phone, req.userId]
      );
      res.json({ message: "แก้ไขข้อมูลสำเร็จ", isOk: true });
    } catch (error) {
      console.error(error);
      res.json({ error, message: "มีข้อผิดพลาด", isOk: false });
    }
  }
);

router.delete(
  "/profile",
  checkAuth,
  upload.any(),
  express.json(),
  async (req, res) => {
    try {
      await db.query("BEGIN");
      await db.query("DELETE FROM Addresses WHERE userId=$1", [req.userId]);
      await db.query("DELETE FROM Users WHERE userId=$1", [req.userId]);
      await db.query("DELETE FROM Items WHERE ownerId=$1", [req.userId]);
      await db.query(
        "DELETE FROM ItemActions WHERE ownerId=$1 OR clickerId=$1",
        [req.userId]
      );
      await db.query(
        "UPDATE Items SET status='instock' WHERE itemId IN (SELECT itemIdB FROM Matches WHERE ownerIdA=$1)",
        [req.userId]
      );
      await db.query(
        "UPDATE Items SET status='instock' WHERE itemId IN (SELECT itemIdA FROM Matches WHERE ownerIdB=$1)",
        [req.userId]
      );
      await db.query("DELETE FROM Matches WHERE ownerIdA=$1 OR ownerIdB=$1", [
        req.userId,
      ]);
      await db.query("COMMIT");
      res.json({ message: "ลบบัญชีสำเร็จ", isOk: true });
    } catch (error) {
      console.error(error);
      res.json({ error, message: "มีข้อผิดพลาด", isOk: false });
    }
  }
);

router.get("/profile", checkAuth, async (req, res) => {
  try {
    const data = await db.query("SELECT * FROM Users WHERE userId=$1", [
      req.userId,
    ]);
    res.json({ data: data.rows[0], isOk: true });
  } catch (error) {
    console.error(error);
    res.json({ error, message: "มีข้อผิดพลาด", isOk: false });
  }
});

router.get("/auth", checkAuth, express.json(), async (req, res) => {
  try {
    const token = generateToken({ userId: req.userId });
    res.json({ status: true, isOk: true, token });
  } catch (error) {
    console.error(error);
    res.json({ status: false, isOk: false });
  }
});

module.exports = router;
