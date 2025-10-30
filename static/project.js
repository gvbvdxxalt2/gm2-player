var options = {}; //Init our options
var colors = GM2Player.colors;

//Turbowarp options.

options.cloneLimit = false; //if you want more then 300 clones, this does that, changing it to true enables the 300 limit.
options.miscLimits = false; //other limits that scratch has, false means disable these, like sound pitch and stuff.
options.fps = 30; //frames per second, default is 60, the heigher, the more faster your project runs, the lower the slower it runs.
options.fencing = true; //fencing allows for sprites to get bigger or small as they want, allows them to go offscreen, ext.
options.width = 480; //default stage width is 480.
options.height = 360; //default stage height is 360.
options.warpTimer = false; //set to true to prevent projects from crashing suddenly.
options.enableCompiler = true; //makes scratch projects run faster by compiling them.
options.highQualityPen = true; //if true, makes the pen high quality looking.

//Player options.

options.useTurbomode = false; //use turbo mode, turbo mode makes your project run like crazy, increases the fps by alot, usefull for those very slow projects.
options.hideCursor = false; //set to true to hide the cursor (DOES NOT LOCK THE POINTER).
options.clickToStart = false; //in a situatuon, such as animations, you will NEED this enabled, so your audio will sync, this is because the audio will not start to play until you interact with the page, like clicking it.

//Loading screen options.

options.loadingImage = null; //change the null to something (example: "myimage.png") if you want a image in the background displayed when the project is loading.
options.progressBar = true; //show how much of the assets are loaded.
options.progressBarColors = true; //make the progress bar have a style, instead of the browsers default.

//Player colors.

/* These Can Only Be Set Before The Player Loads, Not After */
colors.BGColor = "black"; //the color displayed behind the project, appears after loading.
colors.loadingBGColor = "black"; //the background color displayed when loading the project.
colors.progressBar.incompleteBGColor = "#454544"; //the color displayed for the incomplete amount on the progress bar.
colors.progressBar.incompleteBorderColor = "#696969"; //the progress bar's background color.
colors.progressBar.completeBGColor = "#fafaf7"; //the complete part's color of the progress bar

options.project = "cloudtest.gm2";

//Project file (Optional)
//Uncomment it if you want to provide an SB3 file instead of extracting the assets.

//options.project = "project.sb3";

//Set the options.

GM2Player.setOptions(options);

//Start loading and run the project!
GM2Player.start(document.getElementById("Player"));

class CloudProvider {
  /**
   * A cloud data provider which creates and manages a web socket connection
   * to the Scratch cloud data server. This provider is responsible for
   * interfacing with the VM's cloud io device.
   * @param {string} cloudHost The url for the cloud data server
   * @param {VirtualMachine} vm The Scratch virtual machine to interface with
   * @param {string} username The username to associate cloud data updates with
   * @param {string} projectId The id associated with the project containing
   * cloud data.
   */
  constructor(cloudHost, vm, username, projectId) {
    this.vm = vm;
    this.username = username;
    this.projectId = projectId;
    this.cloudHost = cloudHost;

    this.connectionAttempts = 0;

    // A queue of messages to send which were received before the
    // connection was ready
    this.queuedData = [];

    this.openConnection();
  }

  /**
   * Open a new websocket connection to the clouddata server.
   * @param {string} cloudHost The cloud data server to connect to.
   */
  openConnection() {
    this.connectionAttempts += 1;
    let host = this.cloudHost;
    let protocol = "wss://"; // Default to secure

    // Check if the current page is secure
    if (window.location.protocol === "https:") {
      // Force WSS if the page is HTTPS
      if (host.includes("ws://")) {
        console.error(
          "[Cloud Protocol Error] Cannot use ws:// on a secure page (https://). Forcing wss://."
        );
        host = host.replace("ws://", "wss://");
      } else if (!host.includes("wss://")) {
        host = protocol + host;
      }
    } else {
      // If the page is insecure (http://), we can try ws://
      if (!host.includes("ws://") && !host.includes("wss://")) {
        protocol = "ws://";
        host = protocol + host;
      }
    }

    console.log(`Attempting connection with: ${host}`);

    try {
      this.connection = new WebSocket(host);
    } catch (e) {
      console.error("[Cloud] WebSocket instantiation failed:", e);
      this.connection = null;
      return;
    }

    this.connection.onerror = this.onError.bind(this);
    this.connection.onmessage = this.onMessage.bind(this);
    this.connection.onopen = this.onOpen.bind(this);
    this.connection.onclose = this.onClose.bind(this);
  }

  onError(event) {
    console.error(`Websocket connection error: ${JSON.stringify(event)}`);
    // Error is always followed by close, which handles reconnect logic.
  }

  onMessage(event) {
    const messageString = event.data;
    // Multiple commands can be received, newline separated
    messageString.split("\n").forEach((message) => {
      if (message) {
        // .split can also contain '' in the array it returns
        const parsedData = this.parseMessage(JSON.parse(message));
        this.vm.postIOData("cloud", parsedData);
      }
    });
  }

  onOpen() {
    // Reset connection attempts to 1 to make sure any subsequent reconnects
    // use connectionAttempts=1 to calculate timeout
    this.connectionAttempts = 1;
    this.writeToServer("handshake");
    console.warn(`Successfully connected to clouddata server.`);

    // Go through the queued data and send off messages that we weren't
    // ready to send before
    this.queuedData.forEach((data) => {
      this.sendCloudData(data);
    });
    // Reset the queue
    this.queuedData = [];
  }

