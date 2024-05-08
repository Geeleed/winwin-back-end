const cors = require("cors");
module.exports = cors({
  credentials: true,
  origin: [
    process.env.FRONTEND_ORIGIN,
    "http://localhost:3000",
    "https://winwin-front-end.vercel.app",
  ],
});
