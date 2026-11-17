console.log('UI would show up.');
// Use 'let' so the variable can be populated once storage returns data
let assignments = [];
const exportURL = chrome.runtime.getURL('/internalScripts/exporting.js');
const exporter = import(exportURL);

function renderCheckboxList(taskItems) {
    console.log("Rendering checkbox list...");
    const container = document.getElementById('checkboxList');
    container.innerHTML = '';

    if (!taskItems || taskItems.length === 0) {
        container.innerHTML = '<p>No assignments found. (Try reloading extension?)</p>';
        return;
    }

    const getDueDay = (item) => {
        const dueTimestamp = Date.parse(item.dueDate || item.endDateTime);
        if (Number.isNaN(dueTimestamp)) return null;

        const dueDate = new Date(dueTimestamp);
        return new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()).getTime();
    };
    const sortedItems = [...taskItems].sort((first, second) => {
        const firstDue = getDueDay(first);
        const secondDue = getDueDay(second);
        const firstHasDueDate = firstDue !== null;
        const secondHasDueDate = secondDue !== null;

        if (!firstHasDueDate) return secondHasDueDate ? 1 : 0;
        if (!secondHasDueDate) return -1;
        return firstDue - secondDue;
    });

    sortedItems.forEach(item => {
        const div = document.createElement('div');
        const fullDesc = item?.assDesc
        const trunDesc = (str, n) => {
            if (!str) return "(No Description)";
            return str.length > n ? str.slice(0, n) + '[...]' : str;
        }
            
        div.className = 'task-item';

        div.innerHTML = `
            <span>
                <label>
                    <input type="checkbox" value="${item.id}" />
                    <strong>${item.name || 'Unknown Assignment'}</strong><br>
                    <span class="meta"> Due: ${item.dueDate || 'No Date'} - ${item.courName || ''} - ${trunDesc(fullDesc, 200) || item.assDesc} </span>
                </label>
            </span>
            
        `;
        container.appendChild(div);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded");
    
    chrome.runtime.sendMessage({ type: 'assignments:get' }, (response) => {
        if (chrome.runtime.lastError || !response?.ok) {
            const error = chrome.runtime.lastError?.message || response?.error || 'No response from the extension database.';
            document.getElementById('checkboxList').textContent = `Could not load assignments: ${error}`;
            return;
        }

        assignments = response.assignments || [];
        renderCheckboxList(assignments);
    });

    let areWeSignedIn = false;
    const googleButton = document.getElementById('btnConnectGoogle');
    const googleTaskListInput = document.getElementById('googleTaskListInput');
    const googleTaskLists = document.getElementById('googleTaskLists');
    const googleTaskListStatus = document.getElementById('googleTaskListStatus');
    const exportGoogleButton = document.getElementById('btnExportToGoogle');
    const googleExportingRegion = document.getElementById('googleExportRegion');

    const setGoogleConnectionState = (connected) => {
        areWeSignedIn = connected;
        googleButton.textContent = connected ? 'Disconnect Google' : 'Connect Google Tasks';
        googleExportingRegion.hidden = !connected;
        googleTaskListInput.disabled = !connected;
        if (!connected) {
            googleTaskListInput.value = '';
            googleTaskLists.replaceChildren();
            exportGoogleButton.hidden = true;
        }
    };

    const loadGoogleTaskLists = async () => {
        googleTaskListStatus.hidden = false;
        googleTaskListStatus.textContent = 'Loading your Google Task Lists...';
        try {
            const exporterModule = await exporter;
            const taskLists = await exporterModule.getGoogleTaskLists();
            googleTaskLists.replaceChildren();
            taskLists.forEach((taskList) => {
                const option = document.createElement('option');
                option.value = taskList.title;
                googleTaskLists.appendChild(option);
            });
            googleTaskListStatus.hidden = true;
        } catch (error) {
            googleTaskListStatus.textContent = `Could not load Task Lists: ${error.message}`;
        }
    };

    googleTaskListInput?.addEventListener('input', () => {
        exportGoogleButton.hidden = !googleTaskListInput.value.trim();
    });

    googleButton?.addEventListener('click', () => {
        googleButton.disabled = true;

        if (areWeSignedIn) {
            chrome.identity.clearAllCachedAuthTokens(() => {
                googleButton.disabled = false;
                if (chrome.runtime.lastError) {
                    googleTaskListStatus.hidden = false;
                    googleTaskListStatus.textContent = `Could not disconnect Google: ${chrome.runtime.lastError.message}`;
                    return;
                }
                setGoogleConnectionState(false);
                googleTaskListStatus.textContent = '';
            });
            return;
        }

        chrome.identity.getAuthToken({ interactive: true }, async (result) => {
            if (chrome.runtime.lastError) {
                googleButton.disabled = false;
                alert(`Google sign-in failed: ${chrome.runtime.lastError.message}`);
                return;
            }
            const token = typeof result === 'string' ? result : result?.token;
            if (!token) {
                googleButton.disabled = false;
                alert('Google sign-in did not return an access token.');
                return;
            }

            try {
                setGoogleConnectionState(true);
                await loadGoogleTaskLists();
            } catch (error) {
                setGoogleConnectionState(false);
                googleTaskListStatus.hidden = false;
                googleTaskListStatus.textContent = `Could not load Task Lists: ${error.message}`;
            } finally {
                googleButton.disabled = false;
            }
        });
    });

    chrome.identity.getAuthToken({ interactive: false }, (result) => {
        if (chrome.runtime.lastError) return;
        const token = typeof result === 'string' ? result : result?.token;
        if (!token) return;
        setGoogleConnectionState(true);
        loadGoogleTaskLists();
    });

    const icsButton = document.getElementById('btnExportToICS');
    if (icsButton) {
        icsButton.addEventListener('click', async function() {
            console.log("Export to ICS button clicked");
            const selectedAssignmentElements = document.querySelectorAll("input[type='checkbox']:checked");
            const selectedAssignments = Array.from(selectedAssignmentElements)
                .map(element => assignments.find(assignment => assignment.id === element.value))
                .filter(Boolean);

            const exporterModule = await exporter;
            exporterModule.initializeExport("ics", selectedAssignments);
        })
    }

    if (exportGoogleButton) {
        exportGoogleButton.addEventListener('click', async function() {
            console.log("Export to Google button clicked");
            const selectedAssignmentElements = document.querySelectorAll("input[type='checkbox']:checked");
            const selectedAssignments = Array.from(selectedAssignmentElements)
                .map(element => assignments.find(assignment => assignment.id === element.value))
                .filter(Boolean);

            const exporterModule = await exporter;
            exportGoogleButton.disabled = true;
            try {
                await exporterModule.initializeExport(
                    "google",
                    selectedAssignments,
                    googleTaskListInput.value
                );
            } finally {
                exportGoogleButton.disabled = false;
            }
        })
    }

});
