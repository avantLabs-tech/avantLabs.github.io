document.addEventListener("DOMContentLoaded", () => {
  let port;
  let reader;
  let writer;

  const outputTextarea = document.getElementById("outputTextarea");
  const connectBtn = document.getElementById("connectBtn");
  const sendBtn = document.getElementById("sendBtn");

  connectBtn.addEventListener("click", async () => {
    try {
      port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });

      reader = port.readable.getReader();
      writer = port.writable.getWriter();

      readLoop();
    } catch (error) {
      console.error("Error connecting:", error);
    }
  });

  async function readLoop() {
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          reader.releaseLock();
          break;
        }
        const receivedText = new TextDecoder().decode(value);
        outputTextarea.value += receivedText;
      }
    } catch (error) {
      console.error("Error reading:", error);
    }
  }

  sendBtn.addEventListener("click", async () => {
    let data = document.getElementById("dataInput").value;
    data += "\r\n";
    const encoder = new TextEncoder();
    if (!port || !port.writable) return;
    await writer.write(encoder.encode(data));
  });
});
