const express = require("express");

const app = express();

app.use("/users", require("./users"));
app.use("/items", require("./items"));
app.use("/addresses", require("./addresses"));

app.use(require("./cors"));

app.get("/", (req, res) => {
  res.send("WINWIN back-end is ok!");
});

const { server_port, server_ip } = process.env;
app.listen(server_port, server_ip, () =>
  console.log(
    "Server is running on port 8000",
    `http://${server_ip}:${server_port}`
  )
);
