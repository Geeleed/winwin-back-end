const express = require("express");
const db = require("./dbinit");
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage });
const checkAuth = require("./checkAuth");

const router = express.Router();

router.post(
  "/address",
  checkAuth,
  upload.any(),
  express.json(),
  async (req, res) => {
    try {
      const { address } = req.body;
      await db.query("INSERT INTO Addresses (userId,address) VALUES ($1,$2)", [
        req.userId,
        address,
      ]);
      res.json({ message: "เพิ่มที่อยู่สำหรับรับของสำเร็จ" });
    } catch (error) {
      console.error(error);
      res.json({ error });
    }
  }
);

router.put(
  "/address",
  checkAuth,
  upload.any(),
  express.json(),
  async (req, res) => {
    try {
      const { address } = req.body;
      await db.query("UPDATE Addresses SET address=$2 WHERE userId=$1", [
        req.userId,
        address,
      ]);
      res.json({ message: "แก้ไขที่อยู่สำหรับรับของสำเร็จ" });
    } catch (error) {
      console.error(error);
      res.json({ error });
    }
  }
);

router.get(
  "/address",
  checkAuth,
  upload.any(),
  express.json(),
  async (req, res) => {
    try {
      const data = await db.query("SELECT * FROM Addresses WHERE userId=$1", [
        req.userId,
      ]);
      res.json({ data: data.rows[0] });
    } catch (error) {
      console.error(error);
      res.json({ error });
    }
  }
);

router.delete(
  "/address",
  checkAuth,
  upload.any(),
  express.json(),
  async (req, res) => {
    try {
      await db.query("DELETE FROM Addresses WHERE userId=$1", [req.userId]);
      res.json({ message: "ลบที่อยู่สำเร็จ" });
    } catch (error) {
      console.error(error);
      res.json({ error });
    }
  }
);

router.get(
  "/itemAddress/:itemId",
  checkAuth,
  upload.any(),
  express.json(),
  async (req, res) => {
    try {
      const { itemId } = req.body;
      const data = await db.query(
        "SELECT * FROM Addresses WHERE userId=(SELECT ownerId FROM Items WHERE itemId=$1)",
        [itemId]
      );
      res.json({ data: data.rows[0] });
    } catch (error) {
      console.error(error);
      res.json({ error });
    }
  }
);

module.exports = router;
