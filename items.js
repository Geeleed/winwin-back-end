require("dotenv").config();
const { v4: uuidv4 } = require("uuid");
const express = require("express");
const db = require("./dbinit");
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage });
const checkAuth = require("./checkAuth");

const AWS = require("aws-sdk");
const BUCKET_NAME = process.env.BUCKET_NAME;
const BUCKET_REGION = process.env.BUCKET_REGION;
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const s3 = new AWS.S3();
s3.config.update({
  accessKeyId: AWS_ACCESS_KEY_ID,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
  region: BUCKET_REGION,
});

const router = express.Router();

// อัปโหลดข้อมูล item ลงใน Items พร้อมทั้งเก็บไฟล์ภาพไว้ใน AWS S3
router.post(
  "/myItem",
  checkAuth,
  upload.array("files", 3),
  async (req, res) => {
    try {
      const { title, description, weight, height, width, length, sending } =
        req.body;
      const ownerId = req.userId;
      const status = "instock";
      const files = req.files;
      const imageFolder = "image";
      const imageNames = files.map((i) => uuidv4());
      const fileData = imageNames.map((imageName, index) => ({
        Bucket: BUCKET_NAME + `/${imageFolder}`,
        Key: imageName,
        Body: files[index].buffer,
      }));
      const imageUploads = fileData.map((item) => s3.upload(item).promise());
      const result = await Promise.all(imageUploads);
      const imageUrls = result.map((data) => data.Location);
      const itemId = uuidv4();
      const timestamp = new Date().getTime();
      await db
        .query(
          "INSERT INTO Items (ownerId,title,description,weight,height,width,length,sending,status,itemId,imageUrls,postAt) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
          [
            ownerId,
            title,
            description,
            weight,
            height,
            width,
            length,
            sending,
            status,
            itemId,
            imageUrls,
            timestamp,
          ]
        )
        .catch((err) => console.error(err));
      res.json({ message: "อัปโหลดสำเร็จ" });
    } catch (error) {
      console.error(error);
      res.json({ error, message: "มีข้อผิดพลาด" });
    }
  }
);

router.put(
  "/myItem",
  checkAuth,
  upload.any(),
  express.json(),
  async (req, res) => {
    try {
      const {
        itemId,
        title,
        description,
        weight,
        height,
        width,
        length,
        sending,
      } = req.body;
      await db.query(
        "UPDATE Items SET title=$1, description=$2, weight=$3, height=$4, width=$5, length=$6, sending=$7 WHERE itemId=$8",
        [title, description, weight, height, width, length, sending, itemId]
      );
      res.json({ message: "แก้ไขข้อมูลสำเร็จ" });
    } catch (error) {
      console.error(error);
      res.json({ error, message: "มีข้อผิดพลาด" });
    }
  }
);

router.get(
  "/myItem/:itemId",
  checkAuth,
  upload.any(),
  express.json(),
  async (req, res) => {
    try {
      const { itemId } = req.params;
      let data;
      if (itemId === "all") {
        data = await db.query("SELECT * FROM Items WHERE ownerId=$1", [
          req.userId,
        ]);
      } else {
        data = await db.query(
          "SELECT * FROM Items WHERE itemId=$1 AND ownerId=$2",
          [itemId, req.userId]
        );
      }
      res.json({ data });
    } catch (error) {
      console.error(error);
      res.json({ error, message: "มีข้อผิดพลาด" });
    }
  }
);

router.delete("/myItem", upload.any(), express.json(), async (req, res) => {
  try {
    const { itemId } = req.body;
    await db.query("BEGIN");
    await db.query("DELETE FROM Items WHERE itemId=$1", [itemId]);
    await db.query(
      "UPDATE Items SET status='instock' WHERE itemId IN (SELECT itemIdB FROM Matches WHERE ownerIdA=$1)",
      [req.userId]
    );
    await db.query(
      "UPDATE Items SET status='instock' WHERE itemId IN (SELECT itemIdA FROM Matches WHERE ownerIdB=$1)",
      [req.userId]
    );
    await db.query("DELETE FROM ItemActions WHERE itemId=$1", [itemId]);
    await db.query("DELETE FROM Matches WHERE itemIdA=$1 OR itemIdB=$1", [
      itemId,
    ]);
    await db.query("COMMIT");
    res.json({ message: "ลบข้อมูล item สำเร็จ" });
  } catch (error) {
    console.error(error);
    res.json({ error, message: "มีข้อผิดพลาด" });
  }
});

