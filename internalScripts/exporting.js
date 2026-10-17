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
        const eventDate = formatDateForICS(item.dueDate);

        icsContent += "BEGIN:VEVENT\r\n";
        icsContent += `SUMMARY:${escapeICS(item.name || 'Untitled Assignment')}\r\n`;
        icsContent += `DESCRIPTION:${escapeICS(item.assDesc || 'No description provided')}`;
        if (item.assLink) {
            icsContent += `\\nLink: ${escapeICS(item.assLink)}`;
        }
        icsContent += "\r\n";
        icsContent += `LOCATION:${escapeICS(item.courName)}\r\n`;
        if (eventDate) {
            icsContent += `DTSTART:${eventDate}\r\n`;
            icsContent += `DTEND:${eventDate}\r\n`;
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

export function initializeExport(method, items){
    console.log("Export initialized for " + method);
    if (method === "ics"){
        exportToICS(items);
    } else if (method === "google") {
        console.log("we not at google yet");
    } else if (method === "microsoft") {
        console.log("we not at microsoft yet");
    } else {
        console.log("export initialized. invalid method (yeah idk what this is)");
    }
}

console.log('Script loaded but we not running');