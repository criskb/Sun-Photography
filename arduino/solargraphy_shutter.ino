/*
  Solargraphy shutter controller for Arduino Nano + MG90S servo.
  - Receives one-line JSON-like commands over serial.
  - Supports OPEN, CLOSE, and PULSE actions.
  - Keeps shutter normally closed for long (6+ month) captures.

  Serial commands examples:
    OPEN
    CLOSE
    PULSE 1500
    CFG 110 10   // openAngle closedAngle
*/

#include <Servo.h>

Servo shutterServo;

const uint8_t SERVO_PIN = 9;
int openAngle = 110;
int closedAngle = 10;
unsigned long defaultPulseMs = 1500;

void applyClosed() {
  shutterServo.write(closedAngle);
}

void applyOpen() {
  shutterServo.write(openAngle);
}

void pulseOpen(unsigned long durationMs) {
  applyOpen();
  delay(durationMs);
  applyClosed();
}

void setup() {
  Serial.begin(115200);
  shutterServo.attach(SERVO_PIN);
  applyClosed();
  Serial.println("READY Solargraphy shutter");
}

void loop() {
  if (!Serial.available()) return;

  String line = Serial.readStringUntil('\n');
  line.trim();

  if (line.equalsIgnoreCase("OPEN")) {
    applyOpen();
    Serial.println("OK OPEN");
    return;
  }

  if (line.equalsIgnoreCase("CLOSE")) {
    applyClosed();
    Serial.println("OK CLOSE");
    return;
  }

  if (line.startsWith("PULSE")) {
    unsigned long ms = defaultPulseMs;
    int spacePos = line.indexOf(' ');
    if (spacePos > 0) {
      String val = line.substring(spacePos + 1);
      ms = (unsigned long) val.toInt();
      if (ms < 100) ms = 100;
    }
    pulseOpen(ms);
    Serial.println("OK PULSE");
    return;
  }

  if (line.startsWith("CFG")) {
    int firstSpace = line.indexOf(' ');
    int secondSpace = line.indexOf(' ', firstSpace + 1);
    if (firstSpace > 0 && secondSpace > firstSpace) {
      openAngle = line.substring(firstSpace + 1, secondSpace).toInt();
      closedAngle = line.substring(secondSpace + 1).toInt();
      openAngle = constrain(openAngle, 0, 180);
      closedAngle = constrain(closedAngle, 0, 180);
      applyClosed();
      Serial.println("OK CFG");
      return;
    }
  }

  Serial.println("ERR Unknown command");
}
