const express = require("express");

const app = express();
app.use(require("cors")());

app.use("/users", require("./users"));
app.use("/items", require("./items"));
app.use("/addresses", require("./addresses"));

const { server_port, server_ip } = process.env;
app.listen(server_port, server_ip, () =>
  console.log(
    "Server is running on port 8000",
    `http://${server_ip}:${server_port}`
  )
);
