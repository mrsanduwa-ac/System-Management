// --- CONFIGURATION ---
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycby2JfJzXO2T3zWxhael5bSwzDIcqDHL0Qs4-dnzOjbOuIQL7EMZXpN1i3lWdeNeluSp/exec"; // Replace with your URL

// --- GLOBAL VARIABLES ---
let scannedUniqueBarcodes = new Set();
let deletedBarcodes = new Set();
// Removed session-related variables as logic has changed
let userPasscode = null;
let barcodeScanTimeout = null;

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
    orderListContainer: document.getElementById("orderListContainer"),
    clearCurrentOrderBtn: document.getElementById("clearCurrentOrderBtn"),
    printScannedOrderBtn: document.getElementById("printScannedOrderBtn"),
    downloadCsvBtn: document.getElementById("downloadCsvBtn"),
    // Removed elements related to loading/deleting old sessions
    savedSessionsSelect: document.getElementById("savedSessionsSelect"),
    deleteSelectedSessionBtn: document.getElementById("deleteSelectedSessionBtn"),
    searchByDate: document.getElementById("searchByDate"),
    resetDateFilterBtn: document.getElementById("resetDateFilterBtn"),
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
        // Simple validation check, no data is loaded anymore
        const url = `${WEB_APP_URL}?passcode=${encodeURIComponent(passcode)}&action=validate&t=${new Date().getTime()}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("Network error or invalid URL.");
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        userPasscode = passcode;
        el.passcodeModal.style.display = "none";
        document.body.style.overflow = "auto";
        el.mainApp.style.display = "flex";
        initializeMainApp();

    } catch (error) {
        el.passcodeError.textContent = error.message;
        el.passcodeSubmitBtn.disabled = false;
        el.passcodeSubmitBtn.textContent = "Enter";
    }
}

function initializeMainApp() {
    updateClock();
    setInterval(updateClock, 1000);
    // Hide session management UI as it's no longer used
    el.savedSessionsSelect.parentElement.style.display = 'none';
    el.autoSaveStatus.style.display = 'none';

    attachEventListeners();
    el.orderScanInput.focus();
}

function attachEventListeners() {
    el.orderScanInput.addEventListener("keypress", e => e.key === "Enter" && handleOrderScan());
    el.orderScanInput.addEventListener("input", handleAutoScan);
    el.addOrderBarcodeBtn.addEventListener("click", handleOrderScan);
    el.searchScannedInput.addEventListener("input", () => renderPermanentBarcodes());
    el.clearCurrentOrderBtn.addEventListener("click", clearCurrentOrder);
    el.showDeletedBtn.addEventListener('click', showDeletedBarcodes);
    el.printScannedOrderBtn.addEventListener("click", printScannedOrder);
    el.downloadCsvBtn.addEventListener("click", downloadCsv);
    el.passcodeSubmitBtn.addEventListener("click", () => handlePasscodeSubmit());
    el.passcodeInput.addEventListener("keypress", e => e.key === "Enter" && handlePasscodeSubmit());
    el.scannedOrderBarcodesList.addEventListener('click', (e) => {
        if (e.target && e.target.classList.contains('delete-barcode-btn')) {
            deleteSingleBarcode(e.target.dataset.barcode);
        }
    });
}

// --- NEW FUNCTION TO LOG A SINGLE BARCODE ---
async function logBarcodeToSheet(barcode) {
    el.autoSaveStatus.textContent = "Saving...";
    el.autoSaveStatus.classList.add('show');
    try {
        await fetch(WEB_APP_URL, {
            method: "POST",
            mode: "cors", // Required for cross-origin requests
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
                action: "logBarcode",
                passcode: userPasscode,
                barcode: barcode,
                timestamp: new Date().toISOString() // Send current time
            })
        });
        el.autoSaveStatus.textContent = "✓ Saved";
    } catch (error) {
        console.error("Save Failed:", error);
        el.autoSaveStatus.textContent = "Save Failed!";
    } finally {
        setTimeout(() => el.autoSaveStatus.classList.remove('show'), 2000);
    }
}

// --- SCANNING & SAVING ---
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

    if (scannedUniqueBarcodes.has(barcode) || deletedBarcodes.has(barcode)) {
        el.errorSound.play();
        showStatusMessage(`Already Scanned: ${barcode}`, "error");
    } else {
        scannedUniqueBarcodes.add(barcode);
        el.successSound.play();
        renderPermanentBarcodes();
        showStatusMessage(`Success: ${barcode}`, "success");
        logBarcodeToSheet(barcode); // *** CALL THE NEW LOGGING FUNCTION ***
    }
    el.orderScanInput.value = "";
    el.orderScanInput.focus();
}

// --- UI AND BARCODE MANAGEMENT (Mostly unchanged) ---
function renderPermanentBarcodes() {
    const searchTerm = el.searchScannedInput.value.toLowerCase();
    el.scannedOrderBarcodesList.innerHTML = "";
    const barcodesToDisplay = Array.from(scannedUniqueBarcodes)
        .filter(barcode => barcode.toLowerCase().includes(searchTerm))
        .reverse();

    el.noOrderBarcodesMessage.style.display = barcodesToDisplay.length > 0 ? "none" : "block";

    barcodesToDisplay.forEach(barcode => {
        const li = document.createElement("li");
        li.className = "flex items-center justify-between p-2 rounded-md shadow-sm border text-lg font-medium bg-gray-700/50 border-gray-600/50 text-gray-200 list-item-enter";
        li.innerHTML = `<span>${barcode}</span><button class="delete-barcode-btn no-print" data-barcode="${barcode}" title="Remove barcode">×</button>`;
        el.scannedOrderBarcodesList.appendChild(li);
    });
    el.uniqueOrderCount.textContent = scannedUniqueBarcodes.size;
}

function deleteSingleBarcode(barcode) {
    if (scannedUniqueBarcodes.has(barcode)) {
        scannedUniqueBarcodes.delete(barcode);
        deletedBarcodes.add(barcode);
        renderPermanentBarcodes();
        showStatusMessage(`Moved to removed list: ${barcode}`, 'info');
        // Note: This does not delete it from the Google Sheet, it only removes from the current view.
        // A "delete" function could be added to the Apps Script if needed.
    }
}

async function clearCurrentOrder() {
    if (scannedUniqueBarcodes.size === 0 && deletedBarcodes.size === 0) return;
    const result = await Swal.fire({ title: "Are you sure?", text: "This will clear the current screen. It will NOT delete records from the Google Sheet.", icon: "warning", showCancelButton: true, confirmButtonText: "Yes, clear screen!" });
    if (result.isConfirmed) {
        scannedUniqueBarcodes.clear();
        deletedBarcodes.clear();
        renderPermanentBarcodes();
        Swal.fire({ title: "Cleared!", text: "The screen has been cleared.", icon: "info", timer: 1500 });
    }
}

function showDeletedBarcodes() {
    if (deletedBarcodes.size === 0) {
        Swal.fire({ title: "Empty!", text: "There are no removed items in this session.", icon: "info" });
        return;
    }
    let deletedItemsHtml = '<ul class="text-left space-y-2 mt-4" style="max-height: 200px; overflow-y: auto;">';
    deletedBarcodes.forEach(barcode => {
        deletedItemsHtml += `<li class="p-2 bg-gray-700/50 rounded-md">${barcode}</li>`;
    });
    deletedItemsHtml += '</ul>';
    Swal.fire({ title: 'Removed Barcodes (This Session)', html: deletedItemsHtml, confirmButtonText: 'Close' });
}


// --- UTILITY FUNCTIONS ---
function showStatusMessage(message, type) {
    el.statusMessage.textContent = message;
    el.statusMessage.className = `status-message rounded-lg text-center font-semibold p-2 ${type === "success" ? "bg-green-800 text-green-200" : type === "error" ? "bg-red-800 text-red-200" : "bg-blue-800 text-blue-200"}`;
    el.statusMessage.classList.add("show");
    setTimeout(() => el.statusMessage.classList.remove("show"), 2500);
}

function updateClock() {
    el.liveClock.textContent = new Date().toLocaleString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
}

function printScannedOrder() {
    if (scannedUniqueBarcodes.size === 0) return Swal.fire({ title: "Empty!", text: "There are no barcodes to print.", icon: "warning" });
    el.printDateTime.textContent = new Date().toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" });
    el.printBarcodeList.innerHTML = Array.from(scannedUniqueBarcodes).map((barcode, index) => `<div>${index + 1}. ${barcode}</div>`).join("");
    window.print();
}

function downloadCsv() {
    if (scannedUniqueBarcodes.size === 0) return Swal.fire({ title: "Empty!", text: "There are no barcodes to download.", icon: "warning" });
    const csvContent = "Barcode\n" + Array.from(scannedUniqueBarcodes).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `scanned_barcodes_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
}

const handlePasscodeSubmit = () => {
    const passcode = el.passcodeInput.value.trim();
    if (passcode) validateAndLoadApp(passcode);
};

// Initial call to attach listeners for the passcode modal if it exists
if (el.passcodeModal) {
    el.passcodeSubmitBtn.addEventListener("click", handlePasscodeSubmit);
    el.passcodeInput.addEventListener("keypress", e => e.key === "Enter" && handlePasscodeSubmit);
}
