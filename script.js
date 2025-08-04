// --- CONFIGURATION ---
// ඔබ ලබාදුන් අලුත්ම URL එක මෙහි යාවත්කාලීන කර ඇත.
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxGp7SZyDElAg2ATKL7XCo_vOXMlRYO96_-Ar3-aLAFEhYKMDPPQ_WM5Cndh_L7yvja/exec"; 

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
        const url = `${WEB_APP_URL}?action=validate&passcode=${encodeURIComponent(passcode)}&t=${new Date().getTime()}`;
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
        el.passcodeError.textContent = `Login Failed: ${error.message}`;
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

// --- DATA HANDLING (Using POST for saving) ---
async function loadBarcodesForDate(dateString, isToday = false) {
    if (!dateString) { Swal.fire("No Date", "Please select a date.", "warning"); return; }
    isTodayView = isToday;
    updateUIForView();
    Swal.fire({ title: 'Loading...', text: `Fetching scans for ${dateString}`, allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        const url = `${WEB_APP_URL}?action=loadDate&passcode=${userPasscode}&date=${dateString}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Network error: ${response.statusText}`);
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
            body: JSON.stringify({ action: "logBarcode", passcode: userPasscode, barcode: barcode })
        });
        
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        
        const result = await response.json();
        if (result.status === 'error') throw new Error(result.message);
        
        el.autoSaveStatus.textContent = "✓ Saved";
        el.autoSaveStatus.style.color = '#48bb78';
    } catch (error) {
        console.error("Save Failed Detailed Error:", error);
        el.autoSaveStatus.textContent = "Save Failed!";
        el.autoSaveStatus.style.color = '#e53e3e';
        Swal.fire({ icon: 'error', title: 'Save Failed', text: `Could not save. Error: ${error.message}` });
    } finally {
        setTimeout(() => el.autoSaveStatus.classList.remove('show'), 3000);
    }
}

