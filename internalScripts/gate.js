console.log("Script loaded to check if this is Brightspace");

//if brightspace, continue
//if not brightspace, stop
(async () =>{
    console.log("we in the async");
    const moduleUrl = chrome.runtime.getURL('/internalScripts/scraper.js');
    const scraper = await import(moduleUrl);

    let lastPath = '';

    function splitPath() {
        const path = window.location.pathname;
        console.log(path)
        if (path === lastPath) return;
        lastPath = path;

        if (path.startsWith('/d2l/home')) {
            console.log("Calling homepage logic");
            scraper.initializeScraper("home");
        } else if (path.startsWith('/d2l/le/worktodo/view')) {
            console.log("Would be calling the full list function");
            // Call settings functions here
        }
    }

    splitPath();
})();


