# Activity Tracker - Server
[Live here](https://ashy-plant-0cab97a0f.3.azurestaticapps.net)
[Client](https://github.com/dvalley56/nodemcu-client)
[Find how the model was trained](https://colab.research.google.com/drive/13yukbs1QBgEYILthYoCK7bL7W8znS_BX?usp=sharing)
This is a Node.js server that uses Socket.IO to handle real-time communication with clients. The app has a socket hub to which the Iot device and the client (user interface) connects to exchange data.

# Installation

1. Clone the repository
2. Install the dependencies using `npm install`
3. Create a `.env` file and set the environment variables
4. Run the app using `npm run start:dev` for development

```
// MySQL 8 server
DB_HOST=
DB_USERNAME=
DB_PASSWORD=
DB_DATABASE=
DB_PORT=
```

# Activity Tracker - Server
This is a Node.js server that uses Socket.IO to handle real-time communication with clients. The app has a socket hub to which the Iot device and the client (user interface) connects to exchange data.
    
### From where data is collected ?
We have built our own activity monitering device using nodemcu, axdl345, dht11 that is connected to the using a web socket. Every second it sends a reading to the web socket channel. From there it is passed to a CNN [model](https://colab.research.google.com/drive/13yukbs1QBgEYILthYoCK7bL7W8znS_BX?usp=sharing) that analyses the reading and gives the output as idle, walking or running (classification model).

This was built as an Iot based mini project activity tracker for old age people (a wearable device).
Files for model, training datasets are available in the repositery. To get the sketch file for the nodemcu, you can connect me on [LinkedIn](https://www.linkedin.com/in/isa-sunasra-a34126178/)

