async function writeToSerial(port, writer, data) {
  try {
    // Check if port is connected and writable
    if (!port || !port.writable) {
      console.error("Serial port is not connected or writable.");
      return;
    }

    // Ensure the data is an array of numbers
    if (
      !Array.isArray(data) ||
      !data.every((byte) => typeof byte === "number")
    ) {
      console.error("Invalid data format: data should be an array of numbers.");
      return;
    }

    // Append 0x0A (newline character) to the data
    const packet = [...data, 0x0a];

    // Write the data to the serial port
    await writer.write(new Uint8Array(packet)); // Convert to Uint8Array
    console.log("Data written successfully:", packet);
  } catch (error) {
    console.error("Error writing to serial port:", error);
  }
}

async function readLoop(
  reader,
  outputTextarea,
  configCallback,
  heartbeatCallback,
  maxMessages = 100
) {
  let buffer = new Uint8Array(); // Buffer to accumulate incoming data
  let messageCount = 0; // Count of received messages

  try {
    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        reader.releaseLock();
        break;
      }

      const newData = new Uint8Array(value);
      buffer = mergeBuffers(buffer, newData);
      outputTextarea.value += Array.from(newData, (byte) =>
        String.fromCharCode(byte)
      ).join("");
      outputTextarea.scrollTop = outputTextarea.scrollHeight;

      // Process the buffer for protocol-based messages
      buffer = processProtocolData(buffer, configCallback, heartbeatCallback);

      if (value) {
        messageCount++;
        if (messageCount >= maxMessages) {
          console.log("Buffer full, clearing...");
          buffer = new Uint8Array();
          messageCount = 0;
        }
      }
    }
  } catch (error) {
    console.error("Error reading:", error);
  }
}

// Helper to merge two Uint8Array buffers
function mergeBuffers(buffer1, buffer2) {
  const merged = new Uint8Array(buffer1.length + buffer2.length);
  merged.set(buffer1);
  merged.set(buffer2, buffer1.length);
  return merged;
}

// Helper function to process protocol-based data
function processProtocolData(buffer, configCallback, heartbeatCallback) {
  const HEADER = [0xeb, 0x90];
  while (buffer.length >= 10) {
    const startIndex = buffer.findIndex(
      (_, i) => buffer[i] === HEADER[0] && buffer[i + 1] === HEADER[1]
    );
    if (startIndex === -1) break; // No valid header found

    const packet = buffer.slice(startIndex);
    if (packet.length < 10) break; // Wait for the full packet

    const modeByte = packet[4]; // Mode byte
    const sourceByte = packet[5]; // Source byte (BB indicates from device)

    if (sourceByte !== 0xbb) {
      buffer = buffer.slice(startIndex + 2); // Skip invalid packet
      continue;
    }

    if (modeByte === 0xc1) {
      // Heartbeat
      const flags = parseHeartbeatFlags(packet[6]);
      const signalStregnth = packet[7];
      heartbeatCallback(flags, signalStregnth);
      //console.log("Heartbeat received:", flags);
      buffer = buffer.slice(startIndex + 10); // Move to next packet
    } else if (modeByte === 0xc2) {
      // Read Config
      if (packet.length < 11) {
        console.log(
          "Waiting for enough data. Current packet length: ",
          packet.length
        );
        break; // Wait for enough data to process
      }

      const jsonLength = (packet[6] << 8) | packet[7];
      console.log("Extracted JSON Length: ", jsonLength);

      if (packet.length < 10 + jsonLength) {
        console.log(
          "Waiting for full JSON + checksum. Current packet length: ",
          packet.length
        );
        break; // Wait for full JSON + checksum
      }
      console.log("expected number of bytes received");

      const jsonPayload = packet.slice(10, 10 + jsonLength);
      //console.log("Extracted JSON Payload: ", jsonPayload);

      const checksum = (packet[8] << 8) | packet[9];
      //console.log("Extracted checksum: ", checksum);
      //console.log(packet[8]);

      const computedChecksum = computeChecksumXOR(jsonPayload);
      //console.log("Computed checksum: ", computedChecksum);

      if (checksum !== computedChecksum) {
        console.log("Invalid checksum for ReadConfig");
        console.log("Received checksum: " + checksum);
        console.log("Computed checksum: " + computedChecksum);
        console.log("Invalid checksum for ReadConfig");

        buffer = buffer.slice(startIndex + 10 + jsonLength + 2); // Skip invalid packet
        continue;
      }

      const jsonObject = parseJSONPayload(jsonPayload);
      //console.log("Parsed JSON Object: ", jsonObject);
      configCallback(jsonObject);

      console.log("ReadConfig reply received:", jsonObject);
      buffer = buffer.slice(startIndex + 10 + jsonLength + 2);
    } else if (modeByte === 0xc3) {
      // Write Config
      console.log("WriteConfig reply received: Success");
      buffer = buffer.slice(startIndex + 10); // Move to next packet
    } else {
      buffer = buffer.slice(startIndex + 2); // Skip invalid packet
    }
  }
  return buffer;
}

// Helper to parse heartbeat flags
function parseHeartbeatFlags(byte) {
  return {
    simInserted: Boolean(byte & 0b0001),
    gprsConnected: Boolean(byte & 0b0010),
    serverConnected: Boolean(byte & 0b0100),
    gpsReady: Boolean(byte & 0b1000),
  };
}

// Helper to validate checksum
function computeChecksumXOR(data) {
  return data.reduce((checksum, byte) => (checksum ^ byte) & 0xffff, 0);
}

// Helper to parse JSON payload
function parseJSONPayload(payload) {
  try {
    const jsonString = new TextDecoder().decode(payload);
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Error parsing JSON:", error);
    return null;
  }
}

async function createAndSendConfigPacket(port, writer, dataObject) {
  // Remove the ImeiInput field if present
  console.log(dataObject);
  const { ImeiInput, ...filteredData } = dataObject;

  // Convert the object to a JSON string
  const jsonString = JSON.stringify(filteredData);

  // Calculate the JSON payload length
  const jsonLength = jsonString.length;

  // Convert JSON string to bytes
  const jsonBytes = Array.from(jsonString, (char) => char.charCodeAt(0));

  // Calculate checksum
  const checksum = computeChecksumXOR(jsonBytes);

  // Construct the packet
  const msbLength = (jsonLength >> 8) & 0xff; // Most significant byte of length
  const lsbLength = jsonLength & 0xff; // Least significant byte of length
  const msbChecksum = (checksum >> 8) & 0xff; // Most significant byte of checksum
  const lsbChecksum = checksum & 0xff; // Least significant byte of checksum

  const packet = [
    0xeb,
    0x90,
    0xff,
    0xff,
    0xc3,
    0xaa, // Fixed header
    msbLength,
    lsbLength, // Length
    msbChecksum,
    lsbChecksum, // Checksum
    ...jsonBytes, // JSON payload
  ];
  console.log(packet);

  // Send the packet to the serial port
  await writeToSerial(port, writer, packet);
}

async function writeReadPacket(port, writer) {
  // The fixed packet
  const fixedPacket = [
    0xeb, 0x90, 0xff, 0xff, 0xc2, 0xaa, 0x00, 0x00, 0x00, 0x00,
  ];

  // Send the fixed packet to the serial port
  await writeToSerial(port, writer, fixedPacket);
}
