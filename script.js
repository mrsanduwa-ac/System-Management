// === Live Animated Stars background ===
(function starBackground() {
  const STAR_COUNT = 90;
  const starBg = document.getElementById("star-bg");
  if (!starBg) return;
  function random(min, max) { return Math.random() * (max - min) + min; }
  function createStar(i) {
    const star = document.createElement("div");
    star.className = "star-dot";
    star.style.left = `${random(0, 100)}vw`;
    star.style.top = `${random(-20, 100)}vh`;
    star.style.opacity = random(0.3, 1);
    star.style.width = star.style.height = `${random(1.5, 3.5)}px`;
    star.style.animationDuration = `${random(12, 24)}s`;
    star.style.animationDelay = `${-random(0, 24)}s`;
    starBg.appendChild(star);
  }
  for (let i = 0; i < STAR_COUNT; i++) createStar(i);
})();

document.addEventListener("DOMContentLoaded", () => {
  const passcodeBtn = document.getElementById("passcodeSubmitBtn");
  const passcodeInput = document.getElementById("passcodeInput");
  const passcodeError = document.getElementById("passcode-error");
  const passModal = document.getElementById("passcode-modal");
  const mainApp = document.getElementById("main-app");

  const barcodeInput = document.getElementById("orderScanInput");
  const addBtn = document.getElementById("addOrderBarcodeBtn");
  const barcodeList = document.getElementById("scannedOrderBarcodesList");
  const noMsg = document.getElementById("noOrderBarcodesMessage");
  const statusMsg = document.getElementById("statusMessage");
  const searchInput = document.getElementById("searchScannedInput");
  const uniqueCount = document.getElementById("uniqueOrderCount");
  const totalScannedCountEl = document.getElementById("totalScannedCount");
  const successSound = document.getElementById("success-sound");
  const errorSound = document.getElementById("error-sound");
  const logoutBtn = document.getElementById("logoutBtn");
  const currentDateEl = document.getElementById("currentDate");

  // New: load/save barcodes and date filter
  const loadBarcodesBtn = document.getElementById("loadBarcodesBtn");
  const loadBarcodesInput = document.getElementById("loadBarcodesInput");
  const saveBarcodesBtn = document.getElementById("saveBarcodesBtn");
  const barcodeDateFilter = document.getElementById("barcodeDateFilter");
  const loadDateBarcodesBtn = document.getElementById("loadDateBarcodesBtn");
  const clearHomeListBtn = document.getElementById("clearHomeListBtn");

  // Enhanced: Cross-device transfer elements
  const exportDataBtn = document.getElementById("exportDataBtn");
  const importDataBtn = document.getElementById("importDataBtn");
  const importDataInput = document.getElementById("importDataInput");

  let scannedBarcodes = JSON.parse(localStorage.getItem("scannedBarcodes")) || [];
  let deletedBarcodes = JSON.parse(localStorage.getItem("deletedBarcodes")) || [];

  // --- Move saveData above upgradeBarcodesFormat ---
  const saveData = (showStatusMessage = true) => {
    try {
      localStorage.setItem("scannedBarcodes", JSON.stringify(scannedBarcodes));
      localStorage.setItem("deletedBarcodes", JSON.stringify(deletedBarcodes));
      // Also save to sessionStorage as backup
      sessionStorage.setItem("scannedBarcodes", JSON.stringify(scannedBarcodes));
      sessionStorage.setItem("deletedBarcodes", JSON.stringify(deletedBarcodes));
      
      // Enhanced: Save to multiple storage locations for better cross-device sync
      try {
        // Try IndexedDB for larger storage capacity
        if ('indexedDB' in window) {
          const request = indexedDB.open('BarcodeApp', 1);
          request.onupgradeneeded = function() {
            const db = request.result;
            if (!db.objectStoreNames.contains('barcodes')) {
              db.createObjectStore('barcodes', { keyPath: 'id' });
            }
          };
          request.onsuccess = function() {
            const db = request.result;
            const transaction = db.transaction(['barcodes'], 'readwrite');
            const store = transaction.objectStore('barcodes');
            store.put({ id: 'scannedBarcodes', data: scannedBarcodes });
            store.put({ id: 'deletedBarcodes', data: deletedBarcodes });
          };
        }
      } catch (indexedDBError) {
        console.log('IndexedDB not available, using localStorage only');
      }
      
      // Auto-save indicator only if requested
      if (showStatusMessage) {
        showStatus("Data saved automatically", "success");
      }
    } catch (error) {
      console.error('Failed to save data:', error);
      if (showStatusMessage) {
        showStatus("Failed to save data", "error");
      }
    }
  };

  // Enhanced data loading with fallbacks
  const loadData = () => {
    try {
      // Try localStorage first
      const storedBarcodes = localStorage.getItem("scannedBarcodes");
      const storedDeleted = localStorage.getItem("deletedBarcodes");
      
      if (storedBarcodes) {
        scannedBarcodes = JSON.parse(storedBarcodes);
      } else {
        // Fallback to sessionStorage
        const sessionBarcodes = sessionStorage.getItem("scannedBarcodes");
        if (sessionBarcodes) {
          scannedBarcodes = JSON.parse(sessionBarcodes);
        }
      }
      
      if (storedDeleted) {
        deletedBarcodes = JSON.parse(storedDeleted);
      } else {
        // Fallback to sessionStorage
        const sessionDeleted = sessionStorage.getItem("deletedBarcodes");
        if (sessionDeleted) {
          deletedBarcodes = JSON.parse(sessionDeleted);
        }
      }
      
      // Enhanced: Try IndexedDB as additional fallback
      if ('indexedDB' in window && scannedBarcodes.length === 0) {
        const request = indexedDB.open('BarcodeApp', 1);
        request.onsuccess = function() {
          const db = request.result;
          const transaction = db.transaction(['barcodes'], 'readonly');
          const store = transaction.objectStore('barcodes');
          const scannedRequest = store.get('scannedBarcodes');
          const deletedRequest = store.get('deletedBarcodes');
          
          scannedRequest.onsuccess = function() {
            if (scannedRequest.result && scannedRequest.result.data) {
              scannedBarcodes = scannedRequest.result.data;
              updateView();
            }
          };
          
          deletedRequest.onsuccess = function() {
            if (deletedRequest.result && deletedRequest.result.data) {
              deletedBarcodes = deletedRequest.result.data;
            }
          };
        };
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      scannedBarcodes = [];
      deletedBarcodes = [];
    }
  };

  // Enhanced data sync function for cross-device compatibility
  const syncData = () => {
    try {
      // Sync between localStorage and sessionStorage
      const localBarcodes = localStorage.getItem("scannedBarcodes");
      const sessionBarcodes = sessionStorage.getItem("scannedBarcodes");
      
      if (localBarcodes && !sessionBarcodes) {
        sessionStorage.setItem("scannedBarcodes", localBarcodes);
      } else if (sessionBarcodes && !localBarcodes) {
        localStorage.setItem("scannedBarcodes", sessionBarcodes);
      }
      
      const localDeleted = localStorage.getItem("deletedBarcodes");
      const sessionDeleted = sessionStorage.getItem("deletedBarcodes");
      
      if (localDeleted && !sessionDeleted) {
        sessionStorage.setItem("deletedBarcodes", localDeleted);
      } else if (sessionDeleted && !localDeleted) {
        localStorage.setItem("deletedBarcodes", sessionDeleted);
      }
      
      // Enhanced: Sync with IndexedDB
      if ('indexedDB' in window) {
        const request = indexedDB.open('BarcodeApp', 1);
        request.onsuccess = function() {
          const db = request.result;
          const transaction = db.transaction(['barcodes'], 'readwrite');
          const store = transaction.objectStore('barcodes');
          
          // Update IndexedDB with current data
          store.put({ id: 'scannedBarcodes', data: scannedBarcodes });
          store.put({ id: 'deletedBarcodes', data: deletedBarcodes });
        };
      }
    } catch (error) {
      console.error('Failed to sync data:', error);
    }
  };

  // Auto-save functionality
  const autoSave = () => {
    saveData(false); // Don't show status message for auto-save
    showAutoSaveStatus("Auto-saved");
    // Schedule next auto-save
    setTimeout(autoSave, 30000); // Auto-save every 30 seconds
  };

  // Enhanced data export for cross-device transfer
  const exportDataForTransfer = () => {
    const exportData = {
      scannedBarcodes: scannedBarcodes,
      deletedBarcodes: deletedBarcodes,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `barcode-data-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showStatus("Data exported for transfer", "success");
  };

  // Enhanced data import for cross-device transfer
  const importDataFromTransfer = (file) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const importData = JSON.parse(e.target.result);
        
        if (importData.scannedBarcodes && Array.isArray(importData.scannedBarcodes)) {
          // Merge imported data with existing data, avoiding duplicates
          const existingCodes = new Set(scannedBarcodes.map(b => b.code));
          const newBarcodes = importData.scannedBarcodes.filter(b => !existingCodes.has(b.code));
          
          if (newBarcodes.length > 0) {
            scannedBarcodes.unshift(...newBarcodes);
            showStatus(`${newBarcodes.length} new barcodes imported`, "success");
          } else {
            showStatus("No new barcodes to import", "info");
          }
        }
        
        if (importData.deletedBarcodes && Array.isArray(importData.deletedBarcodes)) {
          deletedBarcodes.push(...importData.deletedBarcodes);
        }
        
        saveData();
        updateView();
      } catch (error) {
        showStatus("Invalid import file format", "error");
      }
    };
    reader.readAsText(file);
  };

  // Load data on startup
  loadData();
  syncData();
  
  // Start auto-save functionality
  autoSave();

  // --- Barcode entries now store date ---
  function getTodayYMD() {
    const now = new Date();
    return now.toISOString().slice(0, 10);
  }
  function getNowTimestamp() {
    return (new Date()).toISOString();
  }

  function upgradeBarcodesFormat() {
    let changed = false;
    scannedBarcodes = scannedBarcodes.map(b => {
      if (typeof b === 'string') {
        changed = true;
        return { code: b, date: getTodayYMD(), ts: getNowTimestamp() };
      }
      return b;
    });
    if (changed) saveData();
  }
  upgradeBarcodesFormat();

  const updateView = (filteredBarcodes = null) => {
    barcodeList.innerHTML = "";
    const search = searchInput.value.trim().toLowerCase();
    let toShow = filteredBarcodes || scannedBarcodes;
    if (search) {
      toShow = toShow.filter(obj => obj.code.toLowerCase().includes(search));
    }
    if (toShow.length === 0) {
      noMsg.style.display = "block";
    } else {
      noMsg.style.display = "none";
      toShow.forEach((obj, index) => {
        const li = document.createElement("li");
        li.className = "flex justify-between items-center bg-slate-700 p-2 rounded mb-1";
        // Reverse numbering: newest entries get higher numbers
        const displayNumber = toShow.length - index;
        li.innerHTML = `
          <span>${displayNumber}. ${obj.code} <span class="text-xs text-secondary">(${obj.date})</span></span>
          <button data-barcode="${obj.code}" class="text-red-400 hover:text-red-600 focus:outline-none">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm6 0a1 1 0 11-2 0v6a1 1 0 112 0V8z" clip-rule="evenodd" />
            </svg>
          </button>
        `;
        barcodeList.appendChild(li);
      });
    }
    uniqueCount.textContent = new Set(scannedBarcodes.map(b => b.code)).size;
    totalScannedCountEl.textContent = scannedBarcodes.length;
  };

  const showStatus = (message, type) => {
    statusMsg.textContent = message;
    statusMsg.className = `text-center text-sm mt-2 ${type === "error" ? "text-red-400" : type === "success" ? "text-green-400" : type === "info" ? "text-blue-400" : "text-yellow-400"}`;
    setTimeout(() => {
      statusMsg.textContent = "";
      statusMsg.className = "text-center text-sm mt-2";
    }, 3000);
  };

  // Enhanced status for auto-save (shorter duration)
  const showAutoSaveStatus = (message) => {
    const originalText = statusMsg.textContent;
    const originalClass = statusMsg.className;
    
    statusMsg.textContent = message;
    statusMsg.className = "text-center text-sm mt-2 text-green-400";
    
    setTimeout(() => {
      statusMsg.textContent = originalText;
      statusMsg.className = originalClass;
    }, 1500);
  };

  // Always play Apple Pay sound on success
  const playSuccessSound = () => {
    try {
      if (successSound) {
        successSound.currentTime = 0;
        const playPromise = successSound.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.log('Audio play failed:', error);
          });
        }
      }
    } catch(e) {
      console.log('Audio error:', e);
    }
  };

  const addBarcode = () => {
    const barcode = barcodeInput.value.trim();
    if (barcode) {
      if (!scannedBarcodes.some(b => b.code === barcode)) {
        // Add new barcode to the beginning of the array (top of list)
        scannedBarcodes.unshift({ code: barcode, date: getTodayYMD(), ts: getNowTimestamp() });
        showStatus("Done", "success");
        playSuccessSound();
        saveData();
      } else {
        showStatus("Barcode already exists!", "error");
      }
    }
    barcodeInput.value = "";
    updateView();
  };

  addBtn.addEventListener("click", addBarcode);
  barcodeInput.addEventListener("keypress", e => {
    if (e.key === "Enter") addBarcode();
  });

  barcodeList.addEventListener("click", e => {
    if (e.target.closest("button")) {
      const code = e.target.closest("button").dataset.barcode;
      scannedBarcodes = scannedBarcodes.filter(b => b.code !== code);
      deletedBarcodes.push(code);
      saveData();
      updateView();
      showStatus(`Barcode ${code} deleted.`, "info");
    }
  });

  searchInput.addEventListener("input", () => updateView());

  // --- Load Barcodes from file ---
  loadBarcodesBtn.addEventListener('click', () => loadBarcodesInput.click());
  loadBarcodesInput.addEventListener('change', function() {
    const file = this.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();
    reader.onload = function(e) {
      let arr = [];
      try {
        if (ext === 'csv') {
          arr = e.target.result.split(/\r?\n/).filter(Boolean).map(code => ({ code, date: getTodayYMD(), ts: getNowTimestamp() }));
        } else if (ext === 'json') {
          let data = JSON.parse(e.target.result);
          if (Array.isArray(data)) {
            arr = data.map(code => typeof code === 'string' ? { code, date: getTodayYMD(), ts: getNowTimestamp() } : code);
          }
        }
        if (arr.length) {
          // Add new barcodes to the beginning (top of list) and filter out duplicates
          const newBarcodes = arr.filter(entry => !scannedBarcodes.some(b => b.code === entry.code));
          scannedBarcodes.unshift(...newBarcodes);
          saveData();
          updateView();
          showStatus("Barcodes loaded!", "success");
        } else {
          showStatus("No valid barcodes found", "error");
        }
      } catch (e) {
        showStatus("Invalid file format", "error");
      }
    };
    reader.readAsText(file);
    loadBarcodesInput.value = "";
  });

  // --- Save Barcodes to file ---
  saveBarcodesBtn.addEventListener('click', () => {
    if (scannedBarcodes.length === 0) return showStatus("No barcodes to save", "error");
    const data = JSON.stringify(scannedBarcodes, null, 2);
    const link = document.createElement('a');
    link.setAttribute('href', 'data:application/json,' + encodeURIComponent(data));
    link.setAttribute('download', 'barcodes.json');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showStatus("Barcodes saved!", "success");
  });

  // --- Enhanced Cross-Device Data Transfer ---
  exportDataBtn.addEventListener('click', exportDataForTransfer);
  
  importDataBtn.addEventListener('click', () => importDataInput.click());
  
  importDataInput.addEventListener('change', function() {
    const file = this.files[0];
    if (!file) return;
    
    if (file.name.endsWith('.json')) {
      importDataFromTransfer(file);
    } else {
      showStatus("Please select a JSON file", "error");
    }
    
    importDataInput.value = "";
  });

  // --- Date-based search and load ---
  barcodeDateFilter.value = getTodayYMD();
  barcodeDateFilter.max = getTodayYMD();
  loadDateBarcodesBtn.addEventListener('click', () => {
    const ymd = barcodeDateFilter.value;
    if (!ymd) return showStatus("Select a date", "error");
    const filtered = scannedBarcodes.filter(b => b.date === ymd);
    updateView(filtered);
    showStatus(`Loaded barcodes for ${ymd}`, "success");
  });

  // --- CSV Download (all barcodes) ---
  document.getElementById("downloadCsvBtn").addEventListener("click", () => {
    if (scannedBarcodes.length === 0) return showStatus("No barcodes to download", "error");
    const csv = "data:text/csv;charset=utf-8," + scannedBarcodes.map(b => b.code).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csv));
    link.setAttribute("download", "barcodes.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showStatus("CSV downloaded!", "success");
  });

  // === Print Logic with Barcode Grid Layout ===
  function formatDateTime(dt = new Date()) {
    return dt.toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    });
  }
  function renderPrintHeader() {
    document.getElementById("printHeader").style.display = "none";
    document.getElementById("printDateTime").style.display = "none";
    document.getElementById("barcodePrintGrid").style.display = "none";
    // Always hide the logo for print
    var printLogo = document.getElementById("printLogo");
    if (printLogo) {
      printLogo.style.display = "none";
    }
  }
  function renderBarcodePrintGrid() {
    const grid = document.getElementById("barcodePrintGrid");
    grid.innerHTML = '';
    const toPrint = scannedBarcodes.slice(0, 150);
    const columns = 5;
    const perCol = 30;
    for (let col = 0; col < columns; col++) {
      const ul = document.createElement('ul');
      ul.style.cssText = 'margin: 0; padding: 0; list-style: none;';
      for (let row = 0; row < perCol; row++) {
        const idx = col * perCol + row;
        if (idx < toPrint.length) {
          const li = document.createElement('li');
          // Reverse numbering: newest entries get higher numbers
          const displayNumber = toPrint.length - idx;
          li.textContent = `${displayNumber}. ${toPrint[idx].code}`;
          li.style.cssText = 'padding: 4px 0; border-bottom: 1px solid #ddd; margin: 0 0 4px 0; font-family: "Courier New", monospace; font-size: 9pt; line-height: 1.3; word-break: break-all;';
          ul.appendChild(li);
        }
      }
      grid.appendChild(ul);
    }
  }
  document.getElementById("printScannedOrderBtn").addEventListener("click", () => {
    if (scannedBarcodes.length === 0) return showStatus("No barcodes to print", "error");
    // Always hide logo for print
    var printLogo = document.getElementById("printLogo");
    if (printLogo) {
      printLogo.style.display = "none";
    }
    renderBarcodePrintGrid();
    document.getElementById("printHeader").style.display = "block";
    document.getElementById("printDateTime").textContent = formatDateTime();
    document.getElementById("printDateTime").style.display = "block";
    document.getElementById("barcodePrintGrid").style.display = "grid";
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        renderPrintHeader();
      }, 500);
    }, 150);
  });
  renderPrintHeader();

  document.getElementById("showDeletedBtn").addEventListener("click", () => {
    Swal.fire({
      title: "Deleted Barcodes",
      html: deletedBarcodes.length > 0 ? deletedBarcodes.join("<br>") : "No deleted barcodes.",
      icon: "info",
      confirmButtonText: "Close",
      customClass: {
        popup: 'bg-slate-800 text-slate-100 rounded-lg shadow-xl',
        title: 'text-blue-300',
        content: 'text-slate-200',
        confirmButton: 'bg-blue-500 hover:bg-blue-600 text-white rounded-md px-4 py-2'
      }
    });
  });

  const correctPasscode = "9131";
  const checkPasscode = () => {
    if (passcodeInput.value === correctPasscode) {
      passModal.classList.add("hidden");
      mainApp.classList.remove("hidden");
      passcodeError.textContent = "";
      updateView();
    } else {
      passcodeError.textContent = "Invalid Passcode";
      errorSound.play();
    }
  };

  passcodeBtn.addEventListener("click", checkPasscode);
  passcodeInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") checkPasscode();
  });

  logoutBtn.addEventListener("click", () => {
    passModal.classList.remove("hidden");
    mainApp.classList.add("hidden");
    passcodeInput.value = "";
    passcodeError.textContent = "";
  });

  // Live clock in header
  const updateCurrentDate = () => {
    const now = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: "2-digit", minute: "2-digit", second: "2-digit" };
    currentDateEl.textContent = now.toLocaleDateString('en-US', options);
  };
  updateCurrentDate();
  setInterval(updateCurrentDate, 1000);

  if (!mainApp.classList.contains("hidden")) {
    updateView();
  }

  if (clearHomeListBtn) {
    clearHomeListBtn.addEventListener("click", () => {
      Swal.fire({
        title: 'Clear displayed list?',
        text: 'This will only clear the current view, not delete saved barcodes.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Clear',
        cancelButtonText: 'Cancel',
      }).then(result => {
        if (result.isConfirmed) {
          barcodeList.innerHTML = "";
          noMsg.style.display = "block";
        }
      });
    });
  }
});
