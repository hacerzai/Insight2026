# TinyBot AI — Insight 2026

**Can You Beat the Robot?**

A futuristic Rock–Paper–Scissors AI experience created for the Indraprastha World School Insight 2026 exhibition.

## Live project

https://tinybot-ai.naziaparveen.chatgpt.site

## Features

- Google MediaPipe Gesture Recognizer with 21-point hand tracking
- Live webcam predictions with confidence tracking
- Animated TinyBot opponent and randomized dialogue
- Player/robot scoreboards, win rates and streaks
- Five-win Boss Mode
- Sound effects and responsive futuristic interface
- Web Serial connection at 115200 baud
- Sends exactly `R`, `P`, or `S` to an Arduino after TinyBot chooses
- Two-servo robot-hand firmware included

## Hardware

- Laptop running Chrome or Edge
- Arduino Uno R4 WiFi
- Two servos
- Servo 1 moves the index and middle fingers together
- Servo 2 moves the ring and pinky fingers together
- The thumb stays fixed

## Two-servo hand mapping

| Robot move | Index + middle servo | Ring + pinky servo |
| --- | --- | --- |
| Rock (`R`) | Closed | Closed |
| Paper (`P`) | Open | Open |
| Scissors (`S`) | Open | Closed |

The ready-to-upload Arduino sketch is in
[`arduino/TinyBotTwoServo/TinyBotTwoServo.ino`](arduino/TinyBotTwoServo/TinyBotTwoServo.ino).

### Wiring

| Connection | Arduino Uno R4 WiFi |
| --- | --- |
| Index + middle servo signal | D9 |
| Ring + pinky servo signal | D10 |
| Servo grounds | GND |
| Servo power | External regulated 5 V supply recommended |

Connect the external supply ground to Arduino GND. Do not power two loaded
servos from the Arduino 5 V pin; servo current can reset or damage the board.

If a finger moves backwards, adjust the four angle constants near the top of
the Arduino sketch. The website continues to send only the robot's move.

Built for Insight 2026.
