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

    taskItems.forEach(item => {
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
});
