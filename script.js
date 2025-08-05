// ---- LIVE STAR BACKGROUND ----
const canvas = document.getElementById('star-canvas');
const ctx = canvas.getContext('2d');
let stars = [];
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
function createStars() {
  stars = [];
  for (let i = 0; i < 120; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.4 + 0.5,
      speed: Math.random() * 0.2 + 0.05,
      opacity: Math.random() * 0.7 + 0.3,
      twinkle: Math.random() * 1.5 + 0.5
    });
  }
}
function drawStars() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const s of stars) {
    ctx.save();
    ctx.globalAlpha = s.opacity * (0.7 + 0.3 * Math.sin(Date.now() * 0.001 * s.twinkle));
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, 2 * Math.PI);
    ctx.fillStyle = '#fff';
    ctx.shadowColor = "#aeefff";
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();
    s.y += s.speed;
    if (s.y > canvas.height + 2) s.y = -2;
  }
  requestAnimationFrame(drawStars);
}
window.addEventListener('resize', () => {
  resizeCanvas();
  createStars();
});
resizeCanvas();
createStars();
drawStars();

// ---- BARCODE APP LOGIC ----
const barcodeForm = document.getElementById('barcodeForm');
const barcodeInput = document.getElementById('barcodeInput');
const barcodeList = document.getElementById('barcodeList');
const clearListBtn = document.getElementById('clearListBtn');
const downloadCsvBtn = document.getElementById('downloadCsvBtn');
const successSound = document.getElementById('success-sound');
const statusMsg = document.getElementById('statusMsg');
const noBarcodesMsg = document.getElementById('noBarcodesMsg');
const searchBar = document.getElementById('searchBar');
const currentDateEl = document.getElementById('currentDate');

let barcodes = JSON.parse(localStorage.getItem('barcodes') || "[]");

// Google Sheets Web App URL (your provided URL)
const GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbzQrShfwoTYV8t9zF7ECgFv0xnLPdozl3NhFXnm_w5zIPwBuWUQQEuCK9CVF4GCHZDE/exec";

// Date/time update
function updateCurrentDate() {
  currentDateEl.textContent = new Date().toLocaleString();
}
updateCurrentDate();
setInterval(updateCurrentDate, 1000);

// Render barcode list with search
function renderList(filter = "") {
  barcodeList.innerHTML = "";
  let filtered = barcodes;
  if (filter) {
    filtered = barcodes.filter(item => item.code.toLowerCase().includes(filter));
  }
  if (filtered.length === 0) {
    noBarcodesMsg.style.display = "block";
  } else {
    noBarcodesMsg.style.display = "none";
    filtered.forEach((item, idx) => {
      const li = document.createElement("li");
      li.className = "flex justify-between items-center bg-slate-700 p-2 rounded mb-1";
      li.innerHTML = `
        <span>${idx + 1}. <span class="font-mono">${item.code}</span>
        <span class="text-xs text-slate-400 ml-2">(${item.time})</span></span>
        <button class="text-red-400 hover:text-red-600 font-bold remove-btn" data-idx="${item.idx ?? idx}">&times;</button>
      `;
      barcodeList.appendChild(li);
    });
  }
}
renderList();

// Save to localStorage
function saveBarcodes() {
  localStorage.setItem('barcodes', JSON.stringify(barcodes));
}

// Send barcode to Google Sheets
function sendToGoogleSheets(barcode, time) {
  if (!GOOGLE_SHEETS_URL) return;
  fetch(GOOGLE_SHEETS_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ barcode, time })
  });
}

// Add barcode
barcodeForm.addEventListener('submit', e => {
  e.preventDefault();
  const code = barcodeInput.value.trim();
  if (!code) return;
  const exists = barcodes.some(b => b.code === code);
  if (exists) {
    showStatus("Barcode already exists!", "error");
    barcodeInput.value = "";
    return;
  }
  const ts = new Date();
  const entry = { code, time: ts.toLocaleString() };
  barcodes.push(entry);
  saveBarcodes();
  renderList(searchBar.value.trim().toLowerCase());
  barcodeInput.value = "";
  showStatus("Done", "success");
  // Play Apple Pay sound
  successSound.currentTime = 0;
  successSound.play();
  // Send to Google Sheets
  sendToGoogleSheets(entry.code, entry.time);
});

barcodeList.addEventListener('click', e => {
  if (e.target.classList.contains('remove-btn')) {
    const idx = parseInt(e.target.getAttribute('data-idx'));
    const code = barcodes[idx]?.code;
    Swal.fire({
      title: 'Remove barcode?',
      text: code,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, remove',
      cancelButtonText: 'Cancel'
    }).then(result => {
      if (result.isConfirmed) {
        barcodes.splice(idx, 1);
        saveBarcodes();
        renderList(searchBar.value.trim().toLowerCase());
        showStatus("Removed.", "success");
      }
    });
  }
});

clearListBtn.addEventListener('click', () => {
  if (barcodes.length === 0) {
    showStatus("No barcodes to clear.", "error");
    return;
  }
  Swal.fire({
    title: "Clear all barcodes?",
    text: "This will clear the barcode list (saved files are not removed).",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Yes, clear",
    cancelButtonText: "Cancel"
  }).then(result => {
    if (result.isConfirmed) {
      barcodes = [];
      saveBarcodes();
      renderList();
      showStatus("List cleared.", "success");
    }
  });
});

downloadCsvBtn.addEventListener('click', () => {
  if (barcodes.length === 0) {
    showStatus("No barcodes to download.", "error");
    return;
  }
  const csv = "data:text/csv;charset=utf-8," + barcodes.map(b => `"${b.code}","${b.time}"`).join("\n");
  const link = document.createElement("a");
  link.setAttribute("href", encodeURI(csv));
  link.setAttribute("download", "barcodes.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showStatus("CSV downloaded.", "success");
});

// Search bar
searchBar.addEventListener('input', () => {
  renderList(searchBar.value.trim().toLowerCase());
});

// Show status message
function showStatus(msg, type) {
  statusMsg.textContent = msg;
  statusMsg.className = `text-center text-xs mt-2 ${type === "error" ? "text-red-400" : "text-green-400"}`;
  setTimeout(() => { statusMsg.textContent = ""; }, 2000);
}