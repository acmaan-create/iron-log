import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const DEFAULT_CATEGORIES = [
  { name: "Personal", color: "#6c5ce7" },
  { name: "Work", color: "#0984e3" },
  { name: "Shopping", color: "#e17055" },
  { name: "Gym", color: "#00b894" },
  { name: "Errands", color: "#fdcb6e" },
];

let currentUser = null;
let tasks = [];
let categories = [];
let unsubTasks = null;
let unsubCategories = null;

let activeFilter = "all";
let activeCategoryFilter = null;
let searchTerm = "";
let editingTaskId = null;

// ---------- Element refs ----------
const el = (id) => document.getElementById(id);

const authScreen = el("authScreen");
const appScreen = el("appScreen");
const authForm = el("authForm");
const authEmail = el("authEmail");
const authPassword = el("authPassword");
const authError = el("authError");
const authSubmitBtn = el("authSubmitBtn");
const authToggleModeBtn = el("authToggleModeBtn");
const authResetBtn = el("authResetBtn");

const userEmailLabel = el("userEmailLabel");
const themeToggleBtn = el("themeToggleBtn");
const logoutBtn = el("logoutBtn");

const quickAddForm = el("quickAddForm");
const quickAddInput = el("quickAddInput");
const quickAddCategory = el("quickAddCategory");
const quickAddDate = el("quickAddDate");
const quickAddTime = el("quickAddTime");
const quickAddPriority = el("quickAddPriority");
const micBtn = el("micBtn");
const micStatus = el("micStatus");

const filterTabs = el("filterTabs");
const categoryChipRow = el("categoryChipRow");
const searchInput = el("searchInput");
const manageCategoriesBtn = el("manageCategoriesBtn");

const taskCounts = el("taskCounts");
const taskListEl = el("taskList");
const emptyState = el("emptyState");
const syncStatus = el("syncStatus");

const taskModal = el("taskModal");
const taskModalForm = el("taskModalForm");
const modalTitle = el("modalTitle");
const modalNotes = el("modalNotes");
const modalMicBtn = el("modalMicBtn");
const modalCategory = el("modalCategory");
const modalPriority = el("modalPriority");
const modalDate = el("modalDate");
const modalTime = el("modalTime");
const modalReminder = el("modalReminder");
const modalDeleteBtn = el("modalDeleteBtn");
const modalCancelBtn = el("modalCancelBtn");

const categoryModal = el("categoryModal");
const categoryManageList = el("categoryManageList");
const addCategoryForm = el("addCategoryForm");
const newCategoryName = el("newCategoryName");
const newCategoryColor = el("newCategoryColor");
const categoryModalCloseBtn = el("categoryModalCloseBtn");

let isSignUpMode = false;

// ---------- Theme ----------
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeToggleBtn.textContent = theme === "dark" ? "☀️" : "🌙";
}
applyTheme(localStorage.getItem("taskpilot-theme") || "light");

themeToggleBtn.addEventListener("click", () => {
  const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  localStorage.setItem("taskpilot-theme", next);
  applyTheme(next);
});

// ---------- Auth ----------
authToggleModeBtn.addEventListener("click", () => {
  isSignUpMode = !isSignUpMode;
  authSubmitBtn.textContent = isSignUpMode ? "Sign up" : "Log in";
  authToggleModeBtn.textContent = isSignUpMode ? "Already have an account? Log in" : "Need an account? Sign up";
  authError.classList.add("hidden");
});

authResetBtn.addEventListener("click", async () => {
  const emailVal = authEmail.value.trim();
  if (!emailVal) {
    showAuthError("Enter your email above first, then tap 'Forgot password?'");
    return;
  }
  try {
    await sendPasswordResetEmail(auth, emailVal);
    showAuthError("Password reset email sent. Check your inbox.", true);
  } catch (err) {
    showAuthError(friendlyAuthError(err));
  }
});

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const emailVal = authEmail.value.trim();
  const passVal = authPassword.value;
  authSubmitBtn.disabled = true;
  try {
    if (isSignUpMode) {
      await createUserWithEmailAndPassword(auth, emailVal, passVal);
    } else {
      await signInWithEmailAndPassword(auth, emailVal, passVal);
    }
  } catch (err) {
    showAuthError(friendlyAuthError(err));
  } finally {
    authSubmitBtn.disabled = false;
  }
});

logoutBtn.addEventListener("click", () => signOut(auth));

function showAuthError(msg, isSuccess = false) {
  authError.textContent = msg;
  authError.style.color = isSuccess ? "var(--success)" : "var(--danger)";
  authError.classList.remove("hidden");
}

