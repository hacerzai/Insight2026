#include <Servo.h>

/*
  Vision AI Science Lab — two-servo TinyBot hand
  D9: index + middle fingers
  D10: ring + pinky fingers
  Thumb: mechanically fixed

  The website sends only the robot's move at 115200 baud:
    R = both groups closed
    P = both groups open
    S = index/middle open, ring/pinky closed
*/

Servo indexMiddleServo;
Servo ringPinkyServo;

constexpr uint8_t INDEX_MIDDLE_PIN = 9;
constexpr uint8_t RING_PINKY_PIN = 10;

// Calibrate these four angles for the linkage before exhibition day.
constexpr int INDEX_MIDDLE_OPEN = 15;
constexpr int INDEX_MIDDLE_CLOSED = 165;
constexpr int RING_PINKY_OPEN = 15;
constexpr int RING_PINKY_CLOSED = 165;
constexpr unsigned long STEP_INTERVAL_MS = 8;

int indexMiddlePosition = INDEX_MIDDLE_OPEN;
int ringPinkyPosition = RING_PINKY_OPEN;
int indexMiddleTarget = INDEX_MIDDLE_OPEN;
int ringPinkyTarget = RING_PINKY_OPEN;
unsigned long lastStepAt = 0;

void setMove(char command) {
  switch (command) {
    case 'R':
      indexMiddleTarget = INDEX_MIDDLE_CLOSED;
      ringPinkyTarget = RING_PINKY_CLOSED;
      break;
    case 'P':
      indexMiddleTarget = INDEX_MIDDLE_OPEN;
      ringPinkyTarget = RING_PINKY_OPEN;
      break;
    case 'S':
      indexMiddleTarget = INDEX_MIDDLE_OPEN;
      ringPinkyTarget = RING_PINKY_CLOSED;
      break;
  }
}

int stepToward(int current, int target) {
  if (current < target) return current + 1;
  if (current > target) return current - 1;
  return current;
}

void updateServos() {
  const unsigned long now = millis();
  if (now - lastStepAt < STEP_INTERVAL_MS) return;
  lastStepAt = now;
  indexMiddlePosition = stepToward(indexMiddlePosition, indexMiddleTarget);
  ringPinkyPosition = stepToward(ringPinkyPosition, ringPinkyTarget);
  indexMiddleServo.write(indexMiddlePosition);
  ringPinkyServo.write(ringPinkyPosition);
}

void setup() {
  Serial.begin(115200);
  indexMiddleServo.attach(INDEX_MIDDLE_PIN);
  ringPinkyServo.attach(RING_PINKY_PIN);
  indexMiddleServo.write(indexMiddlePosition);
  ringPinkyServo.write(ringPinkyPosition);
}

void loop() {
  while (Serial.available() > 0) {
    char command = Serial.read();
    if (command >= 'a' && command <= 'z') command -= ('a' - 'A');
    setMove(command);
  }
  updateServos();
}