router.get(
  "/market",
  checkAuth,
  upload.any(),
  express.json(),
  async (req, res) => {
    try {
      const data = await db.query(
        "SELECT * FROM Items WHERE ownerId!=$1 AND status='posting'",
        [req.userId]
      );
      res.json({ data });
    } catch (error) {
      console.error(error);
      res.json({ error, message: "มีข้อผิดพลาด" });
    }
  }
);

router.put(
  "/hidden",
  checkAuth,
  upload.any(),
  express.json(),
  async (req, res) => {
    try {
      const { itemId } = req.body;
      await db.query(
        "UPDATE Items SET status='hidden' WHERE itemId=$1 AND ownerId=$2",
        [itemId, req.userId]
      );
      res.json({ message: "เปลี่ยนสถานะเป็น hidden สำเร็จ" });
    } catch (error) {
      console.error(error);
      res.json({ error, message: "มีข้อผิดพลาด" });
    }
  }
);

router.put(
  "/posting",
  checkAuth,
  upload.any(),
  express.json(),
  async (req, res) => {
    try {
      const { itemId } = req.body;
      await db.query(
        "UPDATE Items SET status='posting' WHERE itemId=$1 AND ownerId=$2",
        [itemId, req.userId]
      );
      res.json({ message: "เปลี่ยนสถานะเป็น posting สำเร็จ" });
    } catch (error) {
      console.error(error);
      res.json({ error, message: "มีข้อผิดพลาด" });
    }
  }
);

router.put(
  "/safePosting",
  checkAuth,
  upload.any(),
  express.json(),
  async (req, res) => {
    try {
      const { itemId } = req.body;
      await db.query(
        "UPDATE Items SET status='safePosting' WHERE itemId=$1 AND ownerId=$2",
        [itemId, req.userId]
      );
      res.json({ message: "เปลี่ยนสถานะเป็น safePosting สำเร็จ" });
    } catch (error) {
      console.error(error);
      res.json({ error, message: "มีข้อผิดพลาด" });
    }
  }
);

router.put(
  "/instock",
  checkAuth,
  upload.any(),
  express.json(),
  async (req, res) => {
    try {
      const { itemId } = req.body;
      await db.query(
        "UPDATE Items SET status='instock' WHERE itemId=$1 AND ownerId=$2",
        [itemId, req.userId]
      );
      res.json({ message: "เปลี่ยนสถานะเป็น instock สำเร็จ" });
    } catch (error) {
      console.error(error);
      res.json({ error, message: "มีข้อผิดพลาด" });
    }
  }
);

router.post(
  "/wish",
  checkAuth,
  upload.any(),
  express.json(),
  async (req, res) => {
    try {
      const { itemId } = req.body;
      const { ownerid } = (
        await db.query("SELECT ownerId FROM Items WHERE itemId=$1", [itemId])
      ).rows[0];
      await db.query(
        "INSERT INTO ItemActions (itemId,ownerId,clickerId,act) VALUES ($1,$2,$3,$4)",
        [itemId, ownerid, req.userId, "wish"]
      );
      res.json({ message: "บันทึกไว้เป็นรายการที่อยากได้เรียบร้อย" });
    } catch (error) {
      console.error(error);
      res.json({ error });
    }
  }
);

router.get("/wish", checkAuth, async (req, res) => {
  try {
    const data = (
      await db.query(
        "SELECT * FROM Items WHERE itemId IN (SELECT itemId FROM ItemActions WHERE status='wish' AND clickerId=$1)",
        [req.userId]
      )
    ).rows;
    res.json(data);
  } catch (error) {
    console.error(error);
    res.json({ error });
  }
});

router.delete(
  "/wish",
  checkAuth,
  upload.any(),
  express.json(),
  async (req, res) => {
    try {
      const { itemId } = req.body;
      await db.query(
        "DELETE FROM ItemActions WHERE clickerId=$1 AND act=$2 AND itemId=$3",
        [req.userId, "wish", itemId]
      );
      res.json({ message: "ยกเลิกการ wish เรียบร้อย" });
    } catch (error) {
      console.error(error);
      res.json({ error });
    }
  }
);

router.post(
  "/exchange",
  checkAuth,
  upload.any(),
  express.json(),
  async (req, res) => {
    try {
      const { itemId } = req.body;
      const { ownerid } = (
        await db.query("SELECT ownerId FROM Items WHERE itemId=$1", [itemId])
      ).rows[0];
      await db.query(
        " INSERT INTO ItemActions (itemId,ownerId,clickerId,act) VALUES ($1,$2,$3,$4)",
        [itemId, ownerid, req.userId, "exchange"]
      );
      res.json({ message: "ส่งคำขอแลกเปลี่ยนเรียบร้อย" });
    } catch (error) {
      console.error(error);
      res.json({ error });
    }
  }
);

