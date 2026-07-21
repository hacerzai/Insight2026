#include <Servo.h>

/*
  TinyBot AI — two-servo cardboard hand

  Servo 1 moves the index and middle fingers together.
  Servo 2 moves the ring and pinky fingers together.
  The thumb remains fixed.

  The website sends exactly one robot-move character at 115200 baud:
    R = both finger groups closed
    P = both finger groups open
    S = index/middle open, ring/pinky closed
*/

Servo indexMiddleServo;
Servo ringPinkyServo;

constexpr uint8_t INDEX_MIDDLE_PIN = 9;
constexpr uint8_t RING_PINKY_PIN = 10;

// Change these angles to match your cardboard hand and linkage direction.
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

  // Start safely in Paper (all controlled fingers open).
  indexMiddleServo.write(indexMiddlePosition);
  ringPinkyServo.write(ringPinkyPosition);
}

void loop() {
  while (Serial.available() > 0) {
    char command = Serial.read();

    // Accept lower-case commands too; ignore newlines and all other bytes.
    if (command >= 'a' && command <= 'z') command -= ('a' - 'A');
    setMove(command);
  }

  updateServos();
}
