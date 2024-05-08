const express = require("express");

const app = express();
app.use(
  require("cors")({
    credentials: true,
    origin: [
      process.env.FRONTEND_ORIGIN,
      "http://localhost:3000",
      "https://winwin-front-end.vercel.app",
    ],
  })
);

app.use("/users", require("./users"));
app.use("/items", require("./items"));
app.use("/addresses", require("./addresses"));

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
