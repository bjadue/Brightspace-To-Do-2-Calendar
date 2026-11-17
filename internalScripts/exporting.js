function exportToICS(items) {
    if (!Array.isArray(items) || items.length === 0) {
        alert("No assignments available to export!");
        return;
    }

    const escapeICS = (value) => String(value || '')
        .replace(/\\/g, '\\\\')
        .replace(/\r?\n/g, '\\n')
        .replace(/([,;])/g, '\\$1');

    const formatDateForICS = (dateValue) => {
        if (!dateValue) return null;

        const date = new Date(dateValue);
        if (Number.isNaN(date.getTime())) return null;

        return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    };

    let icsContent = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Brightspace To-Do Exporter//EN\r\n";

    items.forEach(item => {
        const startDate = formatDateForICS(item.startDateTime || item.dueDate);
        const endDate = formatDateForICS(item.endDateTime || item.dueDate);

        icsContent += "BEGIN:VEVENT\r\n";
        icsContent += `SUMMARY:${escapeICS(item.name || 'Untitled Assignment')}\r\n`;
        icsContent += `DESCRIPTION:${escapeICS(item.assDesc || 'No description provided')}`;
        if (item.assLink) {
            icsContent += `\\nLink: ${escapeICS(item.assLink)}`;
        }
        icsContent += `LOCATION:${escapeICS(item.courName)}\r\n`;
        if (startDate && endDate) {
            icsContent += `DTSTART:${startDate}\r\n`;
            icsContent += `DTEND:${endDate}\r\n`;
        }
        icsContent += "END:VEVENT\r\n";
    });

    icsContent += "END:VCALENDAR\r\n";

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'brightspace-assignments.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    console.log("ICS file generated with " + items.length + " items.");
}

function getGoogleAccessToken() {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: false }, (result) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            const token = typeof result === 'string' ? result : result?.token;
            if (!token) {
                reject(new Error("Connect Google Tasks before exporting."));
                return;
            }
            resolve(token);
        });
    });
}

function removeCachedGoogleToken(token) {
    return new Promise((resolve, reject) => {
        chrome.identity.removeCachedAuthToken({ token }, () => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            resolve();
        });
    });
}

async function requestGoogleTasks(path, token, options = {}, retry = true) {
    const response = await fetch(`https://tasks.googleapis.com/tasks/v1/${path}`, {
        ...options,
        headers: {
            "Authorization": `Bearer ${token}`,
            ...(options.headers || {})
        }
    });

    if (response.status === 401 && retry) {
        await removeCachedGoogleToken(token);
        const freshToken = await getGoogleAccessToken();
        return requestGoogleTasks(path, freshToken, options, false);
    }

    if (!response.ok) {
        throw new Error(`Google Tasks returned ${response.status}: ${await response.text()}`);
    }
    return response;
}

async function fetchGoogleTaskLists(token) {
    const taskLists = [];
    let pageToken;

    do {
        const query = new URLSearchParams({ maxResults: "100" });
        if (pageToken) query.set("pageToken", pageToken);

        const response = await requestGoogleTasks(
            `users/@me/lists?${query.toString()}`,
            token
        );
        const data = await response.json();
        if (Array.isArray(data.items)) taskLists.push(...data.items);
        pageToken = data.nextPageToken;
    } while (pageToken);

    return taskLists;
}

export async function getGoogleTaskLists() {
    const token = await getGoogleAccessToken();
    return fetchGoogleTaskLists(token);
}

function formatTaskDue(item) {
    const value = item.endDateTime || item.dueDate;
    if (!value) return undefined;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;

    // api does not take the time (why)
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T00:00:00.000Z`;
}

async function exportToGoogleTasks(items, requestedListTitle) {
    if (!Array.isArray(items) || items.length === 0) {
        alert("Select at least one assignment to export.");
        return;
    }
    if (typeof requestedListTitle !== "string" || !requestedListTitle.trim()) {
        alert("Choose or enter a Google Task List name.");
        return;
    }

    let created = 0;
    try {
        const token = await getGoogleAccessToken();
        const listTitle = requestedListTitle.trim();
        const taskLists = await fetchGoogleTaskLists(token);
        const matchingLists = taskLists.filter((taskList) => taskList.title === listTitle);
        if (matchingLists.length > 1) {
            throw new Error(`More than one Google Task List is named "${listTitle}". Rename a list and try again.`);
        }

        let taskList = matchingLists[0];
        if (!taskList) {
            const response = await requestGoogleTasks("users/@me/lists", token, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: listTitle })
            });
            taskList = await response.json();
        }
        if (!taskList?.id) {
            throw new Error(`Could not resolve the Google Task List "${listTitle}".`);
        }

        for (const item of items) {
            const notes = [
                item.courName && `Course: ${item.courName}`,
                item.assDesc,
                item.assLink && `\nLink: \n${item.assLink}`
            ].filter(Boolean).join("\n\n");

            const task = {
                title: item.name || "Untitled Assignment",
                notes,
                status: "needsAction"
            };
            const due = formatTaskDue(item);
            if (due) task.due = due;

            await requestGoogleTasks(
                `lists/${encodeURIComponent(taskList.id)}/tasks`,
                token,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(task)
                }
            );
            created++;
        }

        alert(`Exported ${created} task(s) to "${taskList.title}".`);
    } catch (error) {
        console.error("Google Tasks export failed:", error);
        alert(`Export stopped after creating ${created} of ${items.length} task(s): ${error.message}`);
    }
}

export function initializeExport(method, items, listTitle){
    console.log("Export initialized for " + method);
    if (method === "ics"){
        exportToICS(items);
    } else if (method === "google") {
        return exportToGoogleTasks(items, listTitle);
    } else if (method === "microsoft") {
        console.log("we not at microsoft yet");
    } else {
        console.log("export initialized. invalid method (yeah idk what this is)");
    }
}

console.log('Script loaded but we not running');