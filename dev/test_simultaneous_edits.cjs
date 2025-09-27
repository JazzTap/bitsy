const { Browser, Builder, By, Capabilities, Origin, until } = require('selenium-webdriver');
const firefox = require('selenium-webdriver/firefox');
// not reliable enough to test with


// Alternative selectors to try if the main ones don't work
async function findElementWithFallbacks(driver, selectors, timeout = 10000) {
    for (const selector of selectors) {
        try {
            return await driver.wait(until.elementLocated(By.css(selector)), timeout);
        } catch (error) {
            console.log(`Selector "${selector}" not found, trying next...`);
            continue;
        }
    }
    throw new Error(`None of the selectors found: ${selectors.join(', ')}`);
}

async function autoBitsy() {
    const opt = new firefox.Options()
    opt.addArguments("--width=1440", "--height=1440")
    const driver = await new Builder()
        .forBrowser(Browser.FIREFOX)
        // .withCapabilities(Capabilities.firefox())
        .setFirefoxOptions(opt)
        .build();

    try {
        await driver.get('http://localhost:8080/?instance=SGRQ65E1gtCBNhj74KNze4PpiM4');
        await driver.sleep(1000);

        /* driver.executeScript('return 2').then(function(return_value) {
            console.log('returned ', return_value)
        }); */
        
        const pickToolSelectors = [
            'label[for="roomEditToolSelect-1"]'
        ];
        const pickTool = await findElementWithFallbacks(driver, pickToolSelectors);
        await pickTool.click();
        await driver.sleep(2000);
        
        // Try multiple selectors for canvas/tile area
        const canvasSelectors = [
            '#roomPanel canvas'
        ];        
        const canvas = await findElementWithFallbacks(driver, canvasSelectors);

        // Click center area, aiming for tile [1,1]
        const actions = driver.actions();
        await actions.move({ x: 75, y: 200}).perform();
        await driver.sleep(20);
        console.log("pick")
        await actions.press().perform();
        await driver.sleep(50);
        await driver.sleep(1450);
        
        // Try multiple selectors for paint tool
        const paintToolSelectors = [
            'label[for="roomEditToolSelect-0"]'
        ];
        const paintTool = await findElementWithFallbacks(driver, paintToolSelectors);
        await paintTool.click();
        await driver.sleep(1000);
        
        // Repeated clicking
        for (let i = 0; true; ++i) {
            console.log(`Click ${i + 1}`);
            await actions.move({ x: 75, y: 200}).press()
                         .move({x: 30, y: 0, origin: Origin.POINTER}).click()
                         .perform();
            await driver.sleep(250);
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await driver.sleep(5000);
        await driver.quit();
    }
}

// Run the automation
autoBitsy().catch(console.error);