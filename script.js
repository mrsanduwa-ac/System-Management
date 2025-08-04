// --- CONFIGURATION ---
const WEB_APP_URL = "YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL"; // Replace with your URL

// --- GLOBAL VARIABLES ---
let scannedUniqueBarcodes = new Set();
let deletedBarcodes = new Set();
let currentSessionId = null;
let userPasscode = null;
let allSessions = [];
let saveTimeout = null;
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
    searchScannedInput: document.getElementById("searchScannedInput"), // New search input
};

// --- CORE APP LOGIC ---
async function validateAndLoadApp(passcode) {
    el.passcodeError.textContent = "";
    el.passcodeSubmitBtn.disabled = true;
    el.passcodeSubmitBtn.textContent = "Checking...";
    try {
        const url = `${WEB_APP_URL}?passcode=${encodeURIComponent(passcode)}&t=${new Date().getTime()}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("Network error or invalid URL.");
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        userPasscode = passcode;
        allSessions = data;
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
    populateSessionsDropdown(allSessions);
    attachEventListeners();
    el.orderScanInput.focus();
}

function attachEventListeners() {
    // Barcode input listeners
    el.orderScanInput.addEventListener("keypress", e => e.key === "Enter" && handleOrderScan());
    el.orderScanInput.addEventListener("input", handleAutoScan); // Auto-scan on input
    el.addOrderBarcodeBtn.addEventListener("click", handleOrderScan);

    // Session management listeners
    el.savedSessionsSelect.addEventListener("change", loadSelectedSession); // Auto-load on change
    el.deleteSelectedSessionBtn.addEventListener("click", deleteSelectedSession);
    
    // Scanned list management
    el.searchScannedInput.addEventListener("input", () => renderPermanentBarcodes());
    el.clearCurrentOrderBtn.addEventListener("click", clearCurrentOrder);
    
    // Other tools
    el.showDeletedBtn.addEventListener('click', showDeletedBarcodes);
    el.printScannedOrderBtn.addEventListener("click", printScannedOrder);
    el.downloadCsvBtn.addEventListener("click", downloadCsv);

    // Date filter
    el.searchByDate.addEventListener("input", filterSessionsByDate);
    el.resetDateFilterBtn.addEventListener("click", () => {
        el.searchByDate.value = "";
        filterSessionsByDate();
    });

    // Passcode modal
    el.passcodeSubmitBtn.addEventListener("click", () => handlePasscodeSubmit());
    el.passcodeInput.addEventListener("keypress", e => e.key === "Enter" && handlePasscodeSubmit());
}

// --- SCANNING & SAVING ---
function handleAutoScan() {
    clearTimeout(barcodeScanTimeout);
    const barcodeValue = el.orderScanInput.value.trim();
    if (barcodeValue.length > 5) { // Process only if length is reasonable for a barcode
         barcodeScanTimeout = setTimeout(() => {
            handleOrderScan();
         }, 400); // 400ms delay to allow for full scan
    }
}

function handleOrderScan() {
    const barcode = el.orderScanInput.value.trim();
    if (!barcode) return;
    clearTimeout(barcodeScanTimeout); // Prevent double-triggering

    if (scannedUniqueBarcodes.has(barcode) || deletedBarcodes.has(barcode)) {
        el.errorSound.play();
        showStatusMessage(`Already Scanned: ${barcode}`, "error");
    } else {
        if (scannedUniqueBarcodes.size === 0 && !currentSessionId) {
            currentSessionId = new Date().getTime().toString();
        }
        scannedUniqueBarcodes.add(barcode);
        el.successSound.play();
        renderPermanentBarcodes();
        showStatusMessage(`Success: ${barcode}`, "success");
        triggerDebouncedSave();
    }
    el.orderScanInput.value = "";
    el.orderScanInput.focus();
}

function triggerDebouncedSave() {
    if (!currentSessionId) return;
    clearTimeout(saveTimeout);
    el.autoSaveStatus.textContent = "Saving...";
    el.autoSaveStatus.classList.add('show');
    saveTimeout = setTimeout(async () => {
        const sessionName = `Session - ${getTimestamp(currentSessionId)}`;
        try {
            await fetch(WEB_APP_URL, {
                method: "POST",
                mode: "cors",
                body: JSON.stringify({ action: "saveBatch", passcode: userPasscode, sessionID: currentSessionId, sessionName, barcodes: Array.from(scannedUniqueBarcodes) })
            });
            el.autoSaveStatus.textContent = "✓ Saved";
        } catch (error) {
            el.autoSaveStatus.textContent = "Save Failed!";
        } finally {
            setTimeout(() => el.autoSaveStatus.classList.remove('show'), 2000);
        }
    }, 1500);
}

// --- BARCODE & SESSION MANAGEMENT ---
function loadSelectedSession() {
    const sessionId = el.savedSessionsSelect.value;
    if (!sessionId) return; // Do nothing if the default option is selected
    
    const session = allSessions.find(s => s.id === sessionId);
    if (session) {
        currentSessionId = session.id;
        scannedUniqueBarcodes = new Set(session.data.uniqueBarcodes || []);
        deletedBarcodes.clear();
        renderPermanentBarcodes();
        Swal.fire({ title: "Loaded!", text: `Session '${session.name}' has been loaded.`, icon: "success", timer: 1500 });
    }
}

function renderPermanentBarcodes() {
    const searchTerm = el.searchScannedInput.value.toLowerCase();
    
    el.scannedOrderBarcodesList.innerHTML = "";
    
    const barcodesToDisplay = Array.from(scannedUniqueBarcodes)
                                    .filter(barcode => barcode.toLowerCase().includes(searchTerm))
                                    .reverse();

    el.noOrderBarcodesMessage.style.display = barcodesToDisplay.length > 0 ? "none" : "block";

    if (barcodesToDisplay.length > 0) {
        barcodesToDisplay.forEach(barcode => {
            const li = document.createElement("li");
            li.className = "flex items-center justify-between p-2 rounded-md shadow-sm border text-lg font-medium bg-gray-700/50 border-gray-600/50 text-gray-200 list-item-enter";
            li.innerHTML = `<span>${barcode}</span><button class="delete-barcode-btn no-print" data-barcode="${barcode}" title="Remove barcode">×</button>`;
            el.scannedOrderBarcodesList.appendChild(li);
        });
        el.orderListContainer.scrollTop = 0;
    }
    el.uniqueOrderCount.textContent = scannedUniqueBarcodes.size;
}

// Other functions (deleteSingleBarcode, showDeletedBarcodes, clearCurrentOrder, deleteSelectedSession, etc.) remain mostly the same
// ... [The rest of the JS code from the previous response can be pasted here, as it's already correct] ...
// I will include them for completeness.

function deleteSingleBarcode(barcode) {
    if (scannedUniqueBarcodes.has(barcode)) {
        scannedUniqueBarcodes.delete(barcode);
        deletedBarcodes.add(barcode);
        renderPermanentBarcodes();
        showStatusMessage(`Moved to removed list: ${barcode}`, 'info');
        triggerDebouncedSave();
    }
}

function showDeletedBarcodes() {
    if (deletedBarcodes.size === 0) {
        Swal.fire({ title: "Empty!", text: "There are no removed items.", icon: "info" });
        return;
    }
    let deletedItemsHtml = '<ul class="text-left space-y-2 mt-4" style="max-height: 200px; overflow-y: auto;">';
    deletedBarcodes.forEach(barcode => {
        deletedItemsHtml += `<li class="flex justify-between items-center p-2 bg-gray-700/50 rounded-md"><span>${barcode}</span> <button onclick="restoreBarcode('${barcode}')" class="btn-success px-2 py-1 rounded-md text-xs font-semibold">Restore</button></li>`;
    });
    deletedItemsHtml += '</ul>';
    Swal.fire({
        title: 'Removed Barcodes',
        html: deletedItemsHtml,
        confirmButtonText: 'Close',
        width: '400px',
        didOpen: () => {
            window.restoreBarcode = (barcode) => {
                if (deletedBarcodes.has(barcode)) {
                    deletedBarcodes.delete(barcode);
                    scannedUniqueBarcodes.add(barcode);
                    renderPermanentBarcodes();
                    triggerDebouncedSave();
                    showStatusMessage(`Restored: ${barcode}`, 'success');
                    Swal.close();
                    setTimeout(showDeletedBarcodes, 200);
                }
            };
        }
    });
}

async function clearCurrentOrder() {
    if (scannedUniqueBarcodes.size === 0 && deletedBarcodes.size === 0) return;
    const result = await Swal.fire({ title: "Are you sure?", text: "This will clear all current and removed items.", icon: "warning", showCancelButton: true, confirmButtonText: "Yes, clear it!" });
    if (result.isConfirmed) {
        scannedUniqueBarcodes.clear();
        deletedBarcodes.clear();
        currentSessionId = null;
        renderPermanentBarcodes();
        Swal.fire({ title: "Cleared!", icon: "info", timer: 1500 });
    }
}

async function deleteSelectedSession() {
    const sessionId = el.savedSessionsSelect.value;
    if (!sessionId) return Swal.fire({ title: "Oops...", text: "Please select a session to delete.", icon: "warning" });
    const result = await Swal.fire({ title: "Are you sure?", text: "You won't be able to revert this!", icon: "warning", showCancelButton: true, confirmButtonColor: "#d33", confirmButtonText: "Yes, delete it!" });
    if (result.isConfirmed) {
        try {
            await fetch(WEB_APP_URL, {
                method: "POST",
                mode: "cors",
                body: JSON.stringify({ action: "deleteSession", passcode: userPasscode, sessionID: sessionId })
            });
            Swal.fire({ title: "Deleted!", text: "The session has been deleted.", icon: "success", timer: 1500 });
            if (currentSessionId === sessionId) {
                scannedUniqueBarcodes.clear(); deletedBarcodes.clear(); currentSessionId = null;
                renderPermanentBarcodes();
            }
            allSessions = allSessions.filter(s => s.id !== sessionId);
            populateSessionsDropdown(allSessions);
        } catch (e) {
            Swal.fire("Error!", "Could not delete the session.", "error");
        }
    }
}

function populateSessionsDropdown(sessions) {
    el.savedSessionsSelect.innerHTML = '<option value="">Select a session to load</option>';
    sessions.sort((a, b) => b.createdAt - a.createdAt).forEach(session => {
        const option = document.createElement("option");
        option.value = session.id;
        option.textContent = session.name;
        el.savedSessionsSelect.appendChild(option);
    });
    el.savedSessionsSelect.value = currentSessionId;
}

function filterSessionsByDate() {
    const searchDate = el.searchByDate.value;
    const filteredSessions = searchDate ? allSessions.filter(s => new Date(s.createdAt).toLocaleDateString('en-CA') === searchDate) : allSessions;
    populateSessionsDropdown(filteredSessions);
}

function showStatusMessage(message, type) {
    el.statusMessage.textContent = message;
    el.statusMessage.className = `status-message rounded-lg text-center font-semibold p-2 ${type === "success" ? "bg-green-800 text-green-200" : type === "error" ? "bg-red-800 text-red-200" : "bg-blue-800 text-blue-200"}`;
    el.statusMessage.classList.add("show");
    setTimeout(() => el.statusMessage.classList.remove("show"), 2500);
}

function updateClock() {
    el.liveClock.textContent = new Date().toLocaleString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
}

function getTimestamp(epoch) {
    return new Date(parseInt(epoch, 10)).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short", hour12: false });
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
    link.download = `scanned_order_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
}

const handlePasscodeSubmit = () => {
    const passcode = el.passcodeInput.value.trim();
    if (passcode) validateAndLoadApp(passcode);
};

// Initial call to attach listeners for the passcode modal
attachEventListeners();