  onClose(e) {
    // tw: code 4002 is "Username Error" -- do not try to reconnect
    if (e && e.code === 4002) {
      console.warn("Cloud username is invalid. Not reconnecting.");
      console.warn(this.cloudHost);
      this.onInvalidUsername();
      return;
    }
    // tw: code 4004 is "Project Unavailable" -- do not try to reconnect
    if (e && e.code === 4004) {
      console.warn(
        "Cloud variables are disabled for this project. Not reconnecting."
      );
      return;
    }
    console.warn(`Closed connection to websocket`);
    this.setTimeout(this.openConnection.bind(this), 200);
  }

  // tw: method called when username is invalid
  onInvalidUsername() {
    /* no-op */
  }

  exponentialTimeout() {
    return (Math.pow(2, Math.min(this.connectionAttempts, 5)) - 1) * 1000;
  }

  randomizeDuration(t) {
    return Math.random() * t;
  }

  setTimeout(fn, time) {
    console.warn(
      `Reconnecting in ${(time / 1000).toFixed(1)}s, attempt ${
        this.connectionAttempts
      }`
    );
    this._connectionTimeout = window.setTimeout(fn, time);
  }

  parseMessage(message) {
    const varData = {};
    switch (message.method) {
      case "set": {
        varData.varUpdate = {
          name: message.name,
          value: message.value,
        };
        break;
      }
    }
    return varData;
  }

  /**
   * Format and send a message to the cloud data server.
   * @param {string} methodName The message method, indicating the action to perform.
   * @param {string} dataName The name of the cloud variable this message pertains to
   * @param {string | number} dataValue The value to set the cloud variable to
   * @param {string} dataNewName The new name for the cloud variable (if renaming)
   */
  writeToServer(methodName, dataName, dataValue, dataNewName) {
    const msg = {};
    msg.method = methodName;
    msg.user = this.username;
    msg.project_id = this.projectId;

    // Optional string params can use simple falsey undefined check
    if (dataName) msg.name = dataName;
    if (dataNewName) msg.new_name = dataNewName;

    // Optional number params need different undefined check
    if (typeof dataValue !== "undefined" && dataValue !== null)
      msg.value = dataValue;

    const dataToWrite = JSON.stringify(msg);
    if (this.connection && this.connection.readyState === WebSocket.OPEN) {
      this.sendCloudData(dataToWrite);
    } else if (
      msg.method === "create" ||
      msg.method === "delete" ||
      msg.method === "rename"
    ) {
      // Save data for sending when connection is open, iff the data
      // is a create, rename, or  delete
      this.queuedData.push(dataToWrite);
    }
  }

  /**
   * Send a formatted message to the cloud data server.
   * @param {string} data The formatted message to send.
   */
  sendCloudData(data) {
    this.connection.send(`${data}\n`);
  }

  /**
   * Provides an API for the VM's cloud IO device to create
   * a new cloud variable on the server.
   * @param {string} name The name of the variable to create
   * @param {string | number} value The value of the new cloud variable.
   */
  createVariable(name, value) {
    this.writeToServer("create", name, value);
  }

  /**
   * Provides an API for the VM's cloud IO device to update
   * a cloud variable on the server.
   * @param {string} name The name of the variable to update
   * @param {string | number} value The new value for the variable
   */
  updateVariable(name, value) {
    this.writeToServer("set", name, value);
  }

  /**
   * Provides an API for the VM's cloud IO device to rename
   * a cloud variable on the server.
   * @param {string} oldName The old name of the variable to rename
   * @param {string} newName The new name for the cloud variable.
   */
  renameVariable(oldName, newName) {
    this.writeToServer("rename", oldName, null, newName);
  }

  /**
   * Provides an API for the VM's cloud IO device to delete
   * a cloud variable on the server.
   * @param {string} name The name of the variable to delete
   */
  deleteVariable(name) {
    this.writeToServer("delete", name);
  }

  /**
   * Closes the connection to the web socket and clears the cloud
   * provider of references related to the cloud data project.
   */
  requestCloseConnection() {
    if (
      this.connection &&
      this.connection.readyState !== WebSocket.CLOSING &&
      this.connection.readyState !== WebSocket.CLOSED
    ) {
      console.warn("Request close cloud connection without reconnecting");
      // Remove listeners, after this point we do not want to react to connection updates
      this.connection.onclose = () => {};
      this.connection.onerror = () => {};
      this.connection.close();
    }
    this.clear();
  }

  /**
   * Clear this provider of references related to the project
   * and current state.
   */
  clear() {
    this.connection = null;
    this.vm = null;
    this.username = null;
    this.projectId = null;
    if (this._connectionTimeout) {
      clearTimeout(this._connectionTimeout);
      this._connectionTimeout = null;
    }
    this.connectionAttempts = 0;
  }
}
var vm = GM2Player.runtime.vm;
var websocketServerURL = "";
var provider = new CloudProvider(
  websocketServerURL,
  vm,
  "person" + Math.round(Date.now()),
  Date.now()
);

GM2Player.setOptions({
  cloudProvider: provider,
});

setInterval(async () => {
  await fetch("https://" + websocketServerURL);
}, 5000);
