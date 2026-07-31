/* Minimal confetti burst in brand colors. Call launchConfetti() once. */
function launchConfetti() {
  var canvas = document.getElementById("confetti-canvas");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = "confetti-canvas";
    document.body.appendChild(canvas);
  }
  var ctx = canvas.getContext("2d");
  var W = (canvas.width = window.innerWidth);
  var H = (canvas.height = window.innerHeight);
  var colors = ["#C4A15A", "#0C0C0C", "#A8853F", "#E9DDC2", "#ffffff"];
  var pieces = [];
  for (var i = 0; i < 160; i++) {
    pieces.push({
      x: W / 2 + (Math.random() - 0.5) * 200,
      y: H * 0.25,
      vx: (Math.random() - 0.5) * 11,
      vy: -6 - Math.random() * 7,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      c: colors[i % colors.length]
    });
  }
  var start = performance.now();
  function frame(t) {
    var elapsed = t - start;
    ctx.clearRect(0, 0, W, H);
    pieces.forEach(function (p) {
      p.vy += 0.22;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    if (elapsed < 3200) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, W, H);
  }
  requestAnimationFrame(frame);
}
