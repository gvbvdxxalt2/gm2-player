//scales the canvas and the monitors.

var scaler = {
  monitorDiv: document.createElement("div"),
  cvs: null,
  vm: null,
  overlays: document.createElement("div"),
  updateData: function () {},
  start: function () {
    //setup canvas for use on scaler.

    scaler.cvs.style.position = "fixed";
    scaler.cvs.style.top = "50%";
    scaler.cvs.style.left = "50%";
    var lastScale = 0;

    var lastwidth = 480;
    var lastheight = 360;

    setInterval(() => {
      var width = scaler.vm.runtime.stageWidth;
      var height = scaler.vm.runtime.stageHeight;
      var scale = window.innerHeight / height; //basicly finds how many times the stages height
      if (window.innerHeight / height > window.innerWidth / width) {
        scale = window.innerWidth / width;
      }
      var cvs = scaler.cvs;
      var boundingClientRect = cvs.getBoundingClientRect();
      var mdiv = scaler.monitorDiv;
      var overlays = scaler.overlays;
      mdiv.style.position = "fixed";
      overlays.style.position = "fixed";
      mdiv.style.left = boundingClientRect.x + "px";
      mdiv.style.top = boundingClientRect.y + "px";
      overlays.style.left = boundingClientRect.x + "px";
      overlays.style.top = boundingClientRect.y + "px";
      mdiv.style.transform = `scale(${scale})`;

      for (var overlayContainer of overlays.children) {
        overlayContainer.style.width = width + "px";
        overlayContainer.style.height = height + "px";
        overlayContainer.style.transformOrigin = "left top";
        overlayContainer.style.transform = `scale(${scale})`;
      }

      if (!(lastScale == scale && lastwidth == width && lastheight == height)) {
        //Resize canvas.
        scaler.cvs.width = scale * width;
        scaler.cvs.height = scale * height;
        scaler.cvs.style.marginLeft = `-${(scale * width) / 2}px`;
        scaler.cvs.style.marginTop = `-${(scale * height) / 2}px`;

        //Emit updates.
        scaler.updateData({
          width: scale * width,
          height: scale * height,
          scaleX: scale,
          scaleY: scale,
          ogWidth: width,
          ogHeight: height,
        });

        lastScale = scale;

        lastwidth = width;
        lastheight = height;
      }
    }, 1000 / 60);
  },
};
module.exports = scaler;