function friendlyAuthError(err) {
  const code = err.code || "";
  if (code.includes("email-already-in-use")) return "That email already has an account. Try logging in.";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found"))
    return "Incorrect email or password.";
  if (code.includes("weak-password")) return "Password must be at least 6 characters.";
  if (code.includes("invalid-email")) return "That email address doesn't look right.";
  return err.message || "Something went wrong. Please try again.";
}

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    authScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");
    userEmailLabel.textContent = user.email;
    userEmailLabel.title = user.email;
    await ensureDefaultCategories();
    subscribeToCategories();
    subscribeToTasks();
    requestNotificationPermission();
    registerServiceWorker();
  } else {
    authScreen.classList.remove("hidden");
    appScreen.classList.add("hidden");
    if (unsubTasks) unsubTasks();
    if (unsubCategories) unsubCategories();
    tasks = [];
    categories = [];
  }
});

// ---------- Firestore paths ----------
function userTasksCol() {
  return collection(db, "users", currentUser.uid, "tasks");
}
function userCategoriesCol() {
  return collection(db, "users", currentUser.uid, "categories");
}

async function ensureDefaultCategories() {
  const snap = await getDocs(userCategoriesCol());
  if (!snap.empty) return;
  for (const c of DEFAULT_CATEGORIES) {
    await addDoc(userCategoriesCol(), { ...c, createdAt: serverTimestamp() });
  }
}

function subscribeToCategories() {
  if (unsubCategories) unsubCategories();
  unsubCategories = onSnapshot(query(userCategoriesCol(), orderBy("createdAt", "asc")), (snap) => {
    categories = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderCategorySelects();
    renderCategoryChips();
    renderCategoryManageList();
    renderTasks();
  });
}

function subscribeToTasks() {
  if (unsubTasks) unsubTasks();
  syncStatus.textContent = "Syncing…";
  unsubTasks = onSnapshot(
    query(userTasksCol(), orderBy("createdAt", "desc")),
    (snap) => {
      tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderTasks();
      syncStatus.textContent = `Synced • ${new Date().toLocaleTimeString()}`;
    },
    (err) => {
      syncStatus.textContent = "Sync error: " + err.message;
    }
  );
}

// ---------- Categories UI ----------
function renderCategorySelects() {
  for (const sel of [quickAddCategory, modalCategory]) {
    const prevVal = sel.value;
    sel.innerHTML = '<option value="">No category</option>';
    for (const c of categories) {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      sel.appendChild(opt);
    }
    if (prevVal) sel.value = prevVal;
  }
}

function renderCategoryChips() {
  categoryChipRow.innerHTML = "";
  const allChip = makeChip("All", null, "#999999");
  categoryChipRow.appendChild(allChip);
  for (const c of categories) {
    categoryChipRow.appendChild(makeChip(c.name, c.id, c.color));
  }
}

function makeChip(label, catId, color) {
  const btn = document.createElement("button");
  btn.className = "category-chip" + (activeCategoryFilter === catId ? " active" : "");
  if (activeCategoryFilter === catId) btn.style.background = color;
  btn.innerHTML = `<span class="chip-dot" style="background:${color}"></span>${escapeHtml(label)}`;
  btn.addEventListener("click", () => {
    activeCategoryFilter = catId;
    renderCategoryChips();
    renderTasks();
  });
  return btn;
}

function renderCategoryManageList() {
  categoryManageList.innerHTML = "";
  if (!categories.length) {
    categoryManageList.innerHTML = '<li style="color:var(--text-muted);font-size:13px;">No categories yet.</li>';
    return;
  }
  for (const c of categories) {
    const li = document.createElement("li");
    li.className = "category-manage-item";
    li.innerHTML = `<span class="chip-dot" style="background:${c.color}"></span><span class="name">${escapeHtml(c.name)}</span>`;
    const delBtn = document.createElement("button");
    delBtn.textContent = "✕";
    delBtn.title = "Delete category";
    delBtn.addEventListener("click", () => deleteCategory(c.id));
    li.appendChild(delBtn);
    categoryManageList.appendChild(li);
  }
}

manageCategoriesBtn.addEventListener("click", () => categoryModal.classList.remove("hidden"));
categoryModalCloseBtn.addEventListener("click", () => categoryModal.classList.add("hidden"));

addCategoryForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = newCategoryName.value.trim();
  if (!name) return;
  await addDoc(userCategoriesCol(), {
    name,
    color: newCategoryColor.value,
    createdAt: serverTimestamp(),
  });
  newCategoryName.value = "";
});

