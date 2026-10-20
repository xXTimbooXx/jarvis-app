  // ---------- Zustand ----------
  var zustand = "bereit";
  var pegel = 0, ziel = 0, externBis = 0;
  var hell = 0.6, grosse = 1, tempo = 0.00012;
  var drehung = 0, letzte = performance.now();

  var texte = {
    bereit: ["BEREIT", "Tippe auf Sprechen und rede los."],
    hoert: ["HOeRT ZU", "Jarvis hoert dir zu."],
    denkt: ["DENKT", "Jarvis ueberlegt ..."],
    spricht: ["SPRICHT", "Jarvis spricht gerade."]
  };
  function setzeZustand(z, text) {
    if (!texte[z]) return;
    zustand = z;
    document.getElementById("titel").textContent = texte[z][0];
    document.getElementById("text").textContent = text || texte[z][1];
    if (z !== "spricht" && performance.now() > externBis) ziel = 0;
  }
  window.jarvisZustand = setzeZustand;
  window.jarvisPegel = function (w) {
    externBis = performance.now() + 400;
    ziel = Math.max(0, Math.min(1, w));
  };
  function testHuelle() {
    if (zustand === "spricht" && performance.now() > externBis) ziel = 0.3 + Math.random() * 0.7;
    setTimeout(testHuelle, 90 + Math.random() * 140);
  }
  testHuelle();

  document.getElementById("farbe").addEventListener("click", function () {
    pal = (pal === paletten.lila) ? paletten.gold : paletten.lila;
    document.documentElement.style.setProperty("--h", pal.h);
    document.getElementById("farbe").textContent = "Farbe: " + pal.name;
  });

  // ---------- Gespraech: Mikrofon -> Gemini -> Stimme ----------
  var KEY = window.CLAUDE_KEY || "";
  var modelle = ["claude-haiku-4-5", "claude-haiku-5-5"];
  var anweisung = "Du bist Jarvis, der persoenliche Sprachassistent von Tim. Du nennst Tim immer Sir, niemals beim Namen. Antworte immer auf Deutsch, freundlich, locker und sehr kurz (hoechstens 1 kurzer Satz), weil deine Antwort vorgelesen wird. Keine Aufzaehlungen, keine Sternchen, keine Sonderzeichen. Wenn Sir einen neuen Termin eintragen lassen will und Datum und Uhrzeit klar sind, haenge ganz am Ende deiner Antwort genau diese Markierung an: [TERMIN|JJJJ-MM-TT|HH:MM|Dauer in Minuten|Titel]. Beispiel: [TERMIN|2026-10-19|10:00|60|Zahnarzt]. Ohne Dauerangabe nimm 60. Sage davor in einem kurzen Satz, was du eintraegst. Fehlt Datum oder Uhrzeit, frage kurz nach und setze keine Markierung. Wenn Sir einen Termin loeschen will und Tag und Titel klar sind, haenge stattdessen am Ende an: [LOESCHEN|JJJJ-MM-TT|Titel]. Wenn Sir eine Webseite oeffnen will (youtube, google, instagram, tiktok, maps, wikipedia, amazon, netflix, spotify, github, icloud, tagesschau, ebay, whatsapp, claude), sage kurz, was du oeffnest, und haenge ans Ende [OEFFNEN|name|Suchbegriff]. name kleingeschrieben aus dieser Liste, Suchbegriff nur wenn Sir etwas suchen will, sonst leer. Beispiele: [OEFFNEN|youtube|Katzenvideos] oder [OEFFNEN|instagram|]. Benutze Markierungen nie fuer etwas anderes. Bei einem Briefing (guten Morgen, Ueberblick) fasse Wetter, Termine und Nachrichten in hoechstens fuenf kurzen Saetzen zusammen. Nutze Wetter- und Nachrichtendaten nur, wenn sie unten angegeben sind, und erfinde nichts dazu. Wenn Sir etwas fragt, das aktuelles Wissen aus dem Internet braucht (aktuelle Ereignisse, Ergebnisse, Preise, wer gerade ein Amt hat) und unten keine passenden Daten stehen, antworte NUR mit [SUCHE|kurzer Suchbegriff]. Bei Fragen, die du aus Allgemeinwissen sicher beantworten kannst, suche nicht.";
  var verlauf = [];
  var aktiv = false, erkenner = null, stimme = null, sprichtGerade = false;
  var knopf = document.getElementById("b-sprechen");

  function waehleStimme() {
    var v = window.speechSynthesis ? speechSynthesis.getVoices() : [];
    var de = v.filter(function (x) { return /^de/i.test(x.lang); });
    var bevor = ["Markus", "Yannick", "Anna", "Google Deutsch", "Viktor", "Petra"];
    for (var i = 0; i < bevor.length; i++) {
      for (var j = 0; j < de.length; j++) if (de[j].name.indexOf(bevor[i]) >= 0) { stimme = de[j]; return; }
    }
    stimme = de[0] || null;
  }
  if (window.speechSynthesis) { waehleStimme(); speechSynthesis.onvoiceschanged = waehleStimme; }

  var KAL_URL = "http://localhost:8765/termine";
  var kalFrage = /termin|eintrag|trag |kalender|heute|morgen|bermorgen|woche|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|anstehen|ansteht|vorhaben|verabredung|uhrzeit|wie sp.t/i;
  function kalTage(t){if(/woche/i.test(t))return 7;if(/morgen/i.test(t))return 2;if(/heute/i.test(t))return 1;return 7;}
  function holeTermine(text) {
    return fetch(KAL_URL + "?tage=" + kalTage(text), { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("Kalender " + r.status);
      return r.json();
    }).then(function (j) {
      return "\n\nKalender-Daten (nutze sie fuer Fragen zu Terminen und zur Uhrzeit): " + j.text;
    }).catch(function () {
      return "\n\nDer Kalender ist gerade nicht erreichbar. Sage Sir das ehrlich, wenn er nach Terminen fragt.";
    });
  }
  var wetterFrage = /wetter|regen|regnet|temperatur|sonne|schnee|gewitter|draussen|jacke|schirm|warm|kalt/i;
  var newsFrage = /nachricht|news|neuigkeit|schlagzeile|passiert/i;
  var briefFrage = /briefing|guten morgen|ueberblick|überblick/i;
  function holeText(pfad, vorspann, name) {
    return fetch("http://localhost:8765/" + pfad, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error(pfad);
      return r.json();
    }).then(function (j) {
      return "\n\n" + vorspann + j.text;
    }).catch(function () {
      return "\n\n" + name + " sind gerade nicht erreichbar. Sage Sir das ehrlich.";
    });
  }
  function kontextHolen(text) {
    var teile = [];
    var brief = briefFrage.test(text);
    if (kalFrage.test(text) || brief) teile.push(holeTermine(text));
    if (wetterFrage.test(text) || brief) teile.push(holeText("wetter", "Wetter in Hoevelhof: ", "Die Wetterdaten"));
    if (newsFrage.test(text) || brief) teile.push(holeText("nachrichten", "Aktuelle Schlagzeilen (Tagesschau): ", "Die Nachrichten"));
    return Promise.all(teile).then(function (a) { return a.join(""); });
  }
  function sucheHolen(q) {
    return fetch("http://localhost:8765/suche?q=" + encodeURIComponent(q.trim()), { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("Suche");
      return r.json();
    }).then(function (j) {
      return "Suchergebnisse aus dem Internet zu " + q.trim() + ":\n" + j.text;
    }).catch(function () {
      return "Die Websuche ist gerade nicht erreichbar. Sage Sir das ehrlich.";
    });
  }
  var zeiten = {};
  var PAUSE = 800;
  var STROM = true;
  function zeigeZeiten() {
    zeiten.stimme = performance.now();
    var z = zeiten;
    function s(x, y) { var d = (y - x) / 1000; return isNaN(d) ? "-" : d.toFixed(1); }
    var box = document.getElementById("zeitbox");
    if (!box) { box = document.createElement("div"); box.id = "zeitbox"; box.style.cssText = "position:fixed;top:44px;left:50%;transform:translateX(-50%);font:15px monospace;color:#fff;background:rgba(0,0,0,0.7);padding:6px 12px;z-index:2147483647;white-space:nowrap"; document.body.appendChild(box); }
    box.textContent = (STROM ? "STROM" : "PUFFER") + " | Warten " + s(z.worte, z.t0) + " | Daten " + s(z.t0, z.kontext) + " | Claude " + s(z.kontext, z.claude) + " | Stimme " + s(z.sprich, z.stimme) + " (Abruf " + s(z.sprich, z.f0) + " Chunk " + s(z.f0, z.chunk) + " Ton " + s(z.chunk, z.stimme) + ") | Gesamt " + s(z.worte, z.stimme);
    document.title = "Warten " + s(z.worte, z.t0) + " | Daten " + s(z.t0, z.kontext) + " | Claude " + s(z.kontext, z.claude) + " | Stimme " + s(z.sprich, z.stimme) + " | Gesamt " + s(z.worte, z.stimme) + " || Abruf " + s(z.sprich, z.f0) + " | Chunk " + s(z.f0, z.chunk) + " | Ton " + s(z.chunk, z.stimme);
  }
  function heutigesDatum() {
    var jetzt = new Date();
    var wt = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
    var tag = String(jetzt.getDate()).padStart(2, "0");
    var monat = String(jetzt.getMonth() + 1).padStart(2, "0");
    return "\n\nHeutiges Datum (nutze es fuer alle Fragen nach Datum, Wochentag, morgen, uebermorgen; verlasse dich dafuer nie auf dein eigenes Wissen): " + wt[jetzt.getDay()] + ", " + tag + "." + monat + "." + jetzt.getFullYear() + ".";
  }
  function gedaechtnisLesen() {
    return fetch("http://localhost:8765/gedaechtnis", { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("gedaechtnis");
      return r.json();
    }).then(function (j) {
      if (!j.eintraege || !j.eintraege.length) return "";
      return "\n\nDas hast du dir ueber Sir gemerkt (nutze es passend, erwaehne es nicht unaufgefordert):\n- " + j.eintraege.join("\n- ");
    }).catch(function () { return ""; });
  }
  function gedaechtnisPruefen(frage, antwort) {
    var merkBefehl = /merk dir|merke dir|vergiss nicht|notier dir/i.test(frage);
    if (!merkBefehl && frage.length < 25) return;
    var saubere = antwort.replace(/\[[A-Z]+\|[^\]]*\]/g, "").trim();
    var pruef = "Entscheide, ob dieser Dialog eine dauerhaft wichtige Tatsache ueber Sir enthaelt, die man sich fuer kuenftige Gespraeche merken sollte (Vorlieben, Abneigungen, Routinen, wiederkehrende Termine, wichtige Namen, Gewohnheiten). " +
      (merkBefehl ? "Sir hat ausdruecklich gebeten, sich etwas zu merken. Fasse es in einem kurzen Satz zusammen. " : "Melde nur etwas, das wirklich dauerhaft wichtig ist, nicht bei Smalltalk, Zeit-, Wetter- oder Einmalfragen. ") +
      "Antworte NUR mit dem kurzen Merksatz in der dritten Person (zum Beispiel: Sir geht freitags ins Fitnessstudio.) oder, wenn nichts zu merken ist, NUR mit dem einen Wort NICHTS.\n\nSir sagte: " + frage + "\nJarvis antwortete: " + saubere;
    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model: modelle[0], max_tokens: 60, messages: [{ role: "user", content: pruef }] })
    }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j) return;
      var t = "";
      try { t = j.content.map(function (p) { return p.text || ""; }).join(" ").trim(); } catch (e) {}
      if (t && t.toUpperCase().indexOf("NICHTS") === -1) {
        fetch("http://localhost:8765/gedaechtnis_hinzu?text=" + encodeURIComponent(t), { cache: "no-store" }).catch(function () {});
      }
    }).catch(function () {});
  }
  var systemText = anweisung;
  var letzterStatus = 0;
  function frageGemini(text) {
    verlauf.push({ role: "user", content: text });
    if (verlauf.length > 12) verlauf = verlauf.slice(-12);
    while (verlauf.length && verlauf[0].role !== "user") verlauf.shift();
    function probiere(i) {
      if (i >= modelle.length) return Promise.reject(new Error("FEHLER"));
      return fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({ model: modelle[i], max_tokens: 200, system: systemText, messages: verlauf })
      }).then(function (r) {
        letzterStatus = r.status;
        if (r.status === 401 || r.status === 403) throw new Error("KEY");
        if (!r.ok) return probiere(i + 1);
        return r.json().then(function (j) {
          var t = "";
          try { t = j.content.map(function (p) { return p.text || ""; }).join(" "); } catch (e) {}
          if (!t.trim()) return probiere(i + 1);
          return t.trim();
        });
      });
    }
    return Promise.all([kontextHolen(text), gedaechtnisLesen()]).then(function (teile) {
      zeiten.kontext = performance.now();
      systemText = anweisung + heutigesDatum() + teile[0] + teile[1];
      return probiere(0);
    }).then(function (antwort) {
      var m = antwort.match(/\[SUCHE\|([^\]]*)\]/);
      if (!m) return antwort;
      return sucheHolen(m[1]).then(function (erg) {
        systemText = systemText + "\n\n" + erg + "\nBeantworte Sir jetzt kurz mit diesen Ergebnissen. Setze keine Markierung.";
        return probiere(0);
      }).then(function (neu) {
        return neu.replace(/\[SUCHE\|[^\]]*\]/g, "").trim() || "Dazu habe ich nichts gefunden, Sir.";
      });
    }).then(function (antwort) {
      zeiten.claude = performance.now();
      verlauf.push({ role: "assistant", content: antwort });
      return antwort;
    }, function (err) {
      verlauf.pop();
      throw err;
    });
  }

  var ELEVEN = window.ELEVEN_KEY || "";
  var STIMME_ID = "pNInz6obpgDQGcFmaJgB";
  var ac = null, quelle = null, messer = null, hinweis = "";

  function audioFreischalten() {
    try {
      if (!ac) { var AC = window.AudioContext || window.webkitAudioContext; ac = new AC(); }
      if (ac.state === "suspended") ac.resume();
    } catch (e) { ac = null; }
  }

  var fuellerNaechst = null, fuellerLetzte = [], fragenVerlauf = [];
  function fuellerNummer() {
    var n, versuche = 0;
    do {
      n = (Math.random() < 0.35) ? 100 + Math.floor(Math.random() * 100) : Math.floor(Math.random() * 100);
      versuche++;
    } while (fuellerLetzte.indexOf(n) >= 0 && versuche < 50);
    fuellerLetzte.push(n);
    if (fuellerLetzte.length > 40) fuellerLetzte.shift();
    return n;
  }
  function fuellerHolen(n) {
    return fetch("fueller/f" + n + ".mp3")
      .then(function (r) { if (!r.ok) throw new Error("kein Fuellsatz"); return r.arrayBuffer(); })
      .then(function (b) { return new Promise(function (ok, nein) { ac.decodeAudioData(b, ok, nein); }); });
  }
  function fuellerLaden() {
    if (fuellerNaechst || !ac) return;
    fuellerHolen(fuellerNummer()).then(function (x) { fuellerNaechst = x; }).catch(function () {});
  }
  function fuellerAbspielen(buf) {
    try { var q = ac.createBufferSource(); q.buffer = buf; q.connect(ac.destination); q.start(0); } catch (e) {}
  }
  function istWiederholung(frage) {
    var w = frage.toLowerCase().replace(/[^a-zäöüß0-9 ]/g, " ").split(/\s+/).filter(function (x) { return x.length > 2; });
    var gleich = 0;
    for (var i = 0; i < fragenVerlauf.length; i++) {
      var v = fragenVerlauf[i], treffer = 0;
      for (var k = 0; k < w.length; k++) if (v.indexOf(w[k]) >= 0) treffer++;
      var gross = Math.max(w.length, v.length);
      if (gross > 0 && treffer / gross >= 0.7) gleich++;
    }
    fragenVerlauf.push(w);
    if (fragenVerlauf.length > 8) fragenVerlauf.shift();
    return gleich >= 2;
  }
  function fuellerSpielen(frage) {
    if (!ac) return;
    if (istWiederholung(frage || "") && Math.random() < 0.7) {
      fuellerHolen(200 + Math.floor(Math.random() * 15)).then(fuellerAbspielen).catch(function () {});
      return;
    }
    if (!fuellerNaechst) return;
    fuellerAbspielen(fuellerNaechst);
    fuellerNaechst = null;
    fuellerLaden();
  }

  function sprichBrowser(text, danach) {
    var sauber = text.replace(/[*_#]/g, "");
    if (!window.speechSynthesis) { danach(); return; }
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(sauber);
    u.lang = "de-DE"; if (stimme) u.voice = stimme;
    u.rate = 1.02; u.pitch = 0.9;
    u.onstart = function () { sprichtGerade = true; setzeZustand("spricht", hinweis ? sauber + " [" + hinweis + "]" : sauber); };
    u.onboundary = function () { ziel = 0.6 + Math.random() * 0.4; externBis = performance.now() + 250; };
    var fertig = false;
    function ende() { if (fertig) return; fertig = true; sprichtGerade = false; ziel = 0; danach(); }
    u.onend = ende; u.onerror = ende;
    speechSynthesis.speak(u);
  }

  function sprichStrom(url, danach) {
    return new Promise(function (ok, nein) {
      var ms = new MediaSource();
      var el = new Audio();
      var laeuft = false, fertig = false;
      var an = ac.createAnalyser(); an.fftSize = 512;
      var daten = new Uint8Array(an.fftSize);
      try {
        el.src = URL.createObjectURL(ms);
        var q = ac.createMediaElementSource(el);
        q.connect(an); an.connect(ac.destination);
      } catch (e) { nein(e); return; }
      function ende() {
        if (fertig) return; fertig = true;
        clearInterval(messer); sprichtGerade = false; ziel = 0; danach();
      }
      el.addEventListener("ended", ende);
      el.addEventListener("error", function () { if (!laeuft) nein(new Error("Audio")); else ende(); });
      el.addEventListener("playing", function () {
        if (laeuft) return; laeuft = true;
        sprichtGerade = true; hinweis = "";
        zeigeZeiten();
        setzeZustand("spricht", sauberText);
        messer = setInterval(function () {
          an.getByteTimeDomainData(daten);
          var s = 0;
          for (var k = 0; k < daten.length; k++) { var v = (daten[k] - 128) / 128; s += v * v; }
          ziel = Math.min(1, Math.sqrt(s / daten.length) * 4);
          externBis = performance.now() + 250;
        }, 50);
        ok();
      });
      quelle = { stop: function () { try { el.pause(); } catch (e) {} } };
      ms.addEventListener("sourceopen", function () {
        var sb;
        try { sb = ms.addSourceBuffer("audio/mpeg"); } catch (e) { nein(e); return; }
        var warte = [], gelesen = false;
        function weiter() {
          if (sb.updating) return;
          if (warte.length) { try { sb.appendBuffer(warte.shift()); } catch (e) { if (!laeuft) nein(e); } return; }
          if (gelesen && ms.readyState === "open") { try { ms.endOfStream(); } catch (e) {} }
        }
        sb.addEventListener("updateend", weiter);
        zeiten.f0 = performance.now();
        fetch(url, { cache: "no-store" }).then(function (r) {
          if (!r.ok) throw new Error("Stimmen-Fehler " + r.status);
          var rd = r.body.getReader();
          var gespielt = false;
          function lies() {
            return rd.read().then(function (x) {
              if (x.done) { gelesen = true; weiter(); return; }
              warte.push(x.value); weiter();
              if (!gespielt) { gespielt = true; zeiten.chunk = performance.now(); el.play().catch(function (e) { if (!laeuft) nein(e); }); }
              return lies();
            });
          }
          return lies();
        }).catch(function (e) { if (!laeuft) nein(e); else ende(); });
      });
    });
  }

  function sprichEleven(sauber, danach) {
    var url = "http://localhost:8765/sprich?text=" + encodeURIComponent(sauber);
    if (!STROM || !(window.MediaSource && MediaSource.isTypeSupported && MediaSource.isTypeSupported("audio/mpeg"))) {
      return sprichPuffer(sauber, danach);
    }
    sauberText = sauber;
    return sprichStrom(url, danach).catch(function (e) { document.title = "FALLBACK: " + (e && e.message ? e.message : e); return sprichPuffer(sauber, danach); });
  }

  var sauberText = "";

  function sprichPuffer(sauber, danach) {
    return fetch("http://localhost:8765/sprich?text=" + encodeURIComponent(sauber), { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("Stimmen-Fehler " + r.status);
      return r.arrayBuffer();
    }).then(function (buf) {
      return new Promise(function (ok, nein) { ac.decodeAudioData(buf, ok, nein); });
    }).then(function (audio) {
      if (!aktiv) return;
      var an = ac.createAnalyser(); an.fftSize = 512;
      var daten = new Uint8Array(an.fftSize);
      quelle = ac.createBufferSource(); quelle.buffer = audio;
      quelle.connect(an); an.connect(ac.destination);
      var fertig = false;
      function ende() {
        if (fertig) return; fertig = true;
        clearInterval(messer); sprichtGerade = false; ziel = 0; danach();
      }
      quelle.onended = ende;
      sprichtGerade = true; hinweis = "";
      zeiten.f0 = zeiten.sprich; zeiten.chunk = zeiten.sprich;
      zeigeZeiten();
      setzeZustand("spricht", sauber);
      messer = setInterval(function () {
        an.getByteTimeDomainData(daten);
        var s = 0;
        for (var k = 0; k < daten.length; k++) { var v = (daten[k] - 128) / 128; s += v * v; }
        ziel = Math.min(1, Math.sqrt(s / daten.length) * 4);
        externBis = performance.now() + 250;
      }, 50);
      quelle.start(0);
    });
  }

  function sprich(text, danach) {
    var sauber = text.replace(/[*_#]/g, "");
    if (ac) {
      sprichEleven(sauber, danach).catch(function (err) {
        hinweis = "Browser-Stimme, " + (err && err.message ? err.message : "Fehler");
        if (aktiv) sprichBrowser(text, danach);
      });
    } else {
      sprichBrowser(text, danach);
    }
  }

  function terminPruefen(antwort) {
    var o = antwort.match(/\[OEFFNEN\|([^\]]*)\]/);
    if (o) {
      var ot = o[1].split("|");
      var osauber = antwort.replace(/\[OEFFNEN\|[^\]]*\]/g, "").trim();
      return fetch("http://localhost:8765/oeffnen?name=" + encodeURIComponent((ot[0] || "").trim()) + "&suche=" + encodeURIComponent((ot[1] || "").trim()), { cache: "no-store" }).then(function (r) {
        return r.ok ? (osauber || "Erledigt, Sir.") : "Das konnte ich leider nicht oeffnen, Sir.";
      }).catch(function () { return "Das konnte ich leider nicht oeffnen, Sir."; });
    }
    var l = antwort.match(/\[LOESCHEN\|([^\]]*)\]/);
    if (l) {
      var lt = l[1].split("|");
      var lsauber = antwort.replace(/\[LOESCHEN\|[^\]]*\]/g, "").trim();
      if (lt.length < 2) return Promise.resolve("Das Loeschen hat leider nicht geklappt, Sir.");
      return fetch("http://localhost:8765/loeschen?tag=" + encodeURIComponent(lt[0].trim()) + "&titel=" + encodeURIComponent(lt.slice(1).join("|").trim()), { cache: "no-store" }).then(function (r) {
        if (r.ok) return lsauber;
        if (r.status === 404) return "Diesen Termin habe ich nicht gefunden, Sir.";
        if (r.status === 409) return "Den Termin kann ich nicht sicher zuordnen, Sir. Bitte loesche ihn selbst.";
        return "Das Loeschen hat leider nicht geklappt, Sir.";
      }).catch(function () { return "Das Loeschen hat leider nicht geklappt, Sir."; });
    }
    var m = antwort.match(/\[TERMIN\|([^\]]*)\]/);
    var sauber = antwort.replace(/\[TERMIN\|[^\]]*\]/g, "").trim();
    if (!m) return Promise.resolve(sauber || antwort);
    var t = m[1].split("|");
    if (t.length < 4) return Promise.resolve("Das Eintragen hat leider nicht geklappt, Sir.");
    var url = "http://localhost:8765/eintragen?start=" + encodeURIComponent(t[0].trim() + "T" + t[1].trim()) +
      "&dauer=" + encodeURIComponent(t[2].trim()) + "&titel=" + encodeURIComponent(t.slice(3).join("|").trim());
    return fetch(url, { cache: "no-store" }).then(function (r) {
      return r.ok ? sauber : "Das Eintragen hat leider nicht geklappt, Sir.";
    }).catch(function () { return "Das Eintragen hat leider nicht geklappt, Sir."; });
  }

  function hoeren() {
    if (!aktiv) return;
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setzeZustand("bereit", "Dieser Browser kann nicht zuhoeren. Bitte Chrome oder Safari nehmen."); stoppen(); return; }
    erkenner = new SR();
    erkenner.lang = "de-DE";
    erkenner.interimResults = true;
    erkenner.continuous = false;
    var endtext = "", weiter = false, stille = null;
    erkenner.onstart = function () { setzeZustand("hoert"); };
    erkenner.onresult = function (e) {
      var t = "";
      for (var i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      endtext = t;
      zeiten.worte = performance.now();
      clearTimeout(stille);
      stille = setTimeout(function () { try { erkenner.stop(); } catch (e) {} }, PAUSE);
      document.getElementById("text").textContent = t;
    };
    erkenner.onerror = function (e) {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setzeZustand("bereit", "Mikrofon ist nicht erlaubt. Bitte oben in der Adressleiste erlauben.");
        stoppen();
      }
    };
    erkenner.onend = function () {
      clearTimeout(stille);
      if (!aktiv) return;
      if (endtext.trim()) {
        weiter = true;
        zeiten.t0 = performance.now();
        setzeZustand("denkt", endtext);
        fuellerSpielen(endtext);
        frageGemini(endtext).then(function (antwort) {
          if (!aktiv) return;
          gedaechtnisPruefen(endtext, antwort);
          terminPruefen(antwort).then(function (text) {
            if (!aktiv) return;
            zeiten.sprich = performance.now();
            sprich(text, function () { if (aktiv) hoeren(); });
          });
        }).catch(function (err) {
          var m = err.message === "KEY" ? "Der Claude-Schluessel wird nicht akzeptiert." : "Das hat nicht geklappt (Fehler " + letzterStatus + "). Ich hoere weiter zu.";
          setzeZustand("bereit", m);
          if (err.message === "KEY") stoppen(); else setTimeout(hoeren, 1500);
        });
      } else {
        setTimeout(hoeren, 300);
      }
    };
    try { erkenner.start(); } catch (e) { setTimeout(hoeren, 500); }
  }

  function stoppen() {
    aktiv = false;
    knopf.textContent = "Sprechen"; knopf.classList.add("aktiv");
    try { if (erkenner) erkenner.abort(); } catch (e) {}
    if (window.speechSynthesis) speechSynthesis.cancel();
    try { if (quelle) quelle.stop(); } catch (e) {}
    clearInterval(messer);
    ziel = 0;
  }
  knopf.addEventListener("click", function () {
    if (aktiv) { stoppen(); setzeZustand("bereit"); return; }
    if (!KEY) { setzeZustand("bereit", "Die Datei schluessel.js fehlt. Ohne sie kann Jarvis nicht denken."); return; }
    aktiv = true;
    knopf.textContent = "Stopp"; knopf.classList.remove("aktiv");
    // Stimme einmal "freischalten" (Browser-Regel: erst nach Tipp erlaubt)
    if (window.speechSynthesis) { var z = new SpeechSynthesisUtterance(" "); z.volume = 0; speechSynthesis.speak(z); }
    audioFreischalten();
    fuellerLaden();
    hoeren();
  });

  function uhr() {
    document.getElementById("uhr").textContent =
      new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }
  uhr(); setInterval(uhr, 1000);
