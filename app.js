const express = require("express");
const socketIo = require("socket.io");
const tf = require("@tensorflow/tfjs-node");

const app = express();

const server = app.listen(8080, () => {
  console.log("listening on *:8080");
});
const io = socketIo(server);

let logs = [];

//laad model
// const MODEL_PATH  = "http://localhost:3567/model/model.json";
const MODEL_PATH  = "file://model/model.json";
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
    socket.broadcast.emit("tempOutOfRange", `${new Date().toLocaleString()} - ${socket.handshake.headers["user-agent"] } - Temperature out of range}`);
  });

  socket.on("humidityOutOfRange", (data) => {
    // send alert or perform other operations
    logs.push(
      `${new Date().toLocaleString()} - ${
        socket.handshake.headers["user-agent"]
      } - Humidity out of range}`
    );
    // emit data to all connected clients except the NodeMCU
    socket.broadcast.emit("humidityOutOfRange", `${new Date().toLocaleString()} - ${socket.handshake.headers["user-agent"] } - Humidity out of range}`);
  });

  socket.on("fall", () => {
    // send alert or perform other operations
    logs.push(
      `${new Date().toLocaleString()} - ${
        socket.handshake.headers["user-agent"]
      } - Fall detected}`
    );
    // emit data to all connected clients except the NodeMCU
    socket.broadcast.emit("fall", `${new Date().toLocaleString()} - ${socket.handshake.headers["user-agent"] } - Fall detected}`);
  });

  socket.on("disconnect", () => {
    logs.push(
      `${new Date().toLocaleString()} - ${
        socket.handshake.headers["user-agent"]
      } - Connection closed}`
    );
  });
});
