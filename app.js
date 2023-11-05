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
const MODEL_PATH = "https://raw.githubusercontent.com/dvalley56/nodemcu-server/main/model/model.json";
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
  const activityStatus = tf.argMax(prediction, axis = 1).dataSync()[0];
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
    let { startDate, endDate, activity_status } = req.query;
    let query = "";
    let params = [];

    if (!startDate && !endDate) {
      // get min timestamp from db
      query = "SELECT MIN(timestamp) AS min_timestamp FROM `data`";
      const data = await connection.execute(query);
      startDate = data[0].min_timestamp;

      // select max timestamp from db
      query = "SELECT MAX(timestamp) AS max_timestamp FROM `data`";
      const data2 = await connection.execute(query);
      endDate = data2[0].max_timestamp;
    }

    startDate = new Date(startDate);
    endDate = new Date(endDate);

    query =
      "WITH RECURSIVE DateRange AS ( " +
      "SELECT TIMESTAMP(?) AS dt " +
      "UNION ALL " +
      "SELECT TIMESTAMPADD(MINUTE, 1, dt) " +
      "FROM DateRange " +
      "WHERE dt < ? " +
      ") " +
      "SELECT DATE_FORMAT(dr.dt, '%Y-%m-%d %H:%i:00Z') AS rounded_dt," +
      "AVG(d.acceleration_magnitude) AS acceleration_magnitude," +
      "AVG(d.acceleration_x) AS acceleration_x," +
      "AVG(d.acceleration_y) AS acceleration_y," +
      "AVG(d.acceleration_z) AS acceleration_z," +
      "AVG(d.humidity) AS humidity," +
      "AVG(d.temperature) AS temperature," +
      (activity_status ? "? AS activity_status, " : "") +
      "DATE_FORMAT(dr.dt, '%Y-%m-%d %H:%i:00Z') AS timestamp " +
      "FROM DateRange dr " +
      "LEFT JOIN data d ON DATE_FORMAT(dr.dt, '%Y-%m-%d %H:%i:00Z') = DATE_FORMAT(d.timestamp, '%Y-%m-%d %H:%i:00Z') " +
      (activity_status ? "AND activity_status = ?" : "") +
      "GROUP BY rounded_dt " +
      "ORDER BY rounded_dt DESC "
      ;
    params.push(startDate, endDate);
    if (activity_status) {
      params.push(activity_status);
      params.push(activity_status);
    }
    await connection.execute('SET @@cte_max_recursion_depth = 5000;');

    console.log("params", params);

    const data = await connection.execute(query, params);
    res.status(200).json(data);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/stats", async (req, res) => {

  try {

    let totalRecords = await connection.execute("SELECT COUNT(*) AS total_records FROM `data`");
    totalRecords = totalRecords[0].total_records;

    let avgTemp = await connection.execute("SELECT AVG(temperature) AS avg_temp FROM `data`");
    avgTemp = avgTemp[0].avg_temp;

    let avgHumidity = await connection.execute("SELECT AVG(humidity) AS avg_humidity FROM `data`");
    avgHumidity = avgHumidity[0].avg_humidity;

    res.status(200).json({ totalRecords, avgTemp, avgHumidity });

  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }

});

io.on("connection", (socket) => {
  logs.push(
    `${new Date().toLocaleString()} - ${socket.handshake.headers["user-agent"]
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

    // uncomment to save data to database
    // connection.execute(
    //   "INSERT INTO `data` (`acceleration_magnitude`, `acceleration_x`, `acceleration_y`, `acceleration_z`, `humidity`, `is_fall_detected`, `activity_status`, `temperature`, `type`, `timestamp`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    //   [
    //     data.acceleration_magnitude,
    //     data.acceleration_x,
    //     data.acceleration_y,
    //     data.acceleration_z,
    //     data.humidity,
    //     data.is_fall_detected,
    //     data.activity_status,
    //     data.temperature,
    //     data.type,
    //     data.timestamp,
    //   ]
    // );

    socket.broadcast.emit("data", data);
  });

  socket.on("tempOutOfRange", (data) => {
    logs.push(
      `${new Date().toLocaleString()} - ${socket.handshake.headers["user-agent"]
      } - Temperature out of range}`
    );
    socket.broadcast.emit("tempOutOfRange", `${new Date().toLocaleString()} - ${socket.handshake.headers["user-agent"]} - Temperature out of range`);
  });

  socket.on("humidityOutOfRange", (data) => {
    logs.push(
      `${new Date().toLocaleString()} - ${socket.handshake.headers["user-agent"]
      } - Humidity out of range}`
    );
    socket.broadcast.emit("humidityOutOfRange", `${new Date().toLocaleString()} - ${socket.handshake.headers["user-agent"]} - Humidity out of range`);
  });

  socket.on("fall", () => {
    logs.push(
      `${new Date().toLocaleString()} - ${socket.handshake.headers["user-agent"]
      } - Fall detected}`
    );
    socket.broadcast.emit("fall", `${new Date().toLocaleString()} - ${socket.handshake.headers["user-agent"]} - Fall detected`);
  });

  socket.on("disconnect", () => {
    logs.push(
      `${new Date().toLocaleString()} - ${socket.handshake.headers["user-agent"]
      } - Connection closed}`
    );
  });
});
