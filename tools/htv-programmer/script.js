console.log("script loaded x1");
$(document).ready(function () {
  console.log("script loadded");
  const states = {
    HANDSHAKE: 0,
    SEND_IAP_FLASH_ERASE: 5,
    SEND_IAP_FILE_SIZE: 6,
    SEND_BIN_FILE: 7,
    IAP_COMPLETED: 8,
    DEBUG_READ: 9,
  };
  const delay = 100; // Delay in milliseconds
  const BoardTypeMapping = {
    170: "Project C Generator Card",
    187: "Project 52V Generator Card V2",
    204: "Project 52V Generator Card V1",
    221: "Project Firmware Generator Card V1",
    238: "Project Firmware Generator Card V2",
    186: "Project AB Generator Card V1",
    171: "Project AB Generator Card V2",
    16: "Project Elite V2P1",
  };
  let binFile = {
    path: "",
    size: 0,
  };
  console.log(binFile);
  $("#dataBox").val(
    $("#dataBox").val() +
      "HTV Tracker Flash Utility (Firmware file: " +
      binFile.path +
      ")"
  ); // Append ASCII data

  let port;
  let writer;
  let reader;
  let fsmRunning = false;
  let pendingIAP = false;
  let iapSuccess = false;
  let majorVersion = 0;
  let minorVersion = 0;
  let patchVersion = 0;
  let boardType = 0;
  let retries = 0;
  let writtenTodevice = 0;
  // Initialize state
  let currentState = states.HANDSHAKE;

  const majorV = 1;
  const minorV = 0;
  const patchV = 0;

  // Example usage
  console.log("Major version: " + majorV);
  console.log("Minor version: " + minorV);
  console.log("Patch version: " + patchV);

  // Function to create list items for each file and add them to the DOM
  $("#selectFileBtn").on("click", function () {
    console.log("select file button clicked");
    selectBinaryFile();
  });

  function alertSuccess(text) {
    $("#successBannerText").text(text);
    $("#errBanner").fadeOut("slow");
    $("#successBanner").fadeIn("slow");
  }

  function alertErr(text) {
    $("#errBannerText").text(text);
    $("#successBanner").fadeOut("slow");
    $("#errBanner").fadeIn("slow");
  }

  function hideAlert() {
    console.log("hiding alerts");
    $("#successBanner").fadeOut("slow");
    $("#errBanner").fadeOut("slow");
  }

  function setVersionValues() {
    $("#majorVersion").text(majorVersion);
    $("#minorVersion").text(minorVersion);
    $("#patchVersion").text(patchVersion);
    $("#boardType").text(BoardTypeMapping[boardType]);
    $("#deviceInfo").css("display", "inline-block");

    // Show the first button and hide the other two buttons
    $("#openSerialPortBtn").hide();
    $("#updateProgramsbtn").show();

    let showUpdateFirmwareBtn = false;

    if (majorVersion < majorV) {
      showUpdateFirmwareBtn = true;
    } else if (majorVersion === majorV) {
      if (minorVersion < minorV) {
        showUpdateFirmwareBtn = true;
      } else if (minorVersion === minorV) {
        if (patchVersion < patchV) {
          showUpdateFirmwareBtn = true;
        }
      }
    }

    if (showUpdateFirmwareBtn) {
      $("#updateFirmwareBtn").show();
    } else {
      $("#updateFirmwareBtn").hide();
    }
  }

  function unsetVersionValues() {
    // Unset the values of input fields
    $("#majorVersion, #minorVersion, #patchVersion, #boardType").text("");
    $("#deviceInfo").css("display", "none");

    // Hide the bottom two buttons
    $("#updateProgramsbtn, #updateFirmwareBtn").hide();

    // Show the first button
    $("#openSerialPortBtn").css("display", "inline-block"); // or 'block' depending on your layout
  }

  function chunkArray(arrayBuffer) {
    const CHUNK_SIZE = 256; // Define the size of each chunk
    const chunks = [];
    console.log("array buffer byte length: " + arrayBuffer.byteLength);

    // Calculate the number of chunks
    const numberOfChunks = Math.ceil(arrayBuffer.byteLength / CHUNK_SIZE);

    // Iterate over the array buffer and split it into chunks
    for (let i = 0; i < numberOfChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, arrayBuffer.byteLength);
      const chunk = new Uint8Array(arrayBuffer.slice(start, end));
      chunks.push(chunk);
    }

    return chunks;
  }

  function sleepForMs(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function readResponse(checkHandshake = false) {
    const TIMEOUT = 300000; // 5 seconds timeout
    const startBytes = [0xeb, 0x90];
    let buffer = [];
    const startTime = Date.now();

    const timeoutPromise = new Promise((resolve) =>
      setTimeout(resolve, TIMEOUT)
    );
    let retries = 3;

    try {
      let retries = 3;
      while (true) {
        console.log("retrying read");
        let value, done;

        try {
          const result = await Promise.race([reader.read(), timeoutPromise]);
          value = result.value;
          console.log("rx result: ");
          console.log(result.value);
          if (value !== null) {
            // Convert value to ASCII and dump it into the textarea
            const asciiString = new TextDecoder("ascii").decode(value);
            const $textarea = $("#dataBox");
            $textarea.val($textarea.val() + asciiString); // Append ASCII data

            // Auto-scroll to the bottom
            $textarea.scrollTop($textarea[0].scrollHeight);
          }
          done = result.done;
        } catch (error) {
          console.log("error");
          if (retries > 0) {
            retries--;
            await new Promise((resolve) => setTimeout(resolve, delay * 10));
            continue;
          } else {
            throw error;
          }
        }

        if (value) {
          buffer = buffer.concat(Array.from(value));

          // Check if buffer starts with startBytes
          const startIndex = buffer.indexOf(startBytes[0]);
          if (startIndex !== -1 && buffer[startIndex + 1] === startBytes[1]) {
            const packet = buffer.slice(startIndex, startIndex + 10);
            if (packet.length === 10) {
              console.log(packet); // Handle response data
              return packet;
            }
            console.log("handshake not received");

            console.log("Check for hashtag: " + checkHandshake);
            console.log("hashtag present: " + buffer.includes("#"));
          } else {
            console.log("Check for hashtag: " + checkHandshake);
            console.log("hashtag present: " + buffer.includes("#"));
            console.log(buffer);
            if (checkHandshake && buffer.includes(0x23)) {
              return {
                handshake: false,
                bootMode: true,
              };
            }
          }

          // Clear buffer if timeout reached
          if (Date.now() - startTime >= TIMEOUT) {
            buffer = [];
          }
        }
      }
    } catch (error) {
      $("#fileUploadModal").modal("hide");
      //$('#iapFlashModal').modal('hide');
      console.log(new Date());

      alertErr(
        "Port Readable stream disconnected, please refresh the page and try again!"
      );

      console.log(error);
    }
    if (checkHandshake) {
      return {
        handshake: false,
        bootMode: false,
      };
    } else {
      return false;
    }
  }

  async function sendHandshake() {
    console.log("retrying handshake");
    const handshakeData = new Uint8Array([
      0xeb, 0x90, 0xff, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    console.log("tx value: ");
    console.log(handshakeData);

    await writer.write(handshakeData);

    // Wait for response

    const res = await readResponse(true);
    console.log(res);
    if (res.handshake == false) {
      if (res.bootMode) {
        alertErr("controller is in boot mode. Performing Firmware Update");
        pendingIAP = true;
        handleConnect();
        return;
      }
      if (retries < 3) {
        retries++;
        console.log("handshake pending retry");
        handleState();
      } else {
        retries = 0;
        alertErr("Handshake Failure. Please Try Again.");
      }

      return;
    } else {
      console.log("handshake ok");
    }

    // Get board ID from response
    boardID = res[2];
    majorVersion = res[5];
    minorVersion = res[6];
    patchVersion = res[7];
    boardType = res[8];
    setVersionValues();

    console.log("board id: " + boardID);

    // Check response
    //if (response[6] === 0xEE) {
    //}
  }

  async function sendEraseFlash() {
    const eraseFlashData = new Uint8Array([
      0xeb,
      0x90,
      boardID,
      0x00,
      0x0d,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
    ]);
    console.log("tx value: ");
    console.log(eraseFlashData);

    await writer.write(eraseFlashData);

    // Wait for response
    let res = await readResponse();
    if (res[4] != 0x0d) {
      res = false;
    }
    if (res == false) {
      alertErr("Flash Erase Failure. Please Try Again.");

      return;
    } else {
      console.log("flash erase ok");
    }
    retries = 0;

    currentState = states.FILE_TRANSFER;
    handleState();
  }

  // Function to send file transfer request
  async function sendFileTransfer() {
    console.log("beginning write files");
    let i = 1;
    writtenToDevice = 0;
    // Loop through downloaded files
    for (const file of downloadedFiles) {
      console.log("files: " + i + "/" + l);
      console.log("sending file: " + i);
      i++;

      let retryCount = 0;
      console.log("entering while loop");
      while (retryCount < 3) {
        console.log("entered while loop");
        if (file.status == "Available") {
          const fileTransferRequest = new Uint8Array([
            0xeb,
            0x90,
            boardID,
            0x00,
            0x0e,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
          ]);
          console.log("tx value: ");
          console.log(fileTransferRequest);

          await writer.write(fileTransferRequest);
          console.log("reading write request response");
          // Wait for response
          const res = await readResponse();
          if (res == false || res[4] != 0x0e || res[5] != 0xaa) {
            retryCount++;
            continue; // Retry the current iteration
          }

          // Transmit file content
          const contentArray = new TextEncoder().encode(file.content);
          await new Promise((resolve) => setTimeout(resolve, 1));
          console.log("tx value: ");
          console.log(contentArray);

          await writer.write(contentArray);
          console.log("waiting before terminator");
          await new Promise((resolve) => setTimeout(resolve, 10));
          console.log("sending terminator");

          console.log("tx value: ");
          console.log(new Uint8Array([0x1a]));

          await writer.write(new Uint8Array([0x1a]));

          // Wait for response
          await readResponse();
          $("#progressBarPrograms").val(Math.floor((i / l) * 100));
          $("#fileWritingLabel").text("transferring: " + file.name);
          await new Promise((resolve) => setTimeout(resolve, delay));
          writtenToDevice++;
          break; // Exit the retry loop and proceed to the next iteration of the main loop
        }
        break;
      }
    }

    $("#fileWritingLabel").text("");
    currentState = states.FILE_TRANSFER_COMPLETE;
    handleState();
  }

  // Function to handle file transfer completion
  async function handleFileTransferComplete() {
    console.log("file transfer complete state");
    // Send completion indicator
    //await writer.write(new Uint8Array([
    //0xEB, 0x90, boardID, 0x00, 0x0E, 0xCC, 0x00, 0x00, 0x00, 0x00
    //]));
    const backToLocalRequest = new Uint8Array([
      0xeb,
      0x90,
      boardID,
      0x00,
      0x0f,
      0x00,
      0x00,
      0x00,
      0x00,
      0x00,
    ]);
    console.log("tx value: ");
    console.log(backToLocalRequest);

    await writer.write(backToLocalRequest);

    // Wait for response
    await readResponse();
    currentState = states.COMPLETED;
    $("#fileUploadModal").modal("hide");
    handleState();
  }

  async function sendControllerReset() {
    const eraseFlashData = new Uint8Array([
      0xeb, 0x90, 0xff, 0xff, 0xf2, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    console.log("tx value: ");
    console.log(eraseFlashData);

    await writer.write(eraseFlashData);

    // Wait for response
    const res = await readResponse();
    if (res[4] != 0xf2) {
      res = false;
    }
    if (res == false) {
      if (retries < 3) {
        retries++;
        handleState();
      } else {
        retries = 0;
        alertErr("Controller reset failure. Please Try Again.");
      }

      return;
    } else {
      console.log("Controller Reset Successful");
    }
    retries = 0;
  }

  async function sendEraseFlashIAP(abort = false) {
    const eraseFlashData = new Uint8Array([
      0xeb, 0x90, 0xff, 0xff, 0xf3, 0xaa, 0x00, 0x00, 0x00, 0x00,
    ]);
    console.log("tx value: ");
    console.log(eraseFlashData);

    await writer.write(eraseFlashData);

    // Wait for response
    console.log("flash erase response check");
    let res = await readResponse();
    if (res[4] != 0xf3) {
      res = false;
    }
    if (res == false) {
      if (retries < 3) {
        retries++;
        if (abort) {
          sendEraseFlashIAP(true);
        }
        handleState();
      } else {
        retries = 0;
        alertErr("Flash Erase Failure in IAP. Please Try Again.");
      }

      return;
    } else {
      console.log("flash erase ok for IAP");
    }
    retries = 0;

    if (abort) {
      return;
    }

    currentState = states.SEND_IAP_FILE_SIZE;

    handleState();
  }

  async function sendFileSizeForIAP() {
    console.log("file size for iap function");
    const fileSizeData = new Uint8Array([
      0xeb, 0x90, 0xff, 0xff, 0xf1, 0xaa, 0x00, 0x00, 0x00, 0x00,
    ]);
    const fileSize = binFile.data.byteLength;
    console.log("File size being sent to device: " + fileSize);

    // Convert the fileSize to a 4-byte integer array
    const sizeArray = new Uint8Array(new Uint32Array([fileSize]).buffer);

    // Replace the last 4 bytes of fileSizeData with the sizeArray
    for (let i = 6; i <= 9; i++) {
      fileSizeData[i] = sizeArray[i - 6]; //flipping to MSB first
    }
    console.log("tx value: ");
    console.log(fileSizeData);

    await writer.write(fileSizeData);
    console.log(fileSizeData);

    // Wait for response
    let res = await readResponse();
    if (res[4] != 0xf1) {
      res = false;
    }
    if (res == false) {
      if (retries < 3) {
        retries++;
        console.log("calling state again");
        handleState();
      } else {
        retries = 0;
        alertErr("IAP size transmission failure. Please Try Again.");
      }

      return;
    } else {
      console.log("flash size transmitted");
    }
    retries = 0;

    currentState = states.SEND_BIN_FILE;
    handleState();
  }

  async function sendBinaryFile() {
    iapSuccess = true;
    const chunks = chunkArray(binFile.data);
    let nChunks = chunks.length;
    console.log("chunks to send: " + nChunks);
    let i = 1;
    writtenToDevice = 0;
    $("progressBarFirmware").val(0);
    // Loop through downloaded files
    for (const chunk of chunks) {
      console.log("chunks: " + i + "/" + nChunks);
      console.log("sending chunk: " + i);
      $("#progressBarFirmware").val(Math.floor((i / nChunks) * 100));

      let retryCount = 0;
      console.log("entering while loop");
      while (retryCount < 3) {
        console.log("entered while loop");
        const byte1 = (i >> 8) & 0xff;
        const byte2 = i & 0xff;
        let checksum = 0;

        // Iterate over each byte in the chunk
        for (const byte of chunk) {
          // XOR the byte with the current checksum value
          checksum ^= byte;
        }
        const chunkTrasferRequest = new Uint8Array([
          0xeb,
          0x90,
          0xff,
          0xff,
          0xf1,
          0xcc,
          byte2,
          byte1,
          chunk.length - 1,
          checksum,
        ]);

        console.log("chunk transfer request:");
        console.log(chunkTrasferRequest);
        await writer.write(chunkTrasferRequest);

        console.log("sending chunk write request: " + new Date());
        console.log(chunk);
        await new Promise((resolve) => setTimeout(resolve, delay));

        await writer.write(chunk);
        console.log("chunk written:" + new Date());

        console.log("reading write request response");
        console.log(new Date());
        // Wait for response
        const res = await readResponse();
        console.log("read write request response");
        console.log(new Date());

        if (res == false || res[4] != 0xf1 || res[9] != 0x00) {
          retryCount++;
          if (retryCount >= 3) {
            alertErr("Failed to write chunk: " + i);

            iapSuccess = false;
          }
          continue; // Retry the current iteration
        }

        // Transmit file content
        await new Promise((resolve) => setTimeout(resolve, delay));
        break; // Exit the retry loop and proceed to the next iteration of the main loop
      }
      if (!iapSuccess) {
        break;
      }
      i++;
    }
    if (!iapSuccess) {
      sendEraseFlashIAP(true);
    }

    currentState = states.IAP_COMPLETED;
    handleState();
  }

  async function handleIapCompletion() {
    const resetRequest = new Uint8Array([
      0xeb, 0x90, 0xff, 0xff, 0xf2, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    await writer.write(resetRequest);

    // Wait for response
    let res = await readResponse();
    if (res[4] != 0xf2) {
      res = false;
    }
    if (res == false) {
      if (retries < 3) {
        retries++;
        handleState();
      } else {
        retries = 0;
        alertErr("Reset Failed. Please Restart Device Manually");
      }
    } else {
      if (iapSuccess) {
        alertSuccess("File transfer complete, waiting for device to flash");
        iapSuccess = false;
      } else {
        alertErr("IAP Failed");
      }
    }
    currentState = states.DEBUG_READ;
    retries = 0;
    $("#iapFlashModal").modal("hide");
    handleState();
  }

  async function handleState() {
    console.log("FSM Loop Trigerred");
    switch (currentState) {
      case states.HANDSHAKE:
        await new Promise((resolve) => setTimeout(resolve, delay));
        await sendHandshake();
        break;
      case states.ERASE_FLASH:
        await new Promise((resolve) => setTimeout(resolve, delay));
        await sendEraseFlash();
        break;
      case states.FILE_TRANSFER:
        await new Promise((resolve) => setTimeout(resolve, delay));
        await sendFileTransfer();
        break;
      case states.FILE_TRANSFER_COMPLETE:
        await new Promise((resolve) => setTimeout(resolve, delay));
        await handleFileTransferComplete();
        break;
      case states.COMPLETED:
        alertSuccess(
          "File transfer completed! written " +
            writtenToDevice +
            "/" +
            l +
            " files!"
        );
        break;
      case states.SEND_IAP_FLASH_ERASE:
        console.log("sending iap flash erase command");
        await new Promise((resolve) => setTimeout(resolve, delay));
        await sendEraseFlashIAP();
        break;
      case states.SEND_IAP_FILE_SIZE:
        await new Promise((resolve) => setTimeout(resolve, delay));
        console.log("at iap file size state");
        await sendFileSizeForIAP();
        break;
      case states.SEND_BIN_FILE:
        await new Promise((resolve) => setTimeout(resolve, delay));
        await sendBinaryFile();
        break;
      case states.IAP_COMPLETED:
        await new Promise((resolve) => setTimeout(resolve, delay));
        await handleIapCompletion();
        break;
      case states.DEBUG_READ:
        while (true) {
          const res = await readResponse();
          if (res) {
            console.log(res);
          }
        }
        break;
      default:
        break;
    }
  }

  function handleDisconnect(event) {
    alertErr("Serial Port Disconnected");
    console.log(event);
    unsetVersionValues();
    navigator.serial.addEventListener("connect", handleConnect);
  }

  async function handleConnect(event) {
    pendingIAP = false;
    //alertSuccess("Serial Port Connected");
    if (event) {
      console.log(event);
      port = event.target;
      await port.open({
        baudRate: 115200,
        flowControl: "none",
      });
      await performSignalSequence();
      writer = port.writable.getWriter();
      reader = port.readable.getReader();
      port.addEventListener("disconnect", handleDisconnect);
    }

    let receivedHash = false;
    let timeElapsed = false;
    setTimeout(async () => {
      if (!receivedHash) {
        // If '#' is not received within 5 seconds
        timeElapsed = true;
        console.log("Hash not received");
        alertErr("IAP Failed");

        currentState = states.HANDSHAKE;
        handleState();
      }
    }, 2000);

    while (!timeElapsed) {
      const { value, done } = await reader.read();
      if (value) {
        const receivedData = new TextDecoder().decode(value);
        console.log(receivedData);
        if (receivedData.includes("#")) {
          console.log("hash found");
          receivedHash = true;
          // If '#' is received, write '$' to the port
          await writer.write(new TextEncoder().encode("$"));
          $("#iapFlashModal").modal("show");
          currentState = states.SEND_IAP_FLASH_ERASE;
          handleState();
          break;
        }
      }
      if (done) {
        // Handle end of stream
        break;
      }
    }

    navigator.serial.removeEventListener("connect", handleConnect);
  }

  // Function to open serial port and start FSM
  async function openSerialPort() {
    currentState = states.HANDSHAKE;
    port = await navigator.serial.requestPort();
    await port.open({
      baudRate: 115200,
      flowControl: "none",
    });
    await performSignalSequence();

    writer = port.writable.getWriter();
    reader = port.readable.getReader();
    port.addEventListener("disconnect", handleDisconnect);

    await handleState();
  }
  async function performSignalSequence() {
    if (port && port.setSignals) {
      try {
        // Set RTS Low
        await port.setSignals({
          requestToSend: false,
        });
        console.log("RTS set to Low");
        await sleepForMs(100); // Wait for 100 milliseconds

        // Set DTR High
        await port.setSignals({
          dataTerminalReady: true,
        });
        console.log("DTR set to High");
        await sleepForMs(100); // Wait for 100 milliseconds

        // Set DTR Low
        await port.setSignals({
          dataTerminalReady: false,
        });
        console.log("DTR set to Low");
      } catch (error) {
        console.error("Failed to perform signal sequence:", error);
      }
    } else {
      console.error("Port is not available");
    }
  }

  async function setRtsHigh() {
    if (port && port.setSignals) {
      try {
        await port.setSignals({
          requestToSend: true,
        });
        console.log("RTS set to High");
      } catch (error) {
        console.error("Failed to set RTS to High:", error);
      }
    } else {
      console.error("Port is not available");
    }
  }

  async function setRtsLow() {
    if (port && port.setSignals) {
      try {
        await port.setSignals({
          requestToSend: false,
        });
        console.log("RTS set to Low");
      } catch (error) {
        console.error("Failed to set RTS to Low:", error);
      }
    } else {
      console.error("Port is not available");
    }
  }

  async function setDtrHigh() {
    if (port && port.setSignals) {
      try {
        await port.setSignals({
          dataTerminalReady: true,
        });
        console.log("DTR set to High");
      } catch (error) {
        console.error("Failed to set DTR to High:", error);
      }
    } else {
      console.error("Port is not available");
    }
  }

  async function setDtrLow() {
    if (port && port.setSignals) {
      try {
        await port.setSignals({
          dataTerminalReady: false,
        });
        console.log("DTR set to Low");
      } catch (error) {
        console.error("Failed to set DTR to Low:", error);
      }
    } else {
      console.error("Port is not available");
    }
  }

  function handleUpdatePrograms() {
    $("#fileUploadModal").modal("show");
    currentState = states.ERASE_FLASH;
    handleState();
  }

  async function handleFirmwareUpdate() {
    pendingIAP = true;
    setTimeout(() => {
      // Timer is complete, set pendingIAP back to false
      pendingIAP = false;
    }, 10000);
    await sendControllerReset();
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await handleConnect();
  }

  function selectBinaryFile(callback) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "*/*"; // accept any file type
    input.style.display = "none";

    input.onchange = function (event) {
      const file = event.target.files[0];
      if (!file) {
        console.warn("No file selected.");
        return;
      }

      const reader = new FileReader();

      reader.onload = function (e) {
        const arrayBuffer = e.target.result;

        // Save to binFile or pass to callback
        binFile = {
          name: file.name,
          path: file.name,
          type: file.type,
          size: file.size,
          data: arrayBuffer,
        };

        $("#dataBox").val(
          "HTV Tracker Flash Utility (Firmware file: " + binFile.path + ")"
        );

        if (typeof callback === "function") {
          callback(binFile);
        }
      };

      reader.onerror = function () {
        console.error("Error reading the file:", reader.error);
      };

      reader.readAsArrayBuffer(file);
    };

    document.body.appendChild(input); // required to trigger on some browsers
    input.click();
    document.body.removeChild(input);
  }

  //fetchBinaryFile();
  //selectBinaryFile();

  $("#openSerialPortBtn").click(openSerialPort);
  $("#toggleRtsOn").click(setRtsHigh);
  $("#toggleRtsOff").click(setRtsLow);
  $("#toggleDtrOn").click(setDtrHigh);
  $("#toggleDtrOff").click(setDtrLow);
  $("#updateProgramsbtn").click(handleUpdatePrograms);
  $("#updateFirmwareBtn").click(handleFirmwareUpdate);
  $(".hide-banner-btn").click(hideAlert);

  $("#fileList").dataTable({
    order: [],
    columnDefs: [
      {
        targets: "no-sort",
        orderable: false,
      },
    ],
  });
});
