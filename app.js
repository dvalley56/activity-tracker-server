const express = require("express");
const socketIo = require("socket.io");
const tf = require("@tensorflow/tfjs");
const cors = require("cors");

const connection = require("./database/connection");

const app = express();

app.use(cors());

const server = app.listen(8080, () => {
  console.log("listening on *:8080");
});
const io = socketIo(server);

let logs = [];

//laad model
// const MODEL_PATH  = "http://localhost:3567/model/model.json";
const MODEL_PATH  = "https://raw.githubusercontent.com/dvalley56/nodemcu-server/main/model/model.json";
const class_map_inv = ['idle', 'walking', 'running']


let model;

const buffer = [];

async function loadModel() {
  model = await tf.loadLayersModel(MODEL_PATH);
}

loadModel();

const predictActivity = (data) => {
  // Preprocess the data for prediction
  const preprocessedData = tf.tensor3d(data);

  // Make the prediction using the loaded model
  const prediction = model.predict(preprocessedData);
  const activityStatus = tf.argMax(prediction, axis=1).dataSync()[0];
  return class_map_inv[activityStatus];
}

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

app.get("/data", async (req, res) => {
  try {
    const { daterange, activity_status } = req.query;
    let query = "SELECT * FROM `data`";
    let params = [];
  
    if (daterange) {
      query += " WHERE `timestamp` BETWEEN ? AND ?";
      params.push(daterange.split(","));
    }
  
    if (activity_status) {
      query += " WHERE `activity_status` = ?";
      params.push(activity_status);
    }
  
    const data = await connection.execute(query, params);
    res.status(200).json(data);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

    buffer.push([data.acceleration_x, data.acceleration_y, data.acceleration_z])

    if (buffer.length == 3) {
      data["activity_status"] = predictActivity([buffer]);
      buffer.shift();
    } else {
      data["activity_status"] = "unknown";
    }

    connection.execute(
      "INSERT INTO `data` (`acceleration_magnitude`, `acceleration_x`, `acceleration_y`, `acceleration_z`, `humidity`, `is_fall_detected`, `activity_status`, `temperature`, `type`, `timestamp`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        data.acceleration_magnitude,
        data.acceleration_x,
        data.acceleration_y,
        data.acceleration_z,
        data.humidity,
        data.is_fall_detected,
        data.activity_status,
        data.temperature,
        data.type,
        data.timestamp,
      ]
    );
     
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
    socket.broadcast.emit("tempOutOfRange", `${new Date().toLocaleString()} - ${socket.handshake.headers["user-agent"] } - Temperature out of range`);
  });

  socket.on("humidityOutOfRange", (data) => {
    // send alert or perform other operations
    logs.push(
      `${new Date().toLocaleString()} - ${
        socket.handshake.headers["user-agent"]
      } - Humidity out of range}`
    );
    // emit data to all connected clients except the NodeMCU
    socket.broadcast.emit("humidityOutOfRange", `${new Date().toLocaleString()} - ${socket.handshake.headers["user-agent"] } - Humidity out of range`);
  });

  socket.on("fall", () => {
    // send alert or perform other operations
    logs.push(
      `${new Date().toLocaleString()} - ${
        socket.handshake.headers["user-agent"]
      } - Fall detected}`
    );
    // emit data to all connected clients except the NodeMCU
    socket.broadcast.emit("fall", `${new Date().toLocaleString()} - ${socket.handshake.headers["user-agent"] } - Fall detected`);
  });

  socket.on("disconnect", () => {
    logs.push(
      `${new Date().toLocaleString()} - ${
        socket.handshake.headers["user-agent"]
      } - Connection closed}`
    );
  });
});
