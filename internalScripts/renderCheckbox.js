// grabbing from storage

//async function storageRetrieval() {
//    try {
//        // yuh
//        const assignData = await chrome.storage.local.get([ cachedAssignments ])
//        if (!assignData) throw new Error("Retrieval fail.");
//
//        console.log(assignData);
//    } catch (error) {
//         
//    }
//}

console.log('UI would show up.');
const assignments = [];

document.addEventListener('DOMContentLoaded', async () => {
    chrome.storage.local.get(['cachedAssignments'], (result) => {
        assignments = result.cachedAssignments || [];
        renderCheckboxList(assignments)
    })
})

function renderCheckboxList(assignments) {
    const container = document.getElementById('checkboxList');
    container.innerHTML = '';

    if (assignments.length === 0) {
        container.innerHTML = '<p>No assignments found.</p>';
        return;
    }

    assignments.forEach(item => {
        const div = document.createElement('div')
        div.className = 'task-item';

        div.innerHTML = `
            <label>
                <input type="checkbox" value="${item.id}" />
                <strong>${item.assignmentName}</strong>
            </label>
            <span class="meta">${item.courseName} - ${item.rawDueDate}</span>
        `;
        container.appendChild(div);
    });
}