console.log('UI would show up.');

// Use 'let' so the variable can be populated once storage returns data
let assignments = [];

function renderCheckboxList(taskItems) {
    console.log("Rendering checkbox list...");
    const container = document.getElementById('checkboxList');
    container.innerHTML = '';

    if (!taskItems || taskItems.length === 0) {
        container.innerHTML = '<p>No assignments found.</p>';
        return;
    }

    taskItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'task-item';

        // Fixed property names to match what you saved: name, courseName, dueDate
        div.innerHTML = `
            <label>
                <input type="checkbox" value="${item.assLink || '#'}" />
                <strong>${item.name || 'Unknown Assignment'}</strong>
                <span class="meta">${item.courName || ''} \nDue: ${item.dueDate || 'No Date'} \n"${item.assDesc || 'No description'}</span>
            </label>
            
        `;
        container.appendChild(div);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("can i render it now");
    
    chrome.storage.local.get(['cachedAssignments'], (result) => {
        // Safe check for storage results
        assignments = result.cachedAssignments || [];
        console.log("printing assignments:", assignments);
        
        renderCheckboxList(assignments);
    });
});