#include <ESP8266WiFi.h>
#include <SocketIoClient.h>
#include <ArduinoJson.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_ADXL345_U.h>
#include <DHT.h>

// Replace with your network credentials
const char* ssid = "Enter your SSID";
const char* password = "********";

// Initialize the Wi-Fi client
WiFiClient wifiClient;

// Initialize the DHT11 sensor
#define DHTPIN D3
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

// Initialize the ADXL345 sensor
Adafruit_ADXL345_Unified accel = Adafruit_ADXL345_Unified(12345);

// Initialize the WebSocket client
SocketIoClient socketIO;
String customHeader = "X-Device-Type: NodeMCU";

// Initialize fall detection variables
bool is_fall_detected = false;
unsigned long fall_detection_timer = 0;
unsigned long last_loop_time = 0;

// Initialize LED pins
const int GREEN_LED_PIN = D6;
const int RED_LED_PIN = D7;

void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
    //  blink_led(RED_LED_PIN, 1);
      Serial.println("[WebSocket] Disconnected");
      break;
    case WStype_CONNECTED:
      //blink_led(GREEN_LED_PIN, 3);
      Serial.println("[WebSocket] Connected");
      break;
    case WStype_TEXT:
      Serial.println("[WebSocket] Text received");
      break;
    case WStype_BIN:
      Serial.println("[WebSocket] Binary received");
      break;
    case WStype_ERROR:
      Serial.println("[WebSocket] Error");
      break;
  }
}

void setup() {
  Serial.begin(9600);

  // Initialize LED pins
  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(RED_LED_PIN, OUTPUT);

  // Connect to Wi-Fi network
  delay(100);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    blink_led(RED_LED_PIN, 2);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected");
  blink_led(GREEN_LED_PIN, 2);

  // Initialize sensors
  dht.begin();
  if(!accel.begin()) {
    Serial.println("Could not find a valid ADXL345 sensor, check wiring!");
    blink_led(RED_LED_PIN, 2);
    while(1);
  }

  accel.setRange(ADXL345_RANGE_16_G);

  socketIO.begin("nodemcu-server.azurewebsites.net", 80);
  //socketIO.begin("192.168.0.228", 8080);
  socketIO.setExtraHeaders(customHeader.c_str());
  socketIO.on("reply", messageEventHandler);

  blink_led(GREEN_LED_PIN, 2);
}

void messageEventHandler(const char* payload, size_t length) {
  Serial.printf("got message: %s\n", payload);
}

void loop() {

  socketIO.loop();
  // Read DHT11 sensor
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();

  sensors_event_t event;
  accel.getEvent(&event);
  float acceleration_x = event.acceleration.x;
  float acceleration_y = event.acceleration.y;
  float acceleration_z = event.acceleration.z;

  // Calculate the magnitude of acceleration
  float acceleration_magnitude = sqrt(pow(acceleration_x, 2) + pow(acceleration_y, 2) + pow(acceleration_z, 2));

  // Check if temperature and humidity are within the normal range
  if (temperature > 35.0 || temperature < 18.0) {
    Serial.println("Temperature is out of range");
    DynamicJsonDocument json(1024);
    json["type"] = "temperature_out_of_range";
    json["value"] = temperature;
    String jsonString;
    serializeJson(json, jsonString);
    socketIO.emit("tempOutOfRange", jsonString.c_str());
  }
  if (humidity > 80.0 || humidity < 30.0) {
    Serial.println("Humidity is out of range");
    DynamicJsonDocument json(1024);
    json["type"] = "humidity_out_of_range";
    json["value"] = humidity;
    String jsonString;
    serializeJson(json, jsonString);
    socketIO.emit("humidityOutOfRange", jsonString.c_str());
  }

  // Check if a fall is detected
  if (acceleration_magnitude > 15.0) {
    if (!is_fall_detected) {
      is_fall_detected = true;
      fall_detection_timer = millis();
    }
  } else {
    if (is_fall_detected) {
      is_fall_detected = false;
      unsigned long fall_duration = millis() - fall_detection_timer;
      if (fall_duration > 750) {
        Serial.println("Fall detected");
        DynamicJsonDocument json(1024);
        json["type"] = "fall_detected";
        String jsonString;
        serializeJson(json, jsonString);
        socketIO.emit("fall", jsonString.c_str());
      }
    }
  }

  if (millis() - last_loop_time >= 1000) {
    last_loop_time = millis();

    // Code to be executed every 5 seconds goes here

    // Create JSON object
    DynamicJsonDocument json(1024);
    json["type"] = "data";
    json["temperature"] = temperature;
    json["humidity"] = humidity;
    json["acceleration_x"] = acceleration_x;
    json["acceleration_y"] = acceleration_y;
    json["acceleration_z"] = acceleration_z;
    json["acceleration_magnitude"] = acceleration_magnitude;
    json["is_fall_detected"] = is_fall_detected;

    // Convert JSON object to string
    String jsonString;
    serializeJson(json, jsonString);

    // Send data to WebSocket server
    socketIO.emit("event", jsonString.c_str());
    blink_led(GREEN_LED_PIN, 1);
  }
}

  
void blink_led(int pin, int num_blinks) {
  for (int i = 0; i < num_blinks; i++) {
    digitalWrite(pin, HIGH);
    delay(100);
    digitalWrite(pin, LOW);
    delay(100);
  }
}