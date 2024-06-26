require("dotenv").config();
const { v4: uuidv4 } = require("uuid");
const express = require("express");
const db = require("./dbinit");
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage });
const checkAuth = require("./checkAuth");

// const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
// const s3 = new DynamoDBClient({});
const AWS = require("aws-sdk");
const sharp = require("sharp");
const BUCKET_NAME = process.env.BUCKET_NAME;
const BUCKET_REGION = process.env.BUCKET_REGION;
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
// const s3 = new AWS.S3();
// s3.config.update({
//   accessKeyId: AWS_ACCESS_KEY_ID,
//   secretAccessKey: AWS_SECRET_ACCESS_KEY,
//   region: BUCKET_REGION,
// });
const s3 = new AWS.S3({
  accessKeyId: AWS_ACCESS_KEY_ID,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
  region: BUCKET_REGION,
});

const router = express.Router();
router.use(require("./cors"));

// อัปโหลดข้อมูล item ลงใน Items พร้อมทั้งเก็บไฟล์ภาพไว้ใน AWS S3
router.post(
  "/myItem",
  checkAuth,
  upload.array("files", 3),
  express.json(),
  async (req, res) => {
    try {
      const { title, description, weight, height, width, length, sending } =
        req.body;
      const ownerId = req.userId;
      const status = "instock";
      const files = req.files;
      const imageFolder = "image";
      const imageNames = files.map((i) => uuidv4());
      // const fileData = imageNames.map((imageName, index) => ({
      //   Bucket: BUCKET_NAME + `/${imageFolder}`,
      //   Key: imageName,
      //   Body: files[index].buffer,
      // }));
      const fileData = await Promise.all(
        imageNames.map(async (imageName, index) => {
          const resizedImage = await sharp(files[index].buffer)
            .resize({ height: 320, width: 320, fit: "contain" })
            .toBuffer();
          return {
            Bucket: BUCKET_NAME + `/${imageFolder}`,
            Key: imageName,
            Body: resizedImage,
          };
        })
      );
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
      res.json({ message: "อัปโหลดสำเร็จ", isOk: true, files });
    } catch (error) {
      console.error(error);
      res.json({ error, message: "มีข้อผิดพลาด", isOk: false });
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
      res.json({ message: "แก้ไขข้อมูลสำเร็จ", isOk: true });
    } catch (error) {
      console.error(error);
      res.json({ error, message: "มีข้อผิดพลาด", isOk: false });
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
      res.json({ data: data.rows, isOk: true });
    } catch (error) {
      console.error(error);
      res.json({ error, message: "มีข้อผิดพลาด", isOk: false });
    }
  }
);

router.delete("/myItem", upload.any(), express.json(), async (req, res) => {
  try {
    const { itemId } = req.body;
    const locations = (
      await db.query("SELECT imageUrls FROM Items WHERE itemId=$1", [itemId])
    ).rows[0].imageurls
      .slice(1, -1)
      .split(",")
      .map((i) => i.slice(1, -1));
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
    const objects = locations.map((location) => ({
      Key: "image" + location.split("image")[1],
    }));
    await s3
      .deleteObjects({ Bucket: BUCKET_NAME, Delete: { Objects: objects } })
      .promise();
    res.json({ message: "ลบข้อมูล item สำเร็จ", isOk: true });
  } catch (error) {
    console.error(error);
    res.json({ error, message: "มีข้อผิดพลาด", isOk: false });
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
        "SELECT * FROM Items WHERE ownerId!=$1 AND status='posting' AND itemId NOT IN (SELECT itemId FROM ItemActions WHERE clickerId=$1)",
        [req.userId]
      );
      res.json({
        data: data.rows,
        message: "โหลดข้อมูลมาตลาดสำเร็จ",
        isOk: true,
      });
    } catch (error) {
      console.error(error);
      res.json({ error, message: "มีข้อผิดพลาด", isOk: false });
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
      res.json({ message: "เปลี่ยนสถานะเป็น hidden สำเร็จ", isOk: true });
    } catch (error) {
      console.error(error);
      res.json({ error, message: "มีข้อผิดพลาด", isOk: false });
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
      res.json({ message: "เปลี่ยนสถานะเป็น posting สำเร็จ", isOk: true });
    } catch (error) {
      console.error(error);
      res.json({ error, message: "มีข้อผิดพลาด", isOk: false });
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
      res.json({ message: "เปลี่ยนสถานะเป็น safePosting สำเร็จ", isOk: true });
    } catch (error) {
      console.error(error);
      res.json({ error, message: "มีข้อผิดพลาด", isOk: false });
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
      res.json({ message: "เปลี่ยนสถานะเป็น instock สำเร็จ", isOk: true });
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
      res.json({
        message: "บันทึกไว้เป็นรายการที่อยากได้เรียบร้อย",
        isOk: true,
      });
    } catch (error) {
      console.error(error);
      res.json({ error, isOk: false });
    }
  }
);