async function deleteCategory(catId) {
  const affected = tasks.filter((t) => t.category === catId);
  await Promise.all(affected.map((t) => updateDoc(doc(db, "users", currentUser.uid, "tasks", t.id), { category: "" })));
  await deleteDoc(doc(db, "users", currentUser.uid, "categories", catId));
  if (activeCategoryFilter === catId) activeCategoryFilter = null;
}

// ---------- Filters / search ----------
filterTabs.addEventListener("click", (e) => {
  const btn = e.target.closest(".filter-tab");
  if (!btn) return;
  activeFilter = btn.dataset.filter;
  [...filterTabs.children].forEach((b) => b.classList.toggle("active", b === btn));
  renderTasks();
});

searchInput.addEventListener("input", () => {
  searchTerm = searchInput.value.trim().toLowerCase();
  renderTasks();
});

// ---------- Task rendering ----------
function categoryById(id) {
  return categories.find((c) => c.id === id);
}

function taskDueDateTime(t) {
  if (!t.dueDate) return null;
  return new Date(`${t.dueDate}T${t.dueTime || "23:59"}`);
}

function isOverdue(t) {
  if (t.completed) return false;
  const dt = taskDueDateTime(t);
  return dt && dt.getTime() < Date.now();
}

function isToday(t) {
  if (!t.dueDate) return false;
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return t.dueDate === todayStr;
}

function isUpcoming(t) {
  if (!t.dueDate) return false;
  const dt = taskDueDateTime(t);
  return dt && dt.getTime() > Date.now() && !isToday(t);
}

function passesFilter(t) {
  if (activeFilter === "today") return isToday(t) && !t.completed;
  if (activeFilter === "upcoming") return isUpcoming(t) && !t.completed;
  if (activeFilter === "overdue") return isOverdue(t);
  if (activeFilter === "completed") return !!t.completed;
  return !t.completed; // "all" = all open tasks
}

function renderTasks() {
  let visible = tasks.filter((t) => {
    if (activeCategoryFilter && t.category !== activeCategoryFilter) return false;
    if (searchTerm) {
      const hay = `${t.title || ""} ${t.notes || ""}`.toLowerCase();
      if (!hay.includes(searchTerm)) return false;
    }
    return passesFilter(t);
  });

  visible.sort((a, b) => {
    const da = taskDueDateTime(a);
    const db_ = taskDueDateTime(b);
    if (da && db_) return da - db_;
    if (da) return -1;
    if (db_) return 1;
    return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
  });

  taskListEl.innerHTML = "";
  emptyState.classList.toggle("hidden", visible.length > 0);

  const total = tasks.length;
  const openCount = tasks.filter((t) => !t.completed).length;
  taskCounts.textContent = `${openCount} open • ${total} total`;

  for (const t of visible) {
    taskListEl.appendChild(renderTaskItem(t));
  }
}

function renderTaskItem(t) {
  const li = document.createElement("li");
  const overdue = isOverdue(t);
  li.className = "task-item" + (t.completed ? " completed" : "") + (overdue ? " overdue" : "");
  const cat = categoryById(t.category);
  li.style.borderLeftColor = cat ? cat.color : (overdue ? "var(--danger)" : "var(--accent)");

  const checkbox = document.createElement("button");
  checkbox.type = "button";
  checkbox.className = "task-checkbox" + (t.completed ? " checked" : "");
  checkbox.innerHTML = t.completed ? "✓" : "";
  checkbox.addEventListener("click", () => toggleComplete(t));

  const body = document.createElement("div");
  body.className = "task-body";
  body.addEventListener("click", () => openTaskModal(t));

  const title = document.createElement("div");
  title.className = "task-title";
  title.textContent = t.title;
  body.appendChild(title);

  if (t.notes) {
    const notes = document.createElement("div");
    notes.className = "task-notes";
    notes.textContent = t.notes;
    body.appendChild(notes);
  }

  const meta = document.createElement("div");
  meta.className = "task-meta";
  if (cat) {
    const catTag = makeTag(cat.name, "");
    catTag.insertAdjacentHTML("afterbegin", `<span class="chip-dot" style="background:${cat.color}"></span>`);
    meta.appendChild(catTag);
  }
  if (t.dueDate) {
    const dateLabel = t.dueTime ? `${t.dueDate} ${t.dueTime}` : t.dueDate;
    meta.appendChild(makeTag((overdue ? "⏰ " : "📅 ") + dateLabel, overdue ? "overdue-tag" : ""));
  }
  if (t.priority && t.priority !== "medium") {
    meta.appendChild(makeTag(t.priority === "high" ? "High priority" : "Low priority", `priority-${t.priority}`));
  }
  if (t.reminder) {
    meta.appendChild(makeTag("🔔", ""));
  }
  body.appendChild(meta);

  li.appendChild(checkbox);
  li.appendChild(body);
  return li;
}

