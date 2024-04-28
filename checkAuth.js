const { verifyToken } = require("./token");

const checkAuth = (req, res, next) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const userData = verifyToken(token);
    req.userId = userData.userId;
    next();
  } catch (error) {
    console.error(error);
    res.json({ message: "Token หมดอายุ" });
  }
};
module.exports = checkAuth;
