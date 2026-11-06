(function () {
  "use strict";

  var ENTRIES_KEY = "ironlog.entries.v1";
  var PROFILE_KEY = "ironlog.profile.v1";
  var WEIGHTS_KEY = "ironlog.weights.v1";
  var COACH_SETTINGS_KEY = "ironlog.coachSettings.v1";
  var EATOUT_KEY = "ironlog.eatout.v1";
  var THEME_KEY = "ironlog.theme.v1";
  var THEME_COLORS = { cream: "#f6ecd9", onyx: "#15171c", navy: "#f4f1ea", emerald: "#181c1a" };

  var EXERCISES = {
    "Chest": ["Bench Press", "Incline Dumbbell Press", "Push-ups", "Chest Fly", "Dips"],
    "Back": ["Pull-ups", "Lat Pulldown", "Bent-over Row", "Deadlift", "Seated Cable Row"],
    "Shoulders": ["Overhead Press", "Lateral Raises", "Front Raises", "Face Pulls", "Arnold Press"],
    "Arms": ["Bicep Curls", "Hammer Curls", "Tricep Pushdown", "Skull Crushers", "Close-grip Bench Press"],
    "Legs": ["Squats", "Leg Press", "Lunges", "Romanian Deadlift", "Leg Curls"],
    "Core": ["Plank", "Crunches", "Hanging Leg Raise", "Russian Twists", "Cable Woodchopper"],
    "Full Body": ["Clean and Press", "Burpees", "Kettlebell Swings", "Thrusters", "Snatch"]
  };

  // exercise pools tiered by difficulty, used by the Coach recommendation engine
  var EXERCISE_TIERS = {
    "Chest": {
      Simple: ["Push-ups", "Incline Push-ups", "Knee Push-ups"],
      Medium: ["Bench Press", "Incline Dumbbell Press", "Cable Crossover"],
      Advanced: ["Weighted Dips", "Barbell Bench Press", "Plyo Push-ups"]
    },
    "Back": {
      Simple: ["Superman Hold", "Band Rows", "Inverted Rows"],
      Medium: ["Lat Pulldown", "Seated Cable Row", "Bent-over Dumbbell Row"],
      Advanced: ["Weighted Pull-ups", "Barbell Deadlift", "T-Bar Row"]
    },
    "Shoulders": {
      Simple: ["Arm Circles", "Light Lateral Raises", "Front Raises"],
      Medium: ["Overhead Press", "Arnold Press", "Face Pulls"],
      Advanced: ["Push Press", "Handstand Push-ups", "Heavy Overhead Press"]
    },
    "Arms": {
      Simple: ["Bench Dips", "Band Curls", "Diamond Push-ups"],
      Medium: ["Bicep Curls", "Hammer Curls", "Tricep Pushdown"],
      Advanced: ["Skull Crushers", "Close-grip Bench Press", "Weighted Chin-ups"]
    },
    "Legs": {
      Simple: ["Bodyweight Squats", "Glute Bridges", "Walking Lunges"],
      Medium: ["Goblet Squats", "Leg Press", "Romanian Deadlift"],
      Advanced: ["Barbell Back Squat", "Bulgarian Split Squat (weighted)", "Heavy Deadlift"]
    },
    "Core": {
      Simple: ["Plank", "Crunches", "Bird Dog"],
      Medium: ["Russian Twists", "Leg Raises", "Cable Woodchopper"],
      Advanced: ["Hanging Leg Raise", "Dragon Flag", "Weighted Sit-ups"]
    },
    "Full Body": {
      Simple: ["Jumping Jacks", "Modified Burpees", "Mountain Climbers"],
      Medium: ["Kettlebell Swings", "Burpees", "Light Thrusters"],
      Advanced: ["Clean and Press", "Snatch", "Heavy Thrusters"]
    }
  };

  var GOALS = {
    "Lose Weight": { sets: 3, reps: 15, restSec: 30, emoji: "🔥" },
    "Build Muscle": { sets: 4, reps: 10, restSec: 60, emoji: "💪" },
    "Get Stronger": { sets: 5, reps: 5, restSec: 120, emoji: "🏋️" },
    "Marathon Training": { sets: 3, reps: 18, restSec: 30, emoji: "🏃" },
    "Tone & Sculpt": { sets: 3, reps: 12, restSec: 45, emoji: "✨" }
  };

  var INTENSITY_ADJUST = {
    Light: { setsDelta: -1, restDelta: 15 },
    Moderate: { setsDelta: 0, restDelta: 0 },
    High: { setsDelta: 1, restDelta: -15 }
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
  var eatouts = loadJSON(EATOUT_KEY, []);    // array of {id, date, dish, mealType, cost}

  function saveEntries() { saveJSON(ENTRIES_KEY, entries); }
  function saveProfile() { saveJSON(PROFILE_KEY, profile); }
  function saveWeights() { saveJSON(WEIGHTS_KEY, weights); }
  function saveEatouts() { saveJSON(EATOUT_KEY, eatouts); }

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

  // ================= THEME =================
  var themeGroup = document.getElementById("themeGroup");

  function applyTheme(name) {
    document.documentElement.setAttribute("data-theme", name);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta && THEME_COLORS[name]) meta.setAttribute("content", THEME_COLORS[name]);
    themeGroup.querySelectorAll(".theme-swatch").forEach(function (b) {
      b.classList.toggle("selected", b.dataset.value === name);
    });
  }

  themeGroup.querySelectorAll(".theme-swatch").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var name = btn.dataset.value;
      saveJSON(THEME_KEY, name);
      applyTheme(name);
    });
  });

  applyTheme(loadJSON(THEME_KEY, "cream"));

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
    weight: document.getElementById("view-weight"),
    coach: document.getElementById("view-coach"),
    eatout: document.getElementById("view-eatout")
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
      if (btn.dataset.tab === "eatout") renderEatoutTab();
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

    renderInsights();
  }

  // ---------- fun insights ----------
  function renderInsights() {
    var grid = document.getElementById("insightsGrid");
    grid.innerHTML = "";
    var allKeys = Object.keys(entries);

    function addChip(emoji, value, label) {
      var chip = document.createElement("div");
      chip.className = "insight-chip";
      chip.innerHTML =
        '<span class="ic-emoji">' + emoji + '</span>' +
        '<span class="ic-value">' + escapeHtml(String(value)) + '</span>' +
        '<span class="ic-label">' + escapeHtml(label) + '</span>';
      grid.appendChild(chip);
    }

    if (allKeys.length === 0) {
      addChip("🌱", "Just getting started", "Log your first workout to unlock insights");
      return;
    }

    // favorite body part (all-time)
    var bpFreqAll = {};
    allKeys.forEach(function (key) {
      (entries[key].bodyParts || []).forEach(function (bp) {
        bpFreqAll[bp] = (bpFreqAll[bp] || 0) + 1;
      });
    });
    var favBodyPart = "—";
    var favBodyPartCount = 0;
    Object.keys(bpFreqAll).forEach(function (bp) {
      if (bpFreqAll[bp] > favBodyPartCount) { favBodyPartCount = bpFreqAll[bp]; favBodyPart = bp; }
    });
    addChip("🎯", favBodyPart, "Favorite Body Part");

    // favorite gym
    var personalCount = allKeys.filter(function (k) { return entries[k].gym === "Personal"; }).length;
    var officeCount = allKeys.filter(function (k) { return entries[k].gym === "Office"; }).length;
    var favGym = "It's a tie!";
    if (personalCount > officeCount) favGym = "Personal Gym";
    else if (officeCount > personalCount) favGym = "Office Gym";
    addChip("🏋️", favGym, "Favorite Gym");

    // busiest weekday
    var DOW_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    var dowFreq = [0, 0, 0, 0, 0, 0, 0];
    allKeys.forEach(function (key) { dowFreq[fromKey(key).getDay()]++; });
    var busiestDow = 0;
    for (var i = 1; i < 7; i++) { if (dowFreq[i] > dowFreq[busiestDow]) busiestDow = i; }
    addChip("📅", DOW_NAMES[busiestDow], "Most Active Day");

    // totals
    addChip("✅", allKeys.length, "Total Workouts Logged");

    var cardioSessions = allKeys.filter(function (k) { return !!entries[k].cardio; });
    var cardioMinsTotal = cardioSessions.reduce(function (sum, k) { return sum + (entries[k].cardio.duration || 0); }, 0);
    addChip("🏃", cardioMinsTotal, "Total Cardio Minutes");

    // weight change since first entry
    var weightKeys = Object.keys(weights).sort();
    if (weightKeys.length >= 2) {
      var delta = weights[weightKeys[weightKeys.length - 1]] - weights[weightKeys[0]];
      var deltaStr = (delta > 0 ? "+" : "") + delta.toFixed(1) + " kg";
      addChip("⚖️", deltaStr, "Weight Change Since Day One");
    }
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

  // ================= COACH TAB =================
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function wireSingleSelect(group, onSelect) {
    group.querySelectorAll(".choice-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        group.querySelectorAll(".choice-btn").forEach(function (b) { b.classList.remove("selected"); });
        btn.classList.add("selected");
        onSelect(btn.dataset.value);
      });
    });
  }

  var coachDifficultyGroup = document.getElementById("coachDifficultyGroup");
  var coachGoalGroup = document.getElementById("coachGoalGroup");
  var coachBodyPartGroup = document.getElementById("coachBodyPartGroup");
  var coachIntensityGroup = document.getElementById("coachIntensityGroup");
  var coachCardioToggle = document.getElementById("coachCardioToggle");
  var coachCardioPanel = document.getElementById("coachCardioPanel");
  var coachCardioTypeGroup = document.getElementById("coachCardioTypeGroup");
  var coachCardioDuration = document.getElementById("coachCardioDuration");
  var coachTime = document.getElementById("coachTime");
  var coachWarning = document.getElementById("coachWarning");
  var coachGenerateBtn = document.getElementById("coachGenerateBtn");
  var coachResultCard = document.getElementById("coachResultCard");
  var coachResultTitle = document.getElementById("coachResultTitle");
  var coachResultMeta = document.getElementById("coachResultMeta");
  var coachExerciseList = document.getElementById("coachExerciseList");
  var coachCardioBlock = document.getElementById("coachCardioBlock");
  var coachShuffleBtn = document.getElementById("coachShuffleBtn");
  var coachLogBtn = document.getElementById("coachLogBtn");

  var coachDifficulty = null, coachGoal = null, coachIntensity = null;
  var coachBodyParts = [];
  var coachCardioOn = false, coachCardioType = null;
  var lastCoachPlan = null, lastCoachSettings = null;

  wireSingleSelect(coachDifficultyGroup, function (v) { coachDifficulty = v; });
  wireSingleSelect(coachGoalGroup, function (v) { coachGoal = v; });
  wireSingleSelect(coachIntensityGroup, function (v) { coachIntensity = v; });
  wireSingleSelect(coachCardioTypeGroup, function (v) { coachCardioType = v; });

  coachBodyPartGroup.querySelectorAll(".choice-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var val = btn.dataset.value;
      var idx = coachBodyParts.indexOf(val);
      if (idx > -1) {
        coachBodyParts.splice(idx, 1);
        btn.classList.remove("selected");
      } else {
        if (coachBodyParts.length >= 2) {
          var removed = coachBodyParts.shift();
          coachBodyPartGroup.querySelectorAll(".choice-btn").forEach(function (b) {
            if (b.dataset.value === removed) b.classList.remove("selected");
          });
        }
        coachBodyParts.push(val);
        btn.classList.add("selected");
      }
    });
  });

  coachCardioToggle.addEventListener("change", function () {
    coachCardioOn = coachCardioToggle.checked;
    coachCardioPanel.classList.toggle("hidden", !coachCardioOn);
  });

  function pickExercises(bodyParts, difficulty, count) {
    var pools = {};
    bodyParts.forEach(function (bp) {
      var list = ((EXERCISE_TIERS[bp] && EXERCISE_TIERS[bp][difficulty]) || []).slice();
      for (var i = list.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = list[i]; list[i] = list[j]; list[j] = tmp;
      }
      pools[bp] = list;
    });
    var result = [];
    var bpIndex = 0;
    while (result.length < count) {
      var anyLeft = bodyParts.some(function (bp) { return pools[bp].length; });
      if (!anyLeft) break;
      var bp = bodyParts[bpIndex % bodyParts.length];
      if (pools[bp].length) {
        result.push({ name: pools[bp].shift(), bodyPart: bp });
      }
      bpIndex++;
    }
    return result;
  }

  function computeCoachPlan(settings) {
    var goalCfg = GOALS[settings.goal];
    var adj = INTENSITY_ADJUST[settings.intensity];
    var sets = clamp(goalCfg.sets + adj.setsDelta, 2, 6);
    var restSec = clamp(goalCfg.restSec + adj.restDelta, 15, 150);
    var reps = goalCfg.reps;

    var cardioMinutes = settings.cardioOn ? (settings.cardioDuration || 15) : 0;
    var strengthMinutes = Math.max(5, settings.totalTime - cardioMinutes);

    var perExerciseMin = sets * (restSec + reps * 3) / 60;
    var rawCount = strengthMinutes / perExerciseMin;
    var countPerBodyPart = clamp(Math.round(rawCount / settings.bodyParts.length), 1, 4);
    var totalCount = countPerBodyPart * settings.bodyParts.length;

    var exercises = pickExercises(settings.bodyParts, settings.difficulty, totalCount).map(function (ex) {
      return { name: ex.name, bodyPart: ex.bodyPart, sets: sets, reps: reps, restSec: restSec };
    });

    var estimatedStrengthMin = Math.round(exercises.length * perExerciseMin);

    return {
      exercises: exercises,
      cardio: settings.cardioOn ? { type: settings.cardioType, duration: cardioMinutes } : null,
      estimatedStrengthMin: estimatedStrengthMin,
      estimatedTotal: estimatedStrengthMin + cardioMinutes
    };
  }

  function validateCoachSettings(settings) {
    if (!settings.difficulty) return "Pick an exercise level.";
    if (!settings.totalTime || settings.totalTime < 10) return "Enter a total workout time of at least 10 minutes.";
    if (!settings.goal) return "Pick a goal.";
    if (!settings.bodyParts.length) return "Pick at least one body part.";
    if (!settings.intensity) return "Pick an intensity.";
    if (settings.cardioOn && (!settings.cardioType || !settings.cardioDuration)) {
      return "Pick a cardio type and duration, or turn cardio off.";
    }
    return null;
  }

  function renderCoachResult(plan, settings) {
    coachResultCard.classList.remove("hidden");
    coachResultTitle.textContent = settings.totalTime + "-min " + settings.difficulty + " workout — " + settings.goal;
    coachResultMeta.textContent = settings.bodyParts.join(" + ") + " · " + settings.intensity + " intensity · ~" + plan.estimatedTotal + " min total";
    coachExerciseList.innerHTML = "";
    plan.exercises.forEach(function (ex) {
      var row = document.createElement("div");
      row.className = "coach-exercise-row";
      row.innerHTML =
        '<div class="ce-tag">' + escapeHtml(ex.bodyPart) + '</div>' +
        '<div class="ce-name">' + escapeHtml(ex.name) + '</div>' +
        '<div class="ce-meta">' + ex.sets + ' sets × ' + ex.reps + ' reps · ' + ex.restSec + 's rest</div>';
      coachExerciseList.appendChild(row);
    });
    if (plan.cardio) {
      coachCardioBlock.classList.remove("hidden");
      coachCardioBlock.innerHTML = '<b>' + escapeHtml(plan.cardio.type) + '</b> — ' + plan.cardio.duration + ' min · ' + escapeHtml(settings.intensity) + ' intensity';
    } else {
      coachCardioBlock.classList.add("hidden");
      coachCardioBlock.innerHTML = "";
    }
    lastCoachPlan = plan;
    lastCoachSettings = settings;
  }

  coachGenerateBtn.addEventListener("click", function () {
    var settings = {
      difficulty: coachDifficulty,
      totalTime: Number(coachTime.value),
      goal: coachGoal,
      bodyParts: coachBodyParts.slice(),
      intensity: coachIntensity,
      cardioOn: coachCardioOn,
      cardioType: coachCardioType,
      cardioDuration: coachCardioDuration.value ? Number(coachCardioDuration.value) : null
    };
    var warning = validateCoachSettings(settings);
    if (warning) {
      coachWarning.textContent = warning;
      coachWarning.classList.remove("hidden");
      return;
    }
    coachWarning.classList.add("hidden");
    var plan = computeCoachPlan(settings);
    renderCoachResult(plan, settings);
    saveJSON(COACH_SETTINGS_KEY, settings);
  });

  coachShuffleBtn.addEventListener("click", function () {
    if (!lastCoachSettings) return;
    var plan = computeCoachPlan(lastCoachSettings);
    renderCoachResult(plan, lastCoachSettings);
  });

  coachLogBtn.addEventListener("click", function () {
    if (!lastCoachPlan) return;
    logDate.value = todayKey();
    resetLogForm(true);
    var bodyPartsUsed = [];
    lastCoachPlan.exercises.forEach(function (ex) {
      if (bodyPartsUsed.indexOf(ex.bodyPart) === -1) bodyPartsUsed.push(ex.bodyPart);
    });
    bodyPartGroup.querySelectorAll(".choice-btn").forEach(function (b) {
      if (bodyPartsUsed.indexOf(b.dataset.value) > -1) b.click();
    });
    if (lastCoachPlan.cardio) {
      cardioToggle.checked = true;
      cardioToggle.dispatchEvent(new Event("change"));
      cardioTypeGroup.querySelectorAll(".choice-btn").forEach(function (b) {
        if (b.dataset.value === lastCoachPlan.cardio.type) b.click();
      });
      cardioDuration.value = lastCoachPlan.cardio.duration;
      var effortGuess = lastCoachSettings.intensity === "Light" ? 3 : (lastCoachSettings.intensity === "High" ? 9 : 6);
      cardioEffort.value = effortGuess;
      cardioEffort.dispatchEvent(new Event("input"));
    }
    document.querySelector('.tab-btn[data-tab="log"]').click();
  });

  function restoreCoachSettings() {
    var saved = loadJSON(COACH_SETTINGS_KEY, null);
    if (!saved) return;
    if (saved.difficulty) {
      coachDifficulty = saved.difficulty;
      coachDifficultyGroup.querySelectorAll(".choice-btn").forEach(function (b) {
        b.classList.toggle("selected", b.dataset.value === saved.difficulty);
      });
    }
    if (saved.totalTime) coachTime.value = saved.totalTime;
    if (saved.goal) {
      coachGoal = saved.goal;
      coachGoalGroup.querySelectorAll(".choice-btn").forEach(function (b) {
        b.classList.toggle("selected", b.dataset.value === saved.goal);
      });
    }
    if (saved.bodyParts && saved.bodyParts.length) {
      coachBodyParts = saved.bodyParts.slice();
      coachBodyPartGroup.querySelectorAll(".choice-btn").forEach(function (b) {
        b.classList.toggle("selected", coachBodyParts.indexOf(b.dataset.value) > -1);
      });
    }
    if (saved.intensity) {
      coachIntensity = saved.intensity;
      coachIntensityGroup.querySelectorAll(".choice-btn").forEach(function (b) {
        b.classList.toggle("selected", b.dataset.value === saved.intensity);
      });
    }
    if (saved.cardioOn) {
      coachCardioOn = true;
      coachCardioToggle.checked = true;
      coachCardioPanel.classList.remove("hidden");
      if (saved.cardioType) {
        coachCardioType = saved.cardioType;
        coachCardioTypeGroup.querySelectorAll(".choice-btn").forEach(function (b) {
          b.classList.toggle("selected", b.dataset.value === saved.cardioType);
        });
      }
      if (saved.cardioDuration) coachCardioDuration.value = saved.cardioDuration;
    }
  }

  // ================= EAT OUT TAB =================
  var eatoutDate = document.getElementById("eatoutDate");
  var eatoutTypeGroup = document.getElementById("eatoutTypeGroup");
  var eatoutOutFields = document.getElementById("eatoutOutFields");
  var eatoutHomeFields = document.getElementById("eatoutHomeFields");
  var eatoutDishGroup = document.getElementById("eatoutDishGroup");
  var eatoutDishOther = document.getElementById("eatoutDishOther");
  var eatoutCuisineGroup = document.getElementById("eatoutCuisineGroup");
  var eatoutMealGroup = document.getElementById("eatoutMealGroup");
  var eatoutCost = document.getElementById("eatoutCost");
  var eatoutHomeNotes = document.getElementById("eatoutHomeNotes");
  var eatoutWarning = document.getElementById("eatoutWarning");
  var eatoutSaveBtn = document.getElementById("eatoutSaveBtn");
  var eatoutRingFg = document.getElementById("eatoutRingFg");
  var eatoutScoreVal = document.getElementById("eatoutScoreVal");
  var eatoutScoreSub = document.getElementById("eatoutScoreSub");
  var eatoutInsightsEl = document.getElementById("eatoutInsights");
  var eatoutTrendEl = document.getElementById("eatoutTrend");
  var eatoutHistoryEl = document.getElementById("eatoutHistory");

  eatoutDate.value = todayKey();
  var selectedLogType = null;
  var selectedMealType = null;
  var selectedDishes = [];
  var selectedCuisines = [];

  wireSingleSelect(eatoutTypeGroup, function (v) {
    selectedLogType = v;
    eatoutOutFields.classList.toggle("hidden", v !== "eatout");
    eatoutHomeFields.classList.toggle("hidden", v !== "home");
    eatoutSaveBtn.textContent = v === "home" ? "Log Home-Made Meal" : "Log Meal Out";
  });
  wireSingleSelect(eatoutMealGroup, function (v) { selectedMealType = v; });

  function wireMultiSelect(group, arrRef) {
    group.querySelectorAll(".choice-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var val = btn.dataset.value;
        var idx = arrRef.indexOf(val);
        if (idx > -1) {
          arrRef.splice(idx, 1);
          btn.classList.remove("selected");
        } else {
          arrRef.push(val);
          btn.classList.add("selected");
        }
      });
    });
  }
  wireMultiSelect(eatoutDishGroup, selectedDishes);
  wireMultiSelect(eatoutCuisineGroup, selectedCuisines);

  // records before this feature only ever represented an eat-out, so a missing
  // type means "eatout" — keeps old saved data working under the new schema
  function getType(r) { return r.type || "eatout"; }
  function getDishesOf(r) {
    if (r.dishes && r.dishes.length) return r.dishes;
    if (r.dish) return [r.dish];
    return [];
  }
  function getCuisinesOf(r) {
    return r.cuisines || [];
  }

  function resetEatoutForm() {
    eatoutDate.value = todayKey();
    selectedLogType = null;
    eatoutTypeGroup.querySelectorAll(".choice-btn").forEach(function (b) { b.classList.remove("selected"); });
    eatoutOutFields.classList.remove("hidden");
    eatoutHomeFields.classList.add("hidden");
    eatoutSaveBtn.textContent = "Log Meal Out";
    selectedDishes.length = 0;
    selectedCuisines.length = 0;
    eatoutDishGroup.querySelectorAll(".choice-btn").forEach(function (b) { b.classList.remove("selected"); });
    eatoutCuisineGroup.querySelectorAll(".choice-btn").forEach(function (b) { b.classList.remove("selected"); });
    eatoutDishOther.value = "";
    eatoutHomeNotes.value = "";
    selectedMealType = null;
    eatoutMealGroup.querySelectorAll(".choice-btn").forEach(function (b) { b.classList.remove("selected"); });
    eatoutCost.value = "";
    eatoutWarning.classList.add("hidden");
  }

  eatoutSaveBtn.addEventListener("click", function () {
    if (!selectedLogType) {
      eatoutWarning.textContent = "Pick whether you ate out or had home-made food.";
      eatoutWarning.classList.remove("hidden");
      return;
    }

    var record = {
      id: Date.now() + "-" + Math.random().toString(36).slice(2, 8),
      date: eatoutDate.value || todayKey(),
      type: selectedLogType,
      mealType: selectedMealType,
      dishes: [],
      cuisines: [],
      cost: null,
      notes: ""
    };

    if (selectedLogType === "eatout") {
      var customDishes = eatoutDishOther.value
        .split(",")
        .map(function (s) { return s.trim(); })
        .filter(function (s) { return s.length; });
      record.dishes = selectedDishes.concat(customDishes);
      record.cuisines = selectedCuisines.slice();
      record.cost = eatoutCost.value ? Number(eatoutCost.value) : null;
      if (!record.dishes.length && !record.cuisines.length) {
        eatoutWarning.textContent = "Pick at least one dish or cuisine, or type one in.";
        eatoutWarning.classList.remove("hidden");
        return;
      }
    } else {
      record.notes = eatoutHomeNotes.value.trim();
    }

    eatoutWarning.classList.add("hidden");
    eatouts.push(record);
    saveEatouts();
    resetEatoutForm();
    renderEatoutTab();
  });

  // "home-cooked streak" = consecutive days with no eat-out logged. An explicit
  // home-made log is a bonus/positive signal but isn't required for a day to count.
  function computeHomeCookedStreak() {
    if (!eatouts.length) return null;
    var eatoutDateSet = {};
    eatouts.forEach(function (r) { if (getType(r) === "eatout") eatoutDateSet[r.date] = true; });
    if (eatoutDateSet[todayKey()]) return 0;
    var allDates = eatouts.map(function (r) { return r.date; }).sort();
    var earliest = fromKey(allDates[0]);
    var streak = 0;
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - 1);
    while (d >= earliest) {
      if (eatoutDateSet[toKey(d)]) break;
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }

  function computeBestHomeCookedStreak(current) {
    var eatoutDates = Array.from(new Set(
      eatouts.filter(function (r) { return getType(r) === "eatout"; }).map(function (r) { return r.date; })
    )).sort();
    var best = 0;
    for (var i = 1; i < eatoutDates.length; i++) {
      var gap = Math.round((fromKey(eatoutDates[i]) - fromKey(eatoutDates[i - 1])) / 86400000) - 1;
      if (gap > best) best = gap;
    }
    if (current !== null && current > best) best = current;
    return best;
  }

  // "eating-out streak" = consecutive days up to today where an eat-out was logged.
  // Returns 0 when there's no eat-out today, since the streak only matters while active.
  function computeEatingOutStreak() {
    var dateSet = {};
    eatouts.forEach(function (r) { if (getType(r) === "eatout") dateSet[r.date] = true; });
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    if (!dateSet[toKey(d)]) return 0;
    var streak = 0;
    while (dateSet[toKey(d)]) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }

  // Weekly score: each day so far this week scores 100 (home-made or no eat-out
  // logged — benefit of the doubt), 50 (both logged the same day), or 0 (ate out
  // with no home-made meal that day). Averaged over the days elapsed this week.
  function computeWeeklyScore() {
    var weekStart = startOfWeek(new Date());
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var daysElapsed = Math.round((today - weekStart) / 86400000) + 1;
    var total = 0;
    for (var i = 0; i < daysElapsed; i++) {
      var d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      var key = toKey(d);
      var hasHome = eatouts.some(function (r) { return r.date === key && getType(r) === "home"; });
      var hasOut = eatouts.some(function (r) { return r.date === key && getType(r) === "eatout"; });
      if (hasOut && hasHome) total += 50;
      else if (hasOut) total += 0;
      else total += 100;
    }
    return Math.round(total / daysElapsed);
  }

  function renderEatoutMeter() {
    var pct = computeWeeklyScore();
    eatoutScoreVal.textContent = pct + "%";
    var circumference = 2 * Math.PI * 52;
    eatoutRingFg.style.strokeDasharray = circumference;
    eatoutRingFg.style.strokeDashoffset = circumference - (circumference * pct) / 100;
    var color, msg;
    if (pct >= 85) { color = "var(--accent)"; msg = "🌿 Clean week — mostly home-cooked! Keep it up."; }
    else if (pct >= 50) { color = "var(--office)"; msg = "👍 Balanced week — a treat here and there is fine."; }
    else { color = "var(--danger)"; msg = "🍽️ Lots of eating out this week — maybe cook one meal tomorrow?"; }
    eatoutRingFg.style.stroke = color;
    eatoutScoreSub.textContent = msg;
  }

  function renderEatoutInsights() {
    eatoutInsightsEl.innerHTML = "";
    function chip(emoji, value, label, warn) {
      var el = document.createElement("div");
      el.className = "insight-chip" + (warn ? " warn" : "");
      el.innerHTML =
        '<span class="ic-emoji">' + emoji + '</span>' +
        '<span class="ic-value">' + escapeHtml(String(value)) + '</span>' +
        '<span class="ic-label">' + escapeHtml(label) + '</span>';
      eatoutInsightsEl.appendChild(el);
    }

    if (!eatouts.length) {
      chip("🏠", "No data yet", "Log a meal to unlock insights");
      return;
    }

    var eatoutEntries = eatouts.filter(function (r) { return getType(r) === "eatout"; });
    var homeEntries = eatouts.filter(function (r) { return getType(r) === "home"; });

    var weekStart = startOfWeek(new Date());
    var weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
    var lastWeekStart = new Date(weekStart); lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    var thisWeekCount = eatoutEntries.filter(function (r) { var d = fromKey(r.date); return d >= weekStart && d < weekEnd; }).length;
    var lastWeekCount = eatoutEntries.filter(function (r) { var d = fromKey(r.date); return d >= lastWeekStart && d < weekStart; }).length;
    var homeThisWeek = homeEntries.filter(function (r) { var d = fromKey(r.date); return d >= weekStart && d < weekEnd; }).length;
    var deltaWeek = thisWeekCount - lastWeekCount;
    var trendEmoji = deltaWeek <= 0 ? "📉" : "📈";
    var trendText = deltaWeek < 0 ? ("Down " + Math.abs(deltaWeek)) : deltaWeek > 0 ? ("Up " + deltaWeek) : "Same";

    // the good stuff first
    var streak = computeHomeCookedStreak();
    chip("🏠", streak === null ? "—" : streak, "Home-Cooked Streak");
    chip("🏆", computeBestHomeCookedStreak(streak), "Best Home-Cooked Streak");
    chip("🍲", homeThisWeek, "Home-Made This Week");

    // the cautionary stuff
    chip("🍽️", thisWeekCount, "Meals Out This Week");
    chip(trendEmoji, trendText, "Vs Last Week");
    var orderingStreak = computeEatingOutStreak();
    if (orderingStreak > 0) {
      chip("⚠️", orderingStreak + (orderingStreak === 1 ? " day" : " days"), "Ordering Streak — break it today!", true);
    }

    var freq = {};
    eatoutEntries.forEach(function (r) {
      getDishesOf(r).forEach(function (dish) { freq[dish] = (freq[dish] || 0) + 1; });
    });
    var favDish = "—", favCount = 0;
    Object.keys(freq).forEach(function (dish) { if (freq[dish] > favCount) { favCount = freq[dish]; favDish = dish; } });
    if (favCount > 0) chip("⭐", favDish, "Most Ordered");

    var cuisineFreq = {};
    eatoutEntries.forEach(function (r) {
      getCuisinesOf(r).forEach(function (c) { cuisineFreq[c] = (cuisineFreq[c] || 0) + 1; });
    });
    var favCuisine = null, favCuisineCount = 0;
    Object.keys(cuisineFreq).forEach(function (c) { if (cuisineFreq[c] > favCuisineCount) { favCuisineCount = cuisineFreq[c]; favCuisine = c; } });
    if (favCuisine) chip("🌍", favCuisine, "Favorite Cuisine");

    var now = new Date();
    var spentThisMonth = eatoutEntries.reduce(function (sum, r) {
      var d = fromKey(r.date);
      if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && r.cost) return sum + r.cost;
      return sum;
    }, 0);
    if (spentThisMonth > 0) chip("💸", "₹" + spentThisMonth, "Spent This Month");
  }

  function renderEatoutTrend() {
    eatoutTrendEl.innerHTML = "";
    var eatoutEntries = eatouts.filter(function (r) { return getType(r) === "eatout"; });
    var weeks = [];
    for (var i = 7; i >= 0; i--) {
      var ws = startOfWeek(new Date());
      ws.setDate(ws.getDate() - i * 7);
      var we = new Date(ws); we.setDate(we.getDate() + 7);
      var count = eatoutEntries.filter(function (r) { var d = fromKey(r.date); return d >= ws && d < we; }).length;
      weeks.push({ start: ws, count: count });
    }
    var maxCount = Math.max.apply(null, weeks.map(function (w) { return w.count; }).concat([1]));
    weeks.forEach(function (w) {
      var col = document.createElement("div");
      col.className = "week-day";
      var bar = document.createElement("div");
      bar.className = "bar";
      var fill = document.createElement("div");
      fill.className = "bar-fill";
      fill.style.height = (w.count / maxCount) * 100 + "%";
      fill.style.background = "var(--cardio)";
      bar.appendChild(fill);
      var lbl = document.createElement("div");
      lbl.className = "lbl";
      lbl.textContent = w.start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      col.appendChild(bar);
      col.appendChild(lbl);
      eatoutTrendEl.appendChild(col);
    });
  }

  function renderEatoutHistory() {
    eatoutHistoryEl.innerHTML = "";
    if (!eatouts.length) {
      var eh = document.createElement("div");
      eh.className = "weight-empty-history";
      eh.textContent = "No meals logged yet.";
      eatoutHistoryEl.appendChild(eh);
      return;
    }
    var sorted = eatouts.slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return 0;
    });
    sorted.forEach(function (r) {
      var isHome = getType(r) === "home";
      var label;
      if (isHome) {
        label = "🏠 Home-Made" + (r.notes ? " — " + r.notes : "");
      } else {
        var dishes = getDishesOf(r);
        var cuisines = getCuisinesOf(r);
        label = dishes.join(" + ");
        if (cuisines.length) label += (label ? " " : "") + "(" + cuisines.join(", ") + ")";
        if (!label) label = "Ate out";
      }

      var row = document.createElement("div");
      row.className = "weight-history-row";
      var left = document.createElement("span");
      left.className = "wh-date";
      left.textContent = fromKey(r.date).toDateString() + (r.mealType ? " · " + r.mealType : "");
      var mid = document.createElement("span");
      mid.className = "wh-val";
      mid.textContent = label + (r.cost ? " · ₹" + r.cost : "");
      var delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "wh-del";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", function () {
        if (!confirm("Delete this entry (" + label + ")?")) return;
        eatouts = eatouts.filter(function (x) { return x.id !== r.id; });
        saveEatouts();
        renderEatoutTab();
      });
      row.appendChild(left);
      row.appendChild(mid);
      row.appendChild(delBtn);
      eatoutHistoryEl.appendChild(row);
    });
  }

  function renderEatoutTab() {
    renderEatoutMeter();
    renderEatoutInsights();
    renderEatoutTrend();
    renderEatoutHistory();
  }

  // ================= INIT =================
  loadEntryIntoForm(todayKey());
  updateHeaderStreak();
  renderGreeting();
  restoreCoachSettings();
})();