// All other functions are attached below for completeness.
function attachEventListeners(){el.orderScanInput.addEventListener("keypress",e=>"Enter"===e.key&&handleOrderScan());el.orderScanInput.addEventListener("input",handleAutoScan);el.addOrderBarcodeBtn.addEventListener("click",handleOrderScan);el.searchScannedInput.addEventListener("input",renderPermanentBarcodes);el.showDeletedBtn.addEventListener("click",showDeletedBarcodes);el.printScannedOrderBtn.addEventListener("click",printScannedOrder);el.downloadCsvBtn.addEventListener("click",downloadCsv);el.loadDateBtn.addEventListener("click",()=>loadBarcodesForDate(el.searchByDate.value));el.loadTodayBtn.addEventListener("click",()=>loadBarcodesForDate(getTodayDateString(),!0));el.passcodeSubmitBtn.addEventListener("click",()=>handlePasscodeSubmit());el.passcodeInput.addEventListener("keypress",e=>"Enter"===e.key&&handlePasscodeSubmit());el.scannedOrderBarcodesList.addEventListener("click",e=>{e.target&&e.target.classList.contains("delete-barcode-btn")&&deleteSingleBarcode(e.target.dataset.barcode)})}
function handleAutoScan(){clearTimeout(barcodeScanTimeout);if(el.orderScanInput.value.trim().length>5){barcodeScanTimeout=setTimeout(()=>handleOrderScan(),400)}}
function handleOrderScan(){const e=el.orderScanInput.value.trim();if(!e)return;clearTimeout(barcodeScanTimeout);if(!isTodayView){Swal.fire("Read-Only View","You are viewing a past date. Switch to 'Today's Scans' to add new barcodes.","warning");el.orderScanInput.value="";return}if(scannedUniqueBarcodes.has(e)){el.errorSound.play();showStatusMessage(`Already Scanned Today: ${e}`,"error")}else{scannedUniqueBarcodes.add(e);el.successSound.play();renderPermanentBarcodes();showStatusMessage(`Success: ${e}`,"success");logBarcodeToSheet(e)}el.orderScanInput.value="";el.orderScanInput.focus()}
function renderPermanentBarcodes(){const e=el.searchScannedInput.value.toLowerCase();el.scannedOrderBarcodesList.innerHTML="";const t=Array.from(scannedUniqueBarcodes).filter(t=>t.toLowerCase().includes(e)).reverse();el.noOrderBarcodesMessage.style.display=t.length>0?"none":"block";t.forEach(e=>{const t=document.createElement("li");t.className="flex items-center justify-between p-2 rounded-md shadow-sm border text-lg font-medium bg-gray-700/50 border-gray-600/50 text-gray-200 list-item-enter";const a=isTodayView?`<button class="delete-barcode-btn no-print" data-barcode="${e}" title="Remove from view">×</button>`:"";t.innerHTML=`<span>${e}</span>${a}`;el.scannedOrderBarcodesList.appendChild(t)});el.uniqueOrderCount.textContent=scannedUniqueBarcodes.size}
function deleteSingleBarcode(e){if(!isTodayView)return;scannedUniqueBarcodes.delete(e);deletedBarcodes.add(e);renderPermanentBarcodes();showStatusMessage(`Removed from view: ${e}`,"info")}
function updateUIForView(){const e=!isTodayView;el.orderScanInput.disabled=e;el.addOrderBarcodeBtn.disabled=e;el.orderScanInput.placeholder=e?"Viewing past data (read-only)":"Scan or type barcode..."}
function showDeletedBarcodes(){if(0===deletedBarcodes.size){Swal.fire("Empty!","No items have been removed from the current view.","info");return}let e='<ul class="text-left space-y-2 mt-4" style="max-height: 200px; overflow-y: auto;">';deletedBarcodes.forEach(t=>{e+=`<li class="p-2 bg-gray-700/50 rounded-md">${t}</li>`});e+="</ul>";Swal.fire({title:"Removed From View (This Session)",html:e,confirmButtonText:"Close"})}
function showStatusMessage(e,t){el.statusMessage.textContent=e;el.statusMessage.className=`status-message rounded-lg text-center font-semibold p-2 ${"success"===t?"bg-green-800 text-green-200":"error"===t?"bg-red-800 text-red-200":"bg-blue-800 text-blue-200"}`;el.statusMessage.classList.add("show");setTimeout(()=>el.statusMessage.classList.remove("show"),2500)}
function getTodayDateString(){const e=new Date;return`${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,"0")}-${String(e.getDate()).padStart(2,"0")}`}
function updateClock(){el.liveClock.textContent=(new Date).toLocaleString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:!0})}
function printScannedOrder(){if(0===scannedUniqueBarcodes.size)return Swal.fire({title:"Empty!",text:"There are no barcodes to print.",icon:"warning"});el.printDateTime.textContent=(new Date).toLocaleString("en-US",{dateStyle:"long",timeStyle:"short"});el.printBarcodeList.innerHTML=Array.from(scannedUniqueBarcodes).map((e,t)=>`<div>${t+1}. ${e}</div>`).join("");window.print()}
function downloadCsv(){if(0===scannedUniqueBarcodes.size)return Swal.fire({title:"Empty!",text:"There are no barcodes to download.",icon:"warning"});const e=isTodayView?getTodayDateString():el.searchByDate.value,t="Barcode\n"+Array.from(scannedUniqueBarcodes).join("\n"),a=new Blob([t],{type:"text/csv;charset=utf-8;"}),r=document.createElement("a");r.href=URL.createObjectURL(a);r.download=`scanned_barcodes_${e}.csv`;r.click();URL.revokeObjectURL(r.href)}
const handlePasscodeSubmit=()=>{const e=el.passcodeInput.value.trim();e&&validateAndLoadApp(e)};el.passcodeModal&&(el.passcodeSubmitBtn.addEventListener("click",handlePasscodeSubmit),el.passcodeInput.addEventListener("keypress",e=>"Enter"===e.key&&handlePasscodeSubmit()));
