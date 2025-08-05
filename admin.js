function getTodayYMD() {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

// Load from localStorage, fallback to []
function loadBarcodes() {
  let arr = [];
  try {
    arr = JSON.parse(localStorage.getItem("scannedBarcodes")) || [];
  } catch (e) { arr = []; }
  // Upgrade for any legacy string format
  return arr.map(b => typeof b === "string"
    ? { code: b, date: getTodayYMD(), ts: new Date().toISOString() }
    : b
  );
}
function loadDeleted() {
  let arr = [];
  try {
    arr = JSON.parse(localStorage.getItem("deletedBarcodes")) || [];
  } catch (e) { arr = []; }
  return arr;
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
    tableBody.innerHTML = `<tr><td colspan='2' class='text-center py-4 text-slate-400'>No data found.</td></tr>`;
    return;
  }
  data.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class='py-2 px-4 border-b border-slate-700'>${row.ts ? new Date(row.ts).toLocaleString() : ""}</td>
      <td class='py-2 px-4 border-b border-slate-700'>${row.code}</td>
    `;
    tableBody.appendChild(tr);
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