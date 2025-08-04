// --- CONFIGURATION ---
// PASTE YOUR NEW DEPLOYMENT URL FROM STEP 2 HERE
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwH3SzkimLj5whWj1POTmzdjNOU8niTNmFlMA1WGJoNtOmjNvXZhu0m60cLBG4qX6gr/exec"; 

// --- GLOBAL VARIABLES ---
let scannedUniqueBarcodes = new Set();
let deletedBarcodes = new Set();
let userPasscode = null;
let barcodeScanTimeout = null;
let isTodayView = true;

// --- ELEMENT CACHE ---
const el = {
    mainApp: document.getElementById("main-app"),
    passcodeModal: document.getElementById("passcode-modal"),
    passcodeInput: document.getElementById("passcodeInput"),
    passcodeSubmitBtn: document.getElementById("passcodeSubmitBtn"),
    passcodeError: document.getElementById("passcode-error"),
    statusMessage: document.getElementById("statusMessage"),
    liveClock: document.getElementById("live-clock"),
    uniqueOrderCount: document.getElementById("uniqueOrderCount"),
    orderScanInput: document.getElementById("orderScanInput"),
    addOrderBarcodeBtn: document.getElementById("addOrderBarcodeBtn"),
    scannedOrderBarcodesList: document.getElementById("scannedOrderBarcodesList"),
    noOrderBarcodesMessage: document.getElementById("noOrderBarcodesMessage"),
    printScannedOrderBtn: document.getElementById("printScannedOrderBtn"),
    downloadCsvBtn: document.getElementById("downloadCsvBtn"),
    searchByDate: document.getElementById("searchByDate"),
    loadDateBtn: document.getElementById("loadDateBtn"),
    loadTodayBtn: document.getElementById("loadTodayBtn"),
    autoSaveStatus: document.getElementById("autoSaveStatus"),
    successSound: document.getElementById("success-sound"),
    errorSound: document.getElementById("error-sound"),
    printDateTime: document.querySelector(".print-date-time"),
    printBarcodeList: document.getElementById("printBarcodeList"),
    showDeletedBtn: document.getElementById("showDeletedBtn"),
    searchScannedInput: document.getElementById("searchScannedInput"),
};

// --- CORE APP LOGIC ---
async function validateAndLoadApp(passcode) {
    el.passcodeError.textContent = "";
    el.passcodeSubmitBtn.disabled = true;
    el.passcodeSubmitBtn.textContent = "Checking...";
    try {
        const url = `${WEB_APP_URL}?passcode=${encodeURIComponent(passcode)}&t=${new Date().getTime()}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Network validation failed: ${response.statusText}`);
        const data = await response.json();
        if (data.status === 'error') throw new Error(data.message);
        
        userPasscode = passcode;
        el.passcodeModal.style.display = "none";
        document.body.style.overflow = "auto";
        el.mainApp.style.display = "flex";
        await initializeMainApp();
    } catch (error) {
        el.passcodeError.textContent = error.message;
        el.passcodeSubmitBtn.disabled = false;
        el.passcodeSubmitBtn.textContent = "Enter";
    }
}

async function initializeMainApp() {
    updateClock();
    setInterval(updateClock, 1000);
    attachEventListeners();
    await loadBarcodesForDate(getTodayDateString(), true);
    el.orderScanInput.focus();
}

function attachEventListeners() {
    el.orderScanInput.addEventListener("keypress", e => e.key === "Enter" && handleOrderScan());
    el.orderScanInput.addEventListener("input", handleAutoScan);
    el.addOrderBarcodeBtn.addEventListener("click", handleOrderScan);
    el.searchScannedInput.addEventListener("input", renderPermanentBarcodes);
    el.showDeletedBtn.addEventListener('click', showDeletedBarcodes);
    el.printScannedOrderBtn.addEventListener("click", printScannedOrder);
    el.downloadCsvBtn.addEventListener("click", downloadCsv);
    el.loadDateBtn.addEventListener('click', () => loadBarcodesForDate(el.searchByDate.value));
    el.loadTodayBtn.addEventListener('click', () => loadBarcodesForDate(getTodayDateString(), true));
    el.passcodeSubmitBtn.addEventListener("click", handlePasscodeSubmit);
    el.passcodeInput.addEventListener("keypress", e => e.key === "Enter" && handlePasscodeSubmit);
    el.scannedOrderBarcodesList.addEventListener('click', (e) => {
        if (e.target && e.target.classList.contains('delete-barcode-btn')) {
            deleteSingleBarcode(e.target.dataset.barcode);
        }
    });
}

// --- DATA HANDLING (IMPROVED ERROR HANDLING) ---
async function loadBarcodesForDate(dateString, isToday = false) {
    if (!dateString) {
        Swal.fire("No Date Selected", "Please select a date from the calendar to load.", "warning");
        return;
    }
    isTodayView = isToday;
    updateUIForView();
    Swal.fire({ title: 'Loading Data...', text: `Fetching scans for ${dateString}`, allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        const url = `${WEB_APP_URL}?passcode=${userPasscode}&action=loadDate&date=${dateString}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
        const data = await response.json();
        if (data.status === 'error') throw new Error(data.message);
        scannedUniqueBarcodes = new Set(data.barcodes || []);
        deletedBarcodes.clear();
        renderPermanentBarcodes();
        Swal.close();
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Failed to Load', text: error.message });
        scannedUniqueBarcodes.clear();
        renderPermanentBarcodes();
    }
}

// --- IMPROVED SAVE FUNCTION ---
async function logBarcodeToSheet(barcode) {
    el.autoSaveStatus.textContent = "Saving...";
    el.autoSaveStatus.style.color = '#e2e8f0';
    el.autoSaveStatus.classList.add('show');
    try {
        const response = await fetch(WEB_APP_URL, {
            method: "POST",
            mode: "cors",
            cache: "no-cache",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "logBarcode", passcode: userPasscode, barcode, timestamp: new Date().toISOString() })
        });

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const result = await response.json();

        if (result.status === 'error') {
            throw new Error(result.message);
        }

        el.autoSaveStatus.textContent = "✓ Saved";
        el.autoSaveStatus.style.color = '#48bb78';
    } catch (error) {
        console.error("Save Failed:", error); // Log detailed error to the browser console
        el.autoSaveStatus.textContent = "Save Failed!";
        el.autoSaveStatus.style.color = '#e53e3e';
    } finally {
        setTimeout(() => el.autoSaveStatus.classList.remove('show'), 3000);
    }
}

// --- UI & SCANNING LOGIC ---
function handleAutoScan() {
    clearTimeout(barcodeScanTimeout);
    if (el.orderScanInput.value.trim().length > 5) {
        barcodeScanTimeout = setTimeout(() => handleOrderScan(), 400);
    }
}

function handleOrderScan() {
    const barcode = el.orderScanInput.value.trim();
    if (!barcode) return;
    clearTimeout(barcodeScanTimeout);
    if (!isTodayView) {
        Swal.fire("Read-Only View", "You are viewing a past date. Switch to 'Today's Scans' to add new barcodes.", "warning");
        el.orderScanInput.value = "";
        return;
    }
    if (scannedUniqueBarcodes.has(barcode)) {
        el.errorSound.play();
        showStatusMessage(`Already Scanned Today: ${barcode}`, "error");
    } else {
        scannedUniqueBarcodes.add(barcode);
        el.successSound.play();
        renderPermanentBarcodes();
        showStatusMessage(`Success: ${barcode}`, "success");
        logBarcodeToSheet(barcode);
    }
    el.orderScanInput.value = "";
    el.orderScanInput.focus();
}

function renderPermanentBarcodes() {
    const searchTerm = el.searchScannedInput.value.toLowerCase();
    el.scannedOrderBarcodesList.innerHTML = "";
    const barcodesToDisplay = Array.from(scannedUniqueBarcodes).filter(b => b.toLowerCase().includes(searchTerm)).reverse();
    el.noOrderBarcodesMessage.style.display = barcodesToDisplay.length > 0 ? "none" : "block";
    barcodesToDisplay.forEach(barcode => {
        const li = document.createElement("li");
        li.className = "flex items-center justify-between p-2 rounded-md shadow-sm border text-lg font-medium bg-gray-700/50 border-gray-600/50 text-gray-200 list-item-enter";
        const deleteBtnHTML = isTodayView ? `<button class="delete-barcode-btn no-print" data-barcode="${barcode}" title="Remove from view">×</button>` : '';
        li.innerHTML = `<span>${barcode}</span>${deleteBtnHTML}`;
        el.scannedOrderBarcodesList.appendChild(li);
    });
    el.uniqueOrderCount.textContent = scannedUniqueBarcodes.size;
}

function deleteSingleBarcode(barcode) {
    if (!isTodayView) return;
    scannedUniqueBarcodes.delete(barcode);
    deletedBarcodes.add(barcode);
    renderPermanentBarcodes();
    showStatusMessage(`Removed from view: ${barcode}`, 'info');
}

function updateUIForView() {
    const isReadOnly = !isTodayView;
    el.orderScanInput.disabled = isReadOnly;
    el.addOrderBarcodeBtn.disabled = isReadOnly;
    el.orderScanInput.placeholder = isReadOnly ? "Viewing past data (read-only)" : "Scan or type barcode...";
}

// --- UTILITY FUNCTIONS ---
function showDeletedBarcodes() {
    if (deletedBarcodes.size === 0) {
        Swal.fire("Empty!", "No items have been removed from the current view.", "info");
        return;
    }
    let deletedItemsHtml = '<ul class="text-left space-y-2 mt-4" style="max-height: 200px; overflow-y: auto;">';
    deletedBarcodes.forEach(b => { deletedItemsHtml += `<li class="p-2 bg-gray-700/50 rounded-md">${b}</li>`; });
    deletedItemsHtml += '</ul>';
    Swal.fire({ title: 'Removed From View (This Session)', html: deletedItemsHtml, confirmButtonText: 'Close' });
}

function showStatusMessage(message, type) {
    el.statusMessage.textContent = message;
    el.statusMessage.className = `status-message rounded-lg text-center font-semibold p-2 ${type === "success" ? "bg-green-800 text-green-200" : "bg-red-800 text-red-200" : "bg-blue-800 text-blue-200"}`;
    el.statusMessage.classList.add("show");
    setTimeout(() => el.statusMessage.classList.remove("show"), 2500);
}

function getTodayDateString() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function updateClock() {
    el.liveClock.textContent = new Date().toLocaleString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
}

function printScannedOrder() {
    if (scannedUniqueBarcodes.size === 0) return Swal.fire({ title: "Empty!", text: "There are no barcodes to print.", icon: "warning" });
    el.printDateTime.textContent = new Date().toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" });
    el.printBarcodeList.innerHTML = Array.from(scannedUniqueBarcodes).map((b, i) => `<div>${i + 1}. ${b}</div>`).join("");
    window.print();
}

function downloadCsv() {
    if (scannedUniqueBarcodes.size === 0) return Swal.fire({ title: "Empty!", text: "There are no barcodes to download.", icon: "warning" });
    const dateSuffix = isTodayView ? getTodayDateString() : el.searchByDate.value;
    const csvContent = "Barcode\n" + Array.from(scannedUniqueBarcodes).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `scanned_barcodes_${dateSuffix}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
}

const handlePasscodeSubmit = () => {
    const passcode = el.passcodeInput.value.trim();
    if (passcode) validateAndLoadApp(passcode);
};

if (el.passcodeModal) {
    el.passcodeSubmitBtn.addEventListener("click", handlePasscodeSubmit);
    el.passcodeInput.addEventListener("keypress", e => e.key === "Enter" && handlePasscodeSubmit);
}
