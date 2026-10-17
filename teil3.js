  // ---------- Zeichnen ----------
  function zeichnen(jetzt) {
    var dt = Math.min(50, jetzt - letzte);
    letzte = jetzt;

    pegel += (ziel - pegel) * (ziel > pegel ? 0.35 : 0.1);
    var g = zustand === "spricht" ? pegel : 0;
    var atem = 0.5 + 0.5 * Math.sin(jetzt / 1600);

    var zielHell = zustand === "spricht" ? 0.75 + 0.5 * g : (zustand === "hoert" ? 0.5 : 0.62 + 0.06 * atem);
    var zielGroesse = zustand === "hoert" ? 0.93 : 1;
    var zielTempo = zustand === "hoert" ? 0.00006 : (zustand === "spricht" ? 0.00014 + 0.0004 * g : 0.00012);
    hell += (zielHell - hell) * 0.08;
    grosse += (zielGroesse - grosse) * 0.06;
    tempo += (zielTempo - tempo) * 0.08;

    drehung += dt * tempo;
    var ay = drehung, ax = 0.3 + 0.1 * Math.sin(jetzt / 6500);

    mx = B / 2; my = H / 2;
    R = Math.min(B * 0.385, H * 0.42) * grosse * (1 + g * 0.09);

    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(7,6,11,0.5)";
    ctx.fillRect(0, 0, B, H);
    ctx.globalCompositeOperation = "lighter";

    var h = pal.h, h2 = pal.h2;

    // sanfter Hintergrundschein
    var halo = ctx.createRadialGradient(mx, my, R * 0.1, mx, my, R * 1.5);
    halo.addColorStop(0, farbe(h, 100, 55, 0.07 + 0.06 * hell));
    halo.addColorStop(1, farbe(h, 100, 40, 0));
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(mx, my, R * 1.5, 0, 6.2832); ctx.fill();

    // kratzige Linienstuecke
    ctx.lineWidth = 1;
    for (var i = 0; i < kratzer.length; i++) {
      var q = kratzer[i];
      var w = 1 + g * 0.05 * Math.sin(jetzt * 0.009 + q.ph);
      var ext = 1 + g * 0.7;
      var a1 = proj(q.x * w, q.y * w, q.z * w, ay, ax);
      var a2 = proj((q.x + q.dx * ext) * w, (q.y + q.dy * ext) * w, (q.z + q.dz * ext) * w, ay, ax);
      var fl = 0.2 + 0.8 * Math.pow(Math.sin(q.ph + jetzt * q.tempo), 2);
      var tiefe = Math.max(0.25, Math.min(1, 0.55 + a1[2] * 0.45));
      var al = Math.min(1, (0.25 + fl) * tiefe * hell * (q.hell ? 1.2 : 0.95));
      ctx.strokeStyle = q.hell ? farbe(h2, 45, 90, al) : farbe(h + q.dh, 95, 64, al);
      ctx.beginPath(); ctx.moveTo(a1[0], a1[1]); ctx.lineTo(a2[0], a2[1]); ctx.stroke();
    }

    // Umlaufbahnen
    for (var bi = 0; bi < bahnen.length; bi++) {
      var bn = bahnen[bi];
      var w0 = bn.start + bn.v * jetzt;
      var n = Math.max(30, Math.floor(bn.laenge * 16));
      var rb = bn.r * (1 + 0.04 * g * Math.sin(jetzt * 0.006 + bn.ph));
      var pts = [];
      for (var kk = 0; kk <= n; kk++) {
        var wk = w0 + (kk / n) * bn.laenge;
        var c = kreis(rb, wk, bn.kx, bn.kz);
        pts.push(proj(c[0], c[1], c[2], ay, ax));
      }
      if (bn.dash) {
        ctx.setLineDash([16, 9, 4, 9]);
        ctx.lineDashOffset = -jetzt * 0.02;
        linie(pts, 2, farbe(h2, 40, 92, 0.75 * hell));
        ctx.setLineDash([]);
      } else if (bn.hell) {
        linie(pts, 7, farbe(h, 100, 60, 0.1 * hell));
        linie(pts, 2.2, farbe(h2, 35, 94, 0.9 * hell));
      } else {
        linie(pts, 4, farbe(h, 100, 58, 0.08 * hell));
        linie(pts, 1.3, farbe(h, 95, 66, 0.8 * hell));
      }
    }

    // aeussere Ringe (zeigen zum Betrachter, wackeln nur leicht)
    var gay = 0.12 * Math.sin(jetzt / 5200), gax = 0.28 + 0.08 * Math.sin(jetzt / 7300);
    function rpt(rg, w, off) {
      var rad = rg.r + off + rg.wa * Math.sin(3 * w + rg.wp) + rg.wb * Math.sin(7 * w + rg.wq);
      var cc = kreis(rad * (1 + 0.03 * g), w, 0, 0);
      return proj(cc[0], cc[1], cc[2], gay, gax);
    }
    for (var ro = 0; ro < ringeAussen.length; ro++) {
      var rg2 = ringeAussen[ro];
      var rot = jetzt * rg2.v;
      for (var sg2 = 0; sg2 < rg2.segs.length; sg2++) {
        var sgm = rg2.segs[sg2];
        var wbase = sgm.w + rot;
        var np = Math.max(6, Math.floor(sgm.l * 24));
        var bp = [];
        for (var q2 = 0; q2 <= np; q2++) bp.push(rpt(rg2, wbase + sgm.l * q2 / np, 0));
        linie(bp, sgm.breit * 1.1, farbe(h, 95, 70, (sgm.breit > 1 ? 0.9 : 0.6) * hell));
        ctx.lineWidth = 1;
        ctx.strokeStyle = farbe(h2, 80, 78, 0.75 * hell);
        ctx.beginPath();
        for (var tk = 0; tk < sgm.ticks.length; tk++) {
          var tc = sgm.ticks[tk], ln = tc.len * (1 + g * 0.9);
          var o1 = tc.seite === 1 ? 0 : -ln / 2, o2 = tc.seite === 1 ? ln : (tc.seite === -1 ? -ln : ln / 2);
          var t1 = rpt(rg2, wbase + tc.w, o1), t2 = rpt(rg2, wbase + tc.w, o2);
          ctx.moveTo(t1[0], t1[1]); ctx.lineTo(t2[0], t2[1]);
        }
        for (var kl = 0; kl < sgm.klammern.length; kl++) {
          var kc = sgm.klammern[kl];
          var k1 = rpt(rg2, wbase + kc.w, 0), k2 = rpt(rg2, wbase + kc.w, kc.off), k3 = rpt(rg2, wbase + kc.w + kc.dir * kc.l, kc.off);
          ctx.moveTo(k1[0], k1[1]); ctx.lineTo(k2[0], k2[1]); ctx.lineTo(k3[0], k3[1]);
        }
        ctx.stroke();
      }
    }
    // dicke, runde Striche mit dunklem Hof
    for (var ro2 = 0; ro2 < ringeAussen.length; ro2++) {
      var rg3 = ringeAussen[ro2];
      for (var d2 = 0; d2 < rg3.dashes.length; d2++) {
        var ds = rg3.dashes[d2];
        var dp = [];
        for (var q3 = 0; q3 <= 8; q3++) dp.push(rpt(rg3, ds.w + jetzt * rg3.v + ds.l * q3 / 8, ds.off));
        ctx.globalCompositeOperation = "source-over";
        ctx.lineCap = "round";
        linie(dp, 9, "rgba(7,6,11,0.55)");
        ctx.globalCompositeOperation = "lighter";
        linie(dp, 3.6, farbe(h, 95, 66, 0.95 * hell));
        linie(dp, 1.4, farbe(h2, 50, 92, 0.9 * hell));
        ctx.lineCap = "butt";
      }
    }

    // "Hoert zu": Wellen laufen von aussen zur Mitte
    if (zustand === "hoert") {
      for (var wi = 0; wi < 3; wi++) {
        var tt = ((jetzt / 1700) + wi / 3) % 1;
        var wr = R * (0.95 - 0.7 * tt);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = farbe(h2, 80, 80, Math.sin(Math.PI * tt) * 0.55);
        ctx.beginPath(); ctx.arc(mx, my, wr, 0, 6.2832); ctx.stroke();
      }
    }

    // innerer heller Ring
    var ri = 0.36 * (1 + 0.07 * g + 0.012 * atem);
    var rp = [];
    for (var ri2 = 0; ri2 <= 90; ri2++) {
      var cr = kreis(ri, (ri2 / 90) * 6.2832, 0.22, jetzt * 0.00012);
      rp.push(proj(cr[0], cr[1], cr[2], 0, 0.15));
    }
    linie(rp, 12, farbe(h, 100, 55, 0.07 * hell));
    linie(rp, 5, farbe(h, 100, 62, 0.28 * hell));
    linie(rp, 1.8, farbe(h2, 70, 86, 0.95 * hell));
    var rp2 = [];
    for (var ri3 = 0; ri3 <= 90; ri3++) {
      var cr2 = kreis(ri * 0.86, (ri3 / 90) * 6.2832, 0.22, jetzt * 0.00012);
      rp2.push(proj(cr2[0], cr2[1], cr2[2], 0, 0.15));
    }
    linie(rp2, 1.1, farbe(h, 90, 70, 0.5 * hell));

    // Kern: gross, aber nicht grell
    var kr = R * (0.5 + 0.12 * g);
    var kern = ctx.createRadialGradient(mx, my, 0, mx, my, kr);
    kern.addColorStop(0, farbe(h2, 80, 88, 0.55 * hell + 0.15 * g));
    kern.addColorStop(0.18, farbe(h, 100, 68, 0.35 * hell));
    kern.addColorStop(0.55, farbe(h, 100, 55, 0.1 * hell));
    kern.addColorStop(1, farbe(h, 100, 45, 0));
    ctx.fillStyle = kern;
    ctx.beginPath(); ctx.arc(mx, my, kr, 0, 6.2832); ctx.fill();

    ctx.lineWidth = 2;
    ctx.strokeStyle = farbe(h2, 60, 90, 0.9 * hell);
    ctx.beginPath(); ctx.arc(mx, my, R * (0.085 + 0.02 * g), 0, 6.2832); ctx.stroke();
    ctx.fillStyle = farbe(h2, 40, 95, 0.95);
    ctx.beginPath(); ctx.arc(mx, my, R * 0.03, 0, 6.2832); ctx.fill();

    // waagerechter Lichtstreifen durch die Mitte
    var fl = ctx.createLinearGradient(mx - R * 0.9, my, mx + R * 0.9, my);
    fl.addColorStop(0, farbe(h2, 60, 90, 0));
    fl.addColorStop(0.5, farbe(h2, 60, 92, 0.7 * hell));
    fl.addColorStop(1, farbe(h2, 60, 90, 0));
    ctx.fillStyle = fl;
    ctx.fillRect(mx - R * 0.9, my - 1, R * 1.8, 2);

    requestAnimationFrame(zeichnen);
  }
  requestAnimationFrame(zeichnen);