function makeTag(text, extraClass) {
  const span = document.createElement("span");
  span.className = "task-tag " + (extraClass || "");
  span.textContent = text;
  return span;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- Task CRUD ----------
async function toggleComplete(t) {
  await updateDoc(doc(db, "users", currentUser.uid, "tasks", t.id), {
    completed: !t.completed,
    updatedAt: serverTimestamp(),
  });
}

quickAddForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = quickAddInput.value.trim();
  if (!title) return;
  await addDoc(userTasksCol(), {
    title,
    notes: "",
    category: quickAddCategory.value || "",
    priority: quickAddPriority.value,
    dueDate: quickAddDate.value || "",
    dueTime: quickAddTime.value || "",
    reminder: !!(quickAddDate.value && quickAddTime.value),
    completed: false,
    notified: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  quickAddInput.value = "";
  quickAddDate.value = "";
  quickAddTime.value = "";
  quickAddPriority.value = "medium";
  quickAddInput.focus();
});

function openTaskModal(t) {
  editingTaskId = t.id;
  modalTitle.value = t.title || "";
  modalNotes.value = t.notes || "";
  modalCategory.value = t.category || "";
  modalPriority.value = t.priority || "medium";
  modalDate.value = t.dueDate || "";
  modalTime.value = t.dueTime || "";
  modalReminder.checked = !!t.reminder;
  taskModal.classList.remove("hidden");
}

modalCancelBtn.addEventListener("click", () => taskModal.classList.add("hidden"));

taskModalForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!editingTaskId) return;
  await updateDoc(doc(db, "users", currentUser.uid, "tasks", editingTaskId), {
    title: modalTitle.value.trim(),
    notes: modalNotes.value.trim(),
    category: modalCategory.value || "",
    priority: modalPriority.value,
    dueDate: modalDate.value || "",
    dueTime: modalTime.value || "",
    reminder: modalReminder.checked,
    notified: false,
    updatedAt: serverTimestamp(),
  });
  taskModal.classList.add("hidden");
});

modalDeleteBtn.addEventListener("click", async () => {
  if (!editingTaskId) return;
  if (!confirm("Delete this task?")) return;
  await deleteDoc(doc(db, "users", currentUser.uid, "tasks", editingTaskId));
  taskModal.classList.add("hidden");
});

// ---------- Speech-to-text ----------
const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;

function setupMic(button, statusEl, onResult) {
  if (!SpeechRecognitionImpl) {
    button.disabled = true;
    button.title = "Voice input isn't supported in this browser (try Chrome)";
    return;
  }
  let recognizing = false;
  let recognition;

  button.addEventListener("click", () => {
    if (recognizing) {
      recognition.stop();
      return;
    }
    recognition = new SpeechRecognitionImpl();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      recognizing = true;
      button.classList.add("listening");
      if (statusEl) statusEl.classList.remove("hidden");
    };
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };
    recognition.onerror = () => {
      if (statusEl) statusEl.classList.add("hidden");
    };
    recognition.onend = () => {
      recognizing = false;
      button.classList.remove("listening");
      if (statusEl) statusEl.classList.add("hidden");
    };
    recognition.start();
  });
}

setupMic(micBtn, micStatus, (text) => {
  quickAddInput.value = text;
  quickAddInput.focus();
});

setupMic(modalMicBtn, null, (text) => {
  modalNotes.value = modalNotes.value ? `${modalNotes.value} ${text}` : text;
});

// ---------- Reminders / notifications ----------
function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

setInterval(async () => {
  if (!currentUser || !("Notification" in window) || Notification.permission !== "granted") return;
  const now = Date.now();
  for (const t of tasks) {
    if (t.completed || !t.reminder || t.notified || !t.dueDate) continue;
    const dt = taskDueDateTime(t);
    if (dt && dt.getTime() <= now) {
      new Notification("⏰ " + t.title, { body: t.notes || "Task is due now", tag: t.id });
      await updateDoc(doc(db, "users", currentUser.uid, "tasks", t.id), { notified: true });
    }
  }
}, 20000);
