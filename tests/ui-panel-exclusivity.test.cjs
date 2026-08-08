const fs=require('fs');
const html=fs.readFileSync('index.html','utf8');
function ok(cond,msg){if(!cond){console.error('FAIL',msg);process.exit(1)}console.log('PASS',msg)}
ok(html.includes("document.getElementById('progressSyncPanel')?.classList.remove('active'); document.getElementById('progressSyncTab')?.classList.remove('active'); installChrome();"),'programmatic setMenuMode hides Google Backup panel before activating another mode');
ok(!/sync-(?:config|merge|storage|google-auth|progress-sync|library-backup)\.js\?v=EXAM-SIMULATOR2-PROGRESS-SYNC-V2\.2\.1/.test(html),'all sync module cache-busters use current build rather than V2.2.1');
console.log('2/2 UI panel exclusivity tests passed.');
