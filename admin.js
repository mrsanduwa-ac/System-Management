function getTodayYMD() {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

// Load from localStorage, fallback to []
function loadBarcodes() {
  let arr = [];
  try {
    // Try localStorage first
    const stored = localStorage.getItem("scannedBarcodes");
    if (stored) {
      arr = JSON.parse(stored);
    } else {
      // Fallback to sessionStorage
      const sessionStored = sessionStorage.getItem("scannedBarcodes");
      if (sessionStored) {
        arr = JSON.parse(sessionStored);
      }
    }
  } catch (e) { 
    console.error('Failed to load barcodes:', e);
    arr = []; 
  }
  // Upgrade for any legacy string format
  return arr.map(b => typeof b === "string"
    ? { code: b, date: getTodayYMD(), ts: new Date().toISOString() }
    : b
  );
}

function loadDeleted() {
  let arr = [];
  try {
    // Try localStorage first
    const stored = localStorage.getItem("deletedBarcodes");
    if (stored) {
      arr = JSON.parse(stored);
    } else {
      // Fallback to sessionStorage
      const sessionStored = sessionStorage.getItem("deletedBarcodes");
      if (sessionStored) {
        arr = JSON.parse(sessionStored);
      }
    }
  } catch (e) { 
    console.error('Failed to load deleted barcodes:', e);
    arr = []; 
  }
  return arr;
}

// Enhanced save function
function saveBarcodes() {
  try {
    localStorage.setItem('scannedBarcodes', JSON.stringify(allBarcodes));
    localStorage.setItem('deletedBarcodes', JSON.stringify(deletedBarcodes));
    // Also save to sessionStorage as backup
    sessionStorage.setItem('scannedBarcodes', JSON.stringify(allBarcodes));
    sessionStorage.setItem('deletedBarcodes', JSON.stringify(deletedBarcodes));
  } catch (error) {
    console.error('Failed to save barcodes:', error);
  }
}

const todayCountEl = document.getElementById("todayCount");
const deletedCountEl = document.getElementById("deletedCount");
const totalCountEl = document.getElementById("totalCount");
const tableBody = document.getElementById("orderTableBody");
const loadBtn = document.getElementById("loadDataBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const exportJsonBtn = document.getElementById("exportJsonBtn");
const printBtn = document.getElementById("printBtn");
const viewDeletedBtn = document.getElementById("viewDeletedBtn");
const reloadBtn = document.getElementById("reloadBtn");
const searchInput = document.getElementById("searchInput");

let allBarcodes = loadBarcodes();
let deletedBarcodes = loadDeleted();
let filteredBarcodes = allBarcodes.slice();

function renderTable(data) {
  tableBody.innerHTML = "";
  if (!data || data.length === 0) {
    tableBody.innerHTML = `<tr><td colspan='3' class='text-center py-4 text-slate-400'>No data found.</td></tr>`;
    return;
  }
  data.forEach((row, idx) => {
    const tr = document.createElement("tr");
    // Reverse numbering: newest entries get higher numbers
    const displayNumber = data.length - idx;
    tr.innerHTML = `
      <td class='py-2 px-4 border-b border-slate-700'>${displayNumber}. ${row.ts ? new Date(row.ts).toLocaleString() : ""}</td>
      <td class='py-2 px-4 border-b border-slate-700'>${row.code}</td>
      <td class='py-2 px-4 border-b border-slate-700 text-center'>
        <button class='remove-btn px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs' data-idx='${idx}'>Remove</button>
      </td>
    `;
    tableBody.appendChild(tr);
  });
  // Attach remove event listeners
  tableBody.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const idx = parseInt(this.getAttribute('data-idx'));
      const barcode = filteredBarcodes[idx];
      Swal.fire({
        title: 'Remove this barcode?',
        text: barcode.code,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, remove',
        cancelButtonText: 'Cancel',
      }).then(result => {
        if (result.isConfirmed) {
          // Remove from allBarcodes and filteredBarcodes
          const removeIdx = allBarcodes.findIndex(b => b.code === barcode.code && b.ts === barcode.ts);
          if (removeIdx !== -1) {
            allBarcodes.splice(removeIdx, 1);
            saveBarcodes(); // Use enhanced save function
          }
          // Add to deletedBarcodes
          deletedBarcodes.push(barcode.code);
          saveBarcodes(); // Use enhanced save function
          filteredBarcodes.splice(idx, 1);
          renderTable(filteredBarcodes);
          updateCounts();
          Swal.fire({ title: 'Removed!', icon: 'success', timer: 1000, showConfirmButton: false });
        }
      });
    });
  });
}