router.delete(
  "/exchange",
  checkAuth,
  upload.any(),
  express.json(),
  async (req, res) => {
    try {
      const { itemId } = req.body;
      await db.query(
        "DELETE FROM ItemActions WHERE clickerId=$1 AND act=$2 AND itemId=$3",
        [req.userId, "exchange", itemId]
      );
      res.json({ message: "ยกเลิกคำขอแลกเปลี่ยนเรียบร้อย" });
    } catch (error) {
      console.error(error);
      res.json({ error });
    }
  }
);

router.get(
  "/exchange",
  checkAuth,
  upload.any(),
  express.json(),
  async (req, res) => {
    try {
      const data = await db.query(
        "SELECT * FROM Items WHERE itemId IN (SELECT itemId FROM ItemActions WHERE action='exchange' AND ownerId=$1)",
        [req.userId]
      );
      res.json({ data });
    } catch (error) {
      console.error(error);
      res.json({ error });
    }
  }
);

router.get(
  "/waitMatch/:itemId",
  checkAuth,
  upload.any(),
  express.json(),
  async (req, res) => {
    try {
      const { itemId } = req.params;
      const data = await db.query(
        "SELECT * FROM Items WHERE ownerId IN (SELECT clickerId FROM ItemActions WHERE itemId=$1) AND (status!='matched' OR status!='hidden')",
        [itemId]
      );
      res.json({ data: data.rows });
    } catch (error) {
      console.error(error);
      res.json({ error });
    }
  }
);

router.post(
  "/match",
  checkAuth,
  upload.any(),
  express.json(),
  async (req, res) => {
    try {
      const { myItemId, selectItemId } = req.body;
      const userIdA = req.userId;
      const userIdB = (
        await db.query("SELECT ownerId FROM Items WHERE itemId=$1;", [
          selectItemId,
        ])
      ).rows[0].ownerid;
      await db.query("BEGIN"); // เริ่ม transaction

      // ลบข้อมูลในตาราง ItemActions
      await db.query("DELETE FROM ItemActions WHERE itemId=$1 OR itemId=$2", [
        myItemId,
        selectItemId,
      ]);

      // อัปเดตข้อมูลในตาราง Items
      await db.query(
        "UPDATE Items SET status='matched' WHERE itemId=$1 OR itemId=$2",
        [myItemId, selectItemId]
      );

      // เพิ่มข้อมูลในตาราง Matches
      await db.query(
        "INSERT INTO Matches (itemIdA, itemIdB, ownerIdA, ownerIdB) VALUES ($1, $2, $3, $4)",
        [myItemId, selectItemId, userIdA, userIdB]
      );
      await db.query(
        "INSERT INTO Matches (itemIdA, itemIdB, ownerIdA, ownerIdB) VALUES ($1, $2, $3, $4)",
        [selectItemId, myItemId, userIdB, userIdA]
      );

      await db.query("COMMIT"); // สำเร็จและ commit transaction

      res.json({ message: "แมตช์การแลกเปลี่ยนแล้ว" });
    } catch (error) {
      console.error(error);
      res.json({ error });
    }
  }
);

router.get(
  "/match/:itemId",
  checkAuth,
  upload.any(),
  express.json(),
  async (req, res) => {
    try {
      const { itemId } = req.params;
      const matchItem = await db.query(
        "SELECT * FROM Items WHERE itemId = (SELECT itemIdB FROM Matches WHERE itemIdA=$1 AND ownerIdA=$2)",
        [itemId, req.userId]
      );
      const myItem = await db.query("SELECT * FROM Items WHERE itemId=$1", [
        itemId,
      ]);
      res.json({ myItem, matchItem });
    } catch (error) {
      console.error(error);
      res.json({ error });
    }
  }
);

router.delete(
  "/match/:itemId",
  checkAuth,
  upload.any(),
  express.json(),
  async (req, res) => {
    try {
      const { itemId } = req.params;
      const { itemida, itemidb, ownerida, owneridb } = (await db.query(
        "SELECT * FROM Matches WHERE itemIdA=$1 AND ownerIdA=$2"
      ),
      [itemId, req.userId]).rows[0];
      await db.query("BEGIN");
      await db.query(
        "DELETE FROM Matches WHERE itemIdA IN ($1,$2) OR itemIdB IN ($1,$2)",
        [itemida, itemidb]
      );
      await db.query(
        "UPDATE Items SET status='instock' WHERE itemId IN ($1,$2) OR itemId IN ($1,$2)",
        [itemida, itemidb]
      );
      await db.query("COMMIT");
      res.json({ message: "ยกเลิกการแมตช์แล้ว" });
    } catch (error) {
      console.error(error);
      res.json({ error });
    }
  }
);

module.exports = router;