router.get("/wish", checkAuth, async (req, res) => {
  try {
    const data = (
      await db.query(
        "SELECT * FROM Items WHERE itemId IN (SELECT itemId FROM ItemActions WHERE act='wish' AND clickerId=$1)",
        [req.userId]
      )
    ).rows;
    res.json({ data, isOk: true });
  } catch (error) {
    console.error(error);
    res.json({ error, isOk: false });
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
      res.json({ message: "ยกเลิกการ wish เรียบร้อย", isOk: true });
    } catch (error) {
      console.error(error);
      res.json({ error, isOk: false });
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
      // await db.query(
      //   " INSERT INTO ItemActions (itemId,ownerId,clickerId,act) VALUES ($1,$2,$3,$4)",
      //   [itemId, ownerid, req.userId, "exchange"]
      // );
      await db.query(
        `WITH updated_rows AS (UPDATE ItemActions SET act = $4 WHERE itemId = $1 AND ownerId = $2 AND clickerId = $3 RETURNING *)
        INSERT INTO ItemActions (itemId, ownerId, clickerId, act) SELECT $1, $2, $3, $4 WHERE NOT EXISTS (SELECT 1 FROM updated_rows)`,
        [itemId, ownerid, req.userId, "exchange"]
      );
      res.json({ message: "ส่งคำขอแลกเปลี่ยนเรียบร้อย", isOk: true });
    } catch (error) {
      console.error(error);
      res.json({ error, isOk: false });
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
      res.json({ message: "ยกเลิกคำขอแลกเปลี่ยนเรียบร้อย", isOk: true });
    } catch (error) {
      console.error(error);
      res.json({ error, isOk: false });
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
        "SELECT * FROM Items WHERE itemId IN (SELECT itemId FROM ItemActions WHERE act='exchange' AND ownerId=$1)",
        [req.userId]
      );
      res.json({ data: data.rows, isOk: true });
    } catch (error) {
      console.error(error);
      res.json({ error, isOk: false });
    }
  }
);

router.get(
  "/wishExchange",
  checkAuth,
  upload.any(),
  express.json(),
  async (req, res) => {
    try {
      const data = await db.query(
        "SELECT * FROM Items WHERE itemId IN (SELECT itemId FROM ItemActions WHERE act='exchange' AND clickerId=$1)",
        [req.userId]
      );
      res.json({ data: data.rows, isOk: true });
    } catch (error) {
      console.error(error);
      res.json({ error, isOk: false });
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
        "SELECT * FROM Items WHERE ownerId IN (SELECT clickerId FROM ItemActions WHERE itemId=$1) AND (status!='matched' AND status!='hidden')",
        [itemId]
      );
      res.json({ data: data.rows, isOk: true });
    } catch (error) {
      console.error(error);
      res.json({ error, isOk: false });
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

      res.json({ message: "แมตช์การแลกเปลี่ยนแล้ว", isOk: true });
    } catch (error) {
      console.error(error);
      res.json({ error, isOk: false });
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
      res.json({
        myItem: myItem.rows[0],
        matchItem: matchItem.rows[0],
        isOk: true,
      });
    } catch (error) {
      console.error(error);
      res.json({ error, isOk: false });
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
      const { itemida, itemidb, ownerida, owneridb } = (
        await db.query(
          "SELECT * FROM Matches WHERE itemIdA=$1 AND ownerIdA=$2",
          [itemId, req.userId]
        )
      ).rows[0];
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
      res.json({ message: "ยกเลิกการแมตช์แล้ว", isOk: true });
    } catch (error) {
      console.error(error);
      res.json({ error, isOk: false });
    }
  }
);

module.exports = router;
