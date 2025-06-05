console.log("HTV Config Script Loaded v4.0.0");
document.addEventListener("DOMContentLoaded", () => {
  let port;
  let reader;
  let writer;

  const maskOptions = {
    mask: "AAAA",
    definitions: {
      A: { validator: "[0-9A-Fa-f]", cardinality: 1, prevalidator: null },
    },
  };
  const defaultValues = {
    //ImeiInput: "123456789012345", // Default IMEI
    apnInput: "internet", // Default APN
    ipInput: "192.168.1.1", // Default IP
    portInput: "8080", // Default Port
    updateRateInput: "10", // Default Update Rate
    canTypeInput: "EXTID", // Default CAN Type
    pid1: 65535, // Default PID 1
    pid2: 65535, // Default PID 2
    pid3: 65535, // Default PID 3
    pid4: 65535, // Default PID 4
    pid5: 65535, // Default PID 5
    pid6: 65535, // Default PID 6
    pid7: 65535, // Default PID 7
    pid8: 65535, // Default PID 8
    pid9: 65535, // Default PID 9
    pid10: 65535, // Default PID 10
  };

  const readValues = {};

  const outputTextarea = document.getElementById("outputTextarea");

  const imeiInput = document.getElementById("ImeiInput");
  const apnInput = document.getElementById("apnInput");
  const ipInput = document.getElementById("ipInput");
  const portInput = document.getElementById("portInput");
  const updateRateInput = document.getElementById("updateRateInput");
  const canTypeInput = document.getElementById("canTypeInput");
  const pid1 = document.getElementById("pid1");
  const pid2 = document.getElementById("pid2");
  const pid3 = document.getElementById("pid3");
  const pid4 = document.getElementById("pid4");
  const pid5 = document.getElementById("pid5");
  const pid6 = document.getElementById("pid6");
  const pid7 = document.getElementById("pid7");
  const pid8 = document.getElementById("pid8");
  const pid9 = document.getElementById("pid9");
  const pid10 = document.getElementById("pid10");

  const simIndicator = document.getElementById("sim-indicator");
  const gprsIndicator = document.getElementById("gprs-indicator");
  const serverIndicator = document.getElementById("server-indicator");
  const gpsIndicator = document.getElementById("gps-indicator");

  const connectBtn = document.getElementById("connectBtn");
  const showBtn = document.getElementById("showBtn");
  const hideBtn = document.getElementById("hideBtn");
  const showCanBtn = document.getElementById("showCanBtn");
  const hideCanBtn = document.getElementById("hideCanBtn");
  const defaultBtn = document.getElementById("defaultConfigsBtn");
  const readBtn = document.getElementById("readConfigsBtn");
  const saveBtn = document.getElementById("saveConfigsBtn");

  new Inputmask(maskOptions).mask(pid1);
  new Inputmask(maskOptions).mask(pid2);
  new Inputmask(maskOptions).mask(pid3);
  new Inputmask(maskOptions).mask(pid4);
  new Inputmask(maskOptions).mask(pid5);
  new Inputmask(maskOptions).mask(pid6);
  new Inputmask(maskOptions).mask(pid7);
  new Inputmask(maskOptions).mask(pid8);
  new Inputmask(maskOptions).mask(pid9);
  new Inputmask(maskOptions).mask(pid10);

  function populateHeartbeatFlags(flags, signalStrength) {
    console.log("heartbeat recevied");
    updateLedState(simIndicator, flags.simInserted);
    updateLedState(gprsIndicator, flags.gprsConnected);
    updateLedState(serverIndicator, flags.serverConnected);
    updateLedState(gpsIndicator, flags.gpsReady);
    updateSignalStrength(signalStrength);
  }
  function updateLedState(ledElement, isActive) {
    if (isActive) {
      ledElement.classList.remove("led-off", "led-red");
      ledElement.classList.add("led-green");
    } else {
      ledElement.classList.remove("led-off", "led-green");
      ledElement.classList.add("led-red");
    }
  }
  function convertToHex(value) {
    // Convert the number to a 4-character hexadecimal string
    return value.toString(16).toUpperCase().padStart(4, "0");
  }
  function convertFromHex(hexValue) {
    // Convert a 4-character hexadecimal string back to a number
    return parseInt(hexValue, 16);
  }

  function populateInputs(inputValues) {
    // Use the variables directly to populate the input fields
    if (inputValues.ImeiInput !== undefined)
      imeiInput.value = inputValues.ImeiInput;
    if (inputValues.apnInput !== undefined)
      apnInput.value = inputValues.apnInput;
    if (inputValues.ipInput !== undefined) ipInput.value = inputValues.ipInput;
    if (inputValues.portInput !== undefined)
      portInput.value = inputValues.portInput;
    if (inputValues.updateRateInput !== undefined)
      updateRateInput.value = inputValues.updateRateInput;
    if (inputValues.canTypeInput !== undefined)
      canTypeInput.value = inputValues.canTypeInput;
    if (inputValues.pid1 !== undefined)
      pid1.value = convertToHex(inputValues.pid1);
    if (inputValues.pid2 !== undefined)
      pid2.value = convertToHex(inputValues.pid2);
    if (inputValues.pid3 !== undefined)
      pid3.value = convertToHex(inputValues.pid3);
    if (inputValues.pid4 !== undefined)
      pid4.value = convertToHex(inputValues.pid4);
    if (inputValues.pid5 !== undefined)
      pid5.value = convertToHex(inputValues.pid5);
    if (inputValues.pid6 !== undefined)
      pid6.value = convertToHex(inputValues.pid6);
    if (inputValues.pid7 !== undefined)
      pid7.value = convertToHex(inputValues.pid7);
    if (inputValues.pid8 !== undefined)
      pid8.value = convertToHex(inputValues.pid8);
    if (inputValues.pid9 !== undefined)
      pid9.value = convertToHex(inputValues.pid9);
    if (inputValues.pid10 !== undefined)
      pid10.value = convertToHex(inputValues.pid10);
  }
  function collectInputs() {
    const inputValues = {};

    // Collect values from input fields
    if (imeiInput.value !== "") inputValues.ImeiInput = imeiInput.value;
    if (apnInput.value !== "") inputValues.apnInput = apnInput.value;
    if (ipInput.value !== "") inputValues.ipInput = ipInput.value;
    if (portInput.value !== "") inputValues.portInput = portInput.value;
    if (updateRateInput.value !== "")
      inputValues.updateRateInput = updateRateInput.value;
    if (canTypeInput.value !== "")
      inputValues.canTypeInput = canTypeInput.value;

    // Convert hex values back to numbers for PID fields
    if (pid1.value !== "") inputValues.pid1 = convertFromHex(pid1.value);
    if (pid2.value !== "") inputValues.pid2 = convertFromHex(pid2.value);
    if (pid3.value !== "") inputValues.pid3 = convertFromHex(pid3.value);
    if (pid4.value !== "") inputValues.pid4 = convertFromHex(pid4.value);
    if (pid5.value !== "") inputValues.pid5 = convertFromHex(pid5.value);
    if (pid6.value !== "") inputValues.pid6 = convertFromHex(pid6.value);
    if (pid7.value !== "") inputValues.pid7 = convertFromHex(pid7.value);
    if (pid8.value !== "") inputValues.pid8 = convertFromHex(pid8.value);
    if (pid9.value !== "") inputValues.pid9 = convertFromHex(pid9.value);
    if (pid10.value !== "") inputValues.pid10 = convertFromHex(pid10.value);

    return inputValues;
  }

  connectBtn.addEventListener("click", async () => {
    try {
      if (port && port.readable && port.writable) {
        // Port is already open, so close it
        await disconnectPort();
        connectBtn.textContent = "Connect";
        return;
      }

      // Request a new port if not connected
      port = await navigator.serial.requestPort();
      await openPort();

      connectBtn.textContent = "Disconnect";

      // Optionally, listen to `onconnect` and `ondisconnect` events if supported
      if ("onconnect" in port) {
        port.onconnect = () => console.log("Port connected.");
      }
      if ("ondisconnect" in port) {
        port.ondisconnect = async () => {
          console.log("Port disconnected.");
          await disconnectPort();
          connectBtn.textContent = "Connect";
        };
      }
    } catch (error) {
      console.error("Error handling port:", error);
    }
  });
  showBtn.addEventListener("click", async () => {
    if (port && port.readable && port.writable) {
      // Port is already open, so close it
      const text = "SHOW\r\n";
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      await writer.write(data); // Convert to Uint8Array
      return;
    }
  });
  hideBtn.addEventListener("click", async () => {
    if (port && port.readable && port.writable) {
      // Port is already open, so close it
      const text = "HIDE\r\n";
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      await writer.write(data); // Convert to Uint8Array
      return;
    }
  });

  showCanBtn.addEventListener("click", async () => {
    if (port && port.readable && port.writable) {
      // Port is already open, so close it
      const text = "CANS\r\n";
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      await writer.write(data); // Convert to Uint8Array
      return;
    }
  });
  hideCanBtn.addEventListener("click", async () => {
    if (port && port.readable && port.writable) {
      // Port is already open, so close it
      const text = "CANH\r\n";
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      await writer.write(data); // Convert to Uint8Array
      return;
    }
  });

  // Function to open the port
  async function openPort() {
    try {
      await port.open({ baudRate: 115200 });
      await port.setSignals({ requestToSend: false }); // Disable RTS first
      await new Promise((resolve) => setTimeout(resolve, 100)); // Add a slight delay
      await port.setSignals({ dataTerminalReady: false }); // Disable DTR after RTS

      reader = port.readable.getReader();
      writer = port.writable.getWriter();

      readLoop(reader, outputTextarea, populateInputs, populateHeartbeatFlags);
      console.log("Port opened.");
    } catch (error) {
      console.error("Error opening port:", error);
    }
  }

  // Function to close the port
  async function disconnectPort() {
    try {
      if (reader) {
        await reader.cancel();
        reader.releaseLock();
      }
      if (writer) {
        writer.releaseLock();
      }
      if (port && port.close) {
        await port.close();
      }
      console.log("Port closed.");
    } catch (error) {
      console.error("Error disconnecting port:", error);
    }
  }

  function updateSignalStrength(signalValue) {
    const indicator = document.querySelector(".signal-indicator");
    const bars = indicator.querySelectorAll(".signal-bars .bar");

    // Reset all bar classes
    bars.forEach((bar) => {
      bar.classList.remove("active", "inactive");
      bar.classList.add("inactive");
    });

    // Handle unknown signal
    if (signalValue === 99) {
      indicator.classList.add("unknown");
      return;
    } else {
      indicator.classList.remove("unknown");
    }

    let activeBars = 0;

    if (signalValue === 0) {
      activeBars = 0;
    } else if (signalValue <= 5) {
      activeBars = 1;
    } else if (signalValue <= 12) {
      activeBars = 2;
    } else if (signalValue <= 19) {
      activeBars = 3;
    } else if (signalValue <= 31) {
      activeBars = 4;
    }

    // Light up appropriate number of bars
    for (let i = 0; i < activeBars; i++) {
      bars[i].classList.remove("inactive");
      bars[i].classList.add("active");
    }
  }

  saveBtn.addEventListener("click", () => {
    createAndSendConfigPacket(port, writer, collectInputs());
    //writeToSerial(port, writer, "RED:SET");
  });
  defaultBtn.addEventListener("click", () => {
    console.log("Read Configs Button Pressed");
    populateInputs(defaultValues);
  });
  readBtn.addEventListener("click", () => {
    writeReadPacket(port, writer);
  });
});
