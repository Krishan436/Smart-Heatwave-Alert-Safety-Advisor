const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

console.log("=== Aegis Heat App Verification ===");

const files = ['index.html', 'style.css', 'app.js'];
let allPassed = true;

// 1. Check file existence
files.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        console.log(`[PASS] File exists: ${file} (${stats.size} bytes)`);
    } else {
        console.error(`[FAIL] File missing: ${file}`);
        allPassed = false;
    }
});

// 2. Syntax Check app.js (using node's check flag)
if (fs.existsSync(path.join(__dirname, 'app.js'))) {
    exec('node --check app.js', (err, stdout, stderr) => {
        if (err) {
            console.error("[FAIL] app.js syntax check failed:");
            console.error(stderr);
            allPassed = false;
        } else {
            console.log("[PASS] app.js syntax is valid.");
        }
        
        // 3. HTML reference check
        if (fs.existsSync(path.join(__dirname, 'index.html'))) {
            const htmlContent = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
            const hasCSS = htmlContent.includes('href="style.css"');
            const hasJS = htmlContent.includes('src="app.js"');
            
            if (hasCSS) {
                console.log("[PASS] index.html correctly references style.css");
            } else {
                console.error("[FAIL] index.html does not reference style.css");
                allPassed = false;
            }
            
            if (hasJS) {
                console.log("[PASS] index.html correctly references app.js");
            } else {
                console.error("[FAIL] index.html does not reference app.js");
                allPassed = false;
            }
        }
        
        console.log("\n==================================");
        if (allPassed) {
            console.log("SUCCESS: All local checks passed successfully!");
            process.exit(0);
        } else {
            console.error("FAILURE: Some verification checks failed.");
            process.exit(1);
        }
    });
} else {
    console.log("Skipping syntax checks because app.js is missing.");
    process.exit(1);
}
