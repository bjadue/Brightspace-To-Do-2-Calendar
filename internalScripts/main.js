// this should be running from gate.js


function scrapeW2D_homepage() {
    const assignments = [];

    try {
        const w2dWidget = document.querySelector('d2l-w2d-work-to-do');
        if (!w2dWidget || !w2dWidget.shadowRoot) return [];

        const w2dCollections = w2dWidget.shadowRoot.querySelector('d2l-w2d-collections');
        if (!w2dCollections || !w2dCollections.shadowRoot) return [];

        const w2dListContainer = w2dCollections.shadowRoot.querySelector('d2l-w2d-list');
        if (!w2dListContainer || !w2dListContainer.shadowRoot) return [];

        const d2lList = w2dListContainer.shadowRoot.querySelector('d2l-list');
        if (!d2lList) return [];

        // running through all item types
        const items = d2lList.querySelectorAll('d2l-w2d-list-item-quiz, d2l-w2d-list-item-assignment, d2l-w2d-list-item-discussion, d2l-w2d-list-item-content');

        items.forEach((item, index) => {
            if (!item.shadowRoot) return;

            const itemGenericLayout = item.shadowRoot.querySelector('d2l-list-item-generic-layout');
            if (!itemGenericLayout || !itemGenericLayout.shadowRoot) return;

            const itemContentSlot = itemGenericLayout.shadowRoot.querySelector('div[slot="content"]');
            if (!itemContentSlot) return;
            // we grabbing the name
            const itemNameElement = itemContentSlot.querySelector('[class*="d2l-w2d-list-item-name"]');
            let assignmentName = "Unknown";
            if (itemNameElement && itemNameElement.shadowRoot) {
                const itemHcName = itemNameElement.shadowRoot.querySelector('d2l-wc-name');
                if (itemHcName && itemHcName.shadowRoot) {
                    const span = itemHcName.shadowRoot.querySelector('span.d2l-skeletize');
                    if (span) assignmentName = span.textContent.trim();
                }
            }

            //we grabbing the due date and course name
            const attrList = itemContentSlot.querySelector('d2l-w2d-attribute-list');
            let rawDueDate = "";
            let courseName = "What is life?";

            if (attrList) {
                // must peep the spans
                const spans = attrList.querySelectorAll('span');
                if (spans.length > 0) rawDueDate = spans[0].textContent.trim(); // hopefully we get Mth ##
                if (spans.length > 1) courseName = spans[1].textContent.trim(); // hopefully we get a course name
            }

            //get the right due date
            const parsedDate = parseDueDate(rawDueDate)
        })

    } catch (error) {
        console.error("Guys we fucked up.", error);
    }
    return assignments
}

function parseDueDate(rawInfo) {
    if (!rawInfo) return null;

    const cleanStr = rawInfo.replace(/^Due\s+/i, '').trim(); // screw the due
    const currentYear = new Date().getFullYear();

    const parsedDateObj = new Date(`${cleanStr} ${currentYear}`);

    const today = new Date();
    if (parsedDateObj < today && (today - parsedDateObj) > (100 * 24 * 60 * 60 * 1000)) {
        parsedDateObj.setFullYear(currentYear + 1);
    }
    return parsedDateObj.toLocaleDateString('en-US');
}

function waitForW2DWidget_homepage() {
    const checkInterval = setInterval(() => {
        const widget = document.querySelector('d2l-w2d-work-to-do');
    
        // does the w2d widget exist yet and is shadow root accessible
        if (widget && widget.shadowRoot) {
            clearInterval(checkInterval); // Stop checking once found
      
            console.log("D2L Work To Do widget loaded. We on that shit rn");
            const assignments = scrapeW2D_homepage();
      
            // write to local storage
            chrome.storage.local.set({ cachedAssignments: assignments }, () => {
            console.log("Assignments saved to storage.");
            });
        }
    }, 1000);
}

waitForW2DWidget_homepage();