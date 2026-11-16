const DATABASE_NAME = "assignmentList";
const DATABASE_VERSION = 3;
const ASSIGNMENTS_STORE = "assignments";
const LEGACY_STORAGE_KEY = "cachedAssignments";

let databasePromise;
let migrationPromise;
console.log("Service worker started.");
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
        console.log("Requested IndexedDB");
        request.onupgradeneeded = () => {
            console.log("Data store does not exist or is outdated, rebuild.");
            const db = request.result;
            if (!db.objectStoreNames.contains(ASSIGNMENTS_STORE)) {
                db.createObjectStore(ASSIGNMENTS_STORE, { keyPath: "id" });
            }
        };

        request.onsuccess = () => {
            console.log("DB good.");
            const db = request.result;
            db.onversionchange = () => db.close();
            resolve(db);
        };

        request.onerror = () => {
            reject(request.error || new Error("Could not open the assignments database."));
        };
        request.onblocked = () => {
            reject(new Error("The assignments database upgrade is blocked by another open connection."));
        };
    });
}

function getLegacyAssignments() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(LEGACY_STORAGE_KEY, (result) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            resolve(result[LEGACY_STORAGE_KEY]);
        });
    });
}

function removeLegacyAssignments() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.remove(LEGACY_STORAGE_KEY, () => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            resolve();
        });
    });
}

function normalizeAssignments(items, baseUrl) {
    if (!Array.isArray(items)) {
        throw new Error("Assignments must be provided as an array.");
    }

    return items.map((item, index) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
            throw new Error(`Assignment at position ${index} is not a valid object.`);
        }

        const assLink = typeof item.assLink === "string" && item.assLink.trim()
            ? item.assLink.trim()
            : null;
        let id = null;

        if (assLink) {
            let urlForId = assLink;
            try {
                urlForId = baseUrl ? new URL(assLink, baseUrl).href : new URL(assLink).href;
            } catch {
                // Try extracting an ID from the original link if URL parsing fails.
            }
            id = urlForId.match(/(\d+)(?!.*\d)/)?.[1] || null;
        }

        if (!id) {
            id = `generated:${encodeURIComponent(JSON.stringify([
                item.courName || "",
                item.name || "",
                item.dueDate || "",
                index
            ]))}`;
        }

        return {
            ...item,
            id,
            assLink,
            assDesc: item.assDesc ?? null
        };
    });
}

function getAllAssignments(db) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(ASSIGNMENTS_STORE, "readonly");
        const request = transaction.objectStore(ASSIGNMENTS_STORE).getAll();
        let assignments;

        request.onsuccess = () => {
            assignments = request.result;
        };
        transaction.oncomplete = () => resolve(assignments);
        transaction.onerror = () => {
            reject(transaction.error || new Error("Could not read assignments."));
        };
        transaction.onabort = () => {
            reject(transaction.error || new Error("Reading assignments was aborted."));
        };
    });
}

function getAssignmentMatchKey(assignment) {
    const name = typeof assignment.name === "string" ? assignment.name.trim().toLowerCase() : "";
    if (!name || name === "unknown") {
        return null;
    }

    return JSON.stringify([
        name,
        typeof assignment.courName === "string" ? assignment.courName.trim().toLowerCase() : "",
        typeof assignment.dueDate === "string" ? assignment.dueDate.trim().toLowerCase() : ""
    ]);
}

function reconcileAssignments(existingAssignments, assignments) {
    const existingByIdentity = new Map();
    existingAssignments.forEach((assignment) => {
        const key = getAssignmentMatchKey(assignment);
        if (key && !existingByIdentity.has(key)) {
            existingByIdentity.set(key, assignment);
        }
    });

    return assignments.map((assignment) => {
        const existingAssignment = existingByIdentity.get(getAssignmentMatchKey(assignment));
        if (!existingAssignment) {
            return assignment;
        }

        if (assignment.assLink) {
            return assignment;
        }

        if (existingAssignment.assLink) {
            return {
                ...assignment,
                id: existingAssignment.id,
                assLink: existingAssignment.assLink
            };
        }

        return assignment;
    });
}

function replaceAssignments(db, assignments) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(ASSIGNMENTS_STORE, "readwrite");
        const store = transaction.objectStore(ASSIGNMENTS_STORE);
        const request = store.getAll();

        request.onsuccess = () => {
            const reconciledAssignments = reconcileAssignments(request.result, assignments);
            store.clear();
            reconciledAssignments.forEach((assignment) => store.put(assignment));
        };

        transaction.oncomplete = resolve;
        transaction.onerror = () => {
            reject(transaction.error || new Error("Could not save assignments."));
        };
        transaction.onabort = () => {
            reject(transaction.error || new Error("Saving assignments was aborted."));
        };
    });
}

async function migrateLegacyAssignments(db) {
    const storedAssignments = await getAllAssignments(db);
    if (storedAssignments.length > 0) {
        return;
    }

    const legacyAssignments = await getLegacyAssignments();
    if (legacyAssignments === undefined) {
        return;
    }

    const normalizedAssignments = normalizeAssignments(legacyAssignments);
    await replaceAssignments(db, normalizedAssignments);
    await removeLegacyAssignments();
}

async function getReadyDatabase() {
    if (!databasePromise) {
        databasePromise = openDatabase();
    }

    const db = await databasePromise;
    if (!migrationPromise) {
        migrationPromise = migrateLegacyAssignments(db).catch((error) => {
            migrationPromise = null;
            throw error;
        });
    }
    await migrationPromise;
    return db;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== "assignments:get" && message?.type !== "assignments:replace") {
        return;
    }

    (async () => {
        const db = await getReadyDatabase();

        if (message.type === "assignments:get") {
            sendResponse({ ok: true, assignments: await getAllAssignments(db) });
            return;
        }

        const assignments = normalizeAssignments(message.assignments, sender.url);
        await replaceAssignments(db, assignments);
        sendResponse({ ok: true });
    })().catch((error) => {
        console.error("Assignment database operation failed:", error);
        sendResponse({ ok: false, error: error.message || "Assignment database operation failed." });
    });

    return true;
});
