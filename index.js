const express = require("express");

const app = express();
app.use(require("cors")());

app.use("/users", require("./users"));
app.use("/items", require("./items"));
app.use("/addresses", require("./addresses"));

app.listen(8000, () =>
  console.log("Server is running on port 8000", "http://localhost:8000")
);
