const express = require("express");
const socketIo = require("socket.io");

const app = express();

const server = app.listen(8080, () => {
  console.log("listening on *:8080");
});
const io = socketIo(server);

let logs = [];
// keep the log format as dd/mm/yyyy hh:mm:ss - host - message

app.get("/", (req, res) => {
  res.send(
    ` <h1>IoT Server</h1>
    <h2>Logs</h2>
    <ul>
      ${logs.map((log) => `<li>${log}</li>`).join("")}
    </ul>
    `
  );
});

io.on("connection", (socket) => {
  logs.push(
    `${new Date().toLocaleString()} - ${
      socket.handshake.headers["user-agent"]
    } - Connection established`
  );

  socket.on("event", (data) => {
    if (typeof data === "object") {
      data.timestamp = new Date();
    }
    data.temperature = data.temperature || Math.floor(Math.random() * 10 + 20);
    data.humidity = data.humidity || Math.floor(Math.random() * 20 + 40);
    socket.broadcast.emit("data", data);
  });

  socket.on("tempOutOfRange", (data) => {
    // send alert or perform other operations
    logs.push(
      `${new Date().toLocaleString()} - ${
        socket.handshake.headers["user-agent"]
      } - Temperature out of range}`
    );
    // emit data to all connected clients except the NodeMCU
    socket.broadcast.emit("tempOutOfRange", data);
  });

  socket.on("humidityOutOfRange", (data) => {
    // send alert or perform other operations
    logs.push(
      `${new Date().toLocaleString()} - ${
        socket.handshake.headers["user-agent"]
      } - Humidity out of range}`
    );
    // emit data to all connected clients except the NodeMCU
    socket.broadcast.emit("humidityOutOfRange", data);
  });

  socket.on("fall", () => {
    // send alert or perform other operations
    logs.push(
      `${new Date().toLocaleString()} - ${
        socket.handshake.headers["user-agent"]
      } - Fall detected}`
    );
    // emit data to all connected clients except the NodeMCU
    socket.broadcast.emit("fall", true);
  });

  socket.on("disconnect", () => {
    logs.push(
      `${new Date().toLocaleString()} - ${
        socket.handshake.headers["user-agent"]
      } - Connection closed}`
    );
  });
});