function updateCounts() {
  const today = getTodayYMD();
  todayCountEl.textContent = allBarcodes.filter(b => b.date === today).length;
  totalCountEl.textContent = allBarcodes.length;
  deletedCountEl.textContent = deletedBarcodes.length;
}

function filterByDate(date) {
  filteredBarcodes = allBarcodes.filter(b => b.date === date);
  renderTable(filteredBarcodes);
}

function filterBySearch(query) {
  const q = query.trim().toLowerCase();
  renderTable(filteredBarcodes.filter(b => b.code.toLowerCase().includes(q)));
}

loadBtn.addEventListener("click", () => {
  const dateInput = document.getElementById("filterDate").value;
  if (dateInput) {
    filterByDate(dateInput);
    filteredBarcodes = allBarcodes.filter(b => b.date === dateInput);
  }
});
searchInput.addEventListener("input", e => {
  filterBySearch(e.target.value);
});
reloadBtn.addEventListener("click", () => {
  allBarcodes = loadBarcodes();
  filteredBarcodes = allBarcodes.slice();
  renderTable(filteredBarcodes);
  updateCounts();
  searchInput.value = "";
});
exportCsvBtn.addEventListener("click", () => {
  if (!filteredBarcodes.length) return;
  const csv = "data:text/csv;charset=utf-8," + filteredBarcodes.map(b => `"${b.ts}","${b.code}"`).join("\n");
  const link = document.createElement("a");
  link.setAttribute("href", encodeURI(csv));
  link.setAttribute("download", "barcodes.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  Swal.fire({ title: "Exported CSV!", icon: "success", timer: 1200, showConfirmButton: false });
});
exportJsonBtn.addEventListener("click", () => {
  if (!filteredBarcodes.length) return;
  const data = JSON.stringify(filteredBarcodes, null, 2);
  const link = document.createElement("a");
  link.setAttribute("href", "data:application/json," + encodeURIComponent(data));
  link.setAttribute("download", "barcodes.json");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  Swal.fire({ title: "Exported JSON!", icon: "success", timer: 1200, showConfirmButton: false });
});
printBtn.addEventListener("click", () => {
  window.print();
});
viewDeletedBtn.addEventListener("click", () => {
  if (!deletedBarcodes.length) {
    Swal.fire({ title: "No deleted barcodes.", icon: "info", timer: 1200, showConfirmButton: false });
    return;
  }
  Swal.fire({
    title: "Deleted Barcodes",
    html: deletedBarcodes.map(c => `<div>${c}</div>`).join(""),
    width: 400,
    icon: "info",
    confirmButtonText: "Close"
  });
});

// Add Clear List button logic
const clearListBtn = document.getElementById('clearListBtn');
if (clearListBtn) {
  clearListBtn.addEventListener('click', () => {
    Swal.fire({
      title: 'Clear displayed list?',
      text: 'This will only clear the current view, not delete saved barcodes.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Clear',
      cancelButtonText: 'Cancel',
    }).then(result => {
      if (result.isConfirmed) {
        filteredBarcodes = [];
        renderTable(filteredBarcodes);
      }
    });
  });
}

// Play Apple Pay sound on barcode add (example function, call this when adding a barcode)
function playSuccessSound() {
  const audio = document.getElementById('success-sound');
  if (audio) {
    try {
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.log('Audio play failed:', error);
        });
      }
    } catch(e) {
      console.log('Audio error:', e);
    }
  }
}
// Example: Add barcode (call this function wherever you add a barcode)
function addBarcode(barcode) {
  const newBarcode = { code: barcode, date: getTodayYMD(), ts: new Date().toISOString() };
  // Add new barcode to the beginning of the array (top of list)
  allBarcodes.unshift(newBarcode);
  saveBarcodes(); // Use enhanced save function
  filteredBarcodes = allBarcodes.slice();
  renderTable(filteredBarcodes);
  updateCounts();
  playSuccessSound();
}

document.getElementById("logoutBtn").addEventListener("click", () => {
  Swal.fire({
    title: "Logged out",
    icon: "success",
    timer: 1000,
    showConfirmButton: false
  }).then(() => {
    location.href = "index.html";
  });
});

// Initial render
renderTable(filteredBarcodes);
updateCounts();
