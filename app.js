(function () {
  "use strict";

  var ENTRIES_KEY = "ironlog.entries.v1";
  var PROFILE_KEY = "ironlog.profile.v1";
  var WEIGHTS_KEY = "ironlog.weights.v1";

  var EXERCISES = {
    "Chest": ["Bench Press", "Incline Dumbbell Press", "Push-ups", "Chest Fly", "Dips"],
    "Back": ["Pull-ups", "Lat Pulldown", "Bent-over Row", "Deadlift", "Seated Cable Row"],
    "Shoulders": ["Overhead Press", "Lateral Raises", "Front Raises", "Face Pulls", "Arnold Press"],
    "Arms": ["Bicep Curls", "Hammer Curls", "Tricep Pushdown", "Skull Crushers", "Close-grip Bench Press"],
    "Legs": ["Squats", "Leg Press", "Lunges", "Romanian Deadlift", "Leg Curls"],
    "Core": ["Plank", "Crunches", "Hanging Leg Raise", "Russian Twists", "Cable Woodchopper"],
    "Full Body": ["Clean and Press", "Burpees", "Kettlebell Swings", "Thrusters", "Snatch"]
  };

  // ---------- storage helpers ----------
  function loadJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function saveJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  var entries = loadJSON(ENTRIES_KEY, {});   // keyed by "YYYY-MM-DD"
  var profile = loadJSON(PROFILE_KEY, {});   // {name, gender, age}
  var weights = loadJSON(WEIGHTS_KEY, {});   // keyed by "YYYY-MM-DD" -> number

  function saveEntries() { saveJSON(ENTRIES_KEY, entries); }
  function saveProfile() { saveJSON(PROFILE_KEY, profile); }
  function saveWeights() { saveJSON(WEIGHTS_KEY, weights); }

  // ---------- date helpers ----------
  function toKey(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }
  function fromKey(key) {
    var parts = key.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  function todayKey() {
    return toKey(new Date());
  }
  function startOfWeek(d) {
    var nd = new Date(d);
    nd.setDate(nd.getDate() - nd.getDay());
    nd.setHours(0, 0, 0, 0);
    return nd;
  }
  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }
  function entryIsEmpty(e) {
    return !e || (!e.gym && (!e.bodyParts || !e.bodyParts.length) && !e.cardio && !e.notes);
  }

  // ================= PROFILE =================
  var gearBtn = document.getElementById("gearBtn");
  var profileOverlay = document.getElementById("profileOverlay");
  var closeProfile = document.getElementById("closeProfile");
  var profName = document.getElementById("profName");
  var profAge = document.getElementById("profAge");
  var genderGroup = document.getElementById("genderGroup");
  var saveProfileBtn = document.getElementById("saveProfileBtn");
  var greeting = document.getElementById("greeting");
  var selectedGender = profile.gender || null;

  function openProfilePanel() {
    profName.value = profile.name || "";
    profAge.value = profile.age || "";
    selectedGender = profile.gender || null;
    genderGroup.querySelectorAll(".choice-btn").forEach(function (b) {
      b.classList.toggle("selected", b.dataset.value === selectedGender);
    });
    profileOverlay.classList.remove("hidden");
  }
  gearBtn.addEventListener("click", openProfilePanel);
  closeProfile.addEventListener("click", function () {
    profileOverlay.classList.add("hidden");
  });
  genderGroup.querySelectorAll(".choice-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      genderGroup.querySelectorAll(".choice-btn").forEach(function (b) { b.classList.remove("selected"); });
      btn.classList.add("selected");
      selectedGender = btn.dataset.value;
    });
  });
  saveProfileBtn.addEventListener("click", function () {
    profile.name = profName.value.trim();
    profile.age = profAge.value ? Number(profAge.value) : null;
    profile.gender = selectedGender;
    saveProfile();
    renderGreeting();
    profileOverlay.classList.add("hidden");
  });
  function renderGreeting() {
    if (profile.name) {
      greeting.textContent = "Welcome back, " + profile.name + " 👋";
      greeting.classList.remove("hidden");
    } else {
      greeting.classList.add("hidden");
    }
  }

  // ================= TAB NAVIGATION =================
  var tabBtns = document.querySelectorAll(".tab-btn");
  var views = {
    log: document.getElementById("view-log"),
    calendar: document.getElementById("view-calendar"),
    stats: document.getElementById("view-stats"),
    weight: document.getElementById("view-weight")
  };
  tabBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      tabBtns.forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      Object.keys(views).forEach(function (k) { views[k].classList.add("hidden"); });
      views[btn.dataset.tab].classList.remove("hidden");
      if (btn.dataset.tab === "calendar") renderCalendar();
      if (btn.dataset.tab === "stats") renderStats();
      if (btn.dataset.tab === "weight") renderWeightTab();
    });
  });

  // ================= LOG VIEW =================
  var logDate = document.getElementById("logDate");
  logDate.value = todayKey();

  var selectedGym = null;
  var selectedBodyParts = [];
  var cardioOn = false;
  var selectedCardioType = null;

  var gymGroup = document.getElementById("gymGroup");
  gymGroup.querySelectorAll(".choice-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      gymGroup.querySelectorAll(".choice-btn").forEach(function (b) { b.classList.remove("selected"); });
      btn.classList.add("selected");
      selectedGym = btn.dataset.value;
    });
  });

  var bodyPartGroup = document.getElementById("bodyPartGroup");
  var exerciseExamples = document.getElementById("exerciseExamples");
  bodyPartGroup.querySelectorAll(".choice-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var val = btn.dataset.value;
      var idx = selectedBodyParts.indexOf(val);
      if (idx > -1) {
        selectedBodyParts.splice(idx, 1);
        btn.classList.remove("selected");
      } else {
        selectedBodyParts.push(val);
        btn.classList.add("selected");
      }
      renderExerciseExamples();
    });
  });
  function renderExerciseExamples() {
    exerciseExamples.innerHTML = "";
    selectedBodyParts.forEach(function (bp) {
      var block = document.createElement("div");
      block.className = "exercise-block";
      var h4 = document.createElement("h4");
      h4.textContent = bp + " — example exercises";
      var p = document.createElement("p");
      p.textContent = (EXERCISES[bp] || []).join(" · ");
      block.appendChild(h4);
      block.appendChild(p);
      exerciseExamples.appendChild(block);
    });
  }

  var cardioToggle = document.getElementById("cardioToggle");
  var cardioPanel = document.getElementById("cardioPanel");
  cardioToggle.addEventListener("change", function () {
    cardioOn = cardioToggle.checked;
    cardioPanel.classList.toggle("hidden", !cardioOn);
  });

  var cardioTypeGroup = cardioPanel.querySelector(".btn-group");
  cardioTypeGroup.querySelectorAll(".choice-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      cardioTypeGroup.querySelectorAll(".choice-btn").forEach(function (b) { b.classList.remove("selected"); });
      btn.classList.add("selected");
      selectedCardioType = btn.dataset.value;
    });
  });

  var cardioDuration = document.getElementById("cardioDuration");
  var cardioEffort = document.getElementById("cardioEffort");
  var effortVal = document.getElementById("effortVal");
  cardioEffort.addEventListener("input", function () {
    effortVal.textContent = cardioEffort.value;
  });

  var notesInput = document.getElementById("notes");
  var deleteWorkoutBtn = document.getElementById("deleteWorkoutBtn");
  var deleteCardioBtn = document.getElementById("deleteCardioBtn");

  function resetLogForm(keepDate) {
    if (!keepDate) logDate.value = todayKey();
    selectedGym = null;
    selectedBodyParts = [];
    cardioOn = false;
    selectedCardioType = null;
    gymGroup.querySelectorAll(".choice-btn").forEach(function (b) { b.classList.remove("selected"); });
    bodyPartGroup.querySelectorAll(".choice-btn").forEach(function (b) { b.classList.remove("selected"); });
    cardioTypeGroup.querySelectorAll(".choice-btn").forEach(function (b) { b.classList.remove("selected"); });
    cardioToggle.checked = false;
    cardioPanel.classList.add("hidden");
    cardioDuration.value = "";
    cardioEffort.value = 5;
    effortVal.textContent = "5";
    notesInput.value = "";
    exerciseExamples.innerHTML = "";
    deleteWorkoutBtn.classList.add("hidden");
    deleteCardioBtn.classList.add("hidden");
  }

  function loadEntryIntoForm(key) {
    var e = entries[key];
    resetLogForm(true);
    if (!e) return;
    if (e.gym) {
      selectedGym = e.gym;
      gymGroup.querySelectorAll(".choice-btn").forEach(function (b) {
        b.classList.toggle("selected", b.dataset.value === e.gym);
      });
    }
    if (e.bodyParts && e.bodyParts.length) {
      selectedBodyParts = e.bodyParts.slice();
      bodyPartGroup.querySelectorAll(".choice-btn").forEach(function (b) {
        b.classList.toggle("selected", selectedBodyParts.indexOf(b.dataset.value) > -1);
      });
      renderExerciseExamples();
    }
    if (e.gym || (e.bodyParts && e.bodyParts.length)) {
      deleteWorkoutBtn.classList.remove("hidden");
    }
    if (e.cardio) {
      cardioOn = true;
      cardioToggle.checked = true;
      cardioPanel.classList.remove("hidden");
      selectedCardioType = e.cardio.type;
      cardioTypeGroup.querySelectorAll(".choice-btn").forEach(function (b) {
        b.classList.toggle("selected", b.dataset.value === e.cardio.type);
      });
      cardioDuration.value = e.cardio.duration || "";
      cardioEffort.value = e.cardio.effort || 5;
      effortVal.textContent = cardioEffort.value;
      deleteCardioBtn.classList.remove("hidden");
    }
    notesInput.value = e.notes || "";
  }

  logDate.addEventListener("change", function () {
    loadEntryIntoForm(logDate.value);
  });

  var saveBtn = document.getElementById("saveBtn");
  var saveMsg = document.getElementById("saveMsg");
  saveBtn.addEventListener("click", function () {
    var key = logDate.value || todayKey();
    var entry = {
      date: key,
      gym: selectedGym,
      bodyParts: selectedBodyParts.slice(),
      cardio: cardioOn ? {
        type: selectedCardioType,
        duration: cardioDuration.value ? Number(cardioDuration.value) : null,
        effort: Number(cardioEffort.value)
      } : null,
      notes: notesInput.value.trim()
    };
    entries[key] = entry;
    saveEntries();
    saveMsg.classList.remove("hidden");
    setTimeout(function () { saveMsg.classList.add("hidden"); }, 1800);
    loadEntryIntoForm(key);
    updateHeaderStreak();
  });

  // ---------- delete workout / cardio / whole day ----------
  function deleteWorkoutPart(key) {
    var e = entries[key];
    if (!e) return;
    e.gym = null;
    e.bodyParts = [];
    if (entryIsEmpty(e)) delete entries[key]; else entries[key] = e;
    saveEntries();
  }
  function deleteCardioPart(key) {
    var e = entries[key];
    if (!e) return;
    e.cardio = null;
    if (entryIsEmpty(e)) delete entries[key]; else entries[key] = e;
    saveEntries();
  }
  function deleteEntireDay(key) {
    delete entries[key];
    saveEntries();
  }

  deleteWorkoutBtn.addEventListener("click", function () {
    if (!confirm("Delete the workout (gym & body parts) logged for this day?")) return;
    deleteWorkoutPart(logDate.value);
    loadEntryIntoForm(logDate.value);
    updateHeaderStreak();
  });
  deleteCardioBtn.addEventListener("click", function () {
    if (!confirm("Delete the cardio session logged for this day?")) return;
    deleteCardioPart(logDate.value);
    loadEntryIntoForm(logDate.value);
    updateHeaderStreak();
  });

  // ================= CALENDAR VIEW =================
  var calCursor = new Date();
  calCursor.setDate(1);

  var calMonthLabel = document.getElementById("calMonthLabel");
  var calGrid = document.getElementById("calGrid");
  var dayDetailCard = document.getElementById("dayDetailCard");
  var dayDetailTitle = document.getElementById("dayDetailTitle");
  var dayDetailBody = document.getElementById("dayDetailBody");
  var dayDetailActions = document.getElementById("dayDetailActions");

  document.getElementById("prevMonth").addEventListener("click", function () {
    calCursor.setMonth(calCursor.getMonth() - 1);
    renderCalendar();
  });
  document.getElementById("nextMonth").addEventListener("click", function () {
    calCursor.setMonth(calCursor.getMonth() + 1);
    renderCalendar();
  });
  document.getElementById("closeDayDetail").addEventListener("click", function () {
    dayDetailCard.style.display = "none";
  });

  var MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  function renderCalendar() {
    calMonthLabel.textContent = MONTH_NAMES[calCursor.getMonth()] + " " + calCursor.getFullYear();
    calGrid.innerHTML = "";
    var firstDay = new Date(calCursor.getFullYear(), calCursor.getMonth(), 1);
    var startOffset = firstDay.getDay();
    var daysInMonth = new Date(calCursor.getFullYear(), calCursor.getMonth() + 1, 0).getDate();
    var tKey = todayKey();

    for (var i = 0; i < startOffset; i++) {
      var empty = document.createElement("div");
      empty.className = "cal-day empty";
      calGrid.appendChild(empty);
    }
    for (var day = 1; day <= daysInMonth; day++) {
      var d = new Date(calCursor.getFullYear(), calCursor.getMonth(), day);
      var key = toKey(d);
      var cell = document.createElement("div");
      cell.className = "cal-day" + (key === tKey ? " today" : "");
      var num = document.createElement("div");
      num.textContent = day;
      cell.appendChild(num);

      var e = entries[key];
      if (e) {
        var dots = document.createElement("div");
        dots.className = "dots";
        if (e.gym === "Personal") dots.appendChild(makeDot("personal"));
        if (e.gym === "Office") dots.appendChild(makeDot("office"));
        if (e.cardio) dots.appendChild(makeDot("cardio"));
        cell.appendChild(dots);
      }
      cell.addEventListener("click", function (k) {
        return function () { showDayDetail(k); };
      }(key));
      calGrid.appendChild(cell);
    }
  }
  function makeDot(cls) {
    var s = document.createElement("span");
    s.className = "dot " + cls;
    return s;
  }

  function showDayDetail(key) {
    var e = entries[key];
    var d = fromKey(key);
    dayDetailTitle.textContent = d.toDateString();
    dayDetailBody.dataset.key = key;
    dayDetailActions.innerHTML = "";

    if (!e) {
      dayDetailBody.innerHTML = "<p>No workout logged this day.</p>";
      dayDetailCard.style.display = "block";
      return;
    }

    var html = "";
    html += "<p><b>Gym:</b> " + (e.gym ? (e.gym === "Personal" ? "Personal Gym" : "Office Gym") : "—") + "</p>";
    html += "<p><b>Body parts:</b> " + (e.bodyParts && e.bodyParts.length ? e.bodyParts.join(", ") : "—") + "</p>";
    if (e.cardio) {
      html += "<p><b>Cardio:</b> " + e.cardio.type + " · " + (e.cardio.duration || "?") + " min · effort " + e.cardio.effort + "/10</p>";
    }
    if (e.notes) {
      html += "<p><b>Notes:</b> " + escapeHtml(e.notes) + "</p>";
    }
    dayDetailBody.innerHTML = html;

    if (e.gym || (e.bodyParts && e.bodyParts.length)) {
      var delW = document.createElement("button");
      delW.type = "button";
      delW.className = "text-btn danger";
      delW.textContent = "Delete Workout";
      delW.addEventListener("click", function () {
        if (!confirm("Delete the workout logged for " + d.toDateString() + "?")) return;
        deleteWorkoutPart(key);
        renderCalendar();
        showDayDetail(key);
        updateHeaderStreak();
        loadEntryIntoForm(logDate.value);
      });
      dayDetailActions.appendChild(delW);
    }
    if (e.cardio) {
      var delC = document.createElement("button");
      delC.type = "button";
      delC.className = "text-btn danger";
      delC.textContent = "Delete Cardio";
      delC.addEventListener("click", function () {
        if (!confirm("Delete the cardio logged for " + d.toDateString() + "?")) return;
        deleteCardioPart(key);
        renderCalendar();
        showDayDetail(key);
        updateHeaderStreak();
        loadEntryIntoForm(logDate.value);
      });
      dayDetailActions.appendChild(delC);
    }
    var delAll = document.createElement("button");
    delAll.type = "button";
    delAll.className = "text-btn danger";
    delAll.textContent = "Delete Entire Day";
    delAll.addEventListener("click", function () {
      if (!confirm("Delete everything logged for " + d.toDateString() + "?")) return;
      deleteEntireDay(key);
      renderCalendar();
      dayDetailCard.style.display = "none";
      updateHeaderStreak();
      loadEntryIntoForm(logDate.value);
    });
    dayDetailActions.appendChild(delAll);

    dayDetailCard.style.display = "block";
  }

  // allow editing a day from calendar: clicking title jumps to Log tab
  dayDetailTitle.addEventListener("click", function () {
    var key = dayDetailBody.dataset.key;
    if (!key) return;
    document.querySelector('.tab-btn[data-tab="log"]').click();
    logDate.value = key;
    loadEntryIntoForm(key);
  });

  // ================= STATS VIEW =================
  function computeCurrentStreak() {
    var streak = 0;
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    if (!entries[toKey(d)]) {
      d.setDate(d.getDate() - 1);
    }
    while (entries[toKey(d)]) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }

  function computeBestStreak() {
    var keys = Object.keys(entries).sort();
    if (!keys.length) return 0;
    var best = 1, cur = 1;
    for (var i = 1; i < keys.length; i++) {
      var prev = fromKey(keys[i - 1]);
      var currD = fromKey(keys[i]);
      var diff = Math.round((currD - prev) / 86400000);
      if (diff === 1) {
        cur++;
      } else if (diff === 0) {
        // ignore
      } else {
        cur = 1;
      }
      if (cur > best) best = cur;
    }
    return best;
  }

  function updateHeaderStreak() {
    document.getElementById("headerStreakVal").textContent = computeCurrentStreak();
  }

  function renderStats() {
    var current = computeCurrentStreak();
    var best = computeBestStreak();
    document.getElementById("currentStreakNum").textContent = current;
    document.getElementById("bestStreakNum").textContent = best;
    updateHeaderStreak();

    // This week (Sun-Sat)
    var weekStart = startOfWeek(new Date());
    var weekBar = document.getElementById("weekBar");
    weekBar.innerHTML = "";
    var trainedCount = 0;
    var DOW = ["S", "M", "T", "W", "T", "F", "S"];
    for (var i = 0; i < 7; i++) {
      var d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      var key = toKey(d);
      var has = !!entries[key];
      if (has) trainedCount++;
      var col = document.createElement("div");
      col.className = "week-day";
      var bar = document.createElement("div");
      bar.className = "bar";
      var fill = document.createElement("div");
      fill.className = "bar-fill";
      fill.style.height = has ? "100%" : "0%";
      bar.appendChild(fill);
      var lbl = document.createElement("div");
      lbl.className = "lbl";
      lbl.textContent = DOW[i];
      col.appendChild(bar);
      col.appendChild(lbl);
      weekBar.appendChild(col);
    }
    document.getElementById("weekCountLabel").textContent = trainedCount + " / 7 days";

    // Simple health score = days trained this week / 7
    var scorePct = Math.round((trainedCount / 7) * 100);
    document.getElementById("scoreVal").textContent = scorePct + "%";
    var circumference = 2 * Math.PI * 52;
    var ringFg = document.getElementById("ringFg");
    ringFg.style.strokeDasharray = circumference;
    ringFg.style.strokeDashoffset = circumference - (circumference * scorePct / 100);
    var scoreSub = document.getElementById("scoreSub");
    if (scorePct >= 85) scoreSub.textContent = "Excellent consistency this week 💪";
    else if (scorePct >= 50) scoreSub.textContent = "Solid week — keep the momentum";
    else if (scorePct > 0) scoreSub.textContent = "Room to grow — get a few more sessions in";
    else scoreSub.textContent = "No sessions yet this week — start today";

    // This month
    var now = new Date();
    var monthDays = 0, monthCardio = 0, monthMins = 0;
    Object.keys(entries).forEach(function (key) {
      var d = fromKey(key);
      if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
        monthDays++;
        var e = entries[key];
        if (e.cardio) {
          monthCardio++;
          monthMins += e.cardio.duration || 0;
        }
      }
    });
    document.getElementById("monthDays").textContent = monthDays;
    document.getElementById("monthCardio").textContent = monthCardio;
    document.getElementById("monthMins").textContent = monthMins;

    // Personal vs Office gym split (all-time)
    var personalCount = 0, officeCount = 0;
    Object.keys(entries).forEach(function (key) {
      var e = entries[key];
      if (e.gym === "Personal") personalCount++;
      if (e.gym === "Office") officeCount++;
    });
    var gymTotal = personalCount + officeCount;
    var gymSplitEl = document.getElementById("gymSplit");
    var gymSplitSub = document.getElementById("gymSplitSub");
    gymSplitEl.innerHTML = "";
    var maxGym = Math.max(personalCount, officeCount, 1);
    [
      { name: "Personal", count: personalCount, cls: "personal-fill" },
      { name: "Office", count: officeCount, cls: "office-fill" }
    ].forEach(function (row) {
      var r = document.createElement("div");
      r.className = "bp-row";
      var name = document.createElement("div");
      name.className = "bp-name";
      name.textContent = row.name;
      var track = document.createElement("div");
      track.className = "bp-track";
      var fill = document.createElement("div");
      fill.className = "bp-fill";
      fill.style.width = (row.count / maxGym * 100) + "%";
      fill.style.background = row.name === "Personal" ? "var(--personal)" : "var(--office)";
      track.appendChild(fill);
      var count = document.createElement("div");
      count.className = "bp-count";
      count.textContent = row.count;
      r.appendChild(name);
      r.appendChild(track);
      r.appendChild(count);
      gymSplitEl.appendChild(r);
    });
    if (gymTotal > 0) {
      var personalPct = Math.round((personalCount / gymTotal) * 100);
      gymSplitSub.textContent = personalPct + "% Personal · " + (100 - personalPct) + "% Office (all-time, " + gymTotal + " sessions)";
    } else {
      gymSplitSub.textContent = "Log a workout to see your gym split";
    }

    // Body part frequency last 30 days
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    var freq = {};
    Object.keys(EXERCISES).forEach(function (bp) { freq[bp] = 0; });
    Object.keys(entries).forEach(function (key) {
      var d = fromKey(key);
      if (d >= cutoff) {
        var e = entries[key];
        (e.bodyParts || []).forEach(function (bp) {
          freq[bp] = (freq[bp] || 0) + 1;
        });
      }
    });
    var maxFreq = Math.max.apply(null, Object.values(freq).concat([1]));
    var bpFreqEl = document.getElementById("bodyPartFreq");
    bpFreqEl.innerHTML = "";
    Object.keys(freq).forEach(function (bp) {
      var row = document.createElement("div");
      row.className = "bp-row";
      var name = document.createElement("div");
      name.className = "bp-name";
      name.textContent = bp;
      var track = document.createElement("div");
      track.className = "bp-track";
      var fill = document.createElement("div");
      fill.className = "bp-fill";
      fill.style.width = (freq[bp] / maxFreq * 100) + "%";
      track.appendChild(fill);
      var count = document.createElement("div");
      count.className = "bp-count";
      count.textContent = freq[bp];
      row.appendChild(name);
      row.appendChild(track);
      row.appendChild(count);
      bpFreqEl.appendChild(row);
    });
  }

  // ================= WEIGHT TAB =================
  var weightDate = document.getElementById("weightDate");
  var weightValue = document.getElementById("weightValue");
  var saveWeightBtn = document.getElementById("saveWeightBtn");
  var weightChartWrap = document.getElementById("weightChartWrap");
  var weightSummary = document.getElementById("weightSummary");
  var weightHistory = document.getElementById("weightHistory");

  weightDate.value = todayKey();

  saveWeightBtn.addEventListener("click", function () {
    var key = weightDate.value || todayKey();
    var val = parseFloat(weightValue.value);
    if (!val || val <= 0) return;
    weights[key] = val;
    saveWeights();
    weightValue.value = "";
    renderWeightTab();
  });

  function deleteWeightEntry(key) {
    delete weights[key];
    saveWeights();
    renderWeightTab();
  }

  function renderWeightTab() {
    var keys = Object.keys(weights).sort();
    var points = keys.map(function (k) { return { key: k, date: fromKey(k), value: weights[k] }; });

    // chart
    weightChartWrap.innerHTML = "";
    if (points.length < 2) {
      var empty = document.createElement("div");
      empty.className = "weight-empty";
      empty.textContent = points.length === 0
        ? "Add your first weight entry to start tracking your trend."
        : "Add one more entry to see your trend line.";
      weightChartWrap.appendChild(empty);
    } else {
      weightChartWrap.innerHTML = buildWeightSVG(points);
    }

    // summary
    weightSummary.innerHTML = "";
    if (points.length > 0) {
      var latest = points[points.length - 1].value;
      var first = points[0].value;
      var delta = latest - first;
      var deltaStr = (delta > 0 ? "+" : "") + delta.toFixed(1);
      weightSummary.innerHTML =
        '<div class="ws-item"><span>' + latest.toFixed(1) + '</span><small>Current (kg)</small></div>' +
        '<div class="ws-item"><span>' + first.toFixed(1) + '</span><small>Starting (kg)</small></div>' +
        '<div class="ws-item"><span>' + deltaStr + '</span><small>Change (kg)</small></div>';
    }

    // history (most recent first) with delete
    weightHistory.innerHTML = "";
    if (points.length === 0) {
      var eh = document.createElement("div");
      eh.className = "weight-empty-history";
      eh.textContent = "No entries yet.";
      weightHistory.appendChild(eh);
    } else {
      points.slice().reverse().forEach(function (p) {
        var row = document.createElement("div");
        row.className = "weight-history-row";
        var dateSpan = document.createElement("span");
        dateSpan.className = "wh-date";
        dateSpan.textContent = p.date.toDateString();
        var valSpan = document.createElement("span");
        valSpan.className = "wh-val";
        valSpan.textContent = p.value.toFixed(1) + " kg";
        var delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "wh-del";
        delBtn.textContent = "Delete";
        delBtn.addEventListener("click", function () {
          if (!confirm("Delete weight entry for " + p.date.toDateString() + "?")) return;
          deleteWeightEntry(p.key);
        });
        row.appendChild(dateSpan);
        row.appendChild(valSpan);
        row.appendChild(delBtn);
        weightHistory.appendChild(row);
      });
    }
  }

  function buildWeightSVG(points) {
    var W = 320, H = 160, padX = 30, padY = 20;
    var values = points.map(function (p) { return p.value; });
    var minV = Math.min.apply(null, values);
    var maxV = Math.max.apply(null, values);
    if (minV === maxV) { minV -= 1; maxV += 1; }
    var rangePad = (maxV - minV) * 0.15;
    minV -= rangePad; maxV += rangePad;

    function xAt(i) {
      return padX + (i / (points.length - 1)) * (W - padX * 2);
    }
    function yAt(v) {
      return H - padY - ((v - minV) / (maxV - minV)) * (H - padY * 2);
    }

    var pathPoints = points.map(function (p, i) { return xAt(i) + "," + yAt(p.value); }).join(" ");

    var circles = points.map(function (p, i) {
      return '<circle cx="' + xAt(i) + '" cy="' + yAt(p.value) + '" r="3.5" fill="var(--accent)"></circle>';
    }).join("");

    var firstLbl = points[0].date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    var lastLbl = points[points.length - 1].date.toLocaleDateString(undefined, { month: "short", day: "numeric" });

    return (
      '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg">' +
      '<polyline points="' + pathPoints + '" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"></polyline>' +
      circles +
      '<text x="' + padX + '" y="' + (H - 4) + '" font-size="9" fill="var(--text-dim)">' + firstLbl + '</text>' +
      '<text x="' + (W - padX) + '" y="' + (H - 4) + '" font-size="9" fill="var(--text-dim)" text-anchor="end">' + lastLbl + '</text>' +
      '<text x="' + padX + '" y="12" font-size="9" fill="var(--text-dim)">' + maxV.toFixed(1) + '</text>' +
      '<text x="' + padX + '" y="' + (H - padY + 10) + '" font-size="9" fill="var(--text-dim)">' + minV.toFixed(1) + '</text>' +
      '</svg>'
    );
  }

  // ================= INIT =================
  loadEntryIntoForm(todayKey());
  updateHeaderStreak();
  renderGreeting();
})();
