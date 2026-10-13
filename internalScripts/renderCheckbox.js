// grabbing from storage

async function storageRetrieval() {
    try {
        // yuh
        const assignData = await chrome.storage.local.get([ cachedAssignments ])
        if (!assignData) throw new Error("Retrieval fail.");

        console.log(assignData);
    } catch (error) {
         
    }
}