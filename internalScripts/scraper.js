// this should be running from gate.js


function scrapeW2D_homepage() {
    const assignments = [];

    try {
        const w2dWidget = document.querySelector('d2l-w2d-work-to-do');
        
        const w2dCollections = w2dWidget?.shadowRoot.querySelector('d2l-w2d-collections');

        const w2dListContainer = w2dCollections?.shadowRoot.querySelector('d2l-w2d-list');

        const d2lList = w2dListContainer?.shadowRoot.querySelector('d2l-list');
        if (!d2lList || !d2lList.shadowRoot) throw new Error("List not found. Exiting.");
        // running through all item types
        const items = d2lList?.querySelectorAll('d2l-w2d-list-item-quiz, d2l-w2d-list-item-assignment, d2l-w2d-list-item-discussion, d2l-w2d-list-item-content');
        items.forEach((item, index) => {
            if (!item.shadowRoot) throw new Error("it would appear we dont have an assignment after all... exiting");;

            const itemGenericLayout = item?.shadowRoot.querySelector('d2l-list-item-generic-layout');
            if (!itemGenericLayout || !itemGenericLayout.shadowRoot) throw new Error("No generic layout why");

            const itemContentSlot = itemGenericLayout?.querySelector('div[slot="content"], div[slot="content-action"]');
            if (!itemContentSlot) throw new Error("No content div why");

            let assignmentLink = null;
            const itemHref = itemContentSlot?.querySelector('a');
            
            if (!itemHref){
                console.log("Unclickable assignment. Disregard");
            } else {
                assignmentLink = itemHref?.getAttribute('href');
            }
            // we grabbing the name
            const itemNameElement = itemContentSlot?.querySelector('[class*="d2l-w2d-list-item-name"]');
            let assignmentName = "Unknown";
            if (itemNameElement && itemNameElement.shadowRoot) {
                assignmentName = itemNameElement?.getAttribute("_label");
                if (assignmentName === null) {
                assignmentName = itemNameElement?.shadowRoot.textContent?.trim() || "Unknown";
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

            const curAssign = {
                name: assignmentName,
                dueDate: parsedDate,
                courLink: assignmentLink,
                courName: courseName
            };
            assignments.push(curAssign);
        })

    } catch (error) {
        console.error("Guys we fucked up.", error);
    }
    console.log(assignments);
    return assignments
}

function scrapeW2D_fullToDo() {
    const assignments = [];

    try {
        const w2dWidget = document.querySelector('d2l-w2d-work-to-do');
        const w2dCollections = w2dWidget?.shadowRoot?.querySelector('d2l-w2d-collections');
        
        if (!w2dCollections || !w2dCollections.shadowRoot) {
            throw new Error("Collections component not found. Exiting.");
        }

        const collectionsRoot = w2dCollections.shadowRoot;
        const flexBlocks = collectionsRoot.querySelectorAll('div.d2l-w2d-flex');
        const listContainers = collectionsRoot.querySelectorAll('d2l-w2d-list');

        // Loop starting from index 1 to skip the "Upcoming Work" header block
        for (let i = 1; i < flexBlocks.length; i++) {
            const flexBlock = flexBlocks[i];
            
            // Grab the Date from the heading inside the flex block
            const dateHeading = flexBlock.querySelector('h3.d2l-w2d-heading-3');
            const rawDueDate = dateHeading ? dateHeading.textContent.trim() : "Unknown Date";

            const listContainer = listContainers[i - 1];
            if (!listContainer || !listContainer.shadowRoot) continue;

            const d2lList = listContainer.shadowRoot.querySelector('d2l-list');
            if (!d2lList) continue;

            // Running through all item types for this specific date
            const items = d2lList.querySelectorAll(
                'd2l-w2d-list-item-quiz, d2l-w2d-list-item-assignment, d2l-w2d-list-item-discussion, d2l-w2d-list-item-content'
            );

            items.forEach((item) => {
                if (!item.shadowRoot) return;

                const itemGenericLayout = item.shadowRoot.querySelector('d2l-list-item-generic-layout');
                if (!itemGenericLayout || !itemGenericLayout.shadowRoot) return;

                const itemContentSlot = itemGenericLayout.shadowRoot.querySelector('div[slot="content"], div[slot="content-action"]');
                if (!itemContentSlot) return;

                let assignmentLink = null;
                const itemHref = itemContentSlot.querySelector('a');
                
                if (!itemHref) {
                    console.log("Unclickable assignment. Disregard");
                } else {
                    assignmentLink = itemHref.getAttribute('href');
                }

                // Grabbing the name using your shadow root text content fallback pattern
                const itemNameElement = itemContentSlot.querySelector('[class*="d2l-w2d-list-item-name"]');
                let assignmentName = "Unknown";
                if (itemNameElement && itemNameElement.shadowRoot) {
                    assignmentName = itemNameElement.getAttribute("_label");
                    if (assignmentName === null) {
                        assignmentName = itemNameElement.shadowRoot.textContent?.trim() || "Unknown";
                    }
                } 

                // Grabbing the course name from the attribute list spans
                const attrList = itemContentSlot.querySelector('d2l-w2d-attribute-list');
                let courseName = "What is life?";

                if (attrList) {
                    const spans = attrList.querySelectorAll('span');
                    // On the full page, the course name is usually the last span in the attribute list
                    if (spans.length > 0) {
                        courseName = spans[spans.length - 1].textContent.trim();
                    }
                }

                const activityDescElement = itemContentSlot.querySelector('d2l-activity-description-quiz, d2l-activity-description-assignment, d2l-activity-description-discussion, d2l-activity-description-content');
                let description = "";
                if (activityDescElement && activityDescElement.shadowRoot) {
                    const descSpan = activityDescElement.shadowRoot.querySelector('span');
                    description = descSpan?.textContent?.trim() || "";
                }

                const parsedDate = parseDueDate ? parseDueDate(rawDueDate) : rawDueDate;

                const curAssign = {
                    name: assignmentName,
                    dueDate: parsedDate,
                    courLink: assignmentLink,
                    courName: courseName,
                    description: description
                };
                assignments.push(curAssign);
            });
        }

    } catch (error) {
        console.error("Guys we fucked up.", error);
    }

    console.log(assignments);
    return assignments;
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
        console.log("Checking for D2L Work To Do widget...");

        try {
            // Safely traverse shadow DOMs using optional chaining (?.)
            const widget = document.querySelector('d2l-w2d-work-to-do');
            const collections = widget?.shadowRoot?.querySelector('d2l-w2d-collections');
            const listContainer = collections?.shadowRoot?.querySelector('d2l-w2d-list');
            const list = listContainer?.shadowRoot?.querySelector('d2l-list');
            
            const items = list?.querySelectorAll(
                'd2l-w2d-list-item-quiz, d2l-w2d-list-item-assignment, d2l-w2d-list-item-discussion, d2l-w2d-list-item-content'
            );

            // Check if items actually exist and have loaded
            if (items && items.length > 0) {
                clearInterval(checkInterval); // Stop checking once found
                console.log("D2L Work To Do widget loaded with " + items.length + " items!");
                
                const assignments = scrapeW2D_homepage();

                // Write to local storage
                chrome.storage.local.set({ cachedAssignments: assignments }, () => {
                    console.log("Assignments saved to storage.");
                });
            } else {
                console.log("Widget found, but items are still loading...");
            }
        } catch (error) {
            // Catches any temporary null-reference errors while the DOM builds
            console.log("DOM still loading, retrying...");
        }
    }, 2000);
}

function waitForW2DWidget_fullToDo() {
    const checkInterval = setInterval(() => {
        console.log("Checking for D2L Work To Do widget...");

        try {
            // Safely traverse shadow DOMs using optional chaining (?.)
            const widget = document.querySelector('d2l-w2d-work-to-do');
            const collections = widget?.shadowRoot?.querySelector('d2l-w2d-collections');
            const listContainer = collections?.shadowRoot?.querySelector('d2l-w2d-list');
            const list = listContainer?.shadowRoot?.querySelector('d2l-list');
            
            const items = list?.querySelectorAll(
                'd2l-w2d-list-item-quiz, d2l-w2d-list-item-assignment, d2l-w2d-list-item-discussion, d2l-w2d-list-item-content'
            );

            // Check if items actually exist and have loaded
            if (items && items.length > 0) {
                clearInterval(checkInterval); // Stop checking once found
                console.log("D2L Work To Do widget loaded with " + items.length + " items!");
                
                const assignments = scrapeW2D_fullToDo();

                // Write to local storage
                chrome.storage.local.set({ cachedAssignments: assignments }, () => {
                    console.log("Assignments saved to storage.");
                });
            } else {
                console.log("Widget found, but items are still loading...");
            }
        } catch (error) {
            // Catches any temporary null-reference errors while the DOM builds
            console.log("DOM still loading, retrying...");
        }
    }, 2000);
}

export function initializeScraper(method) {
    console.log("scraper.js was called. Origin passed in " + method);
    if (method === "home"){
        waitForW2DWidget_homepage();
    } else if (method === "full") {
        waitForW2DWidget_fullToDo();
    }
}

console.log ("Script was loaded automagically. DONT RUN SHIIIIIT")