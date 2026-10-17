  var canvas = document.getElementById("orb");
  var ctx = canvas.getContext("2d");
  var buehne = document.getElementById("buehne");
  var B = 0, H = 0, dpr = 1;
  var F = 2.8;
  var mx = 0, my = 0, R = 100;

  function anpassen() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    B = buehne.clientWidth; H = buehne.clientHeight;
    canvas.width = Math.max(1, Math.round(B * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#07060b";
    ctx.fillRect(0, 0, B, H);
  }
  window.addEventListener("resize", anpassen);
  if (window.ResizeObserver) new ResizeObserver(anpassen).observe(buehne);
  anpassen();

  function zufall(a, b) { return a + Math.random() * (b - a); }

  // ---------- Farben ----------
  var paletten = {
    lila: { h: 276, h2: 292, name: "Lila" },
    gold: { h: 40, h2: 48, name: "Gold" }
  };
  var pal = paletten.lila;
  function farbe(h, s, l, a) {
    return "hsla(" + h.toFixed(0) + "," + s + "%," + l + "%," + Math.max(0, Math.min(1, a)).toFixed(3) + ")";
  }

  // ---------- 3D-Hilfen ----------
  function drehen(x, y, z, ay, ax) {
    var ca = Math.cos(ay), sa = Math.sin(ay);
    var x1 = x * ca + z * sa, z1 = -x * sa + z * ca;
    var cb = Math.cos(ax), sb = Math.sin(ax);
    return [x1, y * cb - z1 * sb, y * sb + z1 * cb];
  }
  function kreis(r, w, kx, kz) {
    var x = Math.cos(w) * r, y = Math.sin(w) * r;
    var cx = Math.cos(kx), sx = Math.sin(kx);
    var y1 = y * cx, z1 = y * sx;
    var cz = Math.cos(kz), sz = Math.sin(kz);
    return [x * cz - y1 * sz, x * sz + y1 * cz, z1];
  }
  function proj(x, y, z, ay, ax) {
    var d = drehen(x, y, z, ay, ax);
    var p = F / (F + d[2]);
    return [mx + d[0] * R * p, my + d[1] * R * p, d[2]];
  }
  function linie(pts, breite, stil) {
    ctx.lineWidth = breite;
    ctx.strokeStyle = stil;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  }

  // ---------- Bauteile ----------
  // Grosse, schraege Umlaufbahnen
  var bahnen = [];
  function bahn(r, kx, kz, v, hell, laenge, gestrichelt) {
    bahnen.push({ r: r, kx: kx, kz: kz, v: v, hell: hell, laenge: laenge,
      start: Math.random() * 6.28, ph: Math.random() * 6.28, dash: !!gestrichelt });
  }
  bahn(0.98, 1.28, 0.25, 0.00028, true, 6.28);
  bahn(0.94, 0.3, 1.22, -0.00022, true, 6.28);
  bahn(0.9, -0.95, -0.6, 0.00018, true, 5.4);
  for (var i = 0; i < 6; i++) {
    bahn(zufall(0.4, 0.88), zufall(-1.5, 1.5), zufall(-1.5, 1.5), zufall(-0.0005, 0.0005), false, zufall(3.2, 6.28));
  }
  for (var j = 0; j < 4; j++) {
    bahn(zufall(0.55, 0.95), zufall(-1.5, 1.5), zufall(-1.5, 1.5), zufall(-0.0004, 0.0004), true, zufall(2.5, 5), true);
  }

  // kurze, kratzige Linienstuecke
  var kratzer = [];
  for (var k = 0; k < 760; k++) {
    var ux = zufall(-1, 1), uy = zufall(-1, 1), uz = zufall(-1, 1);
    var ul = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1;
    ux /= ul; uy /= ul; uz /= ul;
    var rr = zufall(0.22, 1.0);
    var dx = zufall(-1, 1), dy = zufall(-1, 1), dz = zufall(-1, 1);
    var dl = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    var lang = zufall(0.03, 0.2);
    kratzer.push({
      x: ux * rr, y: uy * rr, z: uz * rr,
      dx: dx / dl * lang, dy: dy / dl * lang, dz: dz / dl * lang,
      ph: Math.random() * 6.28, tempo: zufall(0.0008, 0.004),
      hell: Math.random() < 0.3, dh: zufall(-8, 8)
    });
  }

  // aeussere Ringe: unregelmaessig, gebrochen, mit Strichen und Klammern
  var ringeAussen = [];
  var radien = [0.80, 0.86, 0.92, 0.97, 1.02, 1.07, 1.12];
  for (var ra = 0; ra < radien.length; ra++) {
    var rg = {
      r: radien[ra], v: (ra % 2 ? -1 : 1) * zufall(0.00004, 0.00016),
      wa: zufall(0.003, 0.009), wp: Math.random() * 6.28, wb: zufall(0.002, 0.006), wq: Math.random() * 6.28,
      segs: [], dashes: []
    };
    var wpos = Math.random() * 6.28, summe = 0;
    var dicht = Math.random() < 0.6;
    while (summe < 6.28) {
      var sl = zufall(0.25, 1.5);
      var sg = zufall(0.05, 0.45);
      var seg = { w: wpos, l: sl, breit: Math.random() < 0.2 ? 1.8 : 1, ticks: [], klammern: [] };
      var tw = zufall(0.01, 0.05);
      while (tw < sl) {
        var t = { w: tw, len: Math.random() < 0.18 ? zufall(0.045, 0.09) : zufall(0.008, 0.035),
                  seite: Math.random() < 0.55 ? 1 : (Math.random() < 0.5 ? -1 : 0) };
        if (dicht || Math.random() < 0.5) seg.ticks.push(t);
        tw += dicht ? zufall(0.012, 0.045) : zufall(0.04, 0.16);
      }
      if (Math.random() < 0.7) seg.klammern.push({ w: 0, off: zufall(0.015, 0.05) * (Math.random() < 0.5 ? 1 : -1), l: zufall(0.03, 0.09), dir: 1 });
      if (Math.random() < 0.7) seg.klammern.push({ w: sl, off: zufall(0.015, 0.05) * (Math.random() < 0.5 ? 1 : -1), l: zufall(0.03, 0.09), dir: -1 });
      rg.segs.push(seg);
      wpos += sl + sg; summe += sl + sg;
    }
    var nd = Math.floor(zufall(2, 5));
    for (var dd = 0; dd < nd; dd++) {
      rg.dashes.push({ w: Math.random() * 6.28, l: zufall(0.07, 0.24), off: zufall(-0.02, 0.02) });
    }
    ringeAussen.push(rg);
  }
