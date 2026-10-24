/* ThunderUSMLE UI layer (A23 Phase 1 + Phases A–C): brand, accent colors, the Library home view (rebuilt from the canvas
   boards over StepLibraryBridge), the form details sheet, the start dialog, Quick practice, Add forms, Qbank (build + history), Settings, Backup & sync, the Score Report and the opt-in Modern exam style (Phase E). Shared by the Local and iPad apps; keep both copies identical.
   It restyles the existing screens and adds a few controls. It never removes or renames the IDs and data-* hooks
   the other modules use. The NBME exam interface (the default) is untouched; Modern only applies under :root[data-tu-exam="modern"]. */
(function(){
  'use strict';
  if(window.ThunderUI) return;
  const IPAD = window.__STEP_SIM_STORAGE_PROFILE === 'ipad-browser-library-primary';
  // ThunderUSMLE release number, shown in Settings › About of both apps. tools/release.mjs (iPad) sets it on every release.
  const TU_RELEASE = 15;
  const ACCENTS = {
    crimson:{label:'Crimson', brand:'#A2283A', deep:'#6E1424'},
    blue:{label:'Blue', brand:'#2F5BD3', deep:'#1C3A93'},
    teal:{label:'Teal', brand:'#00676C', deep:'#00403F'}
  };
  const KEYS = {accent:'ThunderUSMLE.accent', status:'ThunderUSMLE.libraryStatus', sort:'ThunderUSMLE.librarySort', view:'ThunderUSMLE.libraryView'};
  const THEME_KEY = 'step-simulator-local-menu-theme';
  const BOLT = 'M298 64 140 296h104l-30 152 162-238H270l28-146z';
  const byId = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const store = {
    get(k, d){ try{ const v = localStorage.getItem(k); return v == null ? d : v; }catch(e){ return d; } },
    set(k, v){ try{ localStorage.setItem(k, v); }catch(e){} }
  };
  const icon = (paths, size) => `<svg class="tu-ico" width="${size||20}" height="${size||20}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const ICONS = {
    quick:'<path d="M13 3 5 14h6l-1 7 8-11h-6l1-7z"/>',
    library:'<rect x="3.5" y="4" width="4.5" height="16" rx="1"/><rect x="10" y="4" width="4.5" height="16" rx="1"/><path d="m16.6 5.2 3.9 1-3.6 13.6-3.9-1z"/>',
    qbank:'<path d="M12 3 3 8l9 5 9-5-9-5z"/><path d="m3 13 9 5 9-5"/>',
    tests:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    sync:'<path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.1 9.6 4.2 4.2 0 0 0 7 18z"/>',
    settings:'<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    moon:'<path d="M20.5 13.2A8.5 8.5 0 1 1 10.8 3.5a6.6 6.6 0 0 0 9.7 9.7z"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    grid:'<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
    list:'<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
    play:'<path d="M7 5v14l11-7z" fill="currentColor" stroke="none"/>',
    chevron:'<path d="m6 9 6 6 6-6"/>',
    check:'<circle cx="12" cy="12" r="8.5"/><path d="m8.5 12.2 2.4 2.4 4.6-4.9"/>',
    clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    pause:'<circle cx="12" cy="12" r="8.5"/><path d="M10 9v6M14 9v6"/>',
    download:'<path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"/>',
    upload:'<path d="M12 16V5m0 0-4 4m4-4 4 4M5 20h14"/>',
    drive:'<path d="M3 7.5a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    flag:'<path d="M5 21V4h11l-2 4 2 4H5" fill="currentColor"/>'
  };
  const tileSvg = (size, cls) => `<svg class="${cls||'tu-logo'}" width="${size}" height="${size}" viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="116" class="tu-logo-tile"/><path d="${BOLT}" class="tu-logo-deep" transform="translate(10 12)"/><path d="${BOLT}" fill="#FFFFFF"/></svg>`;

  /* ---------- styles ---------- */
  const H = ':root[data-tu] body #menu'; // prefix that outranks the legacy menu rules
  const STYLES = `
:root[data-tu-accent="crimson"]{--tu-brand:#A2283A;--tu-brand-deep:#6E1424;--tu-lp:#A2283A;--tu-lonp:#FFFFFF;--tu-lpc:#FFDADC;--tu-lonpc:#40000D;--tu-dp:#FFB2B9;--tu-donp:#67001A;--tu-dpc:#85152A;--tu-donpc:#FFDADC}
:root[data-tu-accent="blue"]{--tu-brand:#2F5BD3;--tu-brand-deep:#1C3A93;--tu-lp:#2F5BD3;--tu-lonp:#FFFFFF;--tu-lpc:#DCE4FF;--tu-lonpc:#0F2A78;--tu-dp:#B3C5FF;--tu-donp:#0F2A78;--tu-dpc:#273F94;--tu-donpc:#DCE4FF}
:root[data-tu-accent="teal"]{--tu-brand:#00676C;--tu-brand-deep:#00403F;--tu-lp:#00676C;--tu-lonp:#FFFFFF;--tu-lpc:#C6ECEE;--tu-lonpc:#002022;--tu-dp:#80D4D9;--tu-donp:#003739;--tu-dpc:#00494D;--tu-donpc:#C6ECEE}
:root[data-tu] #menu,:root[data-tu] #appDialogLayer,:root[data-tu] #examScreen .tu-report{--tu-bg:#F6F7FB;--tu-surface:#FFFFFF;--tu-s1:#EFF1F7;--tu-s2:#E7EAF3;--tu-s3:#DCE0EC;--tu-line:#D3D8E5;--tu-line2:#E4E7F0;--tu-on:#161A25;--tu-on2:#474E62;--tu-on3:#5F6679;--tu-ok:#17683D;--tu-okc:#D3EFDD;--tu-warn:#7D4B00;--tu-warnc:#FFE3B8;--tu-bad:#A8231B;--tu-badc:#FBDAD6;--tu-shadow:0 1px 2px rgba(20,26,40,.06),0 3px 10px rgba(20,26,40,.06);--tu-p:var(--tu-lp);--tu-onp:var(--tu-lonp);--tu-pc:var(--tu-lpc);--tu-onpc:var(--tu-lonpc);--tu-font:"Figtree",-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",system-ui,sans-serif}
:root[data-tu] #menu.theme-dark,:root[data-tu] #examScreen.exam-dark .tu-report,:root[data-tu][data-tu-dark] #appDialogLayer{--tu-bg:#0E1118;--tu-surface:#161A23;--tu-s1:#131720;--tu-s2:#222835;--tu-s3:#2B3242;--tu-line:#3A4256;--tu-line2:#272E3D;--tu-on:#E4E7F0;--tu-on2:#B4BACB;--tu-on3:#9AA1B4;--tu-ok:#86DCA8;--tu-okc:#173A27;--tu-warn:#FFC772;--tu-warnc:#3D2C0F;--tu-bad:#FFB4AB;--tu-badc:#4A1612;--tu-shadow:0 1px 2px rgba(0,0,0,.4),0 4px 14px rgba(0,0,0,.28);--tu-p:var(--tu-dp);--tu-onp:var(--tu-donp);--tu-pc:var(--tu-dpc);--tu-onpc:var(--tu-donpc)}
.tu-logo-tile{fill:var(--tu-brand)}.tu-logo-deep{fill:var(--tu-brand-deep)}.tu-ico{flex:none;display:block}
.tu-sr{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip:rect(0 0 0 0)!important;white-space:nowrap!important}

/* shell */
:root[data-tu] body #menu.modern-menu-shell{background:var(--tu-bg)!important;color:var(--tu-on)!important;font-family:var(--tu-font)!important;font-variant-numeric:tabular-nums}
:root[data-tu] body #menu .modern-menu{background:var(--tu-bg)!important}
:root[data-tu] body #menu .modern-main{background:var(--tu-bg)!important;color:var(--tu-on)!important}
:root[data-tu] body #menu :is(button,input,select,textarea){font-family:var(--tu-font)!important}
:root[data-tu] body #menu :focus-visible{outline:3px solid var(--tu-p)!important;outline-offset:2px!important}
:root[data-tu] body #menu aside.modern-sidebar{background:var(--tu-s1)!important;border-right:1px solid var(--tu-line2)!important;box-shadow:none!important;color:var(--tu-on)!important;padding:20px 14px!important;gap:6px!important}
:root[data-tu] body #menu aside.modern-sidebar .brand-block{display:flex!important;align-items:center!important;gap:12px!important;padding:4px 10px 16px!important;margin:0!important;border:0!important;background:transparent!important}
:root[data-tu] body #menu aside.modern-sidebar .brand-mark{width:40px!important;height:40px!important;flex:none!important;background:transparent!important;box-shadow:none!important;border:0!important;padding:0!important;border-radius:0!important}
:root[data-tu] body #menu aside.modern-sidebar .brand-mark img{display:none!important}
:root[data-tu] body #menu aside.modern-sidebar .brand-mark .tu-logo{width:40px;height:40px;display:block}
:root[data-tu] body #menu aside.modern-sidebar .menu-title{font-size:17px!important;font-weight:800!important;letter-spacing:-.01em!important;color:var(--tu-on)!important;line-height:1.2!important;background:none!important;-webkit-text-fill-color:currentColor!important;text-shadow:none!important}
:root[data-tu] body #menu aside.modern-sidebar .menu-subtitle{font-size:12px!important;color:var(--tu-on3)!important;font-weight:500!important}
:root[data-tu] body #menu aside.modern-sidebar .menu-tab{display:flex!important;align-items:center!important;gap:14px!important;min-height:48px!important;height:auto!important;padding:0 18px!important;margin:0!important;border-radius:999px!important;border:0!important;background:transparent!important;color:var(--tu-on2)!important;font-weight:600!important;font-size:15px!important;box-shadow:none!important;text-align:left!important;justify-content:flex-start!important;width:100%!important}
:root[data-tu] body #menu aside.modern-sidebar .menu-tab:hover{background:var(--tu-s2)!important;color:var(--tu-on)!important}
:root[data-tu] body #menu aside.modern-sidebar .menu-tab.active{background:var(--tu-pc)!important;color:var(--tu-onpc)!important;font-weight:700!important}
:root[data-tu] body #menu aside.modern-sidebar .menu-tab .sync-tab-dot{margin-left:auto!important}
:root[data-tu] body #menu aside.modern-sidebar .sidebar-note{display:none!important}
:root[data-tu] body #menu aside.modern-sidebar #themeToggle{margin-top:auto!important;min-height:44px!important;font-size:14px!important}
:root[data-tu] body #menu aside.modern-sidebar #themeToggle .theme-toggle-icon{display:none!important}
:root[data-tu] body #menu aside.modern-sidebar #tuAddForms{display:flex;align-items:center;gap:12px;height:54px;padding:0 20px;margin:0 4px 12px;border-radius:16px;border:0;background:var(--tu-pc);color:var(--tu-onpc);font-weight:700;font-size:15px;box-shadow:var(--tu-shadow);cursor:pointer;width:calc(100% - 8px)}
:root[data-tu] body #menu aside.modern-sidebar #tuAddForms:hover{filter:brightness(.97)}

/* page header */
:root[data-tu] body #menu .modern-hero{display:flex!important;flex-wrap:wrap!important;align-items:center!important;justify-content:space-between!important;gap:10px 16px!important;padding:0!important;margin:0 0 16px!important;min-height:0!important;background:transparent!important;border:0!important;box-shadow:none!important}
:root[data-tu] body #menu .modern-hero>div:first-child{display:flex!important;align-items:baseline!important;gap:12px!important;flex-wrap:wrap!important}
:root[data-tu] body #menu .modern-hero h1{margin:0!important;font-size:28px!important;font-weight:800!important;letter-spacing:-.02em!important;line-height:1.15!important;color:var(--tu-on)!important;background:none!important;-webkit-text-fill-color:currentColor!important;text-shadow:none!important}
:root[data-tu] body #menu .modern-hero p{margin:0!important;font-size:13.5px!important;color:var(--tu-on3)!important;font-weight:500!important}
:root[data-tu] body #menu .modern-hero :is(#dataStatusRescanWrapV195C,#dataStatusRescanWrapV201){display:flex!important;flex-wrap:wrap!important;align-items:center!important;gap:8px!important;margin:0!important;position:static!important}
:root[data-tu] body #menu .modern-hero .exam-storage-status-row{display:contents!important}
:root[data-tu] body #menu .modern-hero .exam-storage-status-row:empty{display:none!important}
:root[data-tu] body #menu .modern-hero :is(#dataFolderStatus,#googleBackupStatus){display:inline-flex!important;align-items:center!important;gap:7px!important;height:34px!important;padding:0 12px!important;border-radius:999px!important;border:0!important;background:var(--tu-s2)!important;color:var(--tu-on2)!important;font-weight:700!important;font-size:12.5px!important;box-shadow:none!important;white-space:nowrap!important;margin:0!important;min-height:0!important}
:root[data-tu] body #menu .modern-hero :is(#dataFolderStatus,#googleBackupStatus)::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--tu-on3);flex:none}
:root[data-tu] body #menu .modern-hero #dataFolderStatus.connected{background:var(--tu-okc)!important;color:var(--tu-ok)!important}
:root[data-tu] body #menu .modern-hero #dataFolderStatus.connected::before{background:var(--tu-ok)}
:root[data-tu] body #menu .modern-hero #googleBackupStatus{cursor:pointer!important}
:root[data-tu] body #menu .modern-hero #googleBackupStatus[data-tone="good"]{background:var(--tu-okc)!important;color:var(--tu-ok)!important}
:root[data-tu] body #menu .modern-hero #googleBackupStatus[data-tone="good"]::before{background:var(--tu-ok)}
:root[data-tu] body #menu .modern-hero #googleBackupStatus[data-tone="busy"]{background:var(--tu-pc)!important;color:var(--tu-onpc)!important}
:root[data-tu] body #menu .modern-hero #googleBackupStatus[data-tone="busy"]::before{background:var(--tu-p);animation:tuPulse 1.2s ease-in-out infinite}
:root[data-tu] body #menu .modern-hero #googleBackupStatus:is([data-tone="pending"],[data-tone="conflict"]){background:var(--tu-warnc)!important;color:var(--tu-warn)!important}
:root[data-tu] body #menu .modern-hero #googleBackupStatus:is([data-tone="pending"],[data-tone="conflict"])::before{background:var(--tu-warn)}
:root[data-tu] body #menu .modern-hero #googleBackupStatus[data-tone="error"]{background:var(--tu-badc)!important;color:var(--tu-bad)!important}
:root[data-tu] body #menu .modern-hero #googleBackupStatus[data-tone="error"]::before{background:var(--tu-bad)}
@keyframes tuPulse{50%{opacity:.35}}
@media (prefers-reduced-motion:reduce){:root[data-tu] body #menu .modern-hero #googleBackupStatus::before{animation:none!important}}
:root[data-tu] body #menu .modern-hero #scanDataFolderBtn{height:34px!important;min-height:0!important;padding:0 14px!important;border-radius:999px!important;border:1px solid var(--tu-line)!important;background:transparent!important;color:var(--tu-on)!important;font-weight:700!important;font-size:12.5px!important;box-shadow:none!important;margin:0!important}

/* generic surfaces inside the app shell */
:root[data-tu] body #menu .modern-main :is(.glass-panel,.library-toolbar,.settings-panel-v195,.settings-nav-v195,.settings-card-v195,.sync-card,.sync-hero,#qidMigrationCard){background:var(--tu-surface)!important;border:1px solid var(--tu-line2)!important;border-radius:24px!important;box-shadow:var(--tu-shadow)!important;color:var(--tu-on)!important;backdrop-filter:none!important}
:root[data-tu] body #menu .modern-main :is(h2,h3,h4){color:var(--tu-on)!important;font-family:var(--tu-font)!important;letter-spacing:-.01em}
:root[data-tu] body #menu .modern-main .panel-kicker{color:var(--tu-p)!important;letter-spacing:.08em!important;font-weight:800!important}
:root[data-tu] body #menu .modern-main :is(p,.sync-detail){color:var(--tu-on2)}
:root[data-tu] body #menu .modern-main button.primary:not(:disabled){background:var(--tu-p)!important;color:var(--tu-onp)!important;border:0!important;border-radius:999px!important;box-shadow:none!important;font-weight:700!important}
:root[data-tu] body #menu .modern-main button.secondary{background:transparent!important;color:var(--tu-on)!important;border:1px solid var(--tu-line)!important;border-radius:999px!important;box-shadow:none!important;font-weight:700!important}
:root[data-tu] body #menu .modern-main button.secondary:hover:not(:disabled){background:var(--tu-s2)!important}
:root[data-tu] body #menu .modern-main button:is(.primary,.secondary):disabled{opacity:.45!important}
:root[data-tu] body #menu .modern-main button.primary:disabled{background:var(--tu-p)!important;color:var(--tu-onp)!important;border:0!important;border-radius:999px!important}
:root[data-tu] body #menu #settingsPanel>.library-toolbar.glass-panel:first-child{display:none!important}
:root[data-tu] body #menu #settingsPanel .settings-shell-v195{background:transparent!important;border:0!important;box-shadow:none!important;padding:0!important}
:root[data-tu] body #menu .modern-main :is(input[type=text],input[type=number],input[type=search],select,textarea):not(#tuSearch):not(#tuSort):not(.tu-bare){border-radius:12px!important;border:1px solid var(--tu-line)!important;background:var(--tu-surface)!important;color:var(--tu-on)!important}

/* shared controls */
.tu-seg{display:flex;height:40px;border-radius:999px;overflow:hidden;background:var(--tu-s2)}
.tu-seg button{border:0;background:transparent;color:var(--tu-on2);display:flex;align-items:center;justify-content:center;gap:6px;padding:0 14px;min-width:44px;font-weight:700;font-size:13.5px;cursor:pointer}
.tu-seg button[aria-pressed="true"],.tu-seg button[aria-checked="true"]{background:var(--tu-pc);color:var(--tu-onpc)}
.tu-link{border:0;background:transparent;color:var(--tu-p);font-weight:700;font-size:13px;cursor:pointer;padding:6px 4px}
.tu-btn{height:40px;padding:0 20px;border-radius:999px;border:0;background:var(--tu-p);color:var(--tu-onp);font-weight:800;font-size:14px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.tu-btn.tonal{background:var(--tu-pc);color:var(--tu-onpc)}
.tu-btn.outline{background:transparent;color:var(--tu-on);border:1px solid var(--tu-line);font-weight:700}
.tu-btn.text{background:transparent;color:var(--tu-p);padding:0 12px;font-weight:700}
.tu-btn.small{height:36px;padding:0 16px;font-size:13.5px}
.tu-btn:disabled{opacity:.45;cursor:not-allowed}

/* Library home: the legacy panel stays in the DOM for its hooks, hidden off-screen */
${H} #libraryModePanel.tu-has-home.active{display:block!important;padding:0!important;margin:0!important;background:transparent!important;border:0!important;box-shadow:none!important}
${H} #libraryModePanel.tu-has-home>:not(#tuHome){position:absolute!important;left:-10000px!important;top:0!important;width:900px!important;height:1px!important;overflow:hidden!important;visibility:hidden!important;pointer-events:none!important}
${H}[data-tu-page="library"] .modern-hero{display:none!important}
${H} .modern-main:has(#libraryModePanel.tu-has-home.active){padding:22px 32px 48px!important}
${H} #tuHome{max-width:1240px;margin:0 auto;display:flex;flex-direction:column;gap:16px;color:var(--tu-on);font-family:var(--tu-font)}
${H} #tuHome :is(h1,h2,h3){margin:0!important;color:var(--tu-on)!important;font-family:var(--tu-font)!important}
${H} #tuHome button{font-family:var(--tu-font)!important;cursor:pointer}
${H} #tuHome svg{flex:none}
.tu-home-head{display:flex;flex-wrap:wrap;align-items:center;gap:12px;justify-content:space-between}
.tu-home-title{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
${H} #tuHome .tu-home-title h1{font-size:28px!important;font-weight:800!important;letter-spacing:-.02em!important;line-height:1.15!important}
.tu-home-title span{font-size:13.5px;color:var(--tu-on3)}
.tu-home-tools{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
${H} #tuHome .tu-iconbtn{position:relative;width:40px;height:40px;min-width:40px;border-radius:50%!important;border:0!important;background:var(--tu-s2)!important;color:var(--tu-on2)!important;display:inline-flex;align-items:center;justify-content:center;padding:0!important;box-shadow:none!important}
${H} #tuHome .tu-iconbtn:hover{background:var(--tu-s3)!important}
${H} #tuHome .tu-iconbtn:disabled{opacity:.5}
${H} #tuHome .tu-iconbtn select{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;opacity:0!important;cursor:pointer;border:0!important;padding:0!important;margin:0!important;min-width:0!important}
${H} #tuHome .tu-search{display:flex;align-items:center;gap:8px;height:40px;padding:0 14px;width:260px;max-width:100%;border-radius:999px;background:var(--tu-s2);color:var(--tu-on3)}
${H} #tuHome .tu-search input{-webkit-appearance:none!important;appearance:none!important;border:0!important;background:transparent!important;outline:none!important;flex:1!important;min-width:0!important;height:38px!important;padding:0!important;margin:0!important;box-shadow:none!important;font:14px var(--tu-font)!important;color:var(--tu-on)!important}
${H} #tuHome .tu-search:focus-within{outline:3px solid var(--tu-p);outline-offset:2px}
${H} #tuHome .tu-search input::placeholder{color:var(--tu-on3)}
${H} #tuHome .tu-seg button{border:0!important;background:transparent!important;color:var(--tu-on2)!important;height:40px!important;min-height:0!important;border-radius:0!important;box-shadow:none!important;margin:0!important}
${H} #tuHome .tu-seg button[aria-pressed="true"]{background:var(--tu-pc)!important;color:var(--tu-onpc)!important}
${H} #tuHome .tu-view button{width:44px;padding:0!important}
.tu-syncpill{display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 12px;border-radius:999px;border:0;font-weight:800;font-size:13px;white-space:nowrap}
.tu-syncpill i,.tu-navcard .tu-navdot{width:8px;height:8px;border-radius:50%;background:currentColor;flex:none}
.tu-syncpill em{font-style:normal;font-weight:600;opacity:.8}
${H} :is(.tu-syncpill,.tu-syncstrip)[data-tone]{background:var(--tu-s2)!important;color:var(--tu-on2)!important;border:0!important}
${H} :is(.tu-syncpill,.tu-syncstrip)[data-tone="good"]{background:var(--tu-okc)!important;color:var(--tu-ok)!important}
${H} :is(.tu-syncpill,.tu-syncstrip)[data-tone="busy"]{background:var(--tu-pc)!important;color:var(--tu-onpc)!important}
${H} :is(.tu-syncpill,.tu-syncstrip):is([data-tone="pending"],[data-tone="conflict"]){background:var(--tu-warnc)!important;color:var(--tu-warn)!important}
${H} :is(.tu-syncpill,.tu-syncstrip)[data-tone="error"]{background:var(--tu-badc)!important;color:var(--tu-bad)!important}
.tu-syncpill[data-tone="busy"] i{animation:tuPulse 1.2s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.tu-syncpill i{animation:none!important}}
.tu-syncstrip{display:none}
.tu-more{position:relative}
.tu-more>summary{list-style:none}.tu-more>summary::-webkit-details-marker{display:none}
.tu-more-panel{position:absolute;right:0;top:46px;z-index:30;min-width:240px;padding:6px;border-radius:16px;background:var(--tu-surface);border:1px solid var(--tu-line2);box-shadow:0 12px 32px rgba(0,0,0,.18);display:flex;flex-direction:column}
${H} #tuHome .tu-more-panel button{display:flex;align-items:center;gap:10px;width:100%;height:40px!important;min-height:0!important;padding:0 12px!important;margin:0!important;border:0!important;border-radius:10px!important;background:transparent!important;color:var(--tu-on)!important;font:600 14px var(--tu-font)!important;text-align:left;box-shadow:none!important}
${H} #tuHome .tu-more-panel button:hover{background:var(--tu-s2)!important}
.tu-more-panel small{padding:8px 12px 4px;color:var(--tu-on3);font-size:12px}
.tu-card{background:var(--tu-surface);border:1px solid var(--tu-line2);border-radius:24px;box-shadow:var(--tu-shadow)}
/* top row: Categories | Recently completed | Overall performance. Overall has a fixed size; the other two take its height. */
.tu-home-top{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr) 300px;grid-template-rows:292px;grid-template-areas:"cats recent overall";gap:16px}
.tu-home-top>.tu-cats{grid-area:cats}.tu-home-top>.tu-recent{grid-area:recent}.tu-home-top>.tu-overall{grid-area:overall}
.tu-overall{padding:16px 18px;display:flex;flex-direction:column;gap:10px;min-width:0;overflow:hidden}
.tu-ov-note{font-size:11.5px;font-weight:600;color:var(--tu-on3);text-align:center}
.tu-sec-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
${H} #tuHome .tu-sec-head h2{font-size:16px!important;font-weight:800!important;letter-spacing:0!important}
.tu-sec-head>span{font-size:12px;font-weight:700;color:var(--tu-on3)}
.tu-rings{flex:1;min-height:0;display:flex;gap:12px;align-items:center;justify-content:space-around}
.tu-ring112{flex:none;width:112px;height:112px;border-radius:50%;background:conic-gradient(var(--c) calc(var(--v)*1%),var(--tu-s2) 0);display:flex;align-items:center;justify-content:center}
.tu-ring112>div{width:88px;height:88px;border-radius:50%;background:var(--tu-surface);display:flex;flex-direction:column;align-items:center;justify-content:center}
.tu-ring112 b{font-size:25px;font-weight:800;line-height:1.1}
.tu-ring112 span{font-size:10.5px;color:var(--tu-on3);font-weight:700;letter-spacing:.04em}
.tu-pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.tu-pair>div{background:var(--tu-s1);border-radius:14px;padding:10px 12px;display:flex;flex-direction:column}
.tu-pair b{font-size:16px;font-weight:800}.tu-pair b small{font-weight:600;color:var(--tu-on3);font-size:13px}
.tu-pair span{font-size:12px;color:var(--tu-on3);font-weight:600}
.tu-recent{min-width:0;padding:16px 18px;display:flex;flex-direction:column;gap:8px;overflow:hidden;container-type:inline-size}
.tu-recent-list{flex:1;min-height:0;display:grid;grid-template-rows:repeat(6,minmax(0,1fr));gap:2px}
${H} #tuHome .tu-recent-row{display:flex;align-items:center;gap:10px;min-height:0;height:100%;width:100%;padding:0 8px!important;margin:0!important;border-radius:12px!important;border:0!important;background:transparent!important;color:var(--tu-on)!important;text-align:left;box-shadow:none!important;height:auto!important}
${H} #tuHome .tu-recent-row:hover{background:var(--tu-s1)!important}
.tu-recent-row>i{width:9px;height:9px;border-radius:50%;flex:none}
.tu-recent-row>b{flex:1;min-width:0;font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tu-recent-row>span{font-size:12.5px;color:var(--tu-on3);white-space:nowrap}
.tu-recent-row>strong{width:44px;text-align:right;font-size:14.5px;font-weight:800;flex:none}
@container (max-width:250px){.tu-recent-row>span{display:none}}
.tu-empty-note{color:var(--tu-on3);font-size:13.5px;padding:8px 10px}
.tu-cats{padding:16px 18px;display:flex;flex-direction:column;gap:10px;min-width:0;overflow:hidden;container-type:inline-size}
.tu-recent .tu-sec-head h2,.tu-recent .tu-link{white-space:nowrap}
@container (max-width:250px){.tu-recent .tu-sec-head h2{font-size:15px!important}}
.tu-cats-body{flex:1;min-height:0;display:flex;flex-direction:column}
/* tiles share the card's height: --cols/--rows are set from the tile count, so 13-15 tiles still fit (dense) */
.tu-cats .tu-tiles{flex:1;min-height:0;grid-template-columns:repeat(var(--cols,3),minmax(0,1fr));grid-template-rows:repeat(var(--rows,2),minmax(0,1fr));overflow:auto}
.tu-cats .tu-tiles.tu-scroll{grid-template-rows:none;grid-auto-rows:30px}
.tu-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
${H} #tuHome .tu-tile{text-align:left;display:flex;flex-direction:column;justify-content:space-between;gap:6px;padding:9px 12px!important;margin:0!important;height:auto!important;min-height:0!important;border-radius:14px!important;border:1.5px solid var(--tu-line2)!important;background:var(--tu-surface)!important;color:var(--tu-on)!important;box-shadow:none!important}
${H} #tuHome .tu-tile:hover{border-color:var(--tu-line)!important}
${H} #tuHome .tu-tile[aria-pressed="true"]{background:var(--tu-pc)!important;border-color:var(--tu-p)!important;color:var(--tu-onpc)!important}
.tu-tile-top{display:flex;align-items:center;gap:7px;width:100%}
.tu-tile-top i{width:9px;height:9px;border-radius:50%;flex:none}
.tu-tile-top b{font-weight:800;font-size:14px;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tu-tile-top span{font-size:12.5px;font-weight:700;opacity:.85}
.tu-tile-bar{width:100%;height:4px;border-radius:99px;background:var(--tu-s3);overflow:hidden}.tu-tile-bar i{display:block;height:100%;border-radius:99px}
.tu-tile>small{font-size:11.5px;opacity:.8}
.tu-cats .tu-tiles.tu-dense{gap:5px 8px}
${H} #tuHome .tu-tiles.tu-dense .tu-tile{justify-content:center;gap:3px;padding:2px 10px!important;border-radius:10px!important}
.tu-tiles.tu-dense .tu-tile-bar{height:3px}
.tu-tiles.tu-dense .tu-tile>small{display:none}
.tu-tiles.tu-dense .tu-tile-top b{font-size:13px}.tu-tiles.tu-dense .tu-tile-top span{font-size:12px}
.tu-tiles-more{align-self:center}
.tu-tile-caret{flex:none;opacity:.7;transition:transform .15s}
.tu-tile[aria-expanded="true"] .tu-tile-caret{transform:rotate(180deg)}
/* CMS forms pane: the eight shelf subjects in one line under the top row */
.tu-cms{padding:14px 18px 16px;display:flex;flex-direction:column;gap:10px}
.tu-cms[hidden]{display:none}
.tu-cms .tu-sec-head>span{font-weight:600}
.tu-cms .tu-tiles{grid-template-columns:repeat(8,minmax(0,1fr))}
.tu-cms .tu-tile-top{flex-wrap:wrap;row-gap:2px}
.tu-cms .tu-tile-top span{flex-basis:100%;font-size:16px!important;font-weight:800!important;opacity:1!important}
.tu-resume{overflow:hidden;border-radius:22px}
.tu-resume-row{display:flex;flex-wrap:wrap;align-items:center;gap:14px;padding:12px 14px 12px 16px}
.tu-resume-row+.tu-resume-row{border-top:1px solid var(--tu-line2);padding:10px 14px 10px 70px}
.tu-resume-ico{width:40px;height:40px;border-radius:50%;background:var(--tu-pc);color:var(--tu-onpc);display:flex;align-items:center;justify-content:center;flex:none}
.tu-resume-text{flex:1 1 260px;min-width:0;display:flex;flex-direction:column;gap:2px}
.tu-resume-text b{font-weight:800;font-size:15.5px}.tu-resume-text b small{font-weight:600;color:var(--tu-on3);font-size:13.5px}
.tu-resume-row+.tu-resume-row .tu-resume-text b{font-weight:700;font-size:14.5px}
.tu-resume-text>span{font-size:13px;color:var(--tu-on3)}
.tu-resume-bar{width:120px;height:5px;border-radius:99px;background:var(--tu-s2);overflow:hidden}.tu-resume-bar i{display:block;height:100%;background:var(--tu-p);border-radius:99px}
.tu-forms{display:flex;flex-direction:column;gap:14px}
.tu-forms-bar{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between}
${H} #tuHome .tu-status{background:var(--tu-surface);border:1px solid var(--tu-line)}
${H} #tuHome .tu-status button{padding:0 16px!important;border-right:1px solid var(--tu-line)!important}
${H} #tuHome .tu-status button:last-child{border-right:0!important}
.tu-status button span{font-weight:600;opacity:.75}
.tu-shown{font-size:13.5px;color:var(--tu-on3)}
.tu-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:16px}
.tu-form{padding:18px;display:flex;flex-direction:column;gap:14px;min-width:0;container-type:inline-size}
.tu-form-head{display:flex;align-items:flex-start;gap:10px;min-width:0}
.tu-form-hl{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}
.tu-form-hr{flex:none;display:flex;flex-direction:column;align-items:flex-end;gap:6px}
.tu-form-tag{display:flex;align-items:center;gap:8px;min-height:24px}
.tu-form-tag>i{width:9px;height:9px;border-radius:50%;flex:none}
.tu-form-tag>span:not(.tu-st){font-size:12.5px;font-weight:700;color:var(--tu-on3);flex:1;min-width:0;letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tu-st{font-size:12px;font-weight:800;padding:4px 10px;border-radius:999px;white-space:nowrap}
.tu-st.done{background:var(--tu-okc);color:var(--tu-ok)}.tu-st.progress{background:var(--tu-pc);color:var(--tu-onpc)}.tu-st.suspended{background:var(--tu-warnc);color:var(--tu-warn)}.tu-st.new{background:var(--tu-s2);color:var(--tu-on2)}
.tu-form-name{display:flex;flex-direction:column;gap:3px;min-width:0}
.tu-form-name b{font-size:18px;font-weight:800;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tu-three{display:flex;flex-direction:column;align-items:center;min-width:60px;padding:5px 10px 4px;border-radius:12px;background:var(--tu-pc);color:var(--tu-onpc);line-height:1.1;flex:none}
.tu-three b{font-size:19px;font-weight:800;letter-spacing:-.01em}
.tu-three small{font-size:9.5px;font-weight:800;letter-spacing:.08em;opacity:.8}
.tu-three.none{background:transparent;border:1.5px dashed var(--tu-line);color:var(--tu-on3);padding:3px 9px 2px}
.tu-form-name small{font-size:13px;color:var(--tu-on3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tu-form-date{display:flex;align-items:center;gap:6px;min-width:0;margin-top:-4px;font-size:12.5px;font-weight:700;color:var(--tu-on3)}
.tu-form-date>span{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tu-form-date>svg{flex:none}
.tu-form-date.done{color:var(--tu-ok)}.tu-form-date.suspended{color:var(--tu-warn)}
.tu-form-stats{display:flex;align-items:center;gap:14px}
.tu-ring58{width:58px;height:58px;border-radius:50%;background:conic-gradient(var(--c) calc(var(--v)*1%),var(--tu-s2) 0);display:flex;align-items:center;justify-content:center;flex:none}
.tu-ring58>b{width:46px;height:46px;border-radius:50%;background:var(--tu-surface);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px}
.tu-three-stats{flex:1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.tu-three-stats>div{display:flex;flex-direction:column}
.tu-three-stats b{font-weight:800;font-size:15px}.tu-three-stats span{font-size:11.5px;color:var(--tu-on3);font-weight:600}
.tu-bar5{height:5px;border-radius:99px;background:var(--tu-s2);overflow:hidden}.tu-bar5 i{display:block;height:100%;border-radius:99px}
.tu-form-actions{display:flex;align-items:center;gap:8px;min-width:0}
.tu-form-actions>button{flex:none;white-space:nowrap}
${H} #tuHome .tu-form-actions .tu-btn{height:40px!important;min-height:0!important;padding:0 18px!important;font:700 14px var(--tu-font)!important;border:0!important;box-shadow:none!important;margin:0!important}
${H} #tuHome .tu-btn{border:0!important;box-shadow:none!important;margin:0!important;min-height:0!important}
${H} #tuHome .tu-btn:not(.tonal):not(.outline):not(.text):not(.quiet){background:var(--tu-p)!important;color:var(--tu-onp)!important}
${H} #tuHome .tu-btn.tonal{background:var(--tu-pc)!important;color:var(--tu-onpc)!important}
${H} #tuHome .tu-btn.quiet{background:var(--tu-s2)!important;color:var(--tu-on)!important}
${H} #tuHome .tu-btn.outline{background:transparent!important;color:var(--tu-on)!important;border:1px solid var(--tu-line)!important}
${H} #tuHome .tu-btn.text{background:transparent!important;color:var(--tu-p)!important}
.tu-form-actions>.tu-grow{flex:1;min-width:0}
${H} #tuHome .tu-kebab{width:40px;height:40px;min-width:40px;border-radius:50%!important;border:0!important;background:transparent!important;color:var(--tu-on2)!important;display:inline-flex;align-items:center;justify-content:center;padding:0!important;box-shadow:none!important;margin:0!important}
${H} #tuHome .tu-kebab:hover{background:var(--tu-s2)!important}
/* narrow cards (New attempt + Review + ⋯): tighter buttons, then let the labels shrink so ⋯ never leaves the card */
.tu-grid>.tu-form{container-type:inline-size}
${H} #tuHome .tu-form-actions>.tu-btn{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis}
${H} #tuHome .tu-form-actions>.tu-kebab{flex:none}
@container (max-width:300px){${H} #tuHome .tu-form-actions .tu-btn{padding:0 12px!important;gap:6px}${H} #tuHome .tu-form-actions{gap:4px}}
@container (max-width:250px){${H} #tuHome .tu-form-actions .tu-btn>svg{display:none}}
.tu-nomatch{grid-column:1/-1;padding:36px;text-align:center;color:var(--tu-on3);background:var(--tu-surface);border:1px dashed var(--tu-line);border-radius:24px}
/* compact list */
.tu-grid.tu-list{grid-template-columns:minmax(0,1fr);gap:8px}
.tu-list .tu-form{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(250px,1fr) auto;grid-template-areas:"head stats actions" "date stats actions";align-items:center;gap:4px 20px;padding:12px 16px;border-radius:18px}
.tu-list .tu-form-head{grid-area:head;align-items:center}.tu-list .tu-form-hl{flex-direction:column-reverse;gap:2px}
.tu-list .tu-form-hr{flex-direction:row;align-items:center}.tu-list .tu-three{flex-direction:row;align-items:baseline;gap:6px;padding:3px 9px;min-width:0}.tu-list .tu-three b{font-size:14px}
.tu-list .tu-form-date{grid-area:date;margin:0}.tu-list .tu-form-stats{grid-area:stats}.tu-list .tu-form-actions{grid-area:actions}
.tu-list .tu-bar5,.tu-list .tu-form-name small{display:none}
.tu-list .tu-form-name b{font-size:15.5px}
.tu-list .tu-ring58{width:44px;height:44px}.tu-list .tu-ring58>b{width:34px;height:34px;font-size:12px}
@media (max-width:1250px){.tu-list .tu-form{grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"head actions" "date actions" "stats stats"}.tu-list .tu-form-stats{max-width:460px}}

/* sidebar: board order, storage / Google Drive card */
${H} aside.modern-sidebar #tuAddForms{order:1}
${H} aside.modern-sidebar #libraryTab{order:2}${H} aside.modern-sidebar #qbankTab{order:3}${H} aside.modern-sidebar #qbankTestsTab{order:4}
${H} aside.modern-sidebar #quickTab{order:5}${H} aside.modern-sidebar :is(#progressSyncTab,#tuSyncTab){order:6}${H} aside.modern-sidebar #settingsTab{order:7}
${H} aside.modern-sidebar #tuNavCard{order:8;margin-top:auto}
${H} aside.modern-sidebar #themeToggle{order:9;margin-top:6px!important}
${H} aside.modern-sidebar>:not(.brand-block):not(.menu-tab):not(#tuAddForms):not(#tuNavCard):not(#themeToggle){order:10}
.tu-navcard{background:var(--tu-surface);border:1px solid var(--tu-line2);border-radius:16px;padding:14px;margin:0 2px;display:flex;flex-direction:column;gap:10px;font-family:var(--tu-font)}
.tu-navcard>div{display:flex;align-items:center;gap:10px}
.tu-navcard>div b{font-weight:700;font-size:14px;color:var(--tu-on)}
.tu-navcard .tu-navdot{width:10px;height:10px;background:var(--tu-on3)}
.tu-navcard .tu-navdot.ok{background:var(--tu-ok)}.tu-navcard .tu-navdot.busy{background:var(--tu-p)}.tu-navcard .tu-navdot.warn{background:var(--tu-warn)}.tu-navcard .tu-navdot.bad{background:var(--tu-bad)}
.tu-navcard>span{font-size:12.5px;color:var(--tu-on3);line-height:1.4}
.tu-navcard .tu-navbar{height:5px;border-radius:99px;background:var(--tu-s2);overflow:hidden}.tu-navcard .tu-navbar i{display:block;width:58%;height:100%;background:var(--tu-p);border-radius:99px;animation:tuSlide 1.4s ease-in-out infinite alternate}
@keyframes tuSlide{from{transform:translateX(-40%)}to{transform:translateX(80%)}}
@media (prefers-reduced-motion:reduce){.tu-navcard .tu-navbar i{animation:none}}
.tu-navcard .tu-navbtns{display:flex;gap:8px}
${H} .tu-navcard button{flex:1;height:36px!important;min-height:0!important;border-radius:999px!important;border:1px solid var(--tu-line)!important;background:transparent!important;color:var(--tu-on)!important;font:600 13px var(--tu-font)!important;padding:0 10px!important;margin:0!important;box-shadow:none!important;cursor:pointer}
${H} .tu-navcard button:hover{background:var(--tu-s2)!important}

/* Form details sheet */
#tuSheet{position:fixed;inset:0;z-index:90;font-family:var(--tu-font);color:var(--tu-on)}
#tuSheet[hidden]{display:none}
.tu-scrim{position:absolute;inset:0;background:rgba(18,22,34,.42)}
${H}.theme-dark #tuSheet .tu-scrim{background:rgba(0,0,0,.6)}
.tu-sheet{position:absolute;top:12px;right:12px;bottom:12px;width:540px;max-width:calc(100% - 24px);background:var(--tu-surface);border-radius:28px;box-shadow:0 12px 48px rgba(0,0,0,.28);display:flex;flex-direction:column;overflow:hidden;animation:tuSheetIn .18s ease-out}
@keyframes tuSheetIn{from{transform:translateX(24px);opacity:0}}
@media (prefers-reduced-motion:reduce){.tu-sheet{animation:none}}
.tu-sheet-head{padding:22px 24px 0;display:flex;flex-direction:column;gap:14px}
.tu-sheet-row{display:flex;align-items:center;gap:10px}
.tu-chip-tab{display:flex;align-items:center;gap:8px;height:32px;padding:0 12px;border-radius:10px;border:1px solid var(--tu-line);font-size:13px;font-weight:700;color:var(--tu-on2)}
.tu-chip-tab i{width:9px;height:9px;border-radius:50%}
${H} #tuSheet .tu-round{width:40px;height:40px;min-width:40px;border-radius:50%!important;border:0!important;background:var(--tu-s1)!important;color:var(--tu-on2)!important;display:flex;align-items:center;justify-content:center;padding:0!important;margin:0!important;box-shadow:none!important;cursor:pointer}
${H} #tuSheet .tu-round.clear{background:transparent!important}
${H} #tuSheet .tu-round:hover{background:var(--tu-s2)!important}
.tu-sheet-title{display:flex;align-items:flex-start;gap:10px}
.tu-sheet-title>div{flex:1;display:flex;flex-direction:column;gap:4px;min-width:0}
${H} #tuSheet h2{margin:0!important;font-size:26px!important;font-weight:800!important;letter-spacing:-.02em!important;color:var(--tu-on)!important;overflow-wrap:anywhere}
.tu-sheet-title span{font-size:14px;color:var(--tu-on3)}
.tu-sheet-tabs{display:flex;gap:4px;border-bottom:1px solid var(--tu-line2)}
${H} #tuSheet .tu-sheet-tabs button{height:46px!important;min-height:0!important;padding:0 16px!important;margin:0!important;border:0!important;border-radius:0!important;border-bottom:3px solid transparent!important;background:transparent!important;font:700 14.5px var(--tu-font)!important;color:var(--tu-on2)!important;box-shadow:none!important;cursor:pointer}
${H} #tuSheet .tu-sheet-tabs button[aria-selected="true"]{color:var(--tu-p)!important;border-bottom-color:var(--tu-p)!important}
.tu-sheet-body{flex:1;overflow:auto;padding:20px 24px 24px;display:flex;flex-direction:column;gap:20px}
.tu-sheet-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.tu-sheet-stats>div{background:var(--tu-s1);border-radius:18px;padding:14px;display:flex;flex-direction:column;gap:2px}
.tu-sheet-stats b{font-size:22px;font-weight:800}.tu-sheet-stats span{font-size:12px;font-weight:600;color:var(--tu-on3)}
.tu-sheet-actions{display:flex;gap:10px;flex-wrap:wrap}
${H} #tuSheet .tu-btn{height:48px!important;min-height:0!important;padding:0 22px!important;font:800 15px var(--tu-font)!important;border:0!important;box-shadow:none!important;margin:0!important;border-radius:999px!important}
${H} #tuSheet .tu-btn:not(.tonal):not(.outline):not(.danger):not(.dangerfill){background:var(--tu-p)!important;color:var(--tu-onp)!important}
${H} #tuSheet .tu-btn.tonal{background:var(--tu-pc)!important;color:var(--tu-onpc)!important}
${H} #tuSheet .tu-btn.outline{background:transparent!important;color:var(--tu-on)!important;border:1px solid var(--tu-line)!important}
${H} #tuSheet .tu-btn.small{height:38px!important;padding:0 14px!important;font:700 13px var(--tu-font)!important}
${H} #tuSheet .tu-btn.danger{height:40px!important;padding:0 16px!important;font:700 13.5px var(--tu-font)!important;background:transparent!important;color:var(--tu-bad)!important;border:1px solid var(--tu-bad)!important}
${H} #tuSheet .tu-btn.dangerfill{height:40px!important;padding:0 16px!important;font:700 13.5px var(--tu-font)!important;background:var(--tu-bad)!important;color:var(--tu-surface)!important}
${H} .tu-setview .tu-btn.danger{background:transparent!important;color:var(--tu-bad)!important;border:1px solid var(--tu-bad)!important;box-shadow:none!important}
${H} #tuSheet .tu-btn:disabled{opacity:.45!important;cursor:not-allowed}
.tu-sheet section{display:flex;flex-direction:column;gap:10px}
${H} #tuSheet h3{margin:0!important;font-size:15px!important;font-weight:800!important;color:var(--tu-on)!important;letter-spacing:0!important}
.tu-sheet-note{font-size:13px;color:var(--tu-on3)}
.tu-sheet h3+.tu-sheet-note{margin-top:-4px}
.tu-retests{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
${H} #tuSheet .tu-retest{display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:14px!important;margin:0!important;height:auto!important;border-radius:18px!important;border:1px solid var(--tu-line)!important;background:transparent!important;color:var(--tu-on)!important;text-align:left;box-shadow:none!important;cursor:pointer}
${H} #tuSheet .tu-retest:hover:not(:disabled){background:var(--tu-s1)!important}
${H} #tuSheet .tu-retest:disabled{opacity:.5;cursor:not-allowed}
.tu-retest b{font-size:22px;font-weight:800}.tu-retest span{font-size:13px;font-weight:700;color:var(--tu-on2)}
.tu-list-box{border:1px solid var(--tu-line2);border-radius:20px;overflow:hidden}
${H} #tuSheet .tu-attempt{display:flex;align-items:center;gap:12px;width:100%;padding:14px 16px!important;margin:0!important;height:auto!important;border:0!important;border-bottom:1px solid var(--tu-line2)!important;border-radius:0!important;background:transparent!important;color:var(--tu-on)!important;text-align:left;box-shadow:none!important;cursor:pointer}
${H} #tuSheet .tu-attempt:last-child{border-bottom:0!important}
${H} #tuSheet .tu-attempt[aria-checked="true"]{background:var(--tu-s1)!important;cursor:default}
.tu-radio{width:20px;height:20px;border-radius:50%;border:2px solid var(--tu-line);display:flex;align-items:center;justify-content:center;flex:none}
[aria-checked="true"]>.tu-radio{border-color:var(--tu-p)}[aria-checked="true"]>.tu-radio::after{content:"";width:10px;height:10px;border-radius:50%;background:var(--tu-p)}
.tu-attempt>div{flex:1;display:flex;flex-direction:column;gap:2px;min-width:0}
.tu-attempt>div b{font-weight:800;font-size:14.5px}.tu-attempt>div span{font-size:12.5px;color:var(--tu-on3)}
.tu-attempt>strong{font-weight:800;font-size:15px}
.tu-rows{border:1px solid var(--tu-line2);border-radius:20px;overflow:hidden}
.tu-rowi{display:flex;align-items:center;gap:14px;padding:14px 16px;border-bottom:1px solid var(--tu-line2)}
.tu-rowi:last-child{border-bottom:0}
.tu-rowi>div{flex:1;display:flex;flex-direction:column;min-width:0}
.tu-rowi>div b{font-weight:700;font-size:14.5px}.tu-rowi>div span{font-size:12.5px;color:var(--tu-on3)}
.tu-rowi>strong{font-weight:800;font-size:15px}
.tu-danger{border:1px solid var(--tu-badc);border-radius:20px;padding:16px}
${H} #tuSheet .tu-danger h3{color:var(--tu-bad)!important}
.tu-danger>div{display:flex;gap:8px;flex-wrap:wrap}
.tu-loading{font-size:13px;color:var(--tu-on3);padding:6px 2px}

/* Phase B dialogs (boards StartSetup, StartSetupiPad, AddForms, FormUpdates): layers appended to #menu */
.tu-layer{position:fixed;inset:0;z-index:90;font-family:var(--tu-font);color:var(--tu-on);font-variant-numeric:tabular-nums}
.tu-layer[hidden]{display:none}
${H}.theme-dark .tu-layer .tu-scrim{background:rgba(0,0,0,.6)}
.tu-dialog-wrap{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;pointer-events:none}
.tu-dialog{pointer-events:auto;position:relative;max-width:100%;max-height:100%;background:var(--tu-surface);color:var(--tu-on);border-radius:28px;box-shadow:0 16px 56px rgba(0,0,0,.3);display:flex;flex-direction:column;overflow:hidden;animation:tuDlgIn .16s ease-out}
@keyframes tuDlgIn{from{transform:translateY(8px) scale(.99);opacity:0}}
@media (prefers-reduced-motion:reduce){.tu-dialog{animation:none}}
${H} :is(.tu-layer,#tuQuick,.tu-qbview) :is(h1,h2,h3){margin:0!important;color:var(--tu-on)!important;font-family:var(--tu-font)!important;letter-spacing:-.01em!important;line-height:1.2!important;background:none!important;-webkit-text-fill-color:currentColor!important;text-shadow:none!important}
${H} :is(.tu-layer,#tuQuick,.tu-qbview) button{font-family:var(--tu-font)!important;margin:0;box-shadow:none;cursor:pointer}
${H} :is(.tu-layer,#tuQuick,.tu-qbview) button:disabled{cursor:not-allowed}
${H} .tu-layer .tu-round{width:40px;height:40px;min-width:40px;flex:none;border-radius:50%;border:0;background:var(--tu-s1);color:var(--tu-on2);display:flex;align-items:center;justify-content:center;padding:0}
${H} .tu-layer .tu-round:hover{background:var(--tu-s2)}
.tu-layer .tu-btn,#tuQuick .tu-btn,.tu-qbview .tu-btn{border:0;font-family:var(--tu-font);justify-content:center;white-space:nowrap}
.tu-layer .tu-btn.outline,#tuQuick .tu-btn.outline{border:1px solid var(--tu-line)}
.tu-layer .tu-btn.dangertext,#tuQuick .tu-btn.dangertext{background:transparent;color:var(--tu-bad);font-weight:700}
.tu-layer .tu-btn:hover:not(:disabled),#tuQuick .tu-btn:hover:not(:disabled),.tu-qbview .tu-btn:hover:not(:disabled){filter:brightness(.96)}
.tu-layer .tu-btn.outline:hover:not(:disabled),#tuQuick .tu-btn.outline:hover:not(:disabled){background:var(--tu-s2);filter:none}
.tu-note{font-size:12.5px;color:var(--tu-on3);line-height:1.45}
.tu-chips{display:flex;flex-wrap:wrap;gap:8px}
.tu-layer .tu-chip,#tuQuick .tu-chip{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:9px;border:1px solid var(--tu-line);background:transparent;color:var(--tu-on);font-weight:700;font-size:13.5px;white-space:nowrap}
.tu-layer .tu-chip span,#tuQuick .tu-chip span{font-weight:600;opacity:.7}
.tu-layer .tu-chip:is([aria-pressed="true"],[aria-checked="true"]),#tuQuick .tu-chip:is([aria-pressed="true"],[aria-checked="true"]){border-color:var(--tu-p);background:var(--tu-pc);color:var(--tu-onpc)}
.tu-chip svg{flex:none}
.tu-stepper{display:flex;align-items:center;gap:4px;height:44px;padding:0 6px;border-radius:999px;border:1px solid var(--tu-line);flex:none}
${H} .tu-stepper button{width:34px;height:34px;min-width:34px;border-radius:50%;border:0;background:var(--tu-s1);color:var(--tu-on);font-weight:800;font-size:18px;padding:0;display:flex;align-items:center;justify-content:center;line-height:1}
${H} .tu-stepper button:hover{background:var(--tu-s2)}
.tu-stepper>span{min-width:92px;text-align:center;font-weight:800;font-size:15px}
.tu-inline{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
.tu-plan{font-size:14px;color:var(--tu-on2)}
.tu-swrow{display:flex;align-items:center;gap:14px}
.tu-swrow>div{flex:1;display:flex;flex-direction:column;gap:2px;min-width:0}
.tu-swrow b{font-weight:700;font-size:14.5px}
.tu-swrow>div>span{font-size:12.5px;color:var(--tu-on3)}
${H} .tu-switch{width:52px;height:32px;min-width:52px;flex:none;border-radius:999px;border:2px solid var(--tu-on3);background:var(--tu-s2);padding:0;display:flex;align-items:center;justify-content:flex-start}
.tu-switch i{width:16px;height:16px;margin:0 4px;border-radius:50%;background:var(--tu-on3);transition:width .12s,height .12s}
${H} .tu-switch[aria-checked="true"]{border-color:var(--tu-p);background:var(--tu-p);justify-content:flex-end}
.tu-switch[aria-checked="true"] i{width:22px;height:22px;background:var(--tu-onp)}
.tu-seg2{display:flex;height:40px;border-radius:999px;overflow:hidden;border:1px solid var(--tu-line)}
${H} .tu-seg2 button{padding:0 14px;border:0;border-radius:0;background:transparent;color:var(--tu-on);font-weight:700;font-size:13px;height:100%}
${H} .tu-seg2 button+button{border-left:1px solid var(--tu-line)}
${H} .tu-seg2 button[aria-checked="true"]{background:var(--tu-pc);color:var(--tu-onpc)}
.tu-brk-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.tu-brk-row .tu-stepper{height:40px;padding:0 4px}
${H} .tu-brk-row .tu-stepper button{width:32px;height:32px;min-width:32px;font-size:17px}
.tu-brk-row .tu-stepper>span{min-width:104px;font-size:14px}

/* start / new attempt dialog: 980px, fits 1440×900 and 1180×820; the body scrolls when space runs out */
.tu-start{width:980px}
.tu-dlg-head{padding:14px 22px 12px;display:flex;gap:14px;align-items:center;border-bottom:1px solid var(--tu-line2);flex:none}
.tu-dlg-head>div{flex:1;display:flex;flex-direction:column;gap:2px;min-width:0}
.tu-layer .tu-kicker{font-size:12px;font-weight:700;color:var(--tu-on3);letter-spacing:.04em;text-transform:uppercase}
${H} .tu-dlg-head h2{font-size:21px!important;font-weight:800!important;letter-spacing:-.02em!important}
.tu-sub{font-size:12.5px;color:var(--tu-on2)}
.tu-dlg-body{flex:1;min-height:0;overflow:auto;padding:14px 22px}
.tu-start-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:14px 22px;align-content:start}
.tu-col{display:flex;flex-direction:column;gap:14px;min-width:0}
.tu-start section{display:flex;flex-direction:column;gap:8px;min-width:0}
${H} .tu-start h3{font-size:13.5px!important;font-weight:800!important;letter-spacing:0!important}
.tu-pools{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
${H} .tu-pool{text-align:left;padding:9px 12px;border-radius:14px;border:1.5px solid var(--tu-line);background:transparent;color:var(--tu-on);display:flex;flex-direction:column;gap:2px;min-width:0}
.tu-pool b{font-size:19px;font-weight:800}.tu-pool span{font-size:12px;font-weight:700;line-height:1.25}
${H} .tu-pool[aria-checked="true"]{border-color:var(--tu-p);background:var(--tu-pc);color:var(--tu-onpc)}
${H} .tu-pool:disabled{opacity:.45}
.tu-carry{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.tu-carry>span{font-size:13px;font-weight:700;color:var(--tu-on2);margin-right:4px}
.tu-layer .tu-carry .tu-chip{height:30px;padding:0 10px;font-size:13px}
.tu-brk{padding:10px 14px;border:1px solid var(--tu-line2);border-radius:16px}
.tu-runmodes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
${H} .tu-runmode{text-align:left;padding:8px 10px;border-radius:12px;border:1.5px solid var(--tu-line);background:transparent;color:var(--tu-on);display:flex;flex-direction:column;gap:2px;min-width:0}
.tu-runmode b{font-weight:800;font-size:14px}.tu-runmode span{font-size:11px;opacity:.85}
${H} .tu-runmode[aria-checked="true"]{border-color:var(--tu-p);background:var(--tu-pc);color:var(--tu-onpc)}
.tu-blocklist{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:6px;max-height:212px;overflow:auto;padding:1px}
${H} .tu-blockpick{display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:12px;border:1.5px solid var(--tu-line2);background:transparent;color:var(--tu-on);text-align:left;min-width:0}
.tu-blockpick>i{width:20px;height:20px;flex:none;border-radius:6px;border:2px solid var(--tu-on3);color:var(--tu-onp);display:flex;align-items:center;justify-content:center}
.tu-blockpick.one>i{border-radius:50%}
.tu-blockpick>i svg{width:12px;height:12px;stroke-width:3.2}
.tu-blockpick>span{display:flex;flex-direction:column;min-width:0}.tu-blockpick b{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tu-blockpick small{font-size:12px;color:var(--tu-on3)}
${H} .tu-blockpick[aria-checked="true"]{border-color:var(--tu-p);background:var(--tu-pc)}
.tu-blockpick[aria-checked="true"]>i{border-color:var(--tu-p);background:var(--tu-p)}
.tu-blockpick.one[aria-checked="true"]>i{box-shadow:inset 0 0 0 3px var(--tu-pc)}
.tu-start .tu-switches{gap:0;border:1px solid var(--tu-line2);border-radius:20px;overflow:hidden}
.tu-switches .tu-swrow{padding:8px 14px;gap:12px;border-bottom:1px solid var(--tu-line2)}
.tu-switches .tu-swrow:last-child{border-bottom:0}
.tu-switches .tu-swrow>div>span{font-size:11.5px}
.tu-dlg-foot{padding:12px 22px 14px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;border-top:1px solid var(--tu-line2);flex:none}
.tu-dlg-foot>div{flex:1;min-width:200px;display:flex;flex-direction:column}
.tu-dlg-foot b{font-weight:800;font-size:15px}.tu-dlg-foot span{font-size:12.5px;color:var(--tu-on3)}
.tu-layer .tu-go{height:48px;padding:0 26px;gap:8px;font-size:15px}
/* while it is open the dialog sits over the Library (the legacy setup stays in Quick practice, off-screen) */
${H}[data-tu-start] #quickModePanel.mode-panel.active{display:none!important}
${H}[data-tu-start] #libraryModePanel.tu-has-home{display:block!important;padding:0!important;margin:0!important;background:transparent!important;border:0!important;box-shadow:none!important}
${H}[data-tu-start] .modern-hero{display:none!important}
${H}[data-tu-start] .modern-main{padding:22px 32px 48px!important}
${H}[data-tu-start] aside.modern-sidebar #quickTab.active{background:transparent!important;color:var(--tu-on2)!important;font-weight:600!important}
${H}[data-tu-start] aside.modern-sidebar #libraryTab{background:var(--tu-pc)!important;color:var(--tu-onpc)!important;font-weight:700!important}
@media (max-width:900px){
  ${H}[data-tu-start] aside.modern-sidebar #libraryTab{background:transparent!important;color:var(--tu-on)!important;font-weight:800!important}
  ${H}[data-tu-start] aside.modern-sidebar #libraryTab .tu-ico{background:var(--tu-pc);color:var(--tu-onpc)}
  ${H}[data-tu-start] aside.modern-sidebar #quickTab.active .tu-ico{background:transparent;color:inherit}
}

/* Add forms dialog (board AddForms): 1000×760, tab rail on the left */
.tu-layer .tu-add{width:1000px;height:760px;flex-direction:row;flex-wrap:wrap}
.tu-add-nav{flex:1 1 240px;background:var(--tu-s1);padding:22px 12px;display:flex;flex-direction:column;gap:4px;min-width:0}
${H} .tu-add-nav h2{margin:0 12px 14px!important;font-size:22px!important;font-weight:800!important}
.tu-add-nav [role="tablist"]{display:flex;flex-direction:column;gap:4px}
${H} .tu-add-nav [role="tab"]{text-align:left;display:flex;flex-direction:column;gap:2px;padding:12px 14px;border-radius:16px;border:0;background:transparent;color:var(--tu-on);width:100%}
${H} .tu-add-nav [role="tab"]:hover{background:var(--tu-s2)}
${H} .tu-add-nav [role="tab"][aria-selected="true"]{background:var(--tu-pc);color:var(--tu-onpc)}
.tu-add-nav [role="tab"] b{font-weight:800;font-size:14.5px}.tu-add-nav [role="tab"] span{font-size:12.5px;opacity:.85}
.tu-add-foot{margin-top:auto;font-size:12px;color:var(--tu-on3);padding:12px 12px 0;line-height:1.45}
${H} .tu-add-foot .tu-link{padding:0;font-size:12px}
.tu-add-main{flex:999 1 480px;min-width:0;min-height:0;display:flex;flex-direction:column;height:100%}
.tu-add-top{display:flex;justify-content:flex-end;padding:14px 14px 0;flex:none}
.tu-add-body{flex:1;min-height:0;overflow:auto;padding:0 28px 28px;display:flex;flex-direction:column;gap:16px}
.tu-add-h{display:flex;flex-direction:column;gap:4px}
${H} .tu-add-h h3{font-size:20px!important;font-weight:800!important}
.tu-add-h span{font-size:13.5px;color:var(--tu-on3)}
.tu-slotsearch{display:flex;align-items:center;gap:10px;height:44px;padding:0 16px;border-radius:999px;background:var(--tu-s2);color:var(--tu-on3);flex:none}
.tu-slotsearch:focus-within{outline:3px solid var(--tu-p);outline-offset:2px}
${H} .tu-layer .tu-slotsearch input{-webkit-appearance:none!important;appearance:none!important;border:0!important;background:transparent!important;outline:none!important;flex:1!important;min-width:0!important;height:42px!important;padding:0!important;margin:0!important;box-shadow:none!important;font:14.5px var(--tu-font)!important;color:var(--tu-on)!important}
.tu-layer .tu-add .tu-chips{gap:6px}
.tu-layer .tu-add .tu-chip{border-radius:8px;font-size:13px}
.tu-slots{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px}
.tu-slot{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:16px;border:1px solid var(--tu-line2);min-width:0}
.tu-slot.loaded{background:var(--tu-s1)}
.tu-slot>i{width:9px;height:9px;border-radius:50%;flex:none}
.tu-slot>span{flex:1;display:flex;flex-direction:column;min-width:0}
.tu-slot b{font-weight:800;font-size:14.5px}.tu-slot small{font-size:12px;color:var(--tu-on3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tu-layer .tu-slot .tu-btn{height:34px;padding:0 14px;font-size:13px;font-weight:700}
.tu-layer .tu-slot .tu-btn.outline{color:var(--tu-on2)}
.tu-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.tu-fieldin{display:flex;flex-direction:column;gap:6px;min-width:0}
.tu-fieldin.span2{grid-column:span 2}
.tu-fieldin>span{font-size:13px;font-weight:700;color:var(--tu-on2)}
${H} .tu-layer .tu-fieldin :is(input,select){height:46px!important;border-radius:12px!important;border:1px solid var(--tu-line)!important;background:var(--tu-surface)!important;color:var(--tu-on)!important;padding:0 14px!important;font:15px var(--tu-font)!important;margin:0!important;box-shadow:none!important;width:100%!important;min-width:0!important}
${H} .tu-layer .tu-fieldin select{padding:0 12px!important}
${H} .tu-layer .tu-fieldin input::placeholder{color:var(--tu-on3)!important}
${H} :is(.tu-layer,#tuQuick) :is(.tu-dropbox,.tu-drop){display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:26px;border-radius:20px;border:2px dashed var(--tu-line);background:var(--tu-s1);color:var(--tu-on2);text-align:center;cursor:pointer;font-family:var(--tu-font)}
:is(.tu-dropbox,.tu-drop) b{font-weight:800;font-size:15px;color:var(--tu-on)}
:is(.tu-dropbox,.tu-drop)>span{font-size:12.5px;line-height:1.5}
:is(.tu-dropbox,.tu-drop):hover{border-color:var(--tu-on3)}
.tu-dropbox:focus-within{outline:3px solid var(--tu-p);outline-offset:2px}
.tu-dropbox.tu-busy{opacity:.6;cursor:progress}
.tu-bulk-top{display:flex;flex-wrap:wrap;gap:14px}
.tu-bulk-top .tu-dropbox{flex:1 1 260px;padding:22px}
${H} .tu-layer .tu-pre{flex:1 1 220px;margin:0!important;padding:16px!important;border-radius:16px!important;border:0!important;background:var(--tu-s2)!important;font:12.5px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace!important;color:var(--tu-on2)!important;white-space:pre;overflow:auto}
.tu-table{border:1px solid var(--tu-line2);border-radius:18px;overflow:hidden}
.tu-thead,.tu-trow{display:grid;grid-template-columns:minmax(0,1.4fr) repeat(3,minmax(0,1fr));gap:8px;align-items:center}
.tu-thead{padding:10px 16px;font-size:12px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--tu-on3);background:var(--tu-s1)}
.tu-trow{padding:12px 16px;border-top:1px solid var(--tu-line2);font-size:14px}
.tu-trow>span:first-child{display:flex;flex-direction:column;min-width:0}.tu-trow small{font-size:12px;color:var(--tu-on3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tu-oktext{color:var(--tu-ok);font-weight:700}.tu-muted{color:var(--tu-on3);font-weight:700}
${H} .tu-layer p.tu-status{margin:0!important;font-size:13.5px!important;color:var(--tu-on2)!important;line-height:1.45}
${H} .tu-layer p.tu-status:empty{display:none!important}
${H} .tu-layer p.tu-status.ok{color:var(--tu-ok)!important;font-weight:700}
${H} .tu-layer p.tu-status.bad{color:var(--tu-bad)!important;font-weight:700}
.tu-end{display:flex;justify-content:flex-end}
.tu-layer .tu-end .tu-btn{height:46px;padding:0 24px;font-size:14.5px}
.tu-layer .tu-add .tu-banner{background:var(--tu-s1);color:var(--tu-on)}
/* online updates: the Add forms tab and the header popover (board FormUpdates) */
.tu-updbody{display:flex;flex-direction:column;gap:12px}
.tu-updmsg{font-size:13.5px;font-weight:600;color:var(--tu-on2)}
.tu-updmsg.ok{color:var(--tu-ok)}.tu-updmsg.warn{color:var(--tu-warn)}
.tu-updlist{border:1px solid var(--tu-line2);border-radius:20px;overflow:hidden}
.tu-updrow{display:flex;flex-direction:column;gap:4px;padding:12px 16px;border-bottom:1px solid var(--tu-line2)}
.tu-updrow:last-child{border-bottom:0}
.tu-updrow>div{display:flex;align-items:center;gap:12px}
.tu-updrow>div>i{width:9px;height:9px;border-radius:50%;flex:none}
.tu-updrow>div>span{flex:1;display:flex;flex-direction:column;min-width:0}
.tu-updrow b{font-size:14.5px}.tu-updrow small{font-size:12.5px;color:var(--tu-on3)}
.tu-updchip{font-style:normal;font-size:12px;font-weight:800;padding:4px 10px;border-radius:999px;white-space:nowrap}
.tu-updchip.new{background:var(--tu-pc);color:var(--tu-onpc)}.tu-updchip.rev{background:var(--tu-warnc);color:var(--tu-warn)}.tu-updchip.ok{background:var(--tu-okc);color:var(--tu-ok)}.tu-updchip.skip{background:var(--tu-s2);color:var(--tu-on2)}.tu-updchip.bad{background:var(--tu-badc);color:var(--tu-bad)}
.tu-updrow .tu-updwhy{color:var(--tu-bad);padding-left:21px}
.tu-updprog{display:flex;flex-direction:column;gap:6px}
.tu-updprog>div{display:flex;justify-content:space-between;font-size:13px;font-weight:700}.tu-updprog>div span+span{color:var(--tu-on3)}
.tu-updprog .tu-tile-bar{height:8px;background:var(--tu-s2)}.tu-updprog .tu-tile-bar i{background:var(--tu-p)}
.tu-updbody .tu-actions{display:flex;gap:8px;flex-wrap:wrap}
.tu-layer .tu-updbody .tu-actions .tu-btn{height:48px;padding:0 20px;font-size:14.5px}
.tu-layer .tu-updbody .tu-actions .tu-grow{flex:1;font-size:15px;font-weight:800}
#tuUpd .tu-dialog-wrap{align-items:flex-start;justify-content:flex-end;padding:96px 40px 24px}
.tu-layer .tu-upd{width:500px;max-width:calc(100vw - 32px)}
.tu-upd-head{padding:22px 24px 14px;display:flex;align-items:flex-start;gap:12px;flex:none}
.tu-upd-ico{width:44px;height:44px;border-radius:14px;background:var(--tu-pc);color:var(--tu-onpc);display:flex;align-items:center;justify-content:center;flex:none}
.tu-upd-head>div{flex:1;display:flex;flex-direction:column;gap:2px;min-width:0}
${H} .tu-upd-head h2{font-size:20px!important;font-weight:800!important}
${H} .tu-layer .tu-upd-head .tu-round{width:38px;height:38px;min-width:38px}
.tu-upd .tu-updbody{padding:0 16px 20px;overflow:auto;min-height:0}
.tu-upd .tu-updbody>:not(.tu-updlist){margin:0 8px}
.tu-upd .tu-updbody>.tu-actions{margin-top:4px}
/* the legacy Load New Form modal stays open off-screen while Add forms uses its slot and custom import */
:root[data-tu] #modalRoot[data-tu-ghost],:root[data-tu] #modalRoot[data-tu-ghost] *{visibility:hidden!important;pointer-events:none!important}
:root[data-tu] #modalRoot[data-tu-ghost] .modal-backdrop{left:-10000px!important;right:auto!important;width:900px!important}

/* Quick practice (board QuickPractice): the legacy Quick Import panel stays in the DOM, off-screen */
${H} #quickModePanel.tu-has-quick.active{display:block!important;padding:0!important;margin:0!important;background:transparent!important;border:0!important;box-shadow:none!important}
${H} #quickModePanel.tu-has-quick>:not(#tuQuick){position:absolute!important;left:-10000px!important;top:0!important;width:900px!important;height:1px!important;overflow:hidden!important;visibility:hidden!important;pointer-events:none!important}
${H}[data-tu-page="quick"] .modern-hero{display:none!important}
${H}:not([data-tu-start]) .modern-main:has(#quickModePanel.tu-has-quick.active){padding:28px 36px 56px!important}
${H} #tuQuick{max-width:1240px;margin:0 auto;display:flex;flex-direction:column;gap:20px;color:var(--tu-on);font-family:var(--tu-font)}
.tu-qhead{display:flex;flex-direction:column;gap:4px}
${H} #tuQuick .tu-qhead h1{font-size:32px!important;font-weight:800!important;letter-spacing:-.02em!important}
.tu-qhead>span{font-size:14px;color:var(--tu-on3)}
.tu-banner{display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:14px 18px;border-radius:18px;background:var(--tu-warnc);color:var(--tu-warn)}
.tu-banner>span{flex:1 1 260px;font-size:14px;font-weight:600;line-height:1.4}
${H} #tuQuick .tu-banner .tu-link{color:var(--tu-warn);font-weight:800;font-size:14px;text-decoration:underline;text-underline-offset:3px}
.tu-qgrid{display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start}
.tu-qcol{flex:1 1 400px;min-width:0;display:flex;flex-direction:column;gap:16px}
${H} #tuQuick .tu-drop{width:100%;padding:40px 24px;border-radius:28px;gap:10px;background:var(--tu-surface)}
${H} #tuQuick .tu-drop.tu-drag{border-color:var(--tu-p);background:var(--tu-pc)}
.tu-drop-ico{width:56px;height:56px;border-radius:18px;background:var(--tu-pc);color:var(--tu-onpc);display:flex;align-items:center;justify-content:center}
#tuQuick .tu-drop b{font-size:17px}
#tuQuick .tu-drop>span:last-child{font-size:13px;max-width:340px}
.tu-qbank{padding:18px;display:flex;align-items:center;gap:12px}
.tu-okico{width:44px;height:44px;border-radius:14px;background:var(--tu-okc);color:var(--tu-ok);display:flex;align-items:center;justify-content:center;flex:none}
.tu-okico svg{width:22px;height:22px}
.tu-qbank-text{flex:1;display:flex;flex-direction:column;min-width:0}
.tu-qbank-text b{font-size:15.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tu-qbank-text span{font-size:13px;color:var(--tu-on3)}
#tuQuick .tu-qbank .tu-btn{height:36px;padding:0 14px;font-size:13px;font-weight:700}
.tu-qsave{padding:18px;display:flex;flex-direction:column;gap:12px}
${H} #tuQuick .tu-qsave h2{font-size:16px!important;font-weight:800!important}
.tu-qsave .tu-note{font-size:13px;margin-top:-6px}
.tu-qsave .tu-actions{display:flex;flex-wrap:wrap;gap:8px}
#tuQuick .tu-qsave .tu-btn{height:40px;padding:0 16px;font-size:13.5px;font-weight:700}
.tu-run{flex:1 1 480px;min-width:0;padding:20px;border-radius:28px;display:flex;flex-direction:column;gap:18px}
${H} #tuQuick .tu-run h2{font-size:18px!important;font-weight:800!important}
.tu-field{display:flex;flex-direction:column;gap:8px}
.tu-field>span{font-size:13px;font-weight:700;color:var(--tu-on2)}
#tuQuick .tu-chip{height:36px;padding:0 14px;border-radius:10px}
#tuQuick .tu-run>.tu-chips .tu-chip{height:34px;font-size:13px}
#tuQuick .tu-plan{font-size:13.5px}
.tu-qblocks{border:1px solid var(--tu-line2);border-radius:18px;overflow:hidden;max-height:330px;overflow-y:auto}
${H} #tuQuick .tu-qblocks button{width:100%;display:flex;align-items:center;gap:12px;padding:12px 16px;border:0;border-bottom:1px solid var(--tu-line2);border-radius:0;background:transparent;color:var(--tu-on);text-align:left}
${H} #tuQuick .tu-qblocks button:last-child{border-bottom:0}
${H} #tuQuick .tu-qblocks button[aria-checked="true"]{background:var(--tu-s1)}
.tu-qblocks i{width:20px;height:20px;border-radius:50%;border:2px solid var(--tu-line);display:flex;align-items:center;justify-content:center;flex:none}
.tu-qblocks [aria-checked="true"] i{border-color:var(--tu-p)}
.tu-qblocks [aria-checked="true"] i::after{content:"";width:10px;height:10px;border-radius:50%;background:var(--tu-p)}
.tu-qblocks b{flex:1;font-weight:700;font-size:14.5px;min-width:0}.tu-qblocks button>span{font-size:13px;color:var(--tu-on3);white-space:nowrap}
.tu-qstart{display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end}
#tuQuick .tu-qstart .tu-btn{height:48px;padding:0 20px;font-size:14.5px;font-weight:800;gap:8px}
#tuQuick .tu-qstart .tu-btn:not(.outline){padding:0 24px}
.tu-qempty{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;padding:36px 16px;color:var(--tu-on3);border:1px dashed var(--tu-line);border-radius:20px}
.tu-qempty b{color:var(--tu-on);font-size:15px}.tu-qempty span{font-size:13px;max-width:320px}

/* Qbank (boards Qbank, QbankHistory): the legacy panels stay in the DOM, off-screen; History is a tab of Qbank, so the
   sidebar's "Qbank tests" button is hidden (kept for its hooks) and Qbank stays highlighted on the History page */
${H} :is(#qbankModePanel,#qbankTestsPanel).tu-has-qbank.active{display:block!important;padding:0!important;margin:0!important;background:transparent!important;border:0!important;box-shadow:none!important}
${H} :is(#qbankModePanel,#qbankTestsPanel).tu-has-qbank>:not(.tu-qbview){position:absolute!important;left:-10000px!important;top:0!important;width:900px!important;height:1px!important;overflow:hidden!important;visibility:hidden!important;pointer-events:none!important}
${H}:is([data-tu-page="qbank"],[data-tu-page="qbankTests"]) .modern-hero{display:none!important}
${H} .modern-main:has(:is(#qbankModePanel,#qbankTestsPanel).tu-has-qbank.active){padding:28px 36px 56px!important}
${H} aside.modern-sidebar #qbankTestsTab{display:none!important}
${H}[data-tu-page="qbankTests"] aside.modern-sidebar #qbankTab{background:var(--tu-pc)!important;color:var(--tu-onpc)!important;font-weight:700!important}
${H} .tu-qbview{max-width:1240px;margin:0 auto;display:flex;flex-direction:column;gap:22px;color:var(--tu-on);font-family:var(--tu-font);font-variant-numeric:tabular-nums}
.tu-qbhead{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:16px}
.tu-qbhead>div:first-child{display:flex;flex-direction:column;gap:4px;min-width:0}
${H} .tu-qbhead h1{font-size:32px!important;font-weight:800!important;letter-spacing:-.02em!important}
.tu-qbhead>div>span{font-size:14px;color:var(--tu-on3)}
.tu-qbtabs{display:flex;height:44px;border:1px solid var(--tu-line);border-radius:999px;overflow:hidden;background:var(--tu-surface);flex:none}
${H} .tu-qbtabs button{display:flex;align-items:center;gap:6px;padding:0 20px;border:0;border-radius:0;background:transparent;color:var(--tu-on2);font-weight:700;font-size:14px;height:100%}
${H} .tu-qbtabs button+button{border-left:1px solid var(--tu-line)}
${H} .tu-qbtabs button[aria-selected="true"]{background:var(--tu-pc);color:var(--tu-onpc)}
.tu-qbtabs button span{font-weight:600;opacity:.75}
.tu-qbtotals{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}
.tu-qbtile{background:var(--tu-surface);border:1px solid var(--tu-line2);border-radius:22px;padding:16px 18px;display:flex;flex-direction:column;gap:2px;min-width:0}
.tu-qbtile b{font-size:28px;font-weight:800;line-height:1.2}
.tu-qbtile span{font-size:13px;font-weight:700;color:var(--tu-on3)}
.tu-qbtile.main{background:var(--tu-p);border-color:var(--tu-p);color:var(--tu-onp)}
.tu-qbtile.main span{opacity:.9}
.tu-qbgrid{display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start}
.tu-qbview .tu-card{border-radius:28px}
.tu-qbforms{flex:1 1 340px;min-width:0;padding:20px;display:flex;flex-direction:column;gap:14px}
.tu-qbfhead{display:flex;align-items:center;justify-content:space-between;gap:10px}
${H} .tu-qbfhead h2{font-size:18px!important;font-weight:800!important}
.tu-qbfhead h2 span{font-weight:600;color:var(--tu-on3);font-size:14px}
.tu-qbfhead>div{display:flex;gap:6px}
${H} .tu-qbview .tu-link{height:34px;padding:0 12px;border-radius:999px;font-size:13.5px}
${H} .tu-qbview .tu-link:hover{background:var(--tu-s2)}
.tu-qbfind{display:flex;align-items:center;gap:10px;height:44px;padding:0 16px;border-radius:999px;background:var(--tu-s2);color:var(--tu-on3)}
${H} .tu-qbfind input{flex:1;min-width:0;height:100%;border:0!important;background:transparent!important;outline:none;padding:0!important;margin:0;font-size:14.5px;color:var(--tu-on)!important;box-shadow:none!important}
.tu-qbfind:focus-within{outline:3px solid var(--tu-p);outline-offset:2px}
.tu-qbgroups{display:flex;flex-direction:column;gap:14px}
.tu-qbgroup{border:1px solid var(--tu-line2);border-radius:18px;overflow:hidden}
${H} .tu-qbghead{width:100%;display:flex;align-items:center;gap:12px;padding:12px 14px;border:0;border-radius:0;background:var(--tu-s1);color:var(--tu-on);text-align:left}
.tu-qbghead>i{width:10px;height:10px;border-radius:50%;flex:none}
.tu-qbghead>b{flex:1;font-weight:800;font-size:14.5px;min-width:0}
.tu-qbghead>span{font-size:12.5px;color:var(--tu-on3);font-weight:600;white-space:nowrap}
.tu-qbghead>svg{color:var(--tu-on3);transition:transform .15s}
.tu-qbghead[aria-expanded="false"]>svg{transform:rotate(-90deg)}
@media (prefers-reduced-motion:reduce){.tu-qbghead>svg{transition:none}}
${H} .tu-qbrow{width:100%;display:flex;align-items:center;gap:12px;padding:11px 14px;border:0;border-top:1px solid var(--tu-line2);border-radius:0;background:transparent;color:var(--tu-on);text-align:left}
${H} .tu-qbrow:hover{background:var(--tu-s1)}
.tu-qbrow>i{width:20px;height:20px;border-radius:6px;border:2px solid var(--tu-on3);display:flex;align-items:center;justify-content:center;color:var(--tu-onp);flex:none}
.tu-qbrow[aria-checked="true"]>i{border-color:var(--tu-p);background:var(--tu-p)}
.tu-qbrow>span{flex:1;display:flex;flex-direction:column;min-width:0}
.tu-qbrow b{font-weight:700;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tu-qbrow small{font-size:12px;color:var(--tu-on3)}
.tu-qbrow>em{font-style:normal;font-size:13px;font-weight:700;color:var(--tu-on2);white-space:nowrap}
.tu-qbopts{flex:1 1 440px;min-width:0;display:flex;flex-direction:column;gap:14px}
.tu-qbcard{padding:20px;display:flex;flex-direction:column;gap:18px}
.tu-qbfield{display:flex;flex-direction:column;gap:8px;min-width:0}
label.tu-qbfield{gap:6px}
.tu-qbfield>span{font-size:13px;font-weight:700;color:var(--tu-on2)}
${H} .tu-qbview .tu-qbfield input{height:46px;border-radius:12px!important;border:1px solid var(--tu-line)!important;background:var(--tu-surface)!important;color:var(--tu-on)!important;padding:0 14px;font-size:15px;width:100%;box-sizing:border-box;margin:0;box-shadow:none}
${H} .tu-qbview .tu-qbfield input[type=number]{font-weight:700}
.tu-qbpair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
${H} .tu-qbradio{text-align:left;padding:12px 14px;border-radius:16px;border:1.5px solid var(--tu-line);background:transparent;color:var(--tu-on);display:flex;flex-direction:column;gap:2px;min-width:0}
.tu-qbradio b{font-weight:800;font-size:14.5px}.tu-qbradio span{font-size:12.5px;opacity:.85;line-height:1.35}
${H} .tu-qbradio[aria-checked="true"]{border-color:var(--tu-p);background:var(--tu-pc);color:var(--tu-onpc)}
.tu-qbattempt{display:flex;align-items:center;gap:10px;font-size:13.5px;color:var(--tu-on2);flex-wrap:wrap}
${H} .tu-qbview .tu-qbattempt select{height:38px;border-radius:10px!important;border:1px solid var(--tu-line)!important;background-color:var(--tu-surface)!important;color:var(--tu-on)!important;padding:0 10px 0 12px;font-weight:700;font-size:13.5px;margin:0;max-width:100%}
.tu-qbview .tu-chip{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 12px;border-radius:10px;border:1px solid var(--tu-line);background:transparent;color:var(--tu-on);font-weight:700;font-size:13.5px;white-space:nowrap}
.tu-qbview .tu-chip:is([aria-pressed="true"],[aria-checked="true"]){border-color:var(--tu-p);background:var(--tu-pc);color:var(--tu-onpc)}
.tu-qbnums{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.tu-qbrange{display:flex;align-items:center;gap:12px;font-size:14px}
${H} .tu-qbrange input{flex:1;min-width:0;accent-color:var(--tu-p);margin:0;height:24px}
.tu-qbrange>span:last-child{color:var(--tu-on3);font-weight:600;white-space:nowrap}
.tu-qbcard .tu-swrow{padding-top:4px}
.tu-qbfoot{position:sticky;bottom:16px;z-index:2;background:var(--tu-s2);border-radius:24px;padding:14px 14px 14px 20px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.tu-qbfoot>div{flex:1;min-width:150px;display:flex;flex-direction:column}
.tu-qbfoot b{font-weight:800;font-size:15px}.tu-qbfoot span{font-size:12.5px;color:var(--tu-on3)}
${H} .tu-qbview .tu-qbgo{height:50px;padding:0 26px;gap:8px;font-size:15px;font-weight:800}
.tu-qttools{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
.tu-qtfind{width:320px;max-width:100%}
${H} .tu-qticon{width:36px;height:36px;min-width:36px;border-radius:50%;border:0;background:transparent;color:var(--tu-on2);display:flex;align-items:center;justify-content:center;padding:0;flex:none}
${H} .tu-qticon:hover{background:var(--tu-s2)}
${H} .tu-qticon.bad{color:var(--tu-bad)}
.tu-qbhead-r{display:flex;align-items:center;gap:8px}
.tu-qttable{overflow:hidden;container-type:inline-size}
.tu-qtrow{display:grid;grid-template-columns:minmax(0,2.4fr) minmax(0,1fr) minmax(0,1fr) minmax(0,.8fr) minmax(0,1fr) minmax(216px,1.6fr);gap:12px;padding:14px 22px;align-items:center;border-bottom:1px solid var(--tu-line2)}
.tu-qtrow:last-child{border-bottom:0}
.tu-qthead{font-size:12px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--tu-on3)}
.tu-qthead>span:last-child{text-align:right}
.tu-qtname{display:flex;flex-direction:column;gap:2px;min-width:0}
.tu-qtname b{font-weight:800;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tu-qtname small{font-size:12.5px;color:var(--tu-on3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tu-qtmode,.tu-qtst{font-style:normal;font-size:12.5px;font-weight:800;padding:4px 10px;border-radius:8px;background:var(--tu-s2);color:var(--tu-on2);white-space:nowrap;display:inline-block}
.tu-qtmode.tutor{background:var(--tu-warnc);color:var(--tu-warn)}
.tu-qtst{font-size:12px;border-radius:999px;background:var(--tu-pc);color:var(--tu-onpc)}
.tu-qtst.done{background:var(--tu-okc);color:var(--tu-ok)}
.tu-qtqs{font-size:14px;font-weight:700;white-space:nowrap}
.tu-qtscore{font-size:15px;font-weight:800;white-space:nowrap}
.tu-qtlbl{display:none;font-weight:600;color:var(--tu-on3);font-size:13px}
.tu-qtacts{display:flex;gap:6px;justify-content:flex-end;align-items:center}
${H} .tu-qbview .tu-qtacts .tu-btn{height:36px;padding:0 16px;font-weight:700;font-size:13.5px}
${H} .tu-qbview .tu-qtacts .tu-btn.tonal2{background:var(--tu-s2);color:var(--tu-on)}
.tu-qtempty{padding:48px 22px;text-align:center;color:var(--tu-on3);font-size:14.5px;display:flex;flex-direction:column;gap:6px;align-items:center}
.tu-qtempty b{color:var(--tu-on);font-size:15px}
/* legacy dark rules force every span and label in #menu to fixed colors; take them back inside the Qbank views */
${H} .tu-qbview :is(span,label){color:inherit!important}
${H} .tu-qbview :is(.tu-qbhead>div>span,.tu-qbtile span,.tu-qbfhead h2 span,.tu-qbfind,.tu-qbghead>span,.tu-qbrange>span:last-child,.tu-swrow>div>span,.tu-qbfoot span,.tu-qtlbl){color:var(--tu-on3)!important}
${H} .tu-qbview :is(.tu-qbfield>span,.tu-qbattempt){color:var(--tu-on2)!important}
${H} .tu-qbview .tu-qbtile.main span{color:var(--tu-onp)!important}
@container (max-width:780px){
  .tu-qtrow.tu-qthead{display:none}
  .tu-qtrow{display:flex;flex-wrap:wrap;gap:8px 12px;padding:14px 18px}
  .tu-qtname{flex:1 1 100%}
  .tu-qtlbl{display:inline}
  .tu-qtacts{margin-left:auto}
}
@media (max-width:900px){
  ${H}[data-tu-page="qbankTests"] aside.modern-sidebar #qbankTab{background:transparent!important;color:var(--tu-on)!important;font-weight:800!important}
  ${H}[data-tu-page="qbankTests"] aside.modern-sidebar #qbankTab .tu-ico{background:var(--tu-pc);color:var(--tu-onpc)}
  /* the page scrolls here, not .modern-main (which grows to its content), so let the sticky footer use the viewport */
  ${H} .modern-main:has(:is(#qbankModePanel,#qbankTestsPanel).tu-has-qbank.active){padding:24px 24px 120px!important;overflow:visible!important}
  ${H} .tu-qbview{gap:16px}
  ${H} .tu-qbhead h1{font-size:30px!important}
  /* one column: options first, the footer stays visible over the form list */
  .tu-qbgrid{flex-direction:column;align-items:stretch}
  .tu-qbopts{display:contents}
  .tu-qbcard{order:1}.tu-qbforms{order:2;flex:none}
  .tu-qbfoot{order:3;bottom:104px}
}

/* narrow windows */
@media (max-width:1300px){.tu-home-top{grid-template-columns:minmax(0,1.2fr) minmax(0,.95fr) 240px;grid-template-rows:276px}.tu-overall{padding:14px 16px}.tu-overall .tu-rings{gap:8px}.tu-ring112{width:96px;height:96px}.tu-ring112>div{width:76px;height:76px}.tu-ring112 b{font-size:21px}.tu-ring112 span{font-size:9.5px}.tu-pair>div{padding:8px 10px}.tu-pair b{font-size:15px}}
@media (max-width:1000px){${H} .modern-main:has(#libraryModePanel.tu-has-home.active){padding:18px 20px 40px!important}}
@media (max-width:560px){.tu-sheet-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.tu-retests{grid-template-columns:minmax(0,1fr)}.tu-sheet{top:0;right:0;bottom:0;max-width:100%;border-radius:0}}

/* iPad portrait (board iPadPortrait): bottom navigation, Add forms button, sync strip, compact home */
@media (max-width:900px){
  ${H}.modern-menu-shell .modern-menu{display:block!important;padding-bottom:96px!important}
  ${H} aside.modern-sidebar{position:fixed!important;left:0!important;right:0!important;bottom:0!important;top:auto!important;z-index:60!important;width:auto!important;height:auto!important;min-height:0!important;flex-direction:row!important;flex-wrap:nowrap!important;align-items:stretch!important;justify-content:space-around!important;gap:0!important;padding:8px 6px calc(10px + env(safe-area-inset-bottom))!important;overflow:visible!important;background:var(--tu-s1)!important;border-right:0!important;border-top:1px solid var(--tu-line2)!important}
  ${H} aside.modern-sidebar>:is(.brand-block,#tuNavCard,#themeToggle,.sidebar-note){display:none!important}
  ${H} aside.modern-sidebar .menu-tab{flex:1 1 0!important;min-width:0!important;flex-direction:column!important;gap:4px!important;height:auto!important;min-height:0!important;padding:0!important;margin:0!important;border-radius:0!important;background:transparent!important;color:var(--tu-on2)!important;font-size:12px!important;font-weight:600!important;justify-content:flex-start!important;box-shadow:none!important;border:0!important}
  ${H} aside.modern-sidebar .menu-tab .tu-ico{width:64px;height:32px;padding:5px 21px;border-radius:999px;box-sizing:border-box}
  ${H} aside.modern-sidebar .menu-tab.active{background:transparent!important;color:var(--tu-on)!important;font-weight:800!important}
  ${H} aside.modern-sidebar .menu-tab.active .tu-ico{background:var(--tu-pc);color:var(--tu-onpc)}
  ${H} aside.modern-sidebar .menu-tab .tu-tab-label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
  ${H} aside.modern-sidebar .menu-tab .sync-tab-dot{position:absolute;margin:0!important;transform:translate(14px,-2px)}
  ${H} aside.modern-sidebar #tuAddForms{display:none!important}
  ${H}[data-tu-page="library"] aside.modern-sidebar #tuAddForms{display:flex!important;position:fixed!important;left:auto!important;top:auto!important;right:24px!important;bottom:112px!important;width:auto!important;height:60px!important;padding:0 22px!important;margin:0!important;border-radius:18px!important;box-shadow:0 6px 20px rgba(20,26,40,.22)!important;z-index:61;font-size:15.5px!important;font-weight:800!important}
  ${H} .modern-main:has(#libraryModePanel.tu-has-home.active){padding:24px 24px 120px!important}
  ${H} #tuHome{gap:14px}
  ${H} #tuHome .tu-home-title h1{font-size:30px!important}
  .tu-home-title span,${H} #tuHome .tu-sortbtn,${H} #tuHome .tu-view,${H} #tuHome .tu-syncpill{display:none!important}
  ${H} #tuHome .tu-search{width:200px}
  ${H} #tuHome .tu-iconbtn{width:44px;height:44px;min-width:44px}
  .tu-syncstrip{display:flex;align-items:center;gap:10px;min-height:40px;width:100%;padding:4px 6px 4px 14px!important;border-radius:14px!important;text-align:left;font:13px var(--tu-font)!important;cursor:pointer}
  .tu-syncstrip>span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .tu-syncstrip>em{font-style:normal;height:30px;padding:0 12px;border-radius:999px;background:var(--tu-surface);color:var(--tu-on);display:flex;align-items:center;font-weight:800;font-size:12.5px;flex:none}
  .tu-home-top{display:flex;flex-direction:column;gap:12px}
  .tu-overall{order:-1;flex-direction:row;flex-wrap:wrap;align-items:center;gap:12px 18px;padding:12px 16px;border-radius:20px}
  .tu-overall .tu-sec-head,.tu-ov-note{display:none}
  .tu-rings{flex:none;gap:12px}
  .tu-ring112{width:76px;height:76px}.tu-ring112>div{width:60px;height:60px}.tu-ring112 b{font-size:16.5px}.tu-ring112 span{font-size:8.5px;letter-spacing:.02em}
  .tu-pair{flex:1 1 260px}
  .tu-recent{display:none!important}
  .tu-cats-body{flex:none}
  .tu-cats .tu-tiles,.tu-cms .tu-tiles{grid-template-columns:none;grid-template-rows:none;overflow:visible}
  .tu-cms{padding:12px 14px;gap:8px;border-radius:18px}
  .tu-cats{background:transparent;border:0;box-shadow:none;padding:0}
  .tu-cats .tu-sec-head{display:none}
  .tu-tiles{display:flex;flex-wrap:wrap;gap:6px}
  ${H} #tuHome .tu-tile{flex-direction:row;align-items:center;gap:7px;height:36px!important;padding:0 12px!important;border-radius:10px!important;border-width:1px!important}
  .tu-tile .tu-tile-bar,.tu-tile>small,.tu-tile-top span{display:none}
  .tu-tile-top{gap:7px;width:auto}
  .tu-tile-top b{font-weight:700}
  .tu-tile>em{font-style:normal;font-weight:600;opacity:.7;font-size:14px}
  .tu-tiles.tu-clamp{max-height:78px;overflow:hidden}
  .tu-cms .tu-tile-top{flex-wrap:nowrap}
  .tu-cms .tu-tiles{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}.tu-cms .tu-tiles>.tu-tile{flex:none}
  .tu-resume-bar{display:none}
  .tu-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
  .tu-form{padding:16px;gap:12px}
  .tu-forms-bar .tu-shown{display:none}
}
.tu-tile>em{display:none}
@media (max-width:900px){.tu-tile>em{display:inline}}
@media (max-width:600px){.tu-grid{grid-template-columns:minmax(0,1fr)}${H} #tuHome .tu-search{width:100%;flex:1 1 100%}
  /* phones: title, download and ⋯ on one line (⋯ at the right edge, so its menu opens on screen), search below */
  .tu-home-head{gap:10px 8px}.tu-home-title{flex:1;min-width:0}.tu-home-tools{display:contents}${H} #tuHome .tu-search{order:10}
  .tu-more-panel{max-width:calc(100vw - 24px)}
  ${H}[data-tu-page="library"] aside.modern-sidebar #tuAddForms{display:none!important}
  ${H} #tuHome .tu-addmini{display:inline-flex!important}}
${H} #tuHome .tu-addmini{display:none}

/* Settings + Backup & sync (boards Settings, Sync): the legacy panels stay in the DOM, off-screen */
${H} :is(#settingsPanel.tu-has-settings,#progressSyncPanel.tu-has-sync).active{display:block!important;padding:0!important;margin:0!important;background:transparent!important;border:0!important;box-shadow:none!important}
${H} :is(#settingsPanel.tu-has-settings,#progressSyncPanel.tu-has-sync)>:not(.tu-setview){position:absolute!important;left:-10000px!important;top:0!important;width:900px!important;height:1px!important;overflow:hidden!important;visibility:hidden!important;pointer-events:none!important}
${H}:is([data-tu-page="settings"],[data-tu-page="progressSync"],[data-tu-page="tuSync"]) .modern-hero{display:none!important}
${H} .modern-main:has(:is(#settingsPanel.tu-has-settings,#progressSyncPanel.tu-has-sync).active){padding:28px 36px 56px!important}
${H} .tu-setview{max-width:1240px;margin:0 auto;display:flex;flex-direction:column;gap:18px;color:var(--tu-on);font-family:var(--tu-font);font-variant-numeric:tabular-nums}
${H} .tu-setview[hidden]{display:none!important}
${H} #tuSync{max-width:1000px}
${H} .tu-setview :is(h1,h2,h3){margin:0!important;color:var(--tu-on)!important;font-family:var(--tu-font)!important;letter-spacing:-.01em!important;line-height:1.2!important;background:none!important;-webkit-text-fill-color:currentColor!important;text-shadow:none!important}
${H} .tu-setview button{font-family:var(--tu-font)!important;margin:0;box-shadow:none;cursor:pointer}
${H} .tu-setview button:disabled{cursor:not-allowed}
${H} .tu-setview .tu-btn{border:0;justify-content:center;white-space:nowrap;text-decoration:none}
${H} .tu-setview .tu-btn.outline{border:1px solid var(--tu-line);background:transparent;color:var(--tu-on)}
${H} .tu-setview .tu-btn.text{background:transparent}
${H} .tu-setview .tu-btn:hover:not(:disabled){filter:brightness(.96)}
${H} .tu-setview .tu-btn.outline:hover:not(:disabled),${H} .tu-setview .tu-btn.text:hover:not(:disabled){background:var(--tu-s2);filter:none}
${H} .tu-setview .tu-danger{color:var(--tu-bad)!important}
.tu-setview .tu-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.tu-sethead{display:flex;flex-direction:column;gap:4px}
${H} .tu-sethead h1{font-size:32px!important;font-weight:800!important;letter-spacing:-.02em!important}
.tu-sethead>span{font-size:14px}
.tu-setgrid{display:grid;grid-template-columns:220px minmax(0,1fr);gap:20px;align-items:start}
.tu-setnav{display:flex;flex-direction:column;gap:4px;position:sticky;top:16px}
${H} .tu-setnav button{display:flex;align-items:center;justify-content:space-between;gap:8px;height:48px;padding:0 18px;border:0;border-radius:999px;background:transparent;color:var(--tu-on);font-weight:700;font-size:14.5px;text-align:left;white-space:nowrap}
${H} .tu-setnav button:hover{background:var(--tu-s2)}
${H} .tu-setnav button[aria-current="page"]{background:var(--tu-pc);color:var(--tu-onpc)}
.tu-setnav small{font-size:11px;font-weight:800}
.tu-setbody{min-width:0;overflow:hidden;border-radius:28px;padding-bottom:6px}
.tu-sechead{padding:18px 22px 14px;display:flex;flex-direction:column;gap:5px}
${H} .tu-sechead h2{font-size:19px!important;font-weight:800!important}
${H} .tu-setview .tu-sechead p{margin:0!important;font-size:13px!important;line-height:1.5!important}
.tu-sechead p b{color:var(--tu-on);font-weight:700}
.tu-setrow{display:flex;flex-wrap:wrap;align-items:center;gap:10px 20px;padding:14px 22px;border-top:1px solid var(--tu-line2)}
.tu-setrow>div:first-child{flex:1 1 260px;display:flex;flex-direction:column;gap:3px;min-width:0}
.tu-setrow>div:first-child>b{font-size:15px;font-weight:700}
.tu-setrow>div:first-child>span{font-size:13px;line-height:1.45}
.tu-setctl{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.tu-setctl:empty{display:none}
.tu-setseg{display:flex;height:40px;border:1px solid var(--tu-line);border-radius:999px;overflow:hidden;flex:none}
${H} .tu-setseg button{display:flex;align-items:center;gap:6px;padding:0 16px;border:0;border-radius:0;background:transparent;color:var(--tu-on);font-weight:700;font-size:13.5px;height:100%}
${H} .tu-setseg button+button{border-left:1px solid var(--tu-line)}
${H} .tu-setseg button[aria-checked="true"]{background:var(--tu-pc);color:var(--tu-onpc)}
${H} .tu-setview :is(.tu-setselect select,.tu-setnum,.tu-setfield input){height:42px;border-radius:12px!important;border:1px solid var(--tu-line)!important;background-color:var(--tu-surface)!important;color:var(--tu-on)!important;padding:0 12px;font-size:15px;font-weight:600;margin:0;box-shadow:none!important}
${H} .tu-setview .tu-setnum{width:110px;font-weight:700}
.tu-setfield{display:flex;flex-direction:column;gap:6px;min-width:0}
.tu-setfield>span{font-size:12.5px;font-weight:700}
.tu-swatches{display:flex;gap:8px;flex-wrap:wrap}
${H} .tu-swatch{display:flex;align-items:center;gap:9px;height:44px;padding:0 16px 0 9px;border-radius:999px;border:2px solid var(--tu-line);background:var(--tu-surface);color:var(--tu-on);font-weight:800;font-size:14px}
${H} .tu-swatch[aria-checked="true"]{border-color:var(--tu-p)}
.tu-swatch svg{width:26px;height:26px}
.tu-lockchip{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border-radius:999px;background:var(--tu-s2);font-weight:800;font-size:12.5px;flex:none}
.tu-futbox{background:var(--tu-s1);border-top:1px solid var(--tu-line2)}
.tu-futbox .tu-setrow{padding:11px 22px 11px 38px}
/* library tabs table */
.tu-tabtable{container-type:inline-size;border-top:1px solid var(--tu-line2)}
.tu-tabrow{display:grid;grid-template-columns:36px 48px minmax(120px,1fr) repeat(4,minmax(64px,88px)) 44px;align-items:center;column-gap:6px;padding:5px 14px;border-top:1px solid var(--tu-line2);position:relative;background:var(--tu-surface)}
.tu-tabtable>.tu-tabrow:first-child{border-top:0}
.tu-tabhead{background:var(--tu-s1);font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;padding-top:9px;padding-bottom:9px}
.tu-tabhead span:nth-child(n+4):nth-child(-n+7){text-align:center}
.tu-tabcell{display:flex;justify-content:center;align-items:center;gap:6px}
.tu-tablbl{display:none;font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}
${H} .tu-check{width:24px;height:24px;min-width:24px;border-radius:7px;border:2px solid var(--tu-on3);background:transparent;color:var(--tu-onp);display:flex;align-items:center;justify-content:center;padding:0}
${H} .tu-check[aria-checked="true"]{background:var(--tu-p);border-color:var(--tu-p)}
${H} .tu-check:disabled{opacity:.3}
${H} .tu-drag{width:32px;height:40px;border:0;background:transparent;color:var(--tu-on3);cursor:grab;touch-action:none;display:flex;align-items:center;justify-content:center;border-radius:8px;padding:0}
${H} .tu-drag:hover{background:var(--tu-s2)}
${H} .tu-colorbtn{width:34px;height:34px;border-radius:10px;border:1px solid var(--tu-line);background:var(--tu-surface);padding:5px}
.tu-colorbtn i{display:block;width:100%;height:100%;border-radius:6px}
.tu-tabname{display:flex;flex-direction:column;gap:1px;min-width:0}
.tu-tabname b{font-size:14.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tu-tabname small{font-size:12px}
.tu-tabdel{display:flex;justify-content:flex-end}
.tu-colorpop{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:6px;padding:8px 0 8px 90px}
${H} .tu-colorpop button{display:flex;align-items:center;gap:6px;height:32px;padding:0 10px;border-radius:9px;border:1px solid var(--tu-line);background:transparent;color:var(--tu-on);font-weight:700;font-size:12.5px}
${H} .tu-colorpop button[aria-checked="true"]{border-color:var(--tu-p);background:var(--tu-pc);color:var(--tu-onpc)}
.tu-colorpop i{width:14px;height:14px;border-radius:4px}
.tu-tabrow.tu-dragging{z-index:2;box-shadow:var(--tu-shadow);opacity:.95}
.tu-tabrow.tu-dropbefore{box-shadow:inset 0 3px 0 var(--tu-p)}.tu-tabrow.tu-dropafter{box-shadow:inset 0 -3px 0 var(--tu-p)}
.tu-tabfoot{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;padding:14px 22px;border-top:1px solid var(--tu-line2);font-size:13px}
.tu-tabfoot b{color:var(--tu-on)}
@container (max-width:600px){
  .tu-tabhead{display:none}
  .tu-tabrow{grid-template-columns:32px 44px repeat(4,minmax(0,1fr)) 40px;row-gap:8px;padding:10px 12px}
  .tu-tabname{grid-column:3/7}
  .tu-tabcell{grid-row:2;flex-direction:column;gap:4px}
  .tu-tabrow>.tu-tabcell:nth-child(4){grid-column:3}.tu-tabrow>.tu-tabcell:nth-child(5){grid-column:4}.tu-tabrow>.tu-tabcell:nth-child(6){grid-column:5}.tu-tabrow>.tu-tabcell:nth-child(7){grid-column:6}
  .tu-tabdel{grid-column:7;grid-row:1}
  .tu-tablbl{display:block}
  .tu-colorpop{padding-left:0}
}
/* QID migration checklist */
.tu-qidsteps{list-style:none;margin:0;padding:0 22px;display:flex;flex-direction:column;gap:8px}
.tu-qidstep{display:flex;align-items:center;gap:14px;padding:10px 12px 10px 14px;border-radius:16px;background:var(--tu-s1);min-height:54px}
.tu-qidstep.later{opacity:.66}
.tu-qidnum{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;background:var(--tu-s3);flex:none}
.tu-qidtext{flex:1;display:flex;flex-direction:column;gap:2px;min-width:0}
.tu-qidtext b{font-size:14.5px;font-weight:700}
.tu-qidtext small{font-size:12.5px;line-height:1.4}
.tu-qidtext em{font-style:normal;font-weight:700}
.tu-qidtext em.ok{color:var(--tu-ok)}.tu-qidtext em.warn{color:var(--tu-warn)}
.tu-qidact{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.tu-qidneed{margin:10px 22px 0;padding:10px 14px;border-radius:14px;background:var(--tu-warnc);color:var(--tu-warn);font-size:12.5px;display:flex;flex-wrap:wrap;gap:4px 14px}
${H} .tu-setview .tu-qidmsg{margin:12px 22px 0!important;font-size:13px!important;line-height:1.45}
.tu-settools{display:flex;flex-wrap:wrap;gap:8px;padding:14px 22px 10px;border-top:1px solid var(--tu-line2);margin-top:14px}
/* admin */
.tu-adminhead{flex-direction:row!important;justify-content:space-between;align-items:flex-start;gap:12px}
.tu-adminhead>div{display:flex;flex-direction:column;gap:5px}
.tu-adminform{display:flex;flex-wrap:wrap;align-items:flex-end;gap:10px;padding:12px 22px;border-top:1px solid var(--tu-line2)}
.tu-adminform .tu-setfield{flex:1 1 220px}
.tu-adminfilters .tu-setfield{flex:1 1 150px}
.tu-adminform+.tu-note{padding:0 22px 6px;margin:0}
.tu-admintable{margin:4px 22px 0;border:1px solid var(--tu-line2);border-radius:16px;overflow:hidden}
.tu-adminrow{display:grid;grid-template-columns:1.2fr 1.2fr .8fr;gap:10px;padding:10px 14px;border-top:1px solid var(--tu-line2);font-size:13px}
.tu-adminrow:first-child{border-top:0}
.tu-adminth{background:var(--tu-s1);font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase}
.tu-adminrow>span{display:flex;flex-direction:column;gap:2px;min-width:0;overflow-wrap:anywhere}
.tu-adminrow small{font-size:12px}
/* Backup & sync */
.tu-synccard{padding:18px 20px;display:flex;flex-direction:column;gap:14px;border-radius:24px;min-width:0}
.tu-synchead{display:flex;align-items:center;gap:14px}
.tu-settile{width:44px;height:44px;border-radius:14px;flex:none;display:flex;align-items:center;justify-content:center}
.tu-syncttl{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.tu-syncttl>div{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
${H} .tu-syncttl h2{font-size:17px!important;font-weight:800!important}
.tu-syncttl>span{font-size:13px;line-height:1.4}
.tu-statchip{font-style:normal;height:22px;padding:0 9px;border-radius:999px;font-size:11.5px;font-weight:800;display:inline-flex;align-items:center}
.tu-statchip.ok{background:var(--tu-okc);color:var(--tu-ok)}.tu-statchip.warn{background:var(--tu-warnc);color:var(--tu-warn)}
.tu-meter{display:block;height:6px;border-radius:999px;background:var(--tu-s3);overflow:hidden;max-width:360px;margin-top:5px}
.tu-meter i{display:block;height:100%;background:var(--tu-p);border-radius:inherit;transition:width .2s}
.tu-xfer .tu-meter{max-width:none;margin:0}
.tu-synchead>.tu-actions{flex:none}
.tu-syncgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;align-items:stretch}
.tu-cardacts{margin-top:auto}
.tu-cardacts:empty{display:none}
.tu-decide{display:flex;flex-wrap:wrap;gap:10px 14px;align-items:center;padding:12px 14px;border-radius:16px;background:var(--tu-warnc);color:var(--tu-warn)}
.tu-decide>div:first-child{flex:1 1 220px;display:flex;flex-direction:column;gap:2px;min-width:0;font-size:12.5px}
.tu-decide b{font-size:13.5px}
${H} .tu-setview .tu-btn.tu-warnbtn{background:var(--tu-warn);color:var(--tu-warnc)}
${H} .tu-setview .tu-decide .tu-btn.outline{border-color:currentColor;color:var(--tu-warn)}
.tu-xfer{background:var(--tu-s1);border-radius:16px;padding:12px 14px;display:flex;flex-direction:column;gap:8px}
.tu-xferhead,.tu-xferfoot{display:flex;justify-content:space-between;gap:10px;align-items:center;font-size:12.5px;min-width:0}
.tu-xferhead b{color:var(--tu-on);font-size:13.5px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tu-xferhead span{flex:none;font-weight:700}
.tu-synccoll{border-radius:24px;overflow:hidden}
${H} .tu-collhead{width:100%;display:flex;align-items:center;gap:12px;padding:16px 20px;border:0;border-radius:0;background:transparent;color:var(--tu-on);text-align:left}
${H} .tu-collhead:hover{background:var(--tu-s1)}
.tu-collhead>span{flex:1;display:flex;flex-direction:column;gap:2px;min-width:0}
.tu-collhead b{font-size:15.5px;font-weight:800}
.tu-collhead small{font-size:13px}
.tu-collhead .tu-ico{transition:transform .15s}
.tu-collhead[aria-expanded="true"] .tu-ico{transform:rotate(180deg)}
.tu-collbody{padding:0 20px 18px;display:flex;flex-direction:column;gap:8px}
.tu-histrow{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;padding:10px 14px;border-radius:14px;background:var(--tu-s1)}
.tu-histrow>span:first-child{flex:1 1 240px;display:flex;flex-direction:column;gap:2px;min-width:0}
.tu-histrow b{font-size:14px;font-weight:700;overflow-wrap:anywhere}
.tu-histrow small{font-size:12.5px}
.tu-metrics{display:flex;flex-wrap:wrap;gap:8px}
.tu-metrics>span{display:flex;flex-direction:column;gap:1px;padding:8px 12px;border-radius:12px;background:var(--tu-s1);min-width:90px}
.tu-metrics small{font-size:11.5px;font-weight:700}
.tu-metrics b{font-size:16px;font-weight:800}
${H} .tu-setview .tu-diag{margin:0!important;font-size:12.5px!important;white-space:pre-wrap;background:var(--tu-s1);padding:10px 12px;border-radius:12px;max-height:240px;overflow:auto}
.tu-dangerzone{display:flex;flex-direction:column;gap:8px;padding:12px 14px;border:1px solid var(--tu-line);border-radius:16px}
.tu-dangerzone>b{font-size:13px;color:var(--tu-bad)}
#tuSync .tu-sechead{padding:0}
.tu-moves{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.tu-movetile{display:flex;flex-wrap:wrap;align-items:center;gap:10px 12px;padding:12px 14px;border-radius:16px;background:var(--tu-s1)}
.tu-movenum{width:28px;height:28px;border-radius:50%;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;flex:none}
.tu-movetile>span:nth-child(2){flex:1 1 140px;display:flex;flex-direction:column;gap:2px;min-width:0}
.tu-movetile b{font-size:14.5px;font-weight:700}
.tu-movetile small{font-size:12.5px}
.tu-setview .tu-note a,.tu-setview .tu-sechead a{color:var(--tu-p)}
/* legacy dark rules force every span and label in #menu to fixed colors; take them back inside these views */
${H} .tu-setview :is(span,label){color:inherit!important}
${H} .tu-setview :is(.tu-sethead>span,.tu-setrow>div:first-child>span,.tu-setnav small,.tu-tabname small,.tu-tabhead,.tu-tablbl,.tu-qidtext small,.tu-syncttl>span,.tu-collhead small,.tu-histrow small,.tu-movetile small,.tu-xferhead,.tu-xferfoot,.tu-metrics small,.tu-tabfoot,.tu-adminth,.tu-adminrow small,.tu-setfield>span,.tu-sechead p,.tu-note,.tu-qidmsg){color:var(--tu-on3)!important}
${H} .tu-setview .tu-setnav button[aria-current="page"] small{color:var(--tu-onpc)!important}
${H} .tu-setview .tu-lockchip{color:var(--tu-on2)!important}
${H} .tu-setview .tu-lockchip.open{background:var(--tu-okc);color:var(--tu-ok)!important}
${H} .tu-setview .tu-settile{background:var(--tu-pc);color:var(--tu-onpc)!important}
${H} .tu-setview .tu-settile.ok{background:var(--tu-okc);color:var(--tu-ok)!important}
${H} .tu-setview .tu-settile.warn{background:var(--tu-warnc);color:var(--tu-warn)!important}
${H} .tu-setview .tu-settile.bad{background:var(--tu-badc);color:var(--tu-bad)!important}
${H} .tu-setview .tu-synctone[data-tone="good"]{color:var(--tu-ok)!important}
${H} .tu-setview .tu-synctone:is([data-tone="pending"],[data-tone="conflict"]){color:var(--tu-warn)!important}
${H} .tu-setview .tu-synctone[data-tone="error"]{color:var(--tu-bad)!important}
${H} .tu-setview .tu-movenum{background:var(--tu-pc);color:var(--tu-onpc)!important}
${H} .tu-setview .tu-qidnum{color:var(--tu-on2)!important}
${H} .tu-setview .tu-qidstep.done .tu-qidnum{background:var(--tu-okc);color:var(--tu-ok)!important}
${H} .tu-setview .tu-qidstep.now .tu-qidnum{background:var(--tu-pc);color:var(--tu-onpc)!important}
${H} .tu-setview .tu-decide span{color:var(--tu-warn)!important}
@media (max-width:1000px){.tu-setgrid{grid-template-columns:190px minmax(0,1fr)}}
@media (max-width:900px){
  ${H} .modern-main:has(:is(#settingsPanel.tu-has-settings,#progressSyncPanel.tu-has-sync).active){padding:24px 24px 120px!important;overflow:visible!important}
  ${H} .tu-sethead h1{font-size:30px!important}
  .tu-setgrid{grid-template-columns:minmax(0,1fr);gap:14px}
  .tu-setnav{flex-direction:row;position:static;overflow-x:auto;gap:6px;padding-bottom:2px;scrollbar-width:none}
  ${H} .tu-setnav button{height:40px;padding:0 14px;flex:none;border:1px solid var(--tu-line)}
  ${H} .tu-setnav button[aria-current="page"]{border-color:transparent}
}
@media (max-width:720px){.tu-syncgrid,.tu-moves{grid-template-columns:minmax(0,1fr)}}

/* Score Report (shown inside the exam screen) */
:root[data-tu] body #examScreen #workspace .tu-report{font-family:var(--tu-font);color:var(--tu-on);background:var(--tu-bg);max-width:none;margin:0;padding:24px 28px 40px;border:0;box-shadow:none;border-radius:0;min-height:100%;box-sizing:border-box;font-variant-numeric:tabular-nums}
.tu-report *{box-sizing:border-box}
.tu-report .tu-rep-wrap{max-width:1180px;margin:0 auto;display:flex;flex-direction:column;gap:18px}
.tu-report .tu-card{background:var(--tu-surface);border:1px solid var(--tu-line2);border-radius:24px;box-shadow:var(--tu-shadow);color:var(--tu-on)}
.tu-report .tu-rep-hero{padding:24px 28px;display:flex;flex-wrap:wrap;gap:24px;align-items:center;border-radius:28px}
.tu-report .tu-rep-copy{flex:1 1 420px;display:flex;flex-direction:column;gap:8px;min-width:0}
.tu-report .tu-kicker{font-size:12.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--tu-on3)}
.tu-report h1.tu-rep-title{margin:0;font-size:30px;font-weight:800;letter-spacing:-.02em;color:var(--tu-on);line-height:1.15}
.tu-report .tu-rep-meta{font-size:14.5px;color:var(--tu-on2)}
.tu-report .tu-rep-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px}
.tu-report .tu-rep-actions.secondary-row{margin-top:0}
:root[data-tu] body #examScreen .tu-report .tu-rep-actions :is(#reportSaveMenu,#reportExport,#reportExportIncorrect){height:40px!important;padding:0 16px!important;border-radius:999px!important;border:1px solid var(--tu-line)!important;background:transparent!important;color:var(--tu-on)!important;font:700 13.5px var(--tu-font)!important;box-shadow:none!important;margin:0!important;display:inline-flex!important;align-items:center!important;gap:8px!important;cursor:pointer!important;min-width:0!important;width:auto!important}
:root[data-tu] body #examScreen .tu-report .tu-rep-actions :is(#reportSaveMenu,#reportExport,#reportExportIncorrect):hover{background:var(--tu-s2)!important}
.tu-report .tu-btn{font-family:var(--tu-font);height:44px}
.tu-report .tu-rep-score{display:flex;align-items:center;gap:22px;flex-wrap:wrap}
.tu-report .tu-ring{width:148px;height:148px;border-radius:50%;background:conic-gradient(var(--tu-p) calc(var(--v)*1%),var(--tu-s2) 0);display:flex;align-items:center;justify-content:center;flex:none}
.tu-report .tu-ring>div{width:118px;height:118px;border-radius:50%;background:var(--tu-surface);display:flex;flex-direction:column;align-items:center;justify-content:center}
.tu-report .tu-ring b{font-size:34px;font-weight:800;color:var(--tu-on)}.tu-report .tu-ring span{font-size:13px;color:var(--tu-on3);font-weight:700}
.tu-report .tu-legend{display:flex;flex-direction:column;gap:6px;font-size:14px;color:var(--tu-on2)}
.tu-report .tu-legend span{display:flex;align-items:center;gap:8px}.tu-report .tu-legend b{color:var(--tu-on)}
.tu-report .tu-legend i{width:10px;height:10px;border-radius:3px;display:inline-block}
.tu-report .tu-rep-row{display:flex;flex-wrap:wrap;gap:18px;align-items:stretch}
.tu-report .tu-rep-row>.tu-card{padding:20px 22px;display:flex;flex-direction:column;gap:12px;min-width:0}
.tu-report h2.tu-h{margin:0;font-size:17px;font-weight:800;color:var(--tu-on);font-family:var(--tu-font)}
:root[data-tu] body #examScreen .tu-report .answer-change-audit{flex:1 1 460px;margin:0!important;padding:20px 22px!important;background:var(--tu-surface)!important;border:1px solid var(--tu-line2)!important;border-radius:24px!important;box-shadow:var(--tu-shadow)!important;color:var(--tu-on)!important}
:root[data-tu] body #examScreen .tu-report .answer-change-audit h3{display:none!important}
:root[data-tu] body #examScreen .tu-report .answer-change-audit .tu-audit-head{display:flex;align-items:baseline;gap:10px;margin-bottom:14px}
:root[data-tu] body #examScreen .tu-report .answer-change-audit .tu-audit-head h2{flex:1}
:root[data-tu] body #examScreen .tu-report .answer-change-audit .tu-net{font-size:13.5px;font-weight:800}
:root[data-tu] body #examScreen .tu-report .answer-change-grid{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(92px,1fr))!important;gap:10px!important;margin:0!important}
:root[data-tu] body #examScreen .tu-report .answer-change-box{display:flex!important;flex-direction:column!important;align-items:flex-start!important;gap:2px!important;padding:12px!important;border-radius:16px!important;border:0!important;background:var(--tu-s1)!important;color:var(--tu-on2)!important;box-shadow:none!important;min-height:0!important}
:root[data-tu] body #examScreen .tu-report .answer-change-box b{font-size:24px!important;font-weight:800!important;color:var(--tu-on)!important;line-height:1.1!important}
:root[data-tu] body #examScreen .tu-report .answer-change-box span{font-size:12.5px!important;font-weight:700!important;letter-spacing:0!important;text-transform:none!important;color:inherit!important}
:root[data-tu] body #examScreen .tu-report .answer-change-box.bad{background:var(--tu-badc)!important;color:var(--tu-bad)!important}
:root[data-tu] body #examScreen .tu-report .answer-change-box.bad b{color:var(--tu-bad)!important}
:root[data-tu] body #examScreen .tu-report .answer-change-box.good:nth-child(2){background:var(--tu-okc)!important;color:var(--tu-ok)!important}
:root[data-tu] body #examScreen .tu-report .answer-change-box.good:nth-child(2) b{color:var(--tu-ok)!important}
:root[data-tu] body #examScreen .tu-report .answer-change-audit>:not(h3):not(.answer-change-grid):not(.tu-audit-head){font-size:12.5px!important;color:var(--tu-on3)!important;margin:12px 0 0!important;background:transparent!important;border:0!important;padding:0!important}
.tu-report .tu-subjects{flex:1 1 380px}
.tu-report .tu-subj{display:flex;align-items:center;gap:12px}
.tu-report .tu-subj>span:first-child{width:170px;font-size:13.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--tu-on)}
.tu-report .tu-subj .tu-bar{flex:1;height:8px;border-radius:99px;background:var(--tu-s2);overflow:hidden}.tu-report .tu-subj .tu-bar i{display:block;height:100%;border-radius:99px}
.tu-report .tu-subj>span:last-child{width:96px;text-align:right;font-size:13px;color:var(--tu-on2)}.tu-report .tu-subj>span:last-child b{color:var(--tu-on)}
.tu-report .tu-qs{border-radius:28px;overflow:hidden}
.tu-report .tu-qs-head{padding:18px 22px;display:flex;flex-direction:column;gap:14px;border-bottom:1px solid var(--tu-line2)}
:root[data-tu] body #examScreen .tu-report .report-tabs{display:flex!important;flex-wrap:wrap!important;gap:8px!important;margin:0!important;padding:0!important;background:transparent!important;border:0!important}
:root[data-tu] body #examScreen .tu-report .report-tab{height:40px!important;padding:0 16px!important;border-radius:999px!important;border:1px solid var(--tu-line)!important;background:transparent!important;color:var(--tu-on)!important;font:800 13.5px var(--tu-font)!important;box-shadow:none!important;margin:0!important;cursor:pointer}
:root[data-tu] body #examScreen .tu-report .report-tab.active{border-color:var(--tu-p)!important;background:var(--tu-pc)!important;color:var(--tu-onpc)!important}
.tu-report .tu-qs-tools{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.tu-report .tu-chips{display:flex;flex-wrap:wrap;gap:6px}
.tu-report .tu-chip{height:34px;padding:0 12px;border-radius:10px;border:1px solid var(--tu-line);background:transparent;color:var(--tu-on);font:700 13px var(--tu-font);cursor:pointer}
.tu-report .tu-chip span{opacity:.7;font-weight:600;margin-left:3px}
.tu-report .tu-chip[aria-pressed="true"]{border-color:var(--tu-p);background:var(--tu-pc);color:var(--tu-onpc)}
:root[data-tu] body #examScreen .tu-report .report-sort-controls{display:flex!important;align-items:center!important;gap:8px!important;margin:0 0 0 auto!important;padding:0!important;background:transparent!important;border:0!important;box-shadow:none!important;flex-wrap:wrap!important}
:root[data-tu] body #examScreen .tu-report .report-sort-controls label{font:700 13px var(--tu-font)!important;letter-spacing:0!important;text-transform:none!important;color:var(--tu-on2)!important}
:root[data-tu] body #examScreen .tu-report .report-sort-controls select{height:36px!important;min-width:0!important;border-radius:10px!important;border:1px solid var(--tu-line)!important;background:var(--tu-surface)!important;color:var(--tu-on)!important;padding:0 26px 0 10px!important;font:700 13px var(--tu-font)!important;box-shadow:none!important}
:root[data-tu] body #examScreen .tu-report .report-block{overflow-x:auto!important;margin:0!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important}
:root[data-tu] body #examScreen .tu-report .report-q-table{width:100%!important;min-width:860px!important;border-collapse:collapse!important;border-spacing:0!important;margin:0!important;background:transparent!important;font-family:var(--tu-font)!important}
:root[data-tu] body #examScreen .tu-report .report-q-table th{background:var(--tu-s1)!important;color:var(--tu-on3)!important;font:800 12px var(--tu-font)!important;letter-spacing:.05em!important;text-transform:uppercase!important;padding:10px 12px!important;text-align:left!important;border:0!important}
:root[data-tu] body #examScreen .tu-report .report-q-table th:first-child,:root[data-tu] body #examScreen .tu-report .report-q-table td:first-child{padding-left:22px!important}
:root[data-tu] body #examScreen .tu-report .report-q-table td{padding:10px 12px!important;border:0!important;border-top:1px solid var(--tu-line2)!important;background:transparent!important;color:var(--tu-on)!important;font-size:14px!important;vertical-align:middle!important;box-shadow:none!important}
:root[data-tu] body #examScreen .tu-report .report-q-table tr{background:transparent!important;box-shadow:none!important;border:0!important}
:root[data-tu] body #examScreen .tu-report .report-q-table tr.tu-hide{display:none!important}
:root[data-tu] body #examScreen .tu-report .report-q-table td:nth-child(2){max-width:360px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
:root[data-tu] body #examScreen .tu-report .report-q-table td:nth-child(3){color:var(--tu-on2)!important;font-size:13.5px!important}
:root[data-tu] body #examScreen .tu-report .status-dot{display:inline-block!important;font:800 12px var(--tu-font)!important;padding:4px 10px!important;border-radius:999px!important;background:var(--tu-s2)!important;color:var(--tu-on2)!important;border:0!important;box-shadow:none!important}
:root[data-tu] body #examScreen .tu-report .status-dot::before{display:none!important}
:root[data-tu] body #examScreen .tu-report .status-dot.ok{background:var(--tu-okc)!important;color:var(--tu-ok)!important}
:root[data-tu] body #examScreen .tu-report .status-dot.bad{background:var(--tu-badc)!important;color:var(--tu-bad)!important}
:root[data-tu] body #examScreen .tu-report .review-one{height:34px!important;padding:0 14px!important;border-radius:999px!important;border:0!important;background:var(--tu-s2)!important;color:var(--tu-on)!important;font:700 13px var(--tu-font)!important;box-shadow:none!important;cursor:pointer!important}
:root[data-tu] body #examScreen .tu-report .review-one:hover{background:var(--tu-pc)!important;color:var(--tu-onpc)!important}
.tu-report .tu-flag{color:var(--tu-warn);display:inline-block;vertical-align:-2px;margin-left:4px}
.tu-report .tu-chg{font-size:13px;font-weight:700;color:var(--tu-on3)}.tu-report .tu-chg.good{color:var(--tu-ok)}.tu-report .tu-chg.bad{color:var(--tu-bad)}
.tu-report .tu-time{display:flex;align-items:center;gap:8px;font-weight:700;font-size:13px}
.tu-report .tu-time i{width:52px;height:5px;border-radius:99px;background:var(--tu-s2);overflow:hidden;display:inline-block}.tu-report .tu-time i em{display:block;height:100%;background:var(--tu-p)}.tu-report .tu-time i em.slow{background:var(--tu-warn)}
.tu-report .tu-qs-foot{padding:14px 22px;border-top:1px solid var(--tu-line2);font-size:13px;color:var(--tu-on3)}
:root[data-tu] body #examScreen .tu-report .report-actions{display:none!important}
@media (max-width:700px){.tu-report .tu-rep-hero{padding:18px}.tu-report .tu-ring{width:120px;height:120px}.tu-report .tu-ring>div{width:94px;height:94px}.tu-report .tu-ring b{font-size:28px}}
.tu-report .tu-revin{display:flex;align-items:center;height:44px;padding:0 4px 0 14px;border-radius:999px;border:1px solid var(--tu-line);gap:6px}
.tu-report .tu-revin>span{font-size:13px;font-weight:700;color:var(--tu-on2)}
:root[data-tu] body #examScreen .tu-report .tu-revin button{height:36px!important;padding:0 14px!important;border-radius:999px!important;border:0!important;background:transparent!important;color:var(--tu-on)!important;font:800 13px var(--tu-font)!important;box-shadow:none!important;margin:0!important;cursor:pointer!important;min-width:0!important;width:auto!important}
:root[data-tu] body #examScreen .tu-report .tu-revin button[aria-checked="true"]{background:var(--tu-p)!important;color:var(--tu-onp)!important}
#tuxToast{position:fixed;left:50%;bottom:86px;transform:translateX(-50%);z-index:300;max-width:calc(100vw - 32px);background:#161A25;color:#fff;padding:10px 18px;border-radius:999px;font:600 14px/1.3 "Figtree",-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.28);pointer-events:none}
`;
  /* Modern exam style (A23 Phase E, boards ModernExam + Explanation). Every rule is scoped to :root[data-tu-exam="modern"],
     which is only set while Modern is chosen, so the NBME exam (the default) draws exactly as before. :not(#tux0) lifts
     the specificity over the legacy exam rules (many use !important and #examScreen). */
  const X = ':root[data-tu][data-tu-exam="modern"]:not(#tux0) body #examScreen', W = X + ' #workspace', XB = ':root[data-tu][data-tu-exam="modern"]:not(#tux0) body';
  const EXAM_STYLES = `
:root[data-tu][data-tu-exam="modern"] body{--tu-bg:#F6F7FB;--tu-surface:#FFFFFF;--tu-s1:#EFF1F7;--tu-s2:#E7EAF3;--tu-s3:#DCE0EC;--tu-line:#D3D8E5;--tu-line2:#E4E7F0;--tu-on:#161A25;--tu-on2:#474E62;--tu-on3:#5F6679;--tu-ok:#17683D;--tu-okc:#D3EFDD;--tu-warn:#7D4B00;--tu-warnc:#FFE3B8;--tu-bad:#A8231B;--tu-badc:#FBDAD6;--tu-info:#1F4FA8;--tu-infoc:#E2EAFE;--tu-shadow:0 1px 2px rgba(20,26,40,.06),0 3px 10px rgba(20,26,40,.06);--tu-p:var(--tu-lp);--tu-onp:var(--tu-lonp);--tu-pc:var(--tu-lpc);--tu-onpc:var(--tu-lonpc);--tu-font:"Figtree",-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",system-ui,sans-serif;--tux-panel:clamp(380px,36vw,520px)}
:root[data-tu][data-tu-exam="modern"] body.exam-dark-active,${X}.exam-dark{--tu-bg:#0E1118;--tu-surface:#161A23;--tu-s1:#131720;--tu-s2:#222835;--tu-s3:#2B3242;--tu-line:#3A4256;--tu-line2:#272E3D;--tu-on:#E4E7F0;--tu-on2:#B4BACB;--tu-on3:#9AA1B4;--tu-ok:#86DCA8;--tu-okc:#173A27;--tu-warn:#FFC772;--tu-warnc:#3D2C0F;--tu-bad:#FFB4AB;--tu-badc:#4A1612;--tu-info:#B3C5FF;--tu-infoc:#1E2F5C;--tu-shadow:0 1px 2px rgba(0,0,0,.4),0 4px 14px rgba(0,0,0,.28);--tu-p:var(--tu-dp);--tu-onp:var(--tu-donp);--tu-pc:var(--tu-dpc);--tu-onpc:var(--tu-donpc)}
${X}{background:var(--tu-bg)!important;color:var(--tu-on)!important;font-family:var(--tu-font)!important;-webkit-font-smoothing:antialiased}
${X}>.topbar,${X}>.left-status,${X}>.bottombar{visibility:hidden!important;pointer-events:none!important}
${X} .tux,${X} .tux *{box-sizing:border-box}
${X} .tux button,${X} #workspace .tux-strike,${X} #workspace .tux-layout button{font:inherit;color:inherit;background:none;border:0;margin:0;padding:0;box-shadow:none;min-width:0;width:auto;height:auto;cursor:pointer;text-transform:none;letter-spacing:normal;filter:none;border-radius:0;line-height:normal}
${X} .tux button:disabled{cursor:default}
${X} .tux :focus-visible,${W} .tux-strike:focus-visible,${W} .tux-layout button:focus-visible{outline:3px solid var(--tu-p);outline-offset:2px}
${X} .tux-ico{display:block;flex:none}
/* header (board: 62px) */
/* the iPad app draws under the iPhone status bar (viewport-fit=cover): every bar anchored to the top moves down by the safe area */
${XB}{--tux-st:env(safe-area-inset-top,0px)}
${X} .tux-head{position:fixed;left:0;right:0;top:0;height:calc(62px + var(--tux-st));padding-top:var(--tux-st)!important;box-sizing:border-box;z-index:40;display:flex;align-items:center;gap:12px;padding:0 16px;background:var(--tu-surface);color:var(--tu-on);border-bottom:1px solid var(--tu-line2);font-family:var(--tu-font)}
${X} .tux-head .tux-item{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;height:44px;padding:0 12px;border-radius:12px;background:var(--tu-s1);line-height:1.15;max-width:300px;min-width:0;text-align:left}
${X} .tux-item b{font-size:15px;font-weight:700;white-space:nowrap}
${X} .tux-item span{font-size:12px;color:var(--tu-on3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
${X} .tux-item .tux-caret{display:none}
${X} .tux-item .tux-itemtxt{display:flex;flex-direction:column;align-items:flex-start;min-width:0;max-width:100%}
${X} .tux-tag{flex:none;font-size:12px;font-weight:800;padding:5px 10px;border-radius:999px;background:var(--tu-infoc);color:var(--tu-info);white-space:nowrap}
${X} .tux-head .tux-mark{flex:none;display:flex;align-items:center;gap:6px;height:40px;padding:0 14px;border-radius:999px;border:1px solid var(--tu-line);color:var(--tu-on2);font-weight:700;font-size:13.5px}
${X} .tux-head .tux-mark[aria-pressed="true"]{border-color:var(--tu-warn);background:var(--tu-warnc);color:var(--tu-warn)}
${X} .tux-mark[aria-pressed="true"] svg{fill:currentColor}
${X} .tux-head .tux-mark:disabled{opacity:.55}
${X} .tux-center{flex:1;display:flex;justify-content:center;align-items:center;gap:8px;min-width:0}
${X} .tux .tux-round{width:42px;height:42px;flex:none;border-radius:50%;border:1px solid var(--tu-line);background:var(--tu-surface);display:flex;align-items:center;justify-content:center;color:var(--tu-on)}
${X} .tux .tux-round.primary{border:0;background:var(--tu-p);color:var(--tu-onp)}
${X} .tux .tux-round:disabled{opacity:.4}
${X} .tux-count{min-width:64px;text-align:center;font-weight:800;font-size:15px;font-variant-numeric:tabular-nums}
${X} .tux-head .tux-timer{flex:none;display:flex;align-items:center;gap:8px;height:40px;padding:0 14px;border-radius:999px;background:var(--tu-s1);font-variant-numeric:tabular-nums;white-space:nowrap}
${X} .tux-timer b{font-size:15px}${X} .tux-timer span{font-size:12px;color:var(--tu-on3)}
${X} .tux-tools{display:flex;gap:2px;flex:none}
${X} .tux-head .tux-tool{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;width:60px;height:50px;border-radius:12px;color:var(--tu-on2);font-size:11px;font-weight:700}
${X} .tux-head .tux-tool:hover,${X} .tux-head .tux-tool[aria-expanded="true"]{background:var(--tu-s1);color:var(--tu-on)}
${X} .tux-head .tux-more{display:none}
${X} .tux-spacer{flex:1}
/* question navigator (board: 212px, 5 columns) */
${X} .tux-nav{position:fixed;left:0;top:calc(62px + var(--tux-st));bottom:58px;width:212px;z-index:38;background:var(--tu-surface);color:var(--tu-on);border-right:1px solid var(--tu-line2);padding:14px;display:flex;flex-direction:column;gap:10px;overflow:auto;font-family:var(--tu-font)}
${X} .tux-navhead{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
${X} .tux-navhead b{font-size:14px}${X} .tux-navhead span{font-size:12px;color:var(--tu-on3)}
${X} .tux-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}
${X} .tux-nav .tux-q{position:relative;height:32px;border-radius:9px;border:1.5px solid var(--tu-line);font-weight:700;font-size:12.5px;display:flex;align-items:center;justify-content:center;color:var(--tu-on);font-variant-numeric:tabular-nums}
${X} .tux-nav .tux-q.done{border-color:transparent;background:var(--tu-s2)}
${X} .tux-nav .tux-q.bad{border-color:transparent;background:var(--tu-badc);color:var(--tu-bad)}
${X} .tux-nav .tux-q[aria-current="true"]{border:2px solid var(--tu-p)}
${X} .tux-nav .tux-q.dim{opacity:.35}
${X} .tux-q i{position:absolute;top:-3px;right:-3px;width:9px;height:9px;border-radius:50%;background:var(--tu-warn);border:2px solid var(--tu-surface)}
${X} .tux-only{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:4px 6px;padding:8px 10px;border-radius:12px;background:var(--tu-infoc);color:var(--tu-info);font-size:12.5px;font-weight:700}
${X} .tux-nav .tux-only button{white-space:nowrap;font-weight:800;text-decoration:underline;color:var(--tu-info)}
${X} .tux-legend{margin-top:auto;display:flex;flex-direction:column;gap:6px;font-size:12px;color:var(--tu-on3)}
${X} .tux-legend span{display:flex;align-items:center;gap:8px}
${X} .tux-legend i{width:14px;height:14px;border-radius:4px;flex:none}
${X} .tux-legend i.done{background:var(--tu-s2)}${X} .tux-legend i.open{border:1.5px solid var(--tu-line)}${X} .tux-legend i.bad{background:var(--tu-badc)}${X} .tux-legend i.cur{border:2px solid var(--tu-p)}
${X} .tux-legend i.flag{width:9px;height:9px;border-radius:50%;background:var(--tu-warn);margin:0 2.5px}
${X} .tux-scrim{display:none}
/* footer (board: 58px) */
${X} .tux-foot{position:fixed;left:0;right:0;bottom:0;height:58px;z-index:40;display:flex;align-items:center;gap:8px;padding:0 16px;background:var(--tu-surface);color:var(--tu-on);border-top:1px solid var(--tu-line2);font-family:var(--tu-font)}
${X} .tux-foot .tux-fbtn{flex:none;display:flex;align-items:center;gap:8px;height:40px;padding:0 16px;border-radius:999px;border:1px solid var(--tu-line);font-weight:700;font-size:13.5px;white-space:nowrap}
${X} .tux-foot .tux-fbtn.ghost{border-color:transparent;color:var(--tu-on2)}
${X} .tux-foot .tux-fbtn.tonal{border-color:transparent;background:var(--tu-pc);color:var(--tu-onpc);font-weight:800}
${X} .tux-foot .tux-fbtn.danger{border-color:transparent;background:var(--tu-badc);color:var(--tu-bad);font-weight:800;padding:0 18px}
${X} .tux-foot .tux-fbtn:hover{filter:brightness(.97)}
${X} .tux-note{flex:1;min-width:0;text-align:center;font-size:13px;color:var(--tu-on3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${X} .tux-pnav{display:none}
/* phone "more" menu */
${X} .tux-morepop{position:fixed;right:8px;top:calc(60px + var(--tux-st));z-index:70;min-width:220px;max-width:calc(100vw - 16px);background:var(--tu-surface);color:var(--tu-on);border:1px solid var(--tu-line2);border-radius:16px;box-shadow:0 12px 32px rgba(0,0,0,.22);padding:6px;font-family:var(--tu-font)}
${X} .tux-morepop[hidden]{display:none}
${X} .tux-morepop button{display:flex;align-items:center;gap:12px;width:100%;height:46px;padding:0 12px;border-radius:12px;font-weight:700;font-size:15px;color:var(--tu-on)}
${X} .tux-morepop button:hover{background:var(--tu-s1)}
${X} .tux-morepop button.danger{color:var(--tu-bad)}
${X} .tux-morepop hr{border:0;border-top:1px solid var(--tu-line2);margin:4px 6px}
/* workspace and the legacy question, restyled in place (IDs, data-* hooks and text stay) */
${X}:not(.break-screen-active) #workspace{position:absolute!important;left:212px!important;right:0!important;top:calc(62px + var(--tux-st))!important;bottom:58px!important;padding:22px 28px 40px!important;background:var(--tu-bg)!important;color:var(--tu-on)!important;overflow:auto!important;font-family:var(--tu-font)}
${X}[data-tux-view="report"]:not(.break-screen-active) #workspace{left:0!important;bottom:0!important;padding:0!important}
${X}[data-tux-view="other"]:not(.break-screen-active) #workspace{left:0!important}
${X}[data-tux-split]:not(.break-screen-active) #workspace{right:var(--tux-panel)!important}
${X}.break-screen-active .tux-head,${X}.break-screen-active .tux-nav,${X}.break-screen-active .tux-foot,${X}[data-tux-view="report"] .tux-nav,${X}[data-tux-view="report"] .tux-foot,${X}[data-tux-view="other"] .tux-nav{display:none!important}
${W} .question-stack,${W} .question-flex{display:block!important;width:auto!important;max-width:none!important;margin:0!important;padding:0!important;background:none!important;border:0!important;gap:0!important}
${W} .question-main{max-width:780px!important;width:auto!important;margin:0 auto!important;padding:0!important;display:flex!important;flex-wrap:wrap!important;align-items:center!important;gap:16px!important;border:0!important;background:none!important;box-shadow:none!important;float:none!important;position:relative!important;min-height:0!important;min-width:0!important;color:var(--tu-on)!important}
${W} .question-main>*{flex:1 1 100%;min-width:0;margin-left:0!important;margin-right:0!important}
${W} .question-main>.mark-line{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip:rect(0 0 0 0)!important;margin:0!important;padding:0!important}
${W} .question-main>.stem-answer-spacer,${W} .question-main>.locked-banner{display:none!important}
${W} #stem{background:var(--tu-surface)!important;color:var(--tu-on)!important;border:1px solid var(--tu-line2)!important;border-radius:22px!important;padding:22px 24px!important;box-shadow:var(--tu-shadow)!important;line-height:1.65!important;margin:0!important;max-width:none!important;width:auto!important;font-family:var(--tu-font)!important}
${W} #stem :is(table){background:var(--tu-s1)!important;border-radius:14px!important;border-collapse:separate!important;color:var(--tu-on)!important}
${W} #stem :is(td,th){background:transparent!important;color:inherit!important}
${W} #stem,${W} #stem :is(p,li,ul,ol,div,span,b,i,u,em,strong,td,th,tr,table,a,sub,sup){color:var(--tu-on)!important}
${W} #stem :is(td,th,table){border-color:var(--tu-line)!important}
${W} :is(#stem,.qbank-body) .v15-highlight,${W} :is(#stem,.qbank-body) .v15-highlight *{color:#161A25!important}
${W} #stem :is(img,table,svg){max-width:100%!important}
${W} #stem *{min-width:0!important}
${W} .answers{display:flex!important;flex-direction:column!important;gap:8px!important;margin:0!important;padding:0!important;border:0!important;background:none!important;box-shadow:none!important;width:auto!important}
${W} .answers .answer{position:relative!important;display:flex!important;align-items:center!important;gap:12px!important;min-height:52px!important;margin:0 48px 0 0!important;padding:8px 14px!important;border-radius:16px!important;border:1.5px solid var(--tu-line2)!important;background:var(--tu-surface)!important;color:var(--tu-on)!important;box-shadow:none!important;font:500 15.5px/1.45 var(--tu-font)!important;cursor:pointer;outline:0!important;text-decoration:none!important;opacity:1!important;width:auto!important}
${W} .answers .answer:hover{border-color:var(--tu-line)!important}
${W} .answers .answer .radio{width:30px!important;height:30px!important;flex:none!important;border-radius:50%!important;border:2px solid var(--tu-line)!important;background:transparent!important;color:var(--tu-on2)!important;display:flex!important;align-items:center!important;justify-content:center!important;margin:0!important;box-shadow:none!important;position:static!important;font:800 13.5px var(--tu-font)!important}
${W} .answers .answer .radio::before{content:attr(data-tux-letter);display:block!important;position:static!important;background:none!important;width:auto!important;height:auto!important;border:0!important;color:inherit!important;transform:none!important}
${W} .answers .answer .radio::after{display:none!important}
${W} .answers .answer .choice-text{flex:1 1 auto!important;min-width:0;color:inherit!important;background:none!important;padding:0!important;margin:0!important;font:inherit!important}
${W} .answers .answer .tux-pre,${W} .answers .answer .strike-symbol{display:none!important}
${W} .answers .answer.selected{border-color:var(--tu-p)!important;background:var(--tu-pc)!important}
${W} .answers .answer.selected .radio{border-color:var(--tu-p)!important;background:var(--tu-p)!important;color:var(--tu-onp)!important}
${W} .answers .answer:is(.struck,.strike,.striked,.struckout){opacity:1!important}
${W} .answers .answer:is(.struck,.strike,.striked,.struckout) .choice-text{text-decoration:line-through!important;opacity:.55}
${W} .answers .answer:is(.struck,.strike,.striked,.struckout) .radio{opacity:.55}
${W} .answers .answer.correctChoice{border-color:var(--tu-ok)!important;background:var(--tu-okc)!important}
${W} .answers .answer.incorrectChoice{border-color:var(--tu-bad)!important;background:var(--tu-badc)!important}
${W} .answers .answer.correctChoice .radio{border-color:var(--tu-ok)!important;color:var(--tu-ok)!important}
${W} .answers .answer.correctChoice.selected .radio{border-color:var(--tu-ok)!important;background:var(--tu-ok)!important;color:var(--tu-okc)!important}
${W} .answers .answer.incorrectChoice .radio{border-color:var(--tu-bad)!important;background:var(--tu-bad)!important;color:var(--tu-badc)!important}
${W} .answers .answer.correctChoice::after,${W} .answers .answer.incorrectChoice::after{content:"Correct";flex:none;font:800 12px var(--tu-font);padding:4px 10px;border-radius:999px;background:var(--tu-surface);color:var(--tu-ok);position:static;display:block;border:0;width:auto;height:auto}
${W} .answers .answer.incorrectChoice::after{content:"Your answer";color:var(--tu-bad)}
${W} .answers .tux-strike{position:absolute!important;right:-48px;top:50%;transform:translateY(-50%);width:40px!important;height:40px!important;border-radius:12px!important;display:flex!important;align-items:center;justify-content:center;color:var(--tu-on3)!important}
${W} .answers .tux-strike[aria-pressed="true"]{background:var(--tu-s2)!important;color:var(--tu-on)!important}
${W} .answers .tux-strike:hover{background:var(--tu-s1)!important}
${W} .answers #showAnsBtn,${W} .answers .show-answer-btn{align-self:flex-start;height:40px!important;padding:0 18px!important;border-radius:999px!important;border:0!important;background:var(--tu-pc)!important;color:var(--tu-onpc)!important;font:800 13.5px var(--tu-font)!important;box-shadow:none!important;margin:4px 0 0!important}
${W} .question-main>.tux-hint{flex:1 1 0;font-size:12.5px;color:var(--tu-on3);min-width:180px}
${W} #proceedBtn{flex:none!important;height:46px!important;padding:0 24px!important;border-radius:999px!important;border:0!important;background:var(--tu-p)!important;color:var(--tu-onp)!important;font:800 14.5px var(--tu-font)!important;box-shadow:none!important;margin:0!important;width:auto!important;min-width:0!important;cursor:pointer;float:none!important;position:static!important}
${W} #proceedBtn:disabled{background:var(--tu-s2)!important;color:var(--tu-on3)!important;cursor:default}
${W} .last-item-disabled-note{flex:1 1 100%;text-align:right;font-size:12.5px;color:var(--tu-on3)!important;margin:0!important;background:none!important;border:0!important}
${W} .answer-meta-panel{display:flex!important;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 14px!important;border-radius:14px!important;background:var(--tu-s1)!important;border:0!important;color:var(--tu-on)!important;box-shadow:none!important;margin:0!important;font-size:13.5px!important}
${W} .answer-meta-panel *{color:inherit!important;background:none!important;border-color:var(--tu-line)!important}
${W} .question-stack:has(.tux-exsum) .answer-meta-panel{display:none!important}
/* explanation / exhibit panel: a right column when split on a wide screen, a card under the question otherwise */
${W} .right-panel-wrap{position:static!important;width:auto!important;max-width:780px!important;margin:18px auto 0!important;padding:0!important;border:0!important;background:none!important;box-shadow:none!important;min-width:0!important;float:none!important;height:auto!important;max-height:none!important}
/* the iPad's viewport-fit layer gives .workspace translateZ(0), which would anchor the fixed panel to the question column */
${X}[data-tux-split] #workspace{transform:none!important}
${X}[data-tux-split] #workspace .right-panel-wrap{position:fixed!important;right:0!important;top:calc(62px + var(--tux-st))!important;bottom:58px!important;left:auto!important;width:var(--tux-panel)!important;max-width:none!important;margin:0!important;z-index:36;background:var(--tu-surface)!important;border-left:1px solid var(--tu-line2)!important}
${W} .qbank-panel{min-height:0!important;max-width:780px;margin:18px auto 0!important;background:var(--tu-surface)!important;border:1px solid var(--tu-line2)!important;border-radius:22px!important;box-shadow:var(--tu-shadow)!important;overflow:hidden!important;color:var(--tu-on)!important;padding:0!important;height:auto!important;max-height:none!important;font-family:var(--tu-font)!important}
${W} .right-panel-wrap .qbank-panel{margin:0!important;max-width:none}
${X}[data-tux-split] #workspace .right-panel-wrap .qbank-panel{height:100%!important;border:0!important;border-radius:0!important;box-shadow:none!important;overflow:auto!important;display:flex!important;flex-direction:column!important}
${W} .qbank-tabs{display:flex!important;align-items:center!important;gap:6px!important;padding:10px 14px!important;margin:0!important;border:0!important;border-bottom:1px solid var(--tu-line2)!important;background:var(--tu-surface)!important;position:sticky;top:0;z-index:2;flex:none}
${W} .qbank-tabs .qbank-tab{height:36px!important;padding:0 14px!important;border-radius:10px!important;border:0!important;background:transparent!important;color:var(--tu-on2)!important;font:700 13.5px var(--tu-font)!important;box-shadow:none!important;margin:0!important;top:0!important}
${W} .qbank-tabs .qbank-tab.active{background:var(--tu-pc)!important;color:var(--tu-onpc)!important;font-weight:800!important}
${W} .tux-layout{margin-left:auto;display:flex;align-items:center;gap:2px;font-size:12.5px;color:var(--tu-on3)}
${W} .tux-layout button{height:30px!important;padding:0 10px!important;border-radius:8px!important;font:700 12.5px var(--tu-font)!important;color:var(--tu-on3)!important}
${W} .tux-layout button[aria-checked="true"]{background:var(--tu-s1)!important;color:var(--tu-on)!important}
${W} .tux-exsum{padding:16px 18px 0;display:flex;flex-direction:column;gap:12px;font-size:14.5px;line-height:1.55;color:var(--tu-on)}
${W} .tux-exrow{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:13.5px;color:var(--tu-on2)}
${W} .tux-exrow b{color:var(--tu-on)}
${W} .tux-pill{height:30px;padding:0 12px;border-radius:999px;background:var(--tu-s2);color:var(--tu-on2);font-weight:800;font-size:13px;display:flex;align-items:center}
${W} .tux-pill.ok{background:var(--tu-okc);color:var(--tu-ok)}${W} .tux-pill.bad{background:var(--tu-badc);color:var(--tu-bad)}
${W} .tux-exchg{padding:9px 12px;border-radius:12px;background:var(--tu-s1);font-size:13px;color:var(--tu-on2)}
${W} .tux-exchg b{color:var(--tu-on)}
${W} .tux-exobj{padding:12px 14px;border-radius:14px;background:var(--tu-infoc)}
${W} .tux-exobj span,${W} .qbank-body .exp-correct>h3,${W} .qbank-body .exp-rule>b:first-child,${W} .qbank-body [data-tux-kind="trap"]>h3{display:block;font:800 11.5px var(--tu-font)!important;letter-spacing:.06em!important;text-transform:uppercase!important;margin:0 0 4px!important;padding:0!important;border:0!important;background:none!important}
${W} .tux-exobj span{color:var(--tu-info)}${W} .tux-exobj p{margin:0}
${W} .qbank-body{padding:12px 18px 24px!important;margin:0!important;display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px!important;font:400 14.5px/1.55 var(--tu-font)!important;color:var(--tu-on)!important;background:transparent!important;border:0!important;overflow:visible!important;max-height:none!important;height:auto!important;flex:none}
${W} .qbank-body>*{grid-column:1/-1;margin:0!important;min-width:0}
${W} .qbank-body>.exp-rule,${W} .qbank-body>.exp-rule+[data-tux-kind="trap"]{grid-column:auto}
${W} .qbank-body :is(p,div,span,li,ul,ol,td,th,b,strong,em,i,u,a,h4,h5){color:inherit!important}
${W} .qbank-body .exp-section{padding:0!important;border:0!important;background:none!important;box-shadow:none!important;border-radius:0!important}
${W} .qbank-body .exp-section>h3{margin:0 0 6px!important;font:800 13.5px var(--tu-font)!important;color:var(--tu-on)!important;letter-spacing:0;text-transform:none;border:0!important;padding:0!important;background:none!important}
${W} .qbank-body .exp-section.exp-correct{padding:12px 14px!important;border-radius:14px!important;background:var(--tu-okc)!important;border:0!important}
${W} .qbank-body .exp-section.exp-correct>h3{color:var(--tu-ok)!important}
${W} .qbank-body .exp-section.exp-correct>div>b{color:var(--tu-ok)!important}
${W} .qbank-body .exp-wrong{padding:9px 12px!important;border-radius:12px!important;border:1px solid var(--tu-line2)!important;margin:0 0 6px!important;background:transparent!important}
${W} .qbank-body .exp-wrong[data-tux-yours]{border-color:var(--tu-bad)!important;background:var(--tu-badc)!important}
${W} .qbank-body .exp-wrong[data-tux-yours]>b:first-child::after{content:"YOUR ANSWER";margin-left:8px;font-size:11.5px;font-weight:800;color:var(--tu-bad)}
${W} .qbank-body .exp-rule{padding:10px 12px!important;border-radius:12px!important;background:var(--tu-s1)!important;border:0!important}
${W} .qbank-body .exp-rule>b:first-child{color:var(--tu-info)!important}
${W} .qbank-body [data-tux-kind="trap"]{padding:10px 12px!important;border-radius:12px!important;background:var(--tu-warnc)!important}
${W} .qbank-body [data-tux-kind="trap"]>h3{color:var(--tu-warn)!important}
${W} .qbank-body .exp-pre{white-space:pre-wrap!important;font:inherit!important;background:none!important;border:0!important;padding:0!important;color:inherit!important}
${W} .qbank-body .exp-placeholder{color:var(--tu-on3)!important}
${W} .qbank-body[data-panel-mode="exhibit"],${W} .qbank-body:not([data-panel-mode="explanation"]){display:block!important}
${W} .qbank-body img{max-width:100%;height:auto;border-radius:12px}
${W} .exhibit-in-panel{display:block!important;padding:0!important;background:transparent!important}
${W} .exhibit-in-panel .exhibit{width:100%!important;display:flex!important;flex-direction:column;gap:10px;padding:0!important;border:0!important;box-shadow:none!important;background:transparent!important}
${W} .exhibit-tools{position:static!important;transform:none!important;display:flex!important;flex-direction:row!important;flex-wrap:wrap;gap:6px!important;align-items:center!important;color:var(--tu-on2)!important;font:700 12.5px var(--tu-font)!important}
${W} .exhibit-tools>div{position:relative;display:flex;align-items:center;gap:6px;height:34px;padding:0 12px 0 6px;border-radius:999px;background:var(--tu-s1);cursor:pointer}
${W} .exhibit-tools>div:hover{background:var(--tu-s2)}
${W} .exhibit-tool-icon{width:24px!important;height:24px!important;border:0!important;background:transparent!important;color:var(--tu-on)!important;font-size:16px!important;line-height:1!important}
${W} .exhibit-tool-icon::after{content:"";position:absolute;inset:0;border-radius:999px} /* the whole pill clicks the tool */
${W} .exhibit:has(.exhibit-img.invert) .exhibit-tools>div:has(#invertEx),${W} .exhibit:has(.exhibit-img.contrast) .exhibit-tools>div:has(#contrastEx),${W} .exhibit:has(.exhibit-img.zoomed) .exhibit-tools>div:has(#zoomEx){background:var(--tu-pc);color:var(--tu-onpc)!important}
${W} .exhibit-img{min-height:0!important;padding:8px;border:1px solid var(--tu-line2)!important;border-radius:16px;background:var(--tu-s1)!important;box-shadow:none!important}
${W} .exhibit-img:hover{border-color:var(--tu-line)!important}
${W} .exhibit-img img{max-height:min(64vh,620px)!important;margin:0 auto;border-radius:10px}
${W} .exhibit-img svg{min-height:200px!important}
${W} .exhibit-in-panel .drive-link{font-size:13px}
/* Review Block grid */
${W} .review-panel{max-width:980px;margin:0 auto!important;padding:22px 24px!important;background:var(--tu-surface)!important;color:var(--tu-on)!important;border:1px solid var(--tu-line2)!important;border-radius:22px!important;box-shadow:var(--tu-shadow)!important;font-family:var(--tu-font)!important}
${W} .review-panel h2{margin:0 0 6px!important;font:800 24px var(--tu-font)!important;color:var(--tu-on)!important}
${W} .review-panel p{color:var(--tu-on2)!important}
${W} .review-grid{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(150px,1fr))!important;gap:10px!important;margin:14px 0 18px!important}
${W} .review-card{border:1.5px solid var(--tu-line2)!important;border-radius:14px!important;background:var(--tu-surface)!important;color:var(--tu-on)!important;padding:12px!important;box-shadow:none!important;font-size:13.5px!important;line-height:1.5!important;min-height:0!important}
${W} .review-card.current{border-color:var(--tu-p)!important;background:var(--tu-pc)!important;color:var(--tu-onpc)!important}
${W} .review-panel button{height:38px!important;padding:0 16px!important;border-radius:999px!important;border:1px solid var(--tu-line)!important;background:transparent!important;color:var(--tu-on)!important;font:700 13.5px var(--tu-font)!important;box-shadow:none!important;margin:8px 6px 0 0!important;cursor:pointer}
${W} .review-panel button.primary{border:0!important;background:var(--tu-p)!important;color:var(--tu-onp)!important;font-weight:800!important}
/* overlays that sit over the exam */
${XB} .lab-panel{top:calc(62px + var(--tux-st))!important;bottom:58px!important;z-index:45!important;border-left:1px solid var(--tu-line2)!important;box-shadow:-10px 0 28px rgba(0,0,0,.14)!important}
${XB} #examNotesPanel{bottom:70px!important;z-index:46!important;border-radius:16px!important}
${XB} .floating-calc{bottom:70px!important}
${XB} #referenceSettingsDropdown{max-width:calc(100vw - 16px);max-height:calc(100vh - 80px);overflow:auto}
/* tablets in portrait: navigator narrows */
@media (max-width:1099px) and (min-width:760px) and (min-height:521px){
${X} .tux-nav{width:184px;padding:12px}
${X}:not(.break-screen-active) #workspace{left:184px!important;padding:18px 20px 32px!important}
${X} .tux-head{gap:8px;padding:0 12px}
${X} .tux-head .tux-tool{width:44px;height:44px;font-size:0;gap:0}
${X} .tux-head .tux-mark{width:40px;padding:0;justify-content:center}
${X} .tux-head .tux-mark span,${X} .tux-head .tux-tag,${X} .tux-timer span{display:none}
${X} .tux-head .tux-item{max-width:190px}
${X} .tux-count{min-width:48px}
${W} .answers .answer{margin-right:44px!important}
}
/* phones (and short landscape screens): compact header, navigator in a drawer, Previous / Next in the footer */
@media (max-width:759px),(max-height:520px){
${X} .tux-head{height:calc(56px + var(--tux-st));gap:8px;padding:0 8px 0 10px}
${X} .tux-tools,${X} .tux-center,${X} .tux-timer span,${X} .tux-head .tux-mark span,${X} .tux-head .tux-tag{display:none!important}
${X} .tux-head .tux-item{flex:1 1 auto;max-width:none;height:44px;flex-direction:row;align-items:center;gap:8px;padding:0 10px}
${X} .tux-item .tux-itemtxt{display:flex;flex-direction:column;min-width:0}
${X} .tux-item .tux-caret{display:block;margin-left:auto;color:var(--tu-on3)}
${X} .tux-head .tux-mark{width:44px;height:44px;padding:0;justify-content:center}
${X} .tux-head .tux-timer{height:44px;padding:0 10px;gap:6px}
${X} .tux-timer b{font-size:14px}
${X} .tux-head .tux-more{display:flex;width:44px;height:44px;border-radius:50%;align-items:center;justify-content:center;flex:none;color:var(--tu-on)}
${X} .tux-head .tux-more[aria-expanded="true"]{background:var(--tu-s1)}
${X} .tux-nav{top:0;bottom:0;width:min(300px,86vw);z-index:66;transform:translateX(-104%);transition:transform .2s ease;box-shadow:8px 0 30px rgba(0,0,0,.25);padding:calc(16px + var(--tux-st)) 14px calc(16px + env(safe-area-inset-bottom))}
${X}[data-tux-drawer] .tux-nav{transform:none}
${X} .tux-scrim{position:fixed;inset:0;z-index:65;background:rgba(10,12,18,.45)}
${X}[data-tux-drawer] .tux-scrim{display:block}
${X} .tux-grid{grid-template-columns:repeat(5,minmax(0,1fr))}
${X} .tux-nav .tux-q{height:40px}
${X}:not(.break-screen-active) #workspace{left:0!important;right:0!important;top:calc(56px + var(--tux-st))!important;bottom:calc(64px + env(safe-area-inset-bottom))!important;padding:12px 12px 28px!important}
${X}[data-tux-view="report"]:not(.break-screen-active) #workspace{bottom:0!important}
${X} .tux-foot{height:calc(64px + env(safe-area-inset-bottom));padding:0 10px env(safe-area-inset-bottom);gap:8px}
${X} .tux-foot>:not(.tux-pnav){display:none!important}
${X} .tux-foot .tux-pnav{display:flex;flex:1;gap:8px;align-items:center}
${X} .tux-pnav .tux-round{width:48px;height:48px}
${X} .tux-foot .tux-pnav .tux-go{flex:1;height:48px;border-radius:999px;background:var(--tu-p);color:var(--tu-onp);font-weight:800;font-size:15px;display:flex;align-items:center;justify-content:center;gap:6px}
${X} .tux-foot .tux-pnav .tux-go:disabled{background:var(--tu-s2);color:var(--tu-on3)}
${X} .tux-pnav .tux-pcount{min-width:58px;text-align:center;font-weight:800;font-size:14px;font-variant-numeric:tabular-nums;color:var(--tu-on2)}
${W} #stem{padding:16px!important;border-radius:18px!important;line-height:1.6!important}
${W} .question-main{gap:12px!important}
${W} .answers .answer{margin-right:0!important;padding:8px 6px 8px 10px!important;gap:10px!important;font-size:15px!important}
${W} .answers .tux-strike{position:static!important;transform:none;width:38px!important;height:38px!important;flex:none}
${W} .question-main>.tux-hint,${W} .tux-layout{display:none!important}
${X}:not([data-tux-tutor]) #workspace #proceedBtn{display:none!important}
${X}[data-tux-tutor] #workspace #proceedBtn{flex:1 1 100%!important}
${W} .qbank-body{grid-template-columns:minmax(0,1fr);padding:10px 14px 18px!important}
${W} .qbank-body>.exp-rule,${W} .qbank-body>.exp-rule+[data-tux-kind="trap"]{grid-column:1/-1}
${W} .tux-exsum{padding:14px 14px 0}
${W} .qbank-panel,${W} .right-panel-wrap{margin-top:14px!important}
${W} .qbank-panel{border-radius:18px!important}
${W} .review-panel{padding:16px!important;border-radius:18px!important}
${W} .review-grid{grid-template-columns:repeat(auto-fill,minmax(100px,1fr))!important}
${XB} .lab-panel{left:0!important;right:0!important;width:auto!important;min-width:0!important;top:calc(56px + var(--tux-st))!important;bottom:calc(64px + env(safe-area-inset-bottom))!important;border-left:0!important}
${XB} #examNotesPanel{left:8px!important;right:8px!important;width:auto!important;max-width:none!important;bottom:calc(72px + env(safe-area-inset-bottom))!important}
${XB} .floating-calc{right:50%!important;transform:translateX(50%);bottom:calc(72px + env(safe-area-inset-bottom))!important}
${XB} #referenceSettingsDropdown{left:auto!important}
${XB} .pause-card,${XB} #appDialogLayer .app-dialog{max-width:calc(100vw - 24px)!important}
}
`;

  /* ---------- accent, brand and favicon ---------- */
  function currentAccent(){ const a = store.get(KEYS.accent, 'crimson'); return ACCENTS[a] ? a : 'crimson'; }
  function iconBase(){ return 'icons/thunder/'; }
  function setLink(rel, href, sizes){
    let link = document.querySelector(`link[rel="${rel}"][data-tu]`);
    if(!link){
      document.querySelectorAll(`link[rel="${rel}"]`).forEach(l => l.remove());
      link = document.createElement('link'); link.rel = rel; link.dataset.tu = '1'; if(sizes) link.sizes = sizes; link.type = 'image/png';
      document.head.appendChild(link);
    }
    if(link.getAttribute('href') !== href) link.href = href;
  }
  function applyAccent(){
    const a = currentAccent(), root = document.documentElement;
    root.dataset.tu = '1'; root.dataset.tuAccent = a;
    setLink('icon', iconBase() + a + '-32.png', '32x32');
    setLink('apple-touch-icon', iconBase() + a + '-touch-180.png', '180x180');
    let meta = document.querySelector('meta[name="theme-color"]');
    if(!meta){ meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta); }
    meta.content = ACCENTS[a].brand;
  }
  function setAccent(a){
    if(!ACCENTS[a]) return;
    store.set(KEYS.accent, a); applyAccent();
    scheduleSettings();
  }
  function syncDarkFlag(){
    const menu = byId('menu');
    if(menu && menu.classList.contains('theme-dark')) document.documentElement.dataset.tuDark = '1';
    else delete document.documentElement.dataset.tuDark;
  }

  const TAB_LABELS = {quickTab:['Quick practice','quick'], libraryTab:['Library','library'], qbankTab:['Qbank','qbank'], qbankTestsTab:['Qbank tests','tests'], progressSyncTab:['Backup & sync','sync'], settingsTab:['Settings','settings']};
  const TITLES = {quickTab:'Quick practice', libraryTab:'Library', qbankTab:'Qbank', qbankTestsTab:'Qbank tests', progressSyncTab:'Backup & sync', tuSyncTab:'Backup & sync', settingsTab:'Settings'};
  function brand(){
    if(document.title !== 'ThunderUSMLE') document.title = 'ThunderUSMLE';
    const side = document.querySelector('#menu aside.modern-sidebar'); if(!side) return;
    const mark = side.querySelector('.brand-mark');
    if(mark && !mark.querySelector('.tu-logo')) mark.insertAdjacentHTML('beforeend', tileSvg(40));
    const title = side.querySelector('.menu-title'); if(title && title.textContent !== 'ThunderUSMLE') title.textContent = 'ThunderUSMLE';
    const sub = side.querySelector('.menu-subtitle'); if(sub && sub.textContent !== 'by Bladelord') sub.textContent = 'by Bladelord';
    Object.keys(TAB_LABELS).forEach(id => {
      const tab = byId(id); if(!tab || tab.dataset.tuBrand) return;
      const [label, ico] = TAB_LABELS[id];
      const dot = tab.querySelector('.sync-tab-dot');
      tab.innerHTML = icon(ICONS[ico], 22) + '<span class="tu-tab-label">' + esc(label) + '</span>';
      if(dot) tab.appendChild(dot);
      tab.dataset.tuBrand = '1';
    });
    ensureSyncTab();
    if(!byId('tuAddForms') && byId('loadNewFormBtn')){
      const add = document.createElement('button');
      add.type = 'button'; add.id = 'tuAddForms'; add.innerHTML = icon(ICONS.plus, 22) + 'Add forms'; add.setAttribute('aria-haspopup', 'dialog');
      add.addEventListener('click', () => openAdd('slot', add));
      const first = side.querySelector('.menu-tab'); side.insertBefore(add, first || null);
    }
    const theme = byId('themeToggle');
    if(theme){
      const dark = byId('menu')?.classList.contains('theme-dark');
      const want = dark ? 'sun' : 'moon';
      if(theme.dataset.tuIco !== want){ theme.querySelector('.tu-ico')?.remove(); theme.insertAdjacentHTML('afterbegin', icon(ICONS[want], 20)); theme.dataset.tuIco = want; }
    }
    syncDarkFlag();
    heroTitle();
    paintNav();
  }
  function heroTitle(){
    const active = document.querySelector('#menu aside.modern-sidebar .menu-tab.active');
    const menu = byId('menu'), page = menu && menu.dataset.tuStart ? 'library' : active ? active.id.replace(/Tab$/, '') : ''; // the start dialog sits over the Library
    if(menu && menu.dataset.tuPage !== page) menu.dataset.tuPage = page; // the Library page draws its own header
    const hero = document.querySelector('#menu .modern-hero'); if(!hero) return;
    const h1 = hero.querySelector('h1'), p = hero.querySelector('h1 + p, p');
    const t = (active && TITLES[active.id]) || 'Library';
    if(h1 && h1.textContent !== t) h1.textContent = t;
    if(p && p.textContent) p.textContent = '';
  }

  /* ---------- Library home (A23 Phase A: canvas boards Main, LibraryDark, iPadPortrait, FormSheet) ----------
     The view is rendered from StepLibraryBridge (read-only) and from the legacy dashboard numbers. Every button
     clicks the matching control of the hidden legacy card or panel, so prompts, protections and saves still run. */
  const bridge = () => window.StepLibraryBridge || null;
  const TAB_DOTS = {'N-Forms':'#3B6FE0', IM:'#0F8B8D', OBGyn:'#C2417A', Surg:'#D9661F', Peds:'#7B5CD6', FM:'#3C9A4A', EM:'#D23F3F', Psych:'#5A67D8', Neuro:'#B7862A', UWSA:'#0E7490', F120:'#9A3412', Custom:'#7A8194', All:'#6B7280', CMS:'#2C7A7B'};
  // the eight CMS shelf tabs, grouped as one "CMS forms" category on Home
  const CMS_TABS = ['IM', 'OBGyn', 'Surg', 'Peds', 'FM', 'EM', 'Psych', 'Neuro'];
  const LEGACY_TAB_COLORS = ['#d9e3ea', '#38bdf8'];
  const STATUSES = [['all','All'],['progress','In progress'],['done','Completed'],['new','Not started']];
  const ST_LABEL = {done:'Completed', progress:'In progress', suspended:'Suspended', new:'Not started'};
  const SORTS = [['default','Library order'],['recent','Recent activity'],['name','Name A–Z'],['score','Score: high to low'],['answered','Most answered'],['status','Status']];
  const tabInternal = f => f === 'NBME' ? 'N-Forms' : f;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  const kebab = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>';
  function shortDate(iso){
    const d = new Date(iso); if(!iso || isNaN(d)) return '';
    const o = {month:'short', day:'numeric'}; if(d.getFullYear() !== new Date().getFullYear()) o.year = 'numeric';
    return d.toLocaleDateString(undefined, o);
  }
  // Library tabs in the user's order and colors, read from the legacy filter pills.
  function libTabs(){
    return Array.from(document.querySelectorAll('#libraryFilters .filter-pill[data-filter]')).filter(p => p.dataset.filter !== 'Overview').map(p => {
      const key = p.dataset.filter, internal = tabInternal(key);
      let color = (p.style.getPropertyValue('--tab-accent') || '').trim().toLowerCase();
      if(!color || LEGACY_TAB_COLORS.includes(color)) color = TAB_DOTS[internal] || TAB_DOTS.Custom;
      const raw = (p.querySelector('.v214-tab-label')?.textContent || key).trim();
      return {key, internal, label: key === 'All' ? 'All forms' : (internal === 'N-Forms' ? 'NBME' : raw), color};
    });
  }
  function blockCountOf(rec){ const idx = Array.isArray(rec.questionIndex) ? rec.questionIndex : []; return idx.reduce((n, q) => Math.max(n, (Number(q.blockIndex) || 0) + 1), 0) || 1; }
  function formInfo(rec, tabsByKey){
    const B = bridge(), s = rec.progressSummary || {};
    const st = s.completed ? 'done' : s.canResume ? (s.suspended ? 'suspended' : 'progress') : (s.answered || s.inProgress) ? 'progress' : 'new';
    let tabKey = 'Custom'; try{ tabKey = B.tabKey(rec) || 'Custom'; }catch(e){}
    const tab = tabsByKey[tabKey] || {label: tabKey === 'N-Forms' ? 'NBME' : tabKey, color: TAB_DOTS[tabKey] || TAB_DOTS.Custom};
    let chip = false; try{ chip = B.scoreChipOn(tabKey); }catch(e){ chip = rec.type === 'N'; }
    const blocks = s.blockCount || blockCountOf(rec), attempts = Number(s.attemptCount) || (s.answered || s.completed ? 1 : 0);
    const score = s.completed && s.scorePct != null ? Number(s.scorePct) : null;
    return {
      id: rec.id, rec, s, st, tabKey, tabLabel: tab.label, color: tab.color,
      title: rec.displayName || rec.id, tag: (tab.label + ' · ' + rec.id).toUpperCase(),
      chip, three: chip && rec.threeDigitScore ? String(rec.threeDigitScore) : '',
      blockCount: blocks, attemptsText: attempts ? plural(attempts, 'attempt') : 'no attempts',
      meta: [(Number(rec.totalQuestions) || 0) + ' Qs', plural(blocks, 'block'), attempts ? plural(attempts, 'attempt') : 'no attempts'].join(' · '),
      score, answered: Math.max(0, Math.min(100, Number(s.progressPct) || 0)), blocks: (s.completedBlocks || 0) + '/' + blocks, marked: Number(s.marked) || 0,
      canResume: !!s.canResume, canReview: !!s.completed,
      startLabel: (s.answered || s.scoreTotal || s.completed || s.inProgress) ? 'New attempt' : 'Start',
      completedAt: s.completed ? (s.completedAt || '') : '', activity: s.updatedAt || s.completedAt || rec.updatedAt || rec.importedAt || ''
    };
  }

  // Legacy controls: the card for a form lives in the hidden #libraryGrid while its tab is selected.
  const legacyCard = id => document.querySelector(`#libraryGrid .v75-card[data-form-id="${CSS.escape(id)}"]`);
  async function withLegacyCard(id){
    let card = legacyCard(id); if(card) return card;
    document.querySelector('#libraryFilters .filter-pill[data-filter="All"]')?.click();
    for(let i = 0; i < 60 && !(card = legacyCard(id)); i++) await wait(50);
    return card;
  }
  async function cardAction(id, selector){
    const card = await withLegacyCard(id), btn = card && card.querySelector(selector);
    if(!btn || btn.disabled){ console.warn('ThunderUI: legacy control missing', id, selector); return false; }
    btn.click(); return true;
  }
  // Answers an appPrompt the legacy code opens (used for "Progress / Attempts", which asks for a number).
  async function answerPrompt(value){
    for(let i = 0; i < 80; i++){
      const input = byId('appDialogInput'), layer = byId('appDialogLayer');
      if(input && layer && !layer.classList.contains('hidden') && !layer.hidden && input.offsetParent !== null){ input.value = value; byId('appDialogOk')?.click(); return true; }
      await wait(50);
    }
    return false;
  }

  /* iPad Google Drive status, mirrored from the app's own sticker (#googleBackupStatus, fed by stepsync:state) */
  let lastSyncDetail = '';
  window.addEventListener('stepsync:state', e => { lastSyncDetail = String((e.detail && e.detail.detail) || ''); setTimeout(paintSyncBits, 0); });
  const SYNC_VIEW = [
    [/^Synced$/i, 'Synced', ''], [/^Syncing/i, 'Syncing…', ''], [/^Checking/i, 'Checking…', ''], [/^Connecting/i, 'Connecting…', ''],
    [/^Local Changes/i, 'Local changes', 'Sync now'], [/^Cloud Newer/i, 'Cloud newer', 'Review'], [/^Conflict/i, 'Needs your choice', 'Choose version'],
    [/^Offline/i, 'Offline', ''], [/^Reconnect/i, 'Reconnect', 'Reconnect'], [/^Error/i, 'Sync error', 'Retry'], [/^Baseline/i, 'Baseline needed', 'Open'], [/^Off$/i, 'Backup off', 'Turn on']
  ];
  function syncView(){
    const el = byId('googleBackupStatus'); if(!el) return null;
    const raw = el.textContent.replace(/^Google Backup:\s*/i, '').trim() || 'Off';
    const hit = SYNC_VIEW.find(([re]) => re.test(raw)) || [null, raw, ''];
    const detail = lastSyncDetail || String(el.title || '').split('\n')[0] || '';
    const tone = el.dataset.tone || 'offline';
    return {label: hit[1], action: hit[2], detail, tone, dot: {good:'ok', busy:'busy', pending:'warn', conflict:'warn', error:'bad'}[tone] || '', busy: tone === 'busy'};
  }
  function openSync(){ openSyncPage(); }

  /* sidebar card: DATA folder (Local) or Google Drive (iPad) */
  function paintNav(){
    const side = document.querySelector('#menu aside.modern-sidebar'); if(!side) return;
    let card = byId('tuNavCard');
    if(!card){ card = document.createElement('div'); card.id = 'tuNavCard'; card.className = 'tu-navcard'; side.insertBefore(card, byId('themeToggle') || null); }
    let html = '';
    const sv = IPAD ? syncView() : null;
    if(sv){
      html = `<div><span class="tu-navdot ${sv.dot}"></span><b>Google Drive · ${esc(sv.label)}</b></div>${sv.detail ? `<span>${esc(sv.detail)}</span>` : ''}${sv.busy ? '<span class="tu-navbar" aria-hidden="true"><i></i></span>' : ''}<div class="tu-navbtns"><button type="button" data-tu-open-sync>${esc(sv.action || 'Backup & sync')}</button></div>`;
    } else if(!IPAD){
      const status = byId('dataFolderStatus'), ok = !!status && status.classList.contains('connected');
      let n = 0; try{ n = bridge() ? bridge().forms().length : 0; }catch(e){}
      html = `<div><span class="tu-navdot ${ok ? 'ok' : 'warn'}"></span><b>${ok ? 'DATA folder connected' : 'DATA folder not connected'}</b></div><span>${ok ? esc(plural(n, 'form')) + ' · saved to disk automatically' : 'Connect your DATA folder to load your forms and progress.'}</span><div class="tu-navbtns">${ok && byId('scanDataFolderBtn') ? '<button type="button" data-tu-proxy="scanDataFolderBtn">Rescan</button>' : ''}${byId('connectDataFolderBtn') ? `<button type="button" data-tu-proxy="connectDataFolderBtn">${ok ? 'Change' : 'Connect'}</button>` : ''}</div>`;
    }
    if(card.dataset.html !== html){ card.innerHTML = html; card.dataset.html = html; }
    card.hidden = !html;
  }
  function paintSyncBits(){
    paintNav();
    const home = byId('tuHome'); if(!home) return;
    const sv = IPAD ? syncView() : null;
    setRegion('sync', sv ? `<button type="button" class="tu-syncpill" data-tone="${esc(sv.tone)}" data-tu-open-sync title="Google Drive progress sync: ${esc(sv.detail || sv.label)}"><i></i>${esc(sv.label)}</button>` : '');
    setRegion('strip', sv ? `<button type="button" class="tu-syncstrip" data-tone="${esc(sv.tone)}" data-tu-open-sync aria-label="Google Drive sync: ${esc(sv.label)}. ${esc(sv.detail)}">${icon(ICONS.sync, 18)}<span><b>${esc(sv.label)}</b>${sv.detail ? ' · ' + esc(sv.detail) : ''}</span>${sv.action ? `<em>${esc(sv.action)}</em>` : ''}</button>` : '');
  }

  /* view state */
  const homeUi = {resumeOpen:false, tabsOpen:false, cms:false};
  const regionCache = new Map();
  function setRegion(name, html){
    const el = document.querySelector(`#tuHome [data-tu-r="${name}"]`); if(!el) return;
    if(regionCache.get(name) === html && el.dataset.tuFilled) return;
    el.innerHTML = html; el.dataset.tuFilled = '1'; regionCache.set(name, html);
  }
  function ensureHome(panel){
    let home = byId('tuHome'); if(home) return home;
    regionCache.clear();
    home = document.createElement('div'); home.id = 'tuHome';
    const sorts = SORTS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
    home.innerHTML = `<header class="tu-home-head"><div class="tu-home-title"><h1>Library</h1><span data-tu-r="count"></span></div>` +
      `<div class="tu-home-tools"><span data-tu-r="sync" style="display:contents"></span><span data-tu-r="updates" style="display:contents"></span>` +
      `<label class="tu-search">${icon(ICONS.search, 18)}<span class="tu-sr">Search forms</span><input type="search" id="tuSearch" placeholder="Search forms" autocomplete="off"></label>` +
      `<label class="tu-iconbtn tu-sortbtn" title="Sort forms">${icon('<path d="M8 4v16m0 0-4-4m4 4 4-4M14 6h6M14 11h4M14 16h2"/>', 18)}<span class="tu-sr">Sort forms</span><select id="tuSort">${sorts}</select></label>` +
      `<div class="tu-seg tu-view" role="group" aria-label="View"><button type="button" data-tu-view="grid" aria-label="Grid view" title="Grid view">${icon(ICONS.grid, 16)}</button><button type="button" data-tu-view="list" aria-label="List view" title="List view">${icon(ICONS.list, 16)}</button></div>` +
      `<span data-tu-r="more" style="display:contents"></span></div></header>` +
      `<div data-tu-r="strip" style="display:contents"></div>` +
      `<div class="tu-home-top"><section class="tu-card tu-cats" aria-label="Categories"><div class="tu-sec-head"><h2>Categories</h2><button type="button" class="tu-link" id="tuCustomizeTabs">Customize tabs</button></div><div class="tu-cats-body" data-tu-r="cats"></div></section>` +
      `<section class="tu-card tu-recent" aria-label="Recently completed" data-tu-r="recent"></section><section class="tu-card tu-overall" aria-label="Overall performance" data-tu-r="overall"></section></div>` +
      `<section class="tu-card tu-cms" aria-label="CMS forms" data-tu-r="cms" hidden></section>` +
      `<section class="tu-card tu-resume" aria-label="Resume" data-tu-r="resume" hidden></section>` +
      `<section class="tu-forms" aria-label="Forms"><div class="tu-forms-bar"><div class="tu-seg tu-status" role="group" aria-label="Status" data-tu-r="status"></div><span class="tu-shown" data-tu-r="shown" aria-live="polite"></span></div><div class="tu-grid" data-tu-r="cards"></div></section>`;
    panel.insertBefore(home, panel.firstChild);
    const sort = home.querySelector('#tuSort'); sort.value = store.get(KEYS.sort, 'default');
    sort.addEventListener('change', () => { store.set(KEYS.sort, sort.value); scheduleLibrary(); });
    home.querySelector('#tuSearch').addEventListener('input', () => scheduleLibrary());
    home.addEventListener('click', onHomeClick);
    return home;
  }

  function overallHtml(forms){
    const legacy = byId('libraryOverallMainV195B');
    const rings = legacy ? Array.from(legacy.querySelectorAll('.library-main-ring-v201')) : [];
    const ringPct = cls => { const r = rings.find(x => x.classList.contains(cls)); const m = r && (r.querySelector('b')?.textContent || '').match(/(\d+(?:\.\d+)?)\s*%/); return m ? Number(m[1]) : null; };
    const progress = ringPct('progress'), score = ringPct('score');
    const qline = (legacy?.querySelector('.library-question-count-v201')?.firstChild?.textContent || '').trim();
    // before the legacy summary is drawn the line has no "/": default both counts so the whole home paint does not throw
    const [qa = 0, qt = 0] = qline.split('/').map(x => Number(String(x).replace(/[^\d]/g, '')) || 0);
    const fline = Array.from(legacy ? legacy.querySelectorAll('.library-overall-pill-v201') : []).map(x => x.textContent).find(t => /forms? complete/i.test(t)) || '';
    const fm = fline.match(/(\d+)\s*\/\s*(\d+)/);
    const fd = fm ? Number(fm[1]) : forms.filter(f => f.s.completed).length, ft = fm ? Number(fm[2]) : forms.length;
    const ring = (v, c, label) => `<div class="tu-ring112" style="--v:${v == null ? 0 : v};--c:${c}" role="img" aria-label="${label} ${v == null ? 'not available' : v + ' percent'}"><div><b>${v == null ? '—' : v + '%'}</b><span>${label.toUpperCase()}</span></div></div>`;
    return `<div class="tu-sec-head"><h2>Overall performance</h2></div><div class="tu-rings">${ring(progress, 'var(--tu-p)', 'Progress')}${ring(score, 'var(--tu-ok)', 'Avg score')}</div>` +
      `<div class="tu-pair"><div><b>${qa.toLocaleString()} <small>/ ${qt.toLocaleString()}</small></b><span>Questions answered</span></div><div><b>${fd} <small>/ ${ft}</small></b><span>Forms complete</span></div></div><span class="tu-ov-note">Included tabs only</span>`;
  }
  function recentHtml(forms){
    const B = bridge();
    const done = forms.filter(f => f.s.completed && (() => { try{ return B.completedOn(f.tabKey); }catch(e){ return true; } })())
      .sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt))).slice(0, 6);
    const rows = done.map(f => `<button type="button" class="tu-recent-row" data-tu-act="review" data-id="${esc(f.id)}" title="Open the score report for ${esc(f.title)}"><i style="background:${esc(f.color)}"></i><b>${esc(f.title)}</b><span>${esc([shortDate(f.completedAt), f.three].filter(Boolean).join(' · '))}</span><strong>${f.score == null ? '—' : f.score + '%'}</strong></button>`).join('');
    return `<div class="tu-sec-head"><h2>Recently completed</h2>${done.length ? '<button type="button" class="tu-link" data-tu-see-all>See all</button>' : ''}</div>${rows ? `<div class="tu-recent-list">${rows}</div>` : '<span class="tu-empty-note">Completed forms will appear here.</span>'}`;
  }
  function tabForms(B, forms, internal){ try{ const ids = new Set(B.recs(internal).map(r => r.id)); return forms.filter(f => ids.has(f.id)); }catch(e){ return []; } }
  function cmsForms(B, forms, tabs){ const ids = new Set(); tabs.filter(t => CMS_TABS.includes(t.internal)).forEach(t => tabForms(B, forms, t.internal).forEach(f => ids.add(f.id))); return forms.filter(f => ids.has(f.id)); }
  function tileHtml(attrs, label, color, recs, meter, on, caret){
    const done = recs.filter(f => f.s.completed), scoreTotal = done.reduce((n, f) => n + (Number(f.s.scoreTotal) || 0), 0), scoreCorrect = done.reduce((n, f) => n + (Number(f.s.scoreCorrect) || 0), 0);
    const score = scoreTotal ? Math.round(scoreCorrect / scoreTotal * 100) + '%' : '—', pctDone = recs.length ? Math.round(done.length / recs.length * 100) : 0;
    return `<button type="button" class="tu-tile" ${attrs} aria-pressed="${on}" title="${esc(label + (meter ? ' · ' + score : '') + ' · ' + done.length + ' of ' + recs.length + ' done')}"><span class="tu-tile-top"><i style="background:${esc(color)}"></i><b>${esc(label)}</b>${meter ? `<span>${score}</span>` : ''}${caret ? icon(ICONS.chevron, 14).replace('<svg', '<svg class="tu-tile-caret"') : ''}</span>${meter ? `<span class="tu-tile-bar"><i style="width:${pctDone}%;background:${esc(color)}"></i></span>` : ''}<small>${done.length} of ${recs.length} done</small><em>${recs.length}</em></button>`;
  }
  function catsHtml(tabs, forms, cat){
    const B = bridge(); let cmsDone = false;
    const tiles = tabs.map(t => {
      if(CMS_TABS.includes(t.internal)){
        if(cmsDone) return ''; cmsDone = true;
        const cms = tabs.filter(x => CMS_TABS.includes(x.internal));
        let meter = false; cms.forEach(x => { try{ meter = meter || B.meterOn(x.internal); }catch(e){ meter = true; } });
        return tileHtml(`data-tu-group="cms" aria-expanded="${homeUi.cms}" aria-controls="tuCmsPane"`, 'CMS forms', TAB_DOTS.CMS, cmsForms(B, forms, tabs), meter, homeUi.cms, true);
      }
      let meter = true; if(t.key !== 'All'){ try{ meter = B.meterOn(t.internal); }catch(e){} }
      return tileHtml(`data-tu-cat="${esc(t.key)}"`, t.label, t.color, t.key === 'All' ? forms : tabForms(B, forms, t.internal), meter, !homeUi.cms && cat === t.key, false);
    }).join('');
    return `<div class="tu-tiles${homeUi.tabsOpen ? '' : ' tu-clamp'}" data-tu-tiles>${tiles}</div><button type="button" class="tu-link tu-tiles-more" data-tu-tabs-more hidden aria-expanded="${homeUi.tabsOpen}">${homeUi.tabsOpen ? 'Show fewer tabs' : 'Show all tabs'}</button>`;
  }
  function cmsHtml(tabs, forms, cat){
    const B = bridge(), cms = tabs.filter(t => CMS_TABS.includes(t.internal)); if(!homeUi.cms || !cms.length) return '';
    const all = cmsForms(B, forms, tabs), done = all.filter(f => f.s.completed).length;
    const tiles = cms.map(t => { let meter = true; try{ meter = B.meterOn(t.internal); }catch(e){} return tileHtml(`data-tu-cat="${esc(t.key)}"`, t.label, t.color, tabForms(B, forms, t.internal), meter, cat === t.key, false); }).join('');
    return `<div class="tu-sec-head"><h2>CMS forms</h2><span>${done} of ${plural(all.length, 'form')} done${CMS_TABS.includes(tabInternal(cat)) ? '' : ' · pick a subject to filter'}</span></div><div class="tu-tiles">${tiles}</div>`;
  }
  function resumeHtml(forms){
    const list = forms.filter(f => f.canResume).sort((a, b) => String(b.activity).localeCompare(String(a.activity)));
    if(!list.length) return '';
    const open = homeUi.resumeOpen && list.length > 1;
    const meta = f => [(f.st === 'suspended' ? 'Suspended ' : 'In progress · ') + shortDate(f.activity), 'block ' + Math.min((Number(f.s.currentBlockPointer) || 0) + 1, f.s.blockCount || 1) + ' of ' + (f.s.blockCount || 1), (f.s.answered || 0) + ' of ' + (f.s.total || f.rec.totalQuestions || 0) + ' answered'].filter(Boolean).join(' · ').replace(' · ·', ' ·');
    const first = list[0];
    let html = `<div class="tu-resume-row"><span class="tu-resume-ico">${icon(ICONS.play, 18)}</span><div class="tu-resume-text"><b>${esc(first.title)}${first.s.activeAttemptLabel ? ` <small>· ${esc(first.s.activeAttemptLabel)}</small>` : ''}</b><span>${esc(meta(first))}</span></div><span class="tu-resume-bar" aria-hidden="true"><i style="width:${first.answered}%"></i></span>` +
      (list.length > 1 ? `<button type="button" class="tu-btn text" data-tu-resume-more aria-expanded="${open}">${open ? 'Hide' : (list.length - 1) + ' more in progress'}${icon(ICONS.chevron, 16)}</button>` : '') +
      `<button type="button" class="tu-btn" data-tu-act="resume" data-id="${esc(first.id)}">Resume</button></div>`;
    if(open) html += list.slice(1).map(f => `<div class="tu-resume-row"><div class="tu-resume-text"><b>${esc(f.title)}</b><span>${esc(meta(f))}</span></div><button type="button" class="tu-btn outline small" data-tu-act="resume" data-id="${esc(f.id)}">Resume</button></div>`).join('');
    return html;
  }
  function cardHtml(f){
    const ring = f.st === 'done' ? 'var(--tu-ok)' : 'var(--tu-p)';
    const primary = f.canResume ? `<button type="button" class="tu-btn" data-tu-act="resume" data-id="${esc(f.id)}">${icon(ICONS.play, 16)}Resume</button>`
      : `<button type="button" class="tu-btn" data-tu-act="start" data-id="${esc(f.id)}">${icon(ICONS.play, 16)}${f.startLabel}</button>`;
    const three = f.three ? `<span class="tu-three" title="3-digit score"><b>${esc(f.three)}</b><small>3-DIGIT</small></span>` : (f.chip && f.st === 'done' ? '<span class="tu-three none" title="No 3-digit score yet. Add it from the form’s details (⋮)."><b>—</b><small>3-DIGIT</small></span>' : '');
    const when = f.st === 'done' ? [ICONS.check, 'Completed ' + (shortDate(f.completedAt) || '—')] : f.st === 'suspended' ? [ICONS.pause, 'Suspended ' + shortDate(f.activity)] : f.st === 'progress' ? [ICONS.clock, 'Last active ' + shortDate(f.activity)] : [ICONS.clock, 'Not attempted yet'];
    return `<article class="tu-card tu-form" data-tu-form="${esc(f.id)}"><div class="tu-form-head"><div class="tu-form-hl"><div class="tu-form-tag"><i style="background:${esc(f.color)}"></i><span>${esc(f.tag)}</span></div>` +
      `<div class="tu-form-name"><b title="${esc(f.title)}">${esc(f.title)}</b><small title="${esc(f.meta)}">${esc(f.meta)}</small></div></div><div class="tu-form-hr"><span class="tu-st ${f.st}">${ST_LABEL[f.st]}</span>${three}</div></div>` +
      `<div class="tu-form-date ${f.st}">${icon(when[0], 15)}<span>${esc(when[1].trim())}</span></div>` +
      `<div class="tu-form-stats"><div class="tu-ring58" style="--v:${f.score == null ? 0 : f.score};--c:${ring}" role="img" aria-label="Score ${f.score == null ? 'not available' : f.score + ' percent'}"><b>${f.score == null ? '—' : f.score + '%'}</b></div><div class="tu-three-stats"><div><b>${f.answered}%</b><span>Answered</span></div><div><b>${f.blocks}</b><span>Blocks</span></div><div><b>${f.marked}</b><span>Marked</span></div></div></div>` +
      `<div class="tu-bar5" aria-hidden="true"><i style="width:${f.answered}%;background:${esc(f.color)}"></i></div>` +
      `<div class="tu-form-actions">${primary}${f.canReview ? `<button type="button" class="tu-btn quiet" data-tu-act="review" data-id="${esc(f.id)}">Review</button>` : ''}<span class="tu-grow"></span><button type="button" class="tu-kebab" data-tu-act="sheet" data-id="${esc(f.id)}" aria-label="Details and more actions for ${esc(f.title)}" aria-haspopup="dialog">${kebab}</button></div></article>`;
  }
  function moreHtml(){
    const items = [['exportCatalogBtn', 'Save library index'], ['exportFullLibraryBackupBtn', 'Export form library ZIP'], ['importFullLibraryBackupBtn', 'Import form library ZIP'], ['exportProgressOnlyBackupBtn', 'Export progress file'], ['importProgressOnlyBackupBtn', 'Import progress file'], ['updateAppShellBtn', 'Reload latest version']].filter(([id]) => byId(id));
    const fsOk = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled), fsOn = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if(fsOk) items.unshift(['', fsOn ? 'Exit full screen' : 'Full screen']);
    if(!items.length) return '';
    const version = (byId('appVersionLabel')?.textContent || '').trim() || 'Version ' + TU_RELEASE;
    return `<details class="tu-more"><summary class="tu-iconbtn" aria-label="More library actions" title="More">${icon('<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>', 20)}</summary><div class="tu-more-panel">${items.map(([id, l]) => id ? `<button type="button" data-tu-proxy="${id}">${l}</button>` : `<button type="button" data-tu-fullscreen>${l}</button>`).join('')}${version ? `<small>${esc(version)}</small>` : ''}</div></details>`;
  }

  let libraryQueued = false, libraryObserver = null, sawAllFilter = false;
  function scheduleLibrary(){ if(libraryQueued) return; libraryQueued = true; requestAnimationFrame(() => { libraryQueued = false; try{ paintLibrary(); }catch(e){ console.warn('ThunderUI library paint failed', e); } }); }
  function paintLibrary(){
    const panel = byId('libraryModePanel'), B = bridge(); if(!panel || !B || !byId('libraryFilters')) return;
    // The legacy "Completed" tab becomes a status filter; open the library on All forms.
    if(!sawAllFilter && B.filter() === 'Overview'){ const all = document.querySelector('#libraryFilters .filter-pill[data-filter="All"]'); if(all){ sawAllFilter = true; all.click(); return; } }
    sawAllFilter = true;
    const home = ensureHome(panel); panel.classList.add('tu-has-home');
    const tabs = libTabs(), tabsByKey = {}; tabs.forEach(t => { tabsByKey[t.internal] = t; });
    const forms = B.forms().map(r => formInfo(r, tabsByKey));
    let cat = B.filter(); if(cat === 'Overview' || !tabs.some(t => t.key === cat)) cat = 'All';
    if(CMS_TABS.includes(tabInternal(cat))) homeUi.cms = true; else if(cat !== 'All') homeUi.cms = false;
    if(homeUi.cms && !tabs.some(t => CMS_TABS.includes(t.internal))) homeUi.cms = false;
    const qs = forms.reduce((n, f) => n + (Number(f.rec.totalQuestions) || 0), 0);
    setRegion('count', forms.length ? esc(plural(forms.length, 'form') + ' · ' + qs.toLocaleString() + ' questions') : '');
    const upd = byId('formUpdatesCheck');
    // phones: a small Add forms button sits left of the download button instead of the floating one
    const addMini = byId('tuAddForms') ? `<button type="button" class="tu-iconbtn tu-addmini" data-tu-addmini aria-haspopup="dialog" aria-label="Add forms" title="Add forms">${icon(ICONS.plus, 20)}</button>` : '';
    setRegion('updates', addMini + (upd ? `<button type="button" class="tu-iconbtn" data-tu-updates aria-haspopup="dialog" aria-label="Check for form updates" title="Check for form updates">${icon(ICONS.download, 19)}</button>` : ''));
    setRegion('more', moreHtml());
    setRegion('overall', overallHtml(forms));
    setRegion('recent', recentHtml(forms));
    setRegion('cats', catsHtml(tabs, forms, cat));
    const cmsEl = home.querySelector('[data-tu-r="cms"]'), ch = cmsHtml(tabs, forms, cat); setRegion('cms', ch); cmsEl.hidden = !ch; cmsEl.id = 'tuCmsPane';
    const r = home.querySelector('[data-tu-r="resume"]'), rh = resumeHtml(forms); setRegion('resume', rh); r.hidden = !rh;
    // forms in the selected tab, then search, status and sort
    let inCat = forms;
    if(cat !== 'All'){ try{ const ids = new Set(B.recs(tabInternal(cat)).map(x => x.id)); inCat = forms.filter(f => ids.has(f.id)); }catch(e){} }
    else if(homeUi.cms) inCat = cmsForms(B, forms, tabs);
    const q = (byId('tuSearch')?.value || '').trim().toLowerCase();
    if(q) inCat = inCat.filter(f => (f.title + ' ' + f.id + ' ' + f.tabLabel + ' ' + (f.rec.subject || '')).toLowerCase().includes(q));
    let status = store.get(KEYS.status, 'all'); if(!STATUSES.some(s => s[0] === status)) status = 'all';
    const isIn = (f, s) => s === 'all' || (s === 'progress' ? (f.st === 'progress' || f.st === 'suspended') : s === 'done' ? f.st === 'done' && (cat !== 'All' || (() => { try{ return B.completedOn(f.tabKey); }catch(e){ return true; } })()) : f.st === s);
    setRegion('status', STATUSES.map(([id, label]) => `<button type="button" data-tu-status="${id}" aria-pressed="${status === id}">${label} <span>${inCat.filter(f => isIn(f, id)).length}</span></button>`).join(''));
    const sort = store.get(KEYS.sort, 'default'); const sel = byId('tuSort'); if(sel && sel.value !== sort) sel.value = sort;
    const rank = {progress:0, suspended:0, new:1, done:2}, order = new Map(forms.map((f, i) => [f.id, i]));
    const shown = inCat.filter(f => isIn(f, status)).sort((a, b) => {
      const d = order.get(a.id) - order.get(b.id);
      if(sort === 'recent') return String(b.activity).localeCompare(String(a.activity)) || d;
      if(sort === 'name') return a.title.localeCompare(b.title, undefined, {numeric:true}) || d;
      if(sort === 'score') return (b.score ?? -1) - (a.score ?? -1) || d;
      if(sort === 'answered') return b.answered - a.answered || d;
      if(sort === 'status') return rank[a.st] - rank[b.st] || d;
      return d;
    });
    const tabLabel = cat === 'All' ? (homeUi.cms ? ' in CMS forms' : '') : ' in ' + ((tabs.find(t => t.key === cat) || {}).label || cat);
    setRegion('shown', forms.length ? `Showing ${shown.length} of ${plural(inCat.length, 'form')}${tabLabel}` : '');
    const empty = !forms.length ? `<div class="tu-nomatch">No forms yet. Use <b>Add forms</b> to load your first form.</div>` : `<div class="tu-nomatch">${q ? 'No forms match “' + esc(q) + '”.' : 'No forms with this status' + esc(tabLabel) + '.'}</div>`;
    setRegion('cards', shown.length ? shown.map(cardHtml).join('') : empty);
    const view = store.get(KEYS.view, 'grid') === 'list' ? 'list' : 'grid';
    home.querySelector('[data-tu-r="cards"]').classList.toggle('tu-list', view === 'list');
    home.querySelectorAll('[data-tu-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tuView === view)));
    paintSyncBits();
    // "Show all tabs" only when the tiles overflow the collapsed height
    const tiles = home.querySelector('[data-tu-tiles]'), more = home.querySelector('[data-tu-tabs-more]');
    const chips = matchMedia('(max-width:900px)').matches; // iPad portrait: category chips
    if(tiles){
      // wide: the tiles fill the Categories card; 2-3 columns, rows shrink as tabs are added (13-15 fit), then the grid scrolls
      const n = tiles.children.length, wide = tiles.clientWidth >= 380, cols = n <= 6 && !wide ? 1 : 2, rows = Math.max(1, Math.ceil(n / cols));
      tiles.style.setProperty('--cols', cols); tiles.style.setProperty('--rows', rows);
      tiles.classList.toggle('tu-dense', rows > 3); tiles.classList.toggle('tu-scroll', rows > 7); // 2 x 7 = 14 tiles fit
    }
    if(tiles && more){ tiles.classList.add('tu-clamp'); const over = chips && tiles.scrollHeight > tiles.clientHeight + 2; tiles.classList.toggle('tu-clamp', chips && !homeUi.tabsOpen); more.hidden = !over; }
    if(sheetState.id) paintSheet();
    if(addUi.open) paintAdd();
    paintUpdates();
    heroTitle();
    if(libraryObserver) libraryObserver.takeRecords();
  }
  function toggleFullscreen(){
    const d = document, el = d.documentElement;
    const p = (d.fullscreenElement || d.webkitFullscreenElement) ? (d.exitFullscreen || d.webkitExitFullscreen).call(d) : (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    if(p && p.catch) p.catch(err => console.warn('ThunderUI: full screen refused', err));
  }
  ['fullscreenchange', 'webkitfullscreenchange'].forEach(ev => document.addEventListener(ev, () => scheduleLibrary()));
  function onHomeClick(e){
    const t = e.target.closest('button, [data-tu-cat]'); if(!t || !byId('tuHome').contains(t)) return;
    if(t.dataset.tuGroup === 'cms'){ homeUi.cms = true; if(bridge().filter() !== 'All') document.querySelector('#libraryFilters .filter-pill[data-filter="All"]')?.click(); scheduleLibrary(); return; }
    if(t.dataset.tuCat){ homeUi.cms = CMS_TABS.includes(tabInternal(t.dataset.tuCat)); document.querySelector(`#libraryFilters .filter-pill[data-filter="${CSS.escape(t.dataset.tuCat)}"]`)?.click(); scheduleLibrary(); return; }
    if(t.dataset.tuStatus){ store.set(KEYS.status, t.dataset.tuStatus); scheduleLibrary(); return; }
    if(t.dataset.tuView){ store.set(KEYS.view, t.dataset.tuView); scheduleLibrary(); return; }
    if(t.hasAttribute('data-tu-resume-more')){ homeUi.resumeOpen = !homeUi.resumeOpen; scheduleLibrary(); return; }
    if(t.hasAttribute('data-tu-tabs-more')){ homeUi.tabsOpen = !homeUi.tabsOpen; scheduleLibrary(); return; }
    if(t.hasAttribute('data-tu-see-all')){ homeUi.cms = false; store.set(KEYS.status, 'done'); if(bridge().filter() !== 'All') document.querySelector('#libraryFilters .filter-pill[data-filter="All"]')?.click(); scheduleLibrary(); byId('tuHome').querySelector('.tu-forms')?.scrollIntoView({behavior:'smooth', block:'start'}); return; }
    if(t.hasAttribute('data-tu-updates')){ openUpdates(t); return; }
    if(t.hasAttribute('data-tu-addmini')){ openAdd('slot', t); return; }
    if(t.hasAttribute('data-tu-fullscreen')){ t.closest('details')?.removeAttribute('open'); toggleFullscreen(); return; }
    if(t.id === 'tuCustomizeTabs'){ setUi.sec = 'tabs'; store.set(SET_KEY, 'tabs'); if(setUi.page === 'sync') setSyncPage(false); byId('settingsTab')?.click(); setSyncPage(false); return; }
    const act = t.dataset.tuAct, id = t.dataset.id; if(!act || !id) return;
    if(act === 'sheet'){ openSheet(id, t); return; }
    cardAction(id, `[data-action="${act}"]`);
  }
  document.addEventListener('click', e => { if(e.target.closest && e.target.closest('[data-tu-open-sync]')){ e.preventDefault(); openSync(); } });
  window.addEventListener('resize', () => { if(byId('tuHome')) scheduleLibrary(); }); // re-measures the "Show all tabs" toggle
  document.addEventListener('click', e => { const p = e.target.closest && e.target.closest('#tuHome .tu-more-panel button'); if(p) p.closest('details')?.removeAttribute('open'); });

  /* ---------- Form details sheet (board FormSheet), replaces the card's More menu ---------- */
  const sheetState = {id:null, tab:'overview', attempts:null, counts:null, returnTo:null, token:0};
  function ensureSheet(){
    let el = byId('tuSheet'); if(el) return el;
    el = document.createElement('div'); el.id = 'tuSheet'; el.hidden = true;
    el.innerHTML = '<div class="tu-scrim" data-tu-close></div><aside class="tu-sheet" role="dialog" aria-modal="true" aria-labelledby="tuSheetTitle"></aside>';
    (byId('menu') || document.body).appendChild(el);
    el.addEventListener('click', onSheetClick);
    el.addEventListener('keydown', e => {
      if(e.key === 'Escape'){ e.preventDefault(); closeSheet(); return; }
      if(e.key !== 'Tab') return;
      const f = Array.from(el.querySelectorAll('button:not(:disabled)')).filter(b => b.offsetParent !== null); if(!f.length) return;
      if(e.shiftKey && document.activeElement === f[0]){ e.preventDefault(); f[f.length - 1].focus(); }
      else if(!e.shiftKey && document.activeElement === f[f.length - 1]){ e.preventDefault(); f[0].focus(); }
    });
    return el;
  }
  async function loadSheetData(){
    const B = bridge(), id = sheetState.id, token = ++sheetState.token;
    sheetState.attempts = null; sheetState.counts = null;
    try{ const a = await B.attempts(id); if(token === sheetState.token){ sheetState.attempts = a; paintSheet(); } }catch(e){ if(token === sheetState.token){ sheetState.attempts = {attempts:[], error:true}; paintSheet(); } }
    try{ const c = await B.retestCounts(id); if(token === sheetState.token){ sheetState.counts = c; paintSheet(); } }catch(e){ if(token === sheetState.token){ sheetState.counts = {error:true}; paintSheet(); } }
  }
  function openSheet(id, from){
    const el = ensureSheet(); sheetState.id = id; sheetState.tab = 'overview'; sheetState.returnTo = from || null;
    el.hidden = false; paintSheet(); loadSheetData();
    setTimeout(() => el.querySelector('[data-tu-close].tu-round')?.focus(), 0);
  }
  function closeSheet(){
    const el = byId('tuSheet'); if(!el || el.hidden) return;
    el.hidden = true; sheetState.id = null; sheetState.token++;
    const back = sheetState.returnTo; sheetState.returnTo = null;
    const again = back && back.dataset.id ? document.querySelector(`#tuHome [data-tu-act="sheet"][data-id="${CSS.escape(back.dataset.id)}"]`) : null;
    (again || back)?.focus?.();
  }
  function paintSheet(){
    const el = byId('tuSheet'), B = bridge(); if(!el || el.hidden || !B) return;
    const rec = B.form(sheetState.id); if(!rec){ closeSheet(); return; }
    const tabsByKey = {}; libTabs().forEach(t => { tabsByKey[t.internal] = t; });
    const f = formInfo(rec, tabsByKey), card = legacyCard(f.id) || null;
    const has = sel => !card || !!card.querySelector(sel);
    const images = rec.optimized ? 'images optimized' + (rec.imageAssets ? ' · ' + plural(Number(rec.imageAssets), 'asset') : '') : 'original images';
    const head = `<div class="tu-sheet-head"><div class="tu-sheet-row"><span class="tu-chip-tab"><i style="background:${esc(f.color)}"></i>${esc(f.tabLabel + ' · ' + f.id)}</span><span class="tu-st ${f.st}">${ST_LABEL[f.st]}</span><span style="flex:1"></span><button type="button" class="tu-round" data-tu-close aria-label="Close">${icon('<path d="M6 6l12 12M18 6 6 18"/>', 20)}</button></div>` +
      `<div class="tu-sheet-title"><div><h2 id="tuSheetTitle">${esc(f.title)}</h2><span>${esc([plural(Number(rec.totalQuestions) || 0, 'question'), plural(f.blockCount, 'block'), f.attemptsText, images].join(' · '))}</span></div><button type="button" class="tu-round clear" data-tu-do="rename" aria-label="Rename form" title="Rename">${icon('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>', 20)}</button></div>` +
      `<div class="tu-sheet-tabs" role="tablist" aria-label="Form sections"><button type="button" role="tab" data-tu-tab="overview" aria-selected="${sheetState.tab === 'overview'}">Overview</button><button type="button" role="tab" data-tu-tab="manage" aria-selected="${sheetState.tab === 'manage'}">Manage</button></div></div>`;
    let body = '';
    if(sheetState.tab === 'overview'){
      const third = rec.type === 'N' ? [rec.threeDigitScore || '—', '3-digit'] : [f.answered + '%', 'Answered'];
      body += `<div class="tu-sheet-stats"><div><b>${f.score == null ? '—' : f.score + '%'}</b><span>Score</span></div><div><b>${esc(third[0])}</b><span>${third[1]}</span></div><div><b>${esc(f.blocks)}</b><span>Blocks</span></div><div><b>${f.marked}</b><span>Marked</span></div></div>`;
      body += `<div class="tu-sheet-actions">${f.canResume ? `<button type="button" class="tu-btn" data-tu-do="resume">${icon(ICONS.play, 18)}Resume</button><button type="button" class="tu-btn outline" data-tu-do="start">New attempt</button>` : `<button type="button" class="tu-btn" data-tu-do="start">${icon(ICONS.play, 18)}${f.startLabel}</button>`}${f.canReview ? `<button type="button" class="tu-btn tonal" data-tu-do="review">${icon('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', 18)}Review &amp; score report</button>` : ''}</div>`;
      const c = sheetState.counts;
      if(f.s.answered || f.s.completed){
        const tile = (pool, n, label) => `<button type="button" class="tu-retest" data-tu-retest="${pool}" ${c && !c.error && !n ? 'disabled' : ''}><b>${c ? (c.error ? '—' : n) : '…'}</b><span>${label}</span></button>`;
        body += `<section><h3>Retest from the active attempt</h3><span class="tu-sheet-note">Each retest is saved as its own attempt. The source attempt is never changed.</span><div class="tu-retests">${tile('wrongs', c && c.wrongs, 'Wrongs')}${tile('marked', c && c.marked, 'Marked')}${tile('wrongs_marked', c && c.wrongs_marked, 'Wrongs + marked')}</div></section>`;
      }
      const at = sheetState.attempts;
      let list = '<div class="tu-loading">Loading attempts…</div>';
      if(at && at.attempts){
        list = at.attempts.length ? `<div class="tu-list-box" role="radiogroup" aria-label="Active attempt">${at.attempts.map((a, i) => {
          const active = a.attemptId === at.activeAttemptId, sm = a.summary || {};
          const meta = [active ? 'Active' : '', sm.completed ? 'completed ' + shortDate(a.completedAt || sm.completedAt) : (sm.answered ? sm.answered + ' of ' + sm.total + ' answered' : 'not started'), plural(sm.blockCount || 1, 'block')].filter(Boolean).join(' · ');
          return `<button type="button" class="tu-attempt" role="radio" aria-checked="${active}" data-tu-attempt="${i + 1}"><span class="tu-radio"></span><div><b>${esc(a.label || 'Attempt ' + (i + 1))}</b><span>${esc(meta)}</span></div><strong>${sm.completed && sm.scorePct != null ? sm.scorePct + '%' : '—'}</strong></button>`;
        }).join('')}</div><span class="tu-sheet-note">The active attempt drives the card, meters and retests.</span>` : '<span class="tu-sheet-note">No attempts saved yet.</span>';
      }
      body += `<section><h3>Attempts</h3>${list}</section>`;
    } else {
      const rows = [];
      rows.push(`<div class="tu-rowi"><div><b>Library tab</b><span>Where this form appears and which meter it counts toward</span></div><strong>${esc(f.tabLabel)}</strong></div>`);
      if(rec.type === 'N') rows.push(`<div class="tu-rowi"><div><b>3-digit score</b><span>Shown on the card when enabled for this tab</span></div><strong>${esc(rec.threeDigitScore || '—')}</strong>${has('[data-action="score3"]') ? '<button type="button" class="tu-btn outline small" data-tu-do="score3">Edit</button>' : ''}</div>`);
      rows.push(`<div class="tu-rowi"><div><b>Progress file</b><span>Move this form’s attempts as a single file</span></div><button type="button" class="tu-btn outline small" data-tu-do="import-save">Import</button>${f.s.answered || f.s.completed ? '<button type="button" class="tu-btn outline small" data-tu-do="export-save">Export</button>' : ''}</div>`);
      rows.push(`<div class="tu-rowi"><div><b>Images</b><span>${rec.optimized ? 'Optimized' + (rec.imageAssets ? ' · ' + esc(plural(Number(rec.imageAssets), 'asset')) : '') : 'Original images inside the form file'}</span></div><button type="button" class="tu-btn outline small" data-tu-do="optimize">${rec.optimized ? 'Optimize again' : 'Optimize'}</button></div>`);
      body += `<div class="tu-rows">${rows.join('')}</div>`;
      body += `<section class="tu-danger"><h3>Danger zone</h3><span class="tu-sheet-note">Each action asks for confirmation first.</span><div>${f.s.attemptCount || f.s.answered ? '<button type="button" class="tu-btn danger" data-tu-do="delete-attempt">Delete active attempt</button><button type="button" class="tu-btn danger" data-tu-do="delete-progress">Delete all progress</button>' : ''}<button type="button" class="tu-btn dangerfill" data-tu-do="delete">Remove form</button></div></section>`;
    }
    const html = head + `<div class="tu-sheet-body">${body}</div>`;
    const box = el.querySelector('.tu-sheet');
    if(box.dataset.html === html) return;
    const scroll = box.querySelector('.tu-sheet-body')?.scrollTop || 0, focusKey = document.activeElement && box.contains(document.activeElement) ? ['tuDo', 'tuTab', 'tuRetest', 'tuAttempt'].map(k => document.activeElement.dataset[k] ? `[data-${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}="${document.activeElement.dataset[k]}"]` : '').find(Boolean) || (document.activeElement.hasAttribute('data-tu-close') ? '.tu-round[data-tu-close]' : '') : '';
    box.innerHTML = html; box.dataset.html = html;
    const b2 = box.querySelector('.tu-sheet-body'); if(b2) b2.scrollTop = scroll;
    if(focusKey) box.querySelector(focusKey)?.focus();
  }
  const SHEET_ACTIONS = {start:'[data-action="start"]', resume:'[data-action="resume"]', review:'[data-action="review"]', rename:'[data-action="rename"]', 'import-save':'[data-action="import-save"]', 'export-save':'[data-action="export-save"]', optimize:'[data-action="optimize"]', score3:'[data-action="score3"]', 'delete-attempt':'[data-v9="delete-attempt"]', 'delete-progress':'[data-action="delete-progress"]', delete:'[data-action="delete"]'};
  const LEAVES = ['start', 'resume', 'review', 'delete'];
  async function onSheetClick(e){
    const t = e.target.closest('button, [data-tu-close]'); if(!t) return;
    if(t.hasAttribute('data-tu-close')){ closeSheet(); return; }
    const id = sheetState.id; if(!id) return;
    if(t.dataset.tuTab){ sheetState.tab = t.dataset.tuTab; paintSheet(); return; }
    if(t.dataset.tuDo){
      const act = t.dataset.tuDo, sel = SHEET_ACTIONS[act]; if(!sel) return;
      if(LEAVES.includes(act)) closeSheet();
      await cardAction(id, sel);
      if(!LEAVES.includes(act)) setTimeout(() => { if(sheetState.id === id) loadSheetData(); }, 400);
      return;
    }
    if(t.dataset.tuRetest){
      // A retest is a new attempt with a question pool: open the existing setup, then choose the pool there.
      const pool = t.dataset.tuRetest; closeSheet();
      if(!await cardAction(id, '[data-action="start"]')) return;
      for(let i = 0; i < 1200; i++){
        const s = bridge().setup ? bridge().setup() : null, radio = s && document.querySelector(`input[name="${CSS.escape(s.poolInput)}"][value="${CSS.escape(pool)}"]`);
        if(radio){ if(!radio.checked){ radio.checked = true; radio.dispatchEvent(new Event('change', {bubbles:true})); } return; }
        if(byId('examScreen') && !byId('examScreen').classList.contains('hidden')) return;
        await wait(50);
      }
      return;
    }
    if(t.dataset.tuAttempt && t.getAttribute('aria-checked') !== 'true'){
      if(await cardAction(id, '[data-v9="attempts"]')) await answerPrompt(t.dataset.tuAttempt);
      setTimeout(() => { if(sheetState.id === id) loadSheetData(); }, 400);
    }
  }

  /* ---------- Start dialog and Quick practice (A23 Phase B: boards StartSetup, StartSetupiPad, QuickPractice) ----------
     Both views are drawn from the hidden legacy setup controls and write back through them (value + change event, or a
     click on the legacy button), so renderMenu, the linked-safe shuffle, retest pools and startTest still do the work.
     The legacy New Attempt box is rebuilt on every renderMenu, so its inputs are driven in place rather than moved. */
  const SIZE_LABELS = {all:'All in one', original:'Blocks from files'};
  const POOLS = [['all', 'All questions'], ['wrongs', 'Wrongs'], ['marked', 'Marked'], ['wrongs_marked', 'Wrongs + marked']];
  const CARRY = [['hl', 'Stem highlights'], ['st', 'Strikethroughs'], ['mk', 'Marked flags']]; // the checkbox IDs come from StepLibraryBridge.setup().carry
  const SW_IDS = {timer:'enableTimer', shuffle:'shuffleQuestions', correct:'showCorrect', brk:'enableBreak'};
  const BRK = {bank:{step:5, min:5, max:240}, each:{step:1, min:1, max:60}};
  const setupUi = {brkMin:{bank:60, each:10}};
  const check = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>';
  const closeIco = icon('<path d="M6 6l12 12M18 6 6 18"/>', 20);
  function setupModel(){
    const sel = byId('blockSizeSelect'), sh = byId('shuffleQuestions'), start = byId('startFull');
    const spq = Math.max(15, parseInt(byId('secondsPerQuestion')?.value, 10) || 90);
    const blocks = Array.from(document.querySelectorAll('#blocksTable tbody tr[data-i]')).map(tr => {
      const td = tr.querySelectorAll('td'), n = parseInt(td[2]?.textContent, 10) || 0, i = Number(tr.dataset.i);
      const name = (td[1]?.textContent || '').trim() || 'Block ' + (i + 1);
      // legacy names: "Custom Block 2 (41–80)", "Full Test (1–200)"; the board shows "Block 2" and "Q41–80"
      const cm = name.match(/^Custom Block (\d+) \((\d+)\s*[–-]\s*(\d+)\)$/), fm = name.match(/^Full Test \((\d+)\s*[–-]\s*(\d+)\)$/);
      const short = cm ? 'Block ' + cm[1] : fm ? 'Full test' : name, range = cm ? `Q${cm[2]}–${cm[3]}` : fm ? `Q${fm[1]}–${fm[2]}` : '';
      return {i, name, short, range, n, min:Math.max(1, Math.round(n * spq / 60)), selected:tr.classList.contains('selected')};
    });
    return {
      size: sel ? sel.value : '', sizes: sel ? Array.from(sel.options).map(o => [o.value, SIZE_LABELS[o.value] || o.value]) : [], spq,
      timer: !!byId('enableTimer')?.checked, correct: !!byId('showCorrect')?.checked, shuffle: !!sh?.checked, hasShuffle: !!sh,
      brk: !!byId('enableBreak')?.checked, brkMin: Math.max(0, parseInt(byId('breakMinutes')?.value, 10) || 0), brkMode: byId('breakMode')?.value === 'each' ? 'each' : 'bank', hasBrkMode: !!byId('breakMode'),
      blocks, ready: !!start && !start.disabled
    };
  }
  function setLegacy(id, value){
    const el = byId(id); if(!el) return false;
    if(el.type === 'checkbox'){ if(el.checked === !!value) return false; el.checked = !!value; }
    else { if(String(el.value) === String(value)) return false; el.value = String(value); }
    el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true}));
    return true;
  }
  function planText(m){
    const b = m.blocks; if(!b.length) return '';
    if(b.every(x => x.n === b[0].n)) return `${plural(b.length, 'block')} × ${b[0].n} Qs · ${b[0].min} min${b.length > 1 ? ' each' : ''}`;
    return `${plural(b.length, 'block')} · ${b.reduce((n, x) => n + x.n, 0)} Qs · up to ${Math.max(...b.map(x => x.n))} per block`;
  }
  const switchHtml = (key, on, label) => `<button type="button" class="tu-switch" role="switch" aria-checked="${on}" aria-label="${esc(label)}" data-tu-sw="${key}"><i></i></button>`;
  const stepper = (key, text, what) => `<div class="tu-stepper"><button type="button" data-tu-step="${key}" data-d="-1" aria-label="Less ${what}">−</button><span>${esc(text)}</span><button type="button" data-tu-step="${key}" data-d="1" aria-label="More ${what}">+</button></div>`;
  const chip = (attr, value, label, on, role) => `<button type="button" class="tu-chip" ${role ? `role="${role}" aria-checked="${on}"` : `aria-pressed="${on}"`} data-${attr}="${esc(value)}">${role ? '' : (on ? check : '')}${esc(label)}</button>`;
  function sizesHtml(m, keepOriginal){
    return `<div class="tu-chips" role="radiogroup" aria-label="Block size">${m.sizes.filter(([v]) => v !== 'original' || keepOriginal).map(([v, l]) => chip('tu-size', v, l, m.size === v, 'radio')).join('')}</div>`;
  }
  function breakControls(m){
    if(!m.brk) return '';
    const mode = m.brkMode, modes = m.hasBrkMode ? `<div class="tu-seg2" role="radiogroup" aria-label="Break type">${[['bank', 'Shared break bank'], ['each', 'After each block']].map(([v, l]) => `<button type="button" role="radio" aria-checked="${mode === v}" data-tu-brkmode="${v}">${l}</button>`).join('')}</div>` : '';
    return `<div class="tu-brk-row">${modes}${stepper('brkmin', m.brkMin + (mode === 'bank' ? ' min total' : ' min each'), 'break time')}</div>`;
  }
  function breakHint(m){ return !m.brk ? 'Off: the next block starts right away' : m.brkMode === 'bank' ? 'One pool of break time for the whole sitting, like test day' : 'The same fixed break after every block'; }
  // Setup controls shared by the start dialog and Quick practice. Returns true when it handled the click.
  function setupAction(t){
    const m = setupModel(), d = Number(t.dataset.d) || 0;
    if(t.dataset.tuSw){
      const on = t.getAttribute('aria-checked') !== 'true' && t.getAttribute('aria-pressed') !== 'true';
      setLegacy(SW_IDS[t.dataset.tuSw], on);
      if(t.dataset.tuSw === 'brk' && on && !m.brkMin) setLegacy('breakMinutes', setupUi.brkMin[m.brkMode]);
      return true;
    }
    if(t.dataset.tuSize){ setLegacy('blockSizeSelect', t.dataset.tuSize); return true; }
    if(t.dataset.tuStep === 'spq'){ setLegacy('secondsPerQuestion', Math.max(15, Math.min(300, m.spq + 5 * d))); return true; }
    if(t.dataset.tuStep === 'brkmin'){ const r = BRK[m.brkMode], base = m.brkMin || setupUi.brkMin[m.brkMode]; setLegacy('breakMinutes', Math.max(r.min, Math.min(r.max, base + r.step * d))); setupUi.brkMin[m.brkMode] = Number(byId('breakMinutes')?.value) || base; return true; }
    if(t.dataset.tuBrkmode){
      const mode = t.dataset.tuBrkmode; if(mode === m.brkMode) return true;
      if(m.brkMin) setupUi.brkMin[m.brkMode] = m.brkMin;
      setLegacy('breakMode', mode); setLegacy('breakMinutes', setupUi.brkMin[mode]);
      return true;
    }
    return false;
  }
  // Re-renders a region only when its markup changed, keeping keyboard focus and scroll position.
  function swapHtml(box, html){
    if(!box || box.dataset.html === html) return false;
    const a = document.activeElement, scrollers = Array.from(box.querySelectorAll('[data-tu-scroll]')).map(s => [s.dataset.tuScroll, s.scrollTop]);
    let key = '';
    if(a && a !== box && box.contains(a)) key = Array.from(a.attributes).filter(x => /^data-tu|^id$|^data-d$/.test(x.name)).map(x => `[${x.name}="${CSS.escape(x.value)}"]`).join('');
    box.innerHTML = html; box.dataset.html = html;
    scrollers.forEach(([k, top]) => { const s = box.querySelector(`[data-tu-scroll="${k}"]`); if(s) s.scrollTop = top; });
    if(key) box.querySelector(key)?.focus();
    return true;
  }
  function trapKeys(e, el, close){
    if(e.key === 'Escape'){ e.preventDefault(); close(); return; }
    if(e.key !== 'Tab') return;
    const f = Array.from(el.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')).filter(b => b.offsetParent !== null || b.type === 'file'); if(!f.length) return;
    if(e.shiftKey && document.activeElement === f[0]){ e.preventDefault(); f[f.length - 1].focus(); }
    else if(!e.shiftKey && document.activeElement === f[f.length - 1]){ e.preventDefault(); f[0].focus(); }
  }
  function dialogLayer(id, cls, labelledBy, onClick, onClose){
    let el = byId(id); if(el) return el;
    el = document.createElement('div'); el.id = id; el.className = 'tu-layer'; el.hidden = true;
    el.innerHTML = `<div class="tu-scrim" data-tu-close></div><div class="tu-dialog-wrap"><section class="tu-dialog ${cls}" role="dialog" aria-modal="true" aria-labelledby="${labelledBy}"></section></div>`;
    (byId('menu') || document.body).appendChild(el);
    el.addEventListener('click', onClick);
    el.addEventListener('keydown', e => trapKeys(e, el, onClose));
    return el;
  }

  /* start / new attempt dialog: opens over the Library whenever the legacy New Attempt setup is showing */
  const startUi = {open:false, token:'', formId:'', run:'all', one:0, chosen:new Set(), carry:{hl:true, st:true, mk:false}, size:null, started:new Set(), ran:false, focus:false};
  let startQueued = false;
  function scheduleStart(){ if(startQueued) return; startQueued = true; requestAnimationFrame(() => { startQueued = false; try{ checkStart(); }catch(e){ console.warn('ThunderUI start dialog failed', e); } }); }
  function checkStart(){
    const menu = byId('menu'), B = bridge();
    let setup = B && B.setup ? B.setup() : null; if(setup && !byId(setup.box)) setup = null; // the legacy box is drawn by renderMenu
    const showing = !!setup && !!menu && !menu.classList.contains('hidden') && !!byId('quickModePanel')?.classList.contains('active');
    const menuHidden = !menu || menu.classList.contains('hidden');
    if(startUi.open && menuHidden){ startUi.started.add(startUi.token); startUi.ran = true; } // the menu hides when a run starts
    // Back from a run this dialog started: the legacy menu reopens on Quick practice, so return to the Library.
    if(startUi.ran && !menuHidden){
      startUi.ran = false;
      if(byId('quickModePanel')?.classList.contains('active')){ closeStartView(); byId('libraryTab')?.click(); return; }
    }
    if(!showing){ closeStartView(); return; }
    const token = setup.token + ':' + setup.formId;
    if(startUi.started.has(token)){ closeStartView(); byId('libraryTab')?.click(); return; }
    if(!startUi.open || startUi.token !== token) openStart(token, setup);
    paintStart();
  }
  function openStart(token, setup){
    const el = dialogLayer('tuStart', 'tu-start', 'tuStartTitle', onStartClick, cancelStart);
    Object.assign(startUi, {open:true, token, formId:setup.formId, run:'all', one:0, chosen:new Set(), carry:{hl:true, st:true, mk:false}});
    // Default to the form's suggested block size (the New Attempt setup otherwise falls back to one block of everything).
    const rec = bridge().form(setup.formId), sel = byId('blockSizeSelect'), want = rec && rec.suggestedBlockSize ? String(rec.suggestedBlockSize) : '';
    startUi.size = want && sel && Array.from(sel.options).some(o => o.value === want) ? want : null;
    el.hidden = false; byId('menu').dataset.tuStart = '1'; heroTitle();
    startUi.focus = true; // focus moves to Close after the first paint
  }
  function closeStartView(){
    if(!startUi.open) return;
    startUi.open = false; startUi.token = '';
    const el = byId('tuStart'); if(el){ el.hidden = true; const box = el.querySelector('.tu-start'); box.innerHTML = ''; box.dataset.html = ''; }
    const menu = byId('menu'); if(menu) delete menu.dataset.tuStart;
    heroTitle();
  }
  function cancelStart(){
    const id = startUi.formId; closeStartView();
    byId('libraryTab')?.click(); // leaving the Quick practice panel clears the legacy setup
    setTimeout(() => document.querySelector(`#tuHome [data-tu-act][data-id="${CSS.escape(id)}"]`)?.focus(), 60);
  }
  function startPicked(m){
    if(m.blocks.length <= 1 || startUi.run === 'all') return m.blocks;
    if(startUi.run === 'one') return m.blocks.filter(b => b.i === startUi.one);
    return m.blocks.filter(b => startUi.chosen.has(b.i));
  }
  function paintStart(){
    const el = byId('tuStart'), B = bridge(); if(!el || el.hidden || !B) return;
    const setup = B.setup(); if(!setup) return;
    const m = setupModel();
    if(startUi.size && m.size !== startUi.size && m.sizes.some(s => s[0] === startUi.size)){ setLegacy('blockSizeSelect', startUi.size); return; } // repaints after renderMenu
    const n = m.blocks.length;
    startUi.chosen = new Set([...startUi.chosen].filter(i => i < n)); if(startUi.one >= n) startUi.one = 0;
    const tabsByKey = {}; libTabs().forEach(t => { tabsByKey[t.internal] = t; });
    const rec = B.form(setup.formId), f = rec ? formInfo(rec, tabsByKey) : {title:setup.formId, tabLabel:''};
    const kicker = [f.tabLabel, setup.formId, setup.attemptLabel].filter(Boolean).join(' · ');
    const sub = setup.pool !== 'all' && setup.sourceLabel ? `A retest from “${esc(setup.sourceLabel)}”, saved as its own attempt. The source attempt stays untouched.`
      : setup.sourceLabel ? `Saved as a separate attempt. “${esc(setup.sourceLabel)}” and earlier attempts stay untouched.` : 'This becomes the first attempt for this form.';
    const c = setup.counts || {};
    const pools = POOLS.map(([id, label]) => { const k = Number(c[id]) || 0, on = setup.pool === id; return `<button type="button" class="tu-pool" role="radio" aria-checked="${on}" data-tu-pool="${id}"${id !== 'all' && !k ? ' disabled' : ''}><b>${k}</b><span>${label}</span></button>`; }).join('');
    const carry = setup.sourceLabel ? `<div class="tu-carry"><span>Carry over from “${esc(setup.sourceLabel)}”</span>${CARRY.map(([k, l]) => chip('tu-carry', k, l, !!startUi.carry[k])).join('')}</div>` : '';
    const quick = B.quick ? B.quick() : null;
    const picked = startPicked(m), qs = picked.reduce((s, b) => s + b.n, 0), mins = picked.reduce((s, b) => s + b.min, 0);
    let runHtml = '';
    if(n > 1){
      const modes = [['all', 'All blocks', 'In order, one sitting'], ['one', 'One block', 'Pick a single block'], ['choose', 'Choose blocks', 'Any combination, in order']]
        .map(([id, l, h]) => `<button type="button" class="tu-runmode" role="radio" aria-checked="${startUi.run === id}" data-tu-run="${id}"><b>${l}</b><span>${h}</span></button>`).join('');
      const one = startUi.run === 'one';
      const list = startUi.run === 'all' ? '' : `<div class="tu-blocklist" role="${one ? 'radiogroup' : 'group'}" aria-label="${one ? 'Block to run' : 'Blocks to run'}">${m.blocks.map(b => { const on = one ? startUi.one === b.i : startUi.chosen.has(b.i); return `<button type="button" class="tu-blockpick${one ? ' one' : ''}" role="${one ? 'radio' : 'checkbox'}" aria-checked="${on}" data-tu-block="${b.i}" title="${esc(b.name)}"><i>${on && !one ? check : ''}</i><span><b>${esc(b.short)}</b><small>${b.n} Qs · ${b.min} min</small></span></button>`; }).join('')}</div>` +
        (startUi.run === 'choose' && !picked.length ? '<span class="tu-note">Pick one or more blocks. They run in order, with breaks between them.</span>' : '');
      runHtml = `<section><h3>Blocks to run</h3><div class="tu-runmodes" role="radiogroup" aria-label="Blocks to run">${modes}</div>${list}</section>`;
    } else if(n === 1){
      runHtml = `<section><h3>Blocks to run</h3><span class="tu-note">One block · ${m.blocks[0].n} Qs · ${m.blocks[0].min} min. Choose a smaller block size to split it.</span></section>`;
    }
    const sw = [['timer', 'Timer', 'Block and day countdowns, like test day', m.timer], m.hasShuffle ? ['shuffle', 'Shuffle questions', 'Linked case sets always stay together and in order', m.shuffle] : null, ['correct', 'Show correct answer after each item', 'Tutor-style feedback while you work', m.correct]]
      .filter(Boolean).map(([k, l, h, on]) => `<div class="tu-swrow"><div><b>${l}</b><span>${h}</span></div>${switchHtml(k, on, l)}</div>`).join('');
    const label = n <= 1 ? 'Start' : picked.length === 1 ? 'Start block' : `Start ${picked.length} blocks`;
    const summary = `${qs} questions · ${plural(picked.length, 'block')}${m.timer ? ' · ' + mins + ' min' : ' · untimed'}${m.brk && m.brkMin && picked.length > 1 ? ' + breaks' : ''}`;
    const html = `<header class="tu-dlg-head"><div><span class="tu-kicker">${esc(kicker)}</span><h2 id="tuStartTitle">Start ${esc(f.title)}</h2><span class="tu-sub">${sub}</span></div><button type="button" class="tu-round" data-tu-close aria-label="Close">${closeIco}</button></header>` +
      `<div class="tu-dlg-body tu-start-grid" data-tu-scroll="body"><div class="tu-col">` +
        `<section><h3>Questions</h3><div class="tu-pools" role="radiogroup" aria-label="Question pool">${pools}</div>${carry}</section>` +
        `<section><h3>Blocks &amp; timing</h3>${sizesHtml(m, quick && quick.sourceBlocks > 1)}<div class="tu-inline">${stepper('spq', m.spq + ' sec / Q', 'time per question')}<span class="tu-plan">${esc(planText(m))}</span></div></section>` +
        `<section class="tu-brk"><div class="tu-swrow"><div><b>Breaks between blocks</b><span>${breakHint(m)}</span></div>${switchHtml('brk', m.brk, 'Breaks between blocks')}</div>${breakControls(m)}</section>` +
      `</div><div class="tu-col">${runHtml}<section class="tu-switches">${sw}</section></div></div>` +
      `<footer class="tu-dlg-foot"><div><b>${esc(summary)}</b><span>Progress saves automatically after every answer.</span></div><button type="button" class="tu-btn tu-go" data-tu-go${!m.ready || !picked.length ? ' disabled' : ''}>${icon(ICONS.play, 18)}${label}</button></footer>`;
    swapHtml(el.querySelector('.tu-start'), html);
    if(startUi.focus){ startUi.focus = false; el.querySelector('.tu-start [data-tu-close]')?.focus(); }
  }
  function applyCarry(){ const s = bridge().setup(); if(s) CARRY.forEach(([k], i) => { const el = byId(s.carry[i]); if(el) el.checked = !!startUi.carry[k]; }); }
  function goStart(){
    const m = setupModel(); if(!m.ready || !m.blocks.length) return;
    const token = startUi.token, picked = startPicked(m).map(b => b.i); if(!picked.length) return;
    if(picked.length === 1 && m.blocks.length > 1){
      document.querySelector(`#blocksTable tbody tr[data-i="${picked[0]}"]`)?.click(); // selects it (renderMenu)
      applyCarry(); byId('startSelected')?.click();
    } else if(picked.length < m.blocks.length && typeof window.startChosenBlocks === 'function'){
      applyCarry(); window.startChosenBlocks(picked);
    } else { applyCarry(); byId('startFull')?.click(); }
    if(byId('menu')?.classList.contains('hidden')){ startUi.started.add(token); startUi.ran = true; }
    scheduleStart();
  }
  function onStartClick(e){
    const t = e.target.closest('button, [data-tu-close]'); if(!t || t.disabled) return;
    if(t.hasAttribute('data-tu-close')){ cancelStart(); return; }
    if(t.dataset.tuPool){
      const s = bridge().setup(), r = s && document.querySelector(`input[name="${CSS.escape(s.poolInput)}"][value="${CSS.escape(t.dataset.tuPool)}"]`);
      if(r && !r.disabled && !r.checked){ r.checked = true; r.dispatchEvent(new Event('change', {bubbles:true})); }
      return;
    }
    if(t.dataset.tuCarry){ startUi.carry[t.dataset.tuCarry] = !startUi.carry[t.dataset.tuCarry]; paintStart(); return; }
    if(t.dataset.tuSize) startUi.size = t.dataset.tuSize;
    if(setupAction(t)){ paintStart(); return; }
    if(t.dataset.tuRun){ startUi.run = t.dataset.tuRun; paintStart(); return; }
    if(t.dataset.tuBlock != null){
      const i = Number(t.dataset.tuBlock);
      if(startUi.run === 'one') startUi.one = i; else if(startUi.chosen.has(i)) startUi.chosen.delete(i); else startUi.chosen.add(i);
      paintStart(); return;
    }
    if(t.hasAttribute('data-tu-go')) goStart();
  }

  /* Quick practice (replaces the Quick Import panel; the legacy panel stays in the DOM, off-screen) */
  let quickQueued = false, quickObserver = null;
  function scheduleQuick(){ if(quickQueued) return; quickQueued = true; requestAnimationFrame(() => { quickQueued = false; try{ paintQuick(); }catch(e){ console.warn('ThunderUI quick practice failed', e); } }); }
  function ensureQuick(panel){
    let q = byId('tuQuick'); if(q) return q;
    q = document.createElement('div'); q.id = 'tuQuick';
    panel.insertBefore(q, panel.firstChild);
    q.addEventListener('click', onQuickClick);
    q.addEventListener('dragover', e => { const z = e.target.closest && e.target.closest('.tu-drop'); if(!z) return; e.preventDefault(); z.classList.add('tu-drag'); });
    q.addEventListener('dragleave', e => { e.target.closest && e.target.closest('.tu-drop')?.classList.remove('tu-drag'); });
    q.addEventListener('drop', e => {
      const z = e.target.closest && e.target.closest('.tu-drop'); if(!z) return;
      e.preventDefault(); z.classList.remove('tu-drag');
      const files = e.dataTransfer && e.dataTransfer.files, input = byId('fileInput'); if(!files || !files.length || !input) return;
      try{ const dt = new DataTransfer(); Array.from(files).forEach(f => dt.items.add(f)); input.files = dt.files; input.dispatchEvent(new Event('change', {bubbles:true})); }
      catch(err){ byId('dropZone')?.dispatchEvent(new DragEvent('drop', {dataTransfer:e.dataTransfer, bubbles:true, cancelable:true})); }
    });
    return q;
  }
  const visible = el => !!el && !el.disabled && !el.classList.contains('hidden') && !el.closest('.hidden');
  function quickHtml(){
    const B = bridge(), info = B && B.quick ? B.quick() : null, bank = info && !info.library ? info : null;
    const m = setupModel();
    const saveBtns = [['loadSaveReview', 'Load save & review', 'tonal'], ['exportSave', 'Export save', 'outline'], ['manualImportSave', 'Import a save file', 'outline'], ['deleteSave', 'Delete save', 'dangertext']].filter(([id]) => visible(byId(id)) && (bank || id === 'manualImportSave'));
    const canSave = saveBtns.length > 0;
    const banner = `<div class="tu-banner" role="note">${icon('<path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17h.01"/>', 22)}<span>${canSave ? 'Temporary: answers, highlights and scores here are not saved to your library. Export a save file if you need it later.' : 'Temporary: answers, highlights and scores here are not saved. Add the bank to your library to keep your progress.'}</span><button type="button" class="tu-link" data-tu-open-add>Add to library instead</button></div>`;
    const resume = byId('resumeQuickSession'), canResume = bank && resume && !resume.disabled;
    let left = `<button type="button" class="tu-drop" data-tu-proxy="fileInput"><span class="tu-drop-ico">${icon(ICONS.upload, 28)}</span><b>Drop JSON files or choose</b><span>blocks[], questions[] or a plain question array. Several files merge in natural filename order.</span></button>`;
    if(bank){
      const linked = (byId('bankStatus')?.querySelector('.v215-linked-summary')?.textContent || '');
      const lm = linked.match(/Detected (\d+) linked set/), ltxt = lm ? plural(Number(lm[1]), 'linked set') + ' kept together' : /No linked-set/.test(linked) ? 'no linked sets' : '';
      const title = bank.files.length > 1 ? `${bank.files[0]} + ${bank.files.length - 1} more` : (bank.files[0] || bank.title);
      left += `<section class="tu-card tu-qbank"><span class="tu-okico">${check}</span><span class="tu-qbank-text"><b title="${esc(bank.title)}">${esc(title)}</b><span>${esc([bank.total + ' questions', plural(bank.sourceBlocks, 'source block'), ltxt].filter(Boolean).join(' · '))}</span></span>${visible(byId('clearBank')) ? '<button type="button" class="tu-btn outline small" data-tu-proxy="clearBank">Clear</button>' : ''}</section>`;
    }
    if(canSave){
      const sv = bank && bank.save;
      const note = !bank ? 'Import the same bank first, then load or import its save to review it.' : sv ? `A save from ${esc(shortDate(sv.updatedAt) || 'earlier')} matches this exact set (${sv.completed} of ${plural(sv.blocks, 'block')} completed).` : 'No save yet for this exact set.';
      left += `<section class="tu-card tu-qsave"><h2>Save file</h2><span class="tu-note">${note}</span><div class="tu-actions">${saveBtns.map(([id, l, cls]) => `<button type="button" class="tu-btn small ${cls}" data-tu-proxy="${id}">${esc(l)}</button>`).join('')}</div></section>`;
    }
    let run;
    if(bank && m.blocks.length){
      const blocks = `<div class="tu-qblocks" role="radiogroup" aria-label="Block to run">${m.blocks.map(b => `<button type="button" role="radio" aria-checked="${b.selected}" data-tu-qblock="${b.i}" title="${esc(b.name)}"><i></i><b>${esc(b.short + (b.range ? ' · ' + b.range : ''))}</b><span>${b.n} Qs · ${b.min} min</span></button>`).join('')}</div>`;
      const chips = [['timer', 'Timer', m.timer], m.hasShuffle ? ['shuffle', 'Shuffle', m.shuffle] : null, ['correct', 'Show correct answers', m.correct], ['brk', m.brk ? `Breaks · ${m.brkMin} min${m.brkMode === 'each' ? ' each' : ''}` : 'Breaks', m.brk]].filter(Boolean)
        .map(([k, l, on]) => `<button type="button" class="tu-chip" aria-pressed="${on}" data-tu-sw="${k}">${on ? check : ''}${esc(l)}</button>`).join('');
      run = `<div class="tu-field"><span>Block size</span>${sizesHtml(m, bank.sourceBlocks > 1)}</div><div class="tu-inline">${stepper('spq', m.spq + ' sec / Q', 'time per question')}<span class="tu-plan">${esc(planText(m))}</span></div>` +
        `<div class="tu-chips">${chips}</div>${breakControls(m)}<div class="tu-field"><span>Blocks</span>${blocks}</div>` +
        `<div class="tu-qstart">${canResume ? '<button type="button" class="tu-btn outline" data-tu-proxy="resumeQuickSession">Resume suspended test</button>' : ''}<button type="button" class="tu-btn outline" data-tu-proxy="startSelected"${byId('startSelected')?.disabled ? ' disabled' : ''}>Start selected block</button><button type="button" class="tu-btn" data-tu-proxy="startFull"${m.ready ? '' : ' disabled'}>${icon(ICONS.play, 18)}Start all blocks</button></div>`;
    } else {
      run = `<div class="tu-qempty">${icon(ICONS.quick, 28)}<b>No bank loaded</b><span>Drop or choose JSON files to set up blocks, timing and breaks.</span></div>`;
    }
    return `<header class="tu-qhead"><h1>Quick practice</h1><span>Drop any compatible JSON bank and start right away.</span></header>${banner}` +
      `<div class="tu-qgrid"><div class="tu-qcol">${left}</div><section class="tu-card tu-run" aria-label="Run setup"><h2>Run setup</h2>${run}</section></div>`;
  }
  function paintQuick(){
    const panel = byId('quickModePanel'), B = bridge(); if(!panel || !B || !B.quick) return;
    const q = ensureQuick(panel); panel.classList.add('tu-has-quick');
    swapHtml(q, quickHtml());
    if(quickObserver) quickObserver.takeRecords();
  }
  function onQuickClick(e){
    const t = e.target.closest('button'); if(!t || t.disabled) return;
    if(t.hasAttribute('data-tu-open-add')){ openAdd('slot', t); return; }
    if(t.dataset.tuQblock != null){ document.querySelector(`#blocksTable tbody tr[data-i="${CSS.escape(t.dataset.tuQblock)}"]`)?.click(); scheduleQuick(); return; }
    if(setupAction(t)) scheduleQuick();
  }

  /* ---------- Qbank (boards Qbank, QbankHistory) ----------
     #tuQbank (build a test) and #tuQtests (history) sit in the legacy Qbank panels, which stay in the DOM off-screen.
     Values come from the legacy controls and StepLibraryBridge.qbank(); every control sets the hidden legacy input or
     clicks its button, so pools, used-history, test records and saves still run through the v9/v10/v10.3 code. */
  const QB_POOLS = [['unused', 'Unused'], ['used', 'Used'], ['wrongs', 'Wrongs'], ['marked', 'Marked'], ['wrongs_marked', 'Wrongs + marked'], ['all', 'All']];
  const QB_ATTEMPTS = {
    qbank: [['completed_qbank', 'Completed Qbank tests'], ['latest_qbank', 'Latest Qbank test'], ['all_qbank', 'All Qbank tests']],
    linked: [['first', '1st attempts only'], ['latest_completed', 'Latest completed'], ['active', 'Active selected']]
  };
  // legacy values outside a source's list behave like these (v10 qHist / attemptFor fall through to them)
  const QB_ATTEMPT_FALLBACK = {qbank:'completed_qbank', linked:'active'};
  const QB_FILTERS = [['all', 'All'], ['progress', 'In progress'], ['completed', 'Completed'], ['testing', 'Testing'], ['tutor', 'Tutor'], ['linked', 'From Form Library'], ['separate', 'Separate Qbank']];
  const QB_ICONS = {pencil:'<path d="M4 20h4L19 9l-4-4L4 16z"/>', trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', refresh:'<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>'};
  const qbUi = {data:null, stale:true, seq:0, q:'', open:{}, missing:''};
  let qbQueued = false;
  const qbObservers = [];
  function scheduleQbank(fresh){
    if(fresh) qbUi.stale = true;
    if(qbQueued) return; qbQueued = true;
    requestAnimationFrame(() => { qbQueued = false; paintQbank().catch(e => console.warn('ThunderUI qbank failed', e)); });
  }
  const qbVal = id => { const el = byId(id); return el ? (el.type === 'checkbox' ? el.checked : el.value) : null; };
  const qbLegacyForms = () => Array.from(document.querySelectorAll('#qbankFormList input[data-qbank-form]'));
  function qbWatch(){
    ['qbankModePanel', 'qbankTestsPanel'].forEach(id => {
      const p = byId(id); if(!p || p.dataset.tuWatched) return;
      p.dataset.tuWatched = '1';
      const view = id === 'qbankModePanel' ? 'tuQbank' : 'tuQtests';
      const o = new MutationObserver(recs => {
        if(!recs.some(r => !(r.target.closest && r.target.closest('#' + view)))) return;
        if(openedNow(recs, p) || (p.classList.contains('active') && !p.querySelector(':scope > #' + view))){ qbUi.stale = true; paintQbank().catch(e => console.warn('ThunderUI qbank failed', e)); }
        else scheduleQbank(true);
      });
      o.observe(p, {childList:true, subtree:true, attributes:true, attributeOldValue:true, attributeFilter:['class', 'max', 'disabled']});
      qbObservers.push(o);
    });
  }
  function qbHeadHtml(which, count){
    const sub = which === 'build' ? 'Mix questions across forms. Qbank keeps its own history and never edits your form attempts.' : 'Every generated test, newest first. Resume, review, rename, export or delete.';
    const refresh = which === 'history' ? `<button type="button" class="tu-qticon" data-tu-qtrefresh aria-label="Refresh the test list" title="Refresh">${icon(QB_ICONS.refresh, 18)}</button>` : '';
    return `<header class="tu-qbhead"><div><h1>Qbank</h1><span>${sub}</span></div><div class="tu-qbhead-r">${refresh}<div class="tu-qbtabs" role="tablist" aria-label="Qbank views">` +
      `<button type="button" role="tab" aria-selected="${which === 'build'}" data-tu-qbtab="build">Build test</button>` +
      `<button type="button" role="tab" aria-selected="${which === 'history'}" data-tu-qbtab="history">History <span>${count}</span></button></div></div></header>`;
  }
  function ensureQbView(panel, id){
    let v = byId(id);
    if(v && v.parentNode === panel) return v;
    if(v) v.remove();
    v = document.createElement('div'); v.id = id; v.className = 'tu-qbview';
    if(id === 'tuQbank'){
      v.innerHTML = `<div data-tu-r="head"></div><section class="tu-qbtotals" aria-label="Qbank totals" data-tu-r="totals"></section><div class="tu-qbgrid">` +
        `<section class="tu-card tu-qbforms" aria-label="Choose forms"><div data-tu-r="fhead"></div><label class="tu-qbfind">${icon(ICONS.search, 18)}<span class="tu-sr">Filter forms</span><input type="search" class="tu-bare" placeholder="Filter forms" data-tu-qbfind></label><div class="tu-qbgroups" data-tu-r="groups"></div></section>` +
        `<section class="tu-qbopts" aria-label="Test options"><div class="tu-card tu-qbcard" data-tu-r="opts"></div><div class="tu-qbfoot" data-tu-r="foot"></div></section></div>`;
    } else {
      v.innerHTML = `<div data-tu-r="head"></div><div class="tu-qttools"><label class="tu-qbfind tu-qtfind">${icon(ICONS.search, 18)}<span class="tu-sr">Search Qbank tests</span><input type="search" class="tu-bare" placeholder="Search tests or forms" data-tu-qtfind></label><div class="tu-chips" role="group" aria-label="Filter" data-tu-r="filters"></div></div>` +
        `<section class="tu-card tu-qttable" aria-label="Qbank tests" data-tu-r="rows"></section>`;
      const s = v.querySelector('[data-tu-qtfind]'); s.value = qbVal('qTestSearch') || '';
    }
    panel.insertBefore(v, panel.firstChild);
    v.addEventListener('click', onQbClick);
    v.addEventListener('input', onQbInput);
    v.addEventListener('change', onQbChange);
    return v;
  }
  const qbRegion = (v, name) => v.querySelector(`[data-tu-r="${name}"]`);
  function qbModel(){
    const B = bridge(), d = qbUi.data || {used:0, forms:[], tests:[]};
    const byForm = {}; d.forms.forEach(f => { byForm[f.id] = f; });
    const legacy = qbLegacyForms(), selected = legacy.filter(i => i.checked).map(i => i.dataset.qbankForm);
    const source = qbVal('qbankSourceMode') === 'linked' ? 'linked' : 'qbank';
    let attempt = qbVal('qbankAttemptSource') || ''; if(!QB_ATTEMPTS[source].some(([v]) => v === attempt)) attempt = QB_ATTEMPT_FALLBACK[source];
    const countEl = byId('qbankQuestionCount'), max = parseInt(countEl && countEl.max, 10);
    const available = isNaN(max) ? (parseInt(document.querySelector('#qbankStats .qbank-ring-inner b')?.textContent, 10) || 0) : max;
    const count = Math.max(0, Math.min(available, parseInt(countEl && countEl.value, 10) || 0)), size = Math.max(1, parseInt(qbVal('qbankBlockSize'), 10) || 40);
    return {
      B, d, byForm, legacy, selected, source, attempt, available, count, size,
      mode: qbVal('qbankRunMode') === 'tutor' ? 'tutor' : 'testing', pool: qbVal('qbankQuestionMode') || 'unused', shuffle: !!qbVal('qbankShuffle'),
      selectedTotal: selected.reduce((n, id) => n + ((byForm[id] && byForm[id].questions) || 0), 0)
    };
  }
  function qbTotalsHtml(m){
    const tile = (n, label, main) => `<div class="tu-qbtile${main ? ' main' : ''}"><b>${esc(n)}</b><span>${label}</span></div>`;
    return tile(m.available.toLocaleString(), 'Available now', true) + tile(m.selectedTotal.toLocaleString(), 'In selected forms') + tile(m.d.used.toLocaleString(), 'Used in Qbank') + tile(m.d.tests.length.toLocaleString(), 'Tests taken');
  }
  function qbGroups(m){
    const tabs = libTabs().filter(t => t.key !== 'All'), byKey = {}, order = [];
    tabs.forEach(t => { byKey[t.internal] = {key:t.internal, label:t.label, color:t.color, rows:[]}; order.push(t.internal); });
    m.legacy.forEach(i => {
      const id = i.dataset.qbankForm, rec = m.B.form(id) || {id};
      let key = 'Custom'; try{ key = m.B.tabKey(rec) || 'Custom'; }catch(e){}
      if(!byKey[key]){ byKey[key] = {key, label: key === 'N-Forms' ? 'NBME' : key, color: TAB_DOTS[key] || TAB_DOTS.Custom, rows:[]}; order.push(key); }
      const f = m.byForm[id] || {total:0, questions:0, used:0}, title = rec.displayName || id;
      byKey[key].rows.push({id, title, on:i.checked, meta: plural(f.total || f.questions, 'question') + (title !== id ? ' · ' + id : ''), unused: Math.max(0, f.questions - f.used)});
    });
    return order.map(k => byKey[k]).filter(g => g.rows.length);
  }
  function qbFormsHtml(m){
    const q = qbUi.q.trim().toLowerCase(), groups = qbGroups(m);
    const tick = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>';
    if(!m.legacy.length) return `<div class="tu-qempty">${icon(ICONS.library, 28)}<b>No forms in your library</b><span>Add forms first; Qbank mixes questions from them.</span></div>`;
    const out = groups.map(g => {
      const n = g.rows.filter(r => r.on).length;
      if(qbUi.open[g.key] == null) qbUi.open[g.key] = n > 0; // groups with nothing selected start folded, as on the board
      const rows = q ? g.rows.filter(r => (r.title + ' ' + r.id).toLowerCase().includes(q)) : g.rows;
      if(q && !rows.length) return '';
      const open = q ? true : qbUi.open[g.key];
      return `<div class="tu-qbgroup"><button type="button" class="tu-qbghead" aria-expanded="${open}" data-tu-qbgroup="${esc(g.key)}"><i style="background:${esc(g.color)}"></i><b>${esc(g.label)}</b><span>${n} of ${g.rows.length} selected</span>${icon(ICONS.chevron, 18)}</button>` +
        (open ? rows.map(r => `<button type="button" class="tu-qbrow" role="checkbox" aria-checked="${r.on}" data-tu-qbform="${esc(r.id)}"><i>${r.on ? tick : ''}</i><span><b>${esc(r.title)}</b><small>${esc(r.meta)}</small></span><em>${r.unused.toLocaleString()} unused</em></button>`).join('') : '') + '</div>';
    }).join('');
    return out || `<div class="tu-qempty"><b>No forms match “${esc(qbUi.q.trim())}”</b></div>`;
  }
  function qbOptsHtml(m){
    const card = (attr, v, label, hint, on) => `<button type="button" class="tu-qbradio" role="radio" aria-checked="${on}" data-${attr}="${v}"><b>${label}</b><span>${hint}</span></button>`;
    const auto = `Auto: ${m.mode === 'tutor' ? 'Tutor' : 'Qbank'} — ${(QB_POOLS.find(([v]) => v === m.pool) || QB_POOLS[0])[1]} — ${m.count}Q — ${new Date().toLocaleDateString()}`;
    return `<label class="tu-qbfield"><span>Test name</span><input type="text" placeholder="${esc(auto)}" data-tu-qbin="qbankTestName" autocomplete="off"></label>` +
      `<div class="tu-qbfield"><span>Mode</span><div class="tu-qbpair" role="radiogroup" aria-label="Mode">${card('tu-qbmode', 'testing', 'Testing', 'Timed, answers at the end', m.mode === 'testing')}${card('tu-qbmode', 'tutor', 'Tutor', 'Submit each item to see the explanation', m.mode === 'tutor')}</div></div>` +
      `<div class="tu-qbfield"><span>Count progress from</span><div class="tu-qbpair" role="radiogroup" aria-label="Progress source">${card('tu-qbsrc', 'qbank', 'Qbank history', 'Unused / used across your Qbank tests', m.source === 'qbank')}${card('tu-qbsrc', 'linked', 'Form Library attempts', 'Read-only: wrongs and marks from your forms', m.source === 'linked')}</div>` +
      `<label class="tu-qbattempt"><span>Attempts used</span><select data-tu-qbin="qbankAttemptSource">${QB_ATTEMPTS[m.source].map(([v, l]) => `<option value="${v}"${v === m.attempt ? ' selected' : ''}>${l}</option>`).join('')}</select></label></div>` +
      `<div class="tu-qbfield"><span>Question pool</span><div class="tu-chips" role="radiogroup" aria-label="Question pool">${QB_POOLS.map(([v, l]) => `<button type="button" class="tu-chip" role="radio" aria-checked="${m.pool === v}" data-tu-qbpool="${v}">${l}</button>`).join('')}</div></div>` +
      `<div class="tu-qbnums"><label class="tu-qbfield"><span>Questions</span><input type="number" min="1" max="${m.available}" inputmode="numeric" data-tu-qbin="qbankQuestionCount"></label><label class="tu-qbfield"><span>Questions per block</span><input type="number" min="1" inputmode="numeric" data-tu-qbin="qbankBlockSize"></label></div>` +
      `<label class="tu-qbrange"><span class="tu-sr">Question count slider</span><input type="range" min="1" max="${Math.max(1, m.available)}" data-tu-qbin="range"${m.available ? '' : ' disabled'}><span>max ${m.available.toLocaleString()}</span></label>` +
      `<div class="tu-swrow"><div><b>Shuffle</b><span>Randomize which questions are picked and their order</span></div><button type="button" class="tu-switch" role="switch" aria-checked="${m.shuffle}" aria-label="Shuffle" data-tu-qbsw="qbankShuffle"><i></i></button></div>`;
  }
  function qbFootHtml(m){
    const blocks = Math.max(1, Math.ceil(m.count / m.size));
    const why = !m.selected.length ? 'Select at least one form' : !m.available ? 'No questions in this pool' : '';
    const text = why || `${plural(m.count, 'question')} · ${plural(blocks, 'block')} · ${m.mode === 'tutor' ? 'Tutor' : 'Testing'} · from ${plural(m.selected.length, 'form')}`;
    return `<div><b>${esc(text)}</b><span>Saved to Qbank history only</span></div><button type="button" class="tu-btn tu-qbgo" data-tu-qbgo${why ? ' disabled' : ''}>${icon(ICONS.play, 18)}Generate &amp; start</button>`;
  }
  // number/text inputs are filled after each render (not in the markup), so typing never triggers a re-render
  function qbSyncInputs(v){
    v.querySelectorAll('[data-tu-qbin]').forEach(el => {
      if(el === document.activeElement || el.tagName === 'SELECT') return;
      const key = el.dataset.tuQbin, val = key === 'range' ? qbVal('qbankQuestionCount') : qbVal(key);
      if(val != null && el.value !== String(val)) el.value = String(val);
    });
  }
  function paintQbBuild(panel){
    const v = ensureQbView(panel, 'tuQbank'), m = qbModel();
    panel.classList.add('tu-has-qbank');
    swapHtml(qbRegion(v, 'head'), qbHeadHtml('build', m.d.tests.length));
    swapHtml(qbRegion(v, 'totals'), qbTotalsHtml(m));
    swapHtml(qbRegion(v, 'fhead'), `<div class="tu-qbfhead"><h2>Forms <span>${m.selected.length} selected</span></h2><div><button type="button" class="tu-link" data-tu-qball>Select all</button><button type="button" class="tu-link" data-tu-qbnone>Clear</button></div></div>`);
    swapHtml(qbRegion(v, 'groups'), qbFormsHtml(m));
    swapHtml(qbRegion(v, 'opts'), qbOptsHtml(m));
    swapHtml(qbRegion(v, 'foot'), qbFootHtml(m));
    qbSyncInputs(v);
  }
  function qtMeta(t, B){
    const src = t.sourceMode === 'linked' ? `Form Library (${((QB_ATTEMPTS.linked.find(([v]) => v === t.attemptSource) || [0, 'active selected'])[1]).replace(/ only$/, '').toLowerCase()})` : 'Qbank history';
    const names = t.formIds.map(id => { const r = B.form(id); return (r && r.displayName) || id; });
    const forms = names.length > 3 ? names.length + ' forms' : names.join(', ');
    const pool = (QB_POOLS.find(([v]) => v === t.poolType) || [0, ''])[1];
    return [shortDate(t.completedAt || t.updatedAt || t.createdAt), src, pool, forms].filter(Boolean).join(' · ');
  }
  function paintQbHistory(panel){
    const v = ensureQbView(panel, 'tuQtests'), B = bridge(), d = qbUi.data || {tests:[]};
    panel.classList.add('tu-has-qbank');
    const byId_ = {}; d.tests.forEach(t => { byId_[t.id] = t; });
    const ids = Array.from(document.querySelectorAll('#qbankTestsGrid [data-qb-id]')).map(c => c.dataset.qbId);
    const lost = ids.filter(id => !byId_[id]).join('|');
    if(lost && qbUi.missing !== lost){ qbUi.missing = lost; scheduleQbank(true); } // a test the bridge data has not seen yet
    const f = qbVal('qTestFilter') || 'all';
    swapHtml(qbRegion(v, 'head'), qbHeadHtml('history', d.tests.length));
    swapHtml(qbRegion(v, 'filters'), QB_FILTERS.map(([val, l]) => `<button type="button" class="tu-chip" aria-pressed="${f === val}" data-tu-qtf="${val}">${l}</button>`).join(''));
    const head = '<div class="tu-qtrow tu-qthead" aria-hidden="true"><span>Test</span><span>Mode</span><span>Questions</span><span>Score</span><span>Status</span><span>Actions</span></div>';
    const rows = ids.map(id => byId_[id]).filter(Boolean).map(t => {
      const name = t.name || 'Qbank test', act = t.done ? 'review' : 'resume';
      return `<div class="tu-qtrow" data-id="${esc(t.id)}"><span class="tu-qtname"><b>${esc(name)}</b><small title="${esc(qtMeta(t, B))}">${esc(qtMeta(t, B))}</small></span>` +
        `<span><em class="tu-qtmode ${t.mode}">${t.mode === 'tutor' ? 'Tutor' : 'Testing'}</em></span><span class="tu-qtqs">${t.total} · ${plural(t.blocks || 1, 'block')}</span>` +
        `<span class="tu-qtscore"><span class="tu-qtlbl">Score </span>${t.percent == null ? '—' : esc(Math.round(t.percent)) + '%'}</span><span><em class="tu-qtst ${t.done ? 'done' : ''}">${t.done ? 'Completed' : 'In progress'}</em></span>` +
        `<span class="tu-qtacts"><button type="button" class="tu-btn small ${t.done ? 'tonal2' : ''}" data-tu-qtact="${act}" data-id="${esc(t.id)}" aria-label="${t.done ? 'Review' : 'Resume'} ${esc(name)}">${t.done ? 'Review' : 'Resume'}</button>` +
        `<button type="button" class="tu-qticon" data-tu-qtact="rename" data-id="${esc(t.id)}" aria-label="Rename ${esc(name)}" title="Rename">${icon(QB_ICONS.pencil, 18)}</button>` +
        `<button type="button" class="tu-qticon" data-tu-qtact="export" data-id="${esc(t.id)}" aria-label="Export ${esc(name)}" title="Export">${icon(ICONS.download, 18)}</button>` +
        `<button type="button" class="tu-qticon bad" data-tu-qtact="delete" data-id="${esc(t.id)}" aria-label="Delete ${esc(name)}" title="Delete">${icon(QB_ICONS.trash, 18)}</button></span></div>`;
    }).join('');
    const empty = !d.tests.length ? '<div class="tu-qtempty"><b>No Qbank tests yet</b><span>Generated tests appear here.</span></div>' : '<div class="tu-qtempty">No tests match this filter.</div>';
    swapHtml(qbRegion(v, 'rows'), head + (rows || empty));
    const s = v.querySelector('[data-tu-qtfind]'); if(s && s !== document.activeElement && s.value !== (qbVal('qTestSearch') || '')) s.value = qbVal('qTestSearch') || '';
  }
  async function paintQbank(){
    const B = bridge(); if(!B || !B.qbank) return;
    qbWatch();
    const build = byId('qbankModePanel'), tests = byId('qbankTestsPanel');
    const showBuild = !!build && build.classList.contains('active') && !!byId('qbankRunMode'), showTests = !!tests && tests.classList.contains('active');
    if(!showBuild && !showTests) return;
    const draw = () => {
      if(showBuild) paintQbBuild(build);
      if(showTests) paintQbHistory(tests);
      heroTitle();
      qbObservers.forEach(o => o.takeRecords());
    };
    if(qbUi.stale || !qbUi.data){
      if(qbUi.data) draw(); // the cached data first, so the view is on screen in the frame the tab opens
      const n = ++qbUi.seq; qbUi.stale = false;
      const d = await B.qbank(); if(n !== qbUi.seq) return;
      qbUi.data = d;
    }
    draw();
  }
  function qbSetForms(ids, on){
    const inputs = qbLegacyForms().filter(i => ids.includes(i.dataset.qbankForm) && i.checked !== on); if(!inputs.length) return;
    inputs.forEach(i => { i.checked = on; });
    inputs[inputs.length - 1].dispatchEvent(new Event('change', {bubbles:true})); // the legacy handler reads every box and saves once
  }
  function qtLegacy(id, act){
    const card = document.querySelector(`#qbankTestsGrid [data-qb-id="${CSS.escape(id)}"]`), b = card && card.querySelector(`[data-v9="qbank-${act}"]`);
    if(!b){ console.warn('ThunderUI: legacy Qbank control missing', id, act); return false; }
    b.click(); return true;
  }
  function onQbClick(e){
    const t = e.target.closest('button'); if(!t || t.disabled) return;
    const ds = t.dataset;
    if(ds.tuQbtab){ byId(ds.tuQbtab === 'build' ? 'qbankTab' : 'qbankTestsTab')?.click(); return; }
    if(ds.tuQbform){ const i = qbLegacyForms().find(x => x.dataset.qbankForm === ds.tuQbform); if(i) qbSetForms([ds.tuQbform], !i.checked); return; }
    if(t.hasAttribute('data-tu-qball') || t.hasAttribute('data-tu-qbnone')){
      const q = qbUi.q.trim().toLowerCase(), B = bridge();
      const ids = qbLegacyForms().map(i => i.dataset.qbankForm).filter(id => { const r = B.form(id) || {}; return !q || ((r.displayName || id) + ' ' + id).toLowerCase().includes(q); });
      qbSetForms(ids, t.hasAttribute('data-tu-qball')); return;
    }
    if(ds.tuQbgroup){ qbUi.open[ds.tuQbgroup] = t.getAttribute('aria-expanded') !== 'true'; scheduleQbank(); return; }
    if(ds.tuQbmode){ setLegacy('qbankRunMode', ds.tuQbmode); scheduleQbank(); return; }
    if(ds.tuQbsrc){ setLegacy('qbankSourceMode', ds.tuQbsrc); scheduleQbank(); return; }
    if(ds.tuQbpool){ setLegacy('qbankQuestionMode', ds.tuQbpool); scheduleQbank(); return; }
    if(ds.tuQbsw){ setLegacy(ds.tuQbsw, t.getAttribute('aria-checked') !== 'true'); scheduleQbank(); return; }
    if(t.hasAttribute('data-tu-qbgo')){ document.querySelector('#qbankModePanel [data-v9="qbank-start"]')?.click(); return; }
    if(ds.tuQtf){ setLegacy('qTestFilter', ds.tuQtf); scheduleQbank(); return; }
    if(t.hasAttribute('data-tu-qtrefresh')){ document.querySelector('#qbankTestsPanel [data-v9="qtests-refresh"]')?.click(); scheduleQbank(true); return; }
    if(ds.tuQtact && ds.id) qtLegacy(ds.id, ds.tuQtact);
  }
  function onQbInput(e){
    const t = e.target;
    if(t.hasAttribute('data-tu-qbfind')){ qbUi.q = t.value; const v = byId('tuQbank'); if(v) swapHtml(qbRegion(v, 'groups'), qbFormsHtml(qbModel())); return; }
    if(t.hasAttribute('data-tu-qtfind')){ setLegacy('qTestSearch', t.value); return; }
    const key = t.dataset.tuQbin; if(!key || t.tagName === 'SELECT') return;
    if(key === 'range'){ setLegacy('qbankQuestionCount', t.value); const n = t.closest('.tu-qbview').querySelector('[data-tu-qbin="qbankQuestionCount"]'); if(n) n.value = t.value; }
    else if(key === 'qbankQuestionCount' || key === 'qbankBlockSize'){ if(t.value !== '' && Number(t.value) >= 1) setLegacy(key, t.value); }
    else setLegacy(key, t.value);
    const v = byId('tuQbank'); if(v){ const m = qbModel(); swapHtml(qbRegion(v, 'foot'), qbFootHtml(m)); const r = v.querySelector('[data-tu-qbin="range"]'); if(r && key !== 'range') r.value = String(m.count); }
  }
  function onQbChange(e){
    const t = e.target, key = t.dataset.tuQbin; if(!key) return;
    if(t.tagName === 'SELECT'){ setLegacy(key, t.value); scheduleQbank(); return; }
    if(key === 'qbankQuestionCount' || key === 'qbankBlockSize'){
      const max = key === 'qbankQuestionCount' ? Math.max(1, qbModel().available) : 999, n = Math.max(1, Math.min(max, parseInt(t.value, 10) || 1));
      t.value = String(n); setLegacy(key, n); scheduleQbank();
    }
  }

  /* ---------- Add forms dialog (boards AddForms, FormUpdates): fixed slots, custom form, bulk ZIP, online updates ----------
     Fixed and custom imports run through the legacy Load New Form modal, kept open off-screen; bulk import is the
     shared bulk-import.js (its #bulk* controls now live here instead of Settings); online updates are form-updates.js. */
  const addUi = {open:false, tab:'slot', cat:'', q:'', status:'', tone:'', pending:null, returnTo:null, custom:{name:'', id:'', subject:'Custom', tab:'Custom', block:'40', score:''}};
  const SUBJECTS = ['Custom', 'Internal Medicine', 'OBGyn', 'Surgery', 'Pediatrics', 'Family Medicine', 'Emergency Medicine', 'Psychiatry', 'Neurology'];
  const storageReady = () => IPAD || !!byId('dataFolderStatus')?.classList.contains('connected');
  const hasUpdates = () => IPAD && !!window.StepFormUpdates;
  function legacyLoadModal(){
    if(!storageReady()) return false;
    const root = byId('modalRoot'); if(root) root.dataset.tuGhost = '1';
    if(!document.querySelector('#modalRoot #slotList')) byId('loadNewFormBtn')?.click();
    return !!document.querySelector('#modalRoot #slotList');
  }
  function slotCat(id){ if(/^N-/i.test(id)) return 'NBME'; if(/^UWSA/i.test(id)) return 'UWSA'; if(/^F120/i.test(id)) return 'F120'; const m = id.match(/^C-([A-Za-z]+)-/); return m ? m[1] : 'Other'; }
  function readSlots(){
    if(!legacyLoadModal()) return [];
    const B = bridge();
    return Array.from(document.querySelectorAll('#modalRoot #slotList .slot-row')).map(r => {
      const id = r.querySelector('button[data-fixed-slot]')?.dataset.fixedSlot || ''; if(!id) return null;
      const meta = (r.querySelector('.slot-meta')?.textContent || ''), exp = (meta.match(/expected\s+(\d+)/i) || [])[1] || '';
      let loaded = r.classList.contains('loaded'); try{ loaded = loaded || !!B.form(id); }catch(e){}
      return {id, name:(r.querySelector('.slot-name')?.textContent || id).trim(), exp, loaded, cat:slotCat(id)};
    }).filter(Boolean);
  }
  function setAddStatus(text, tone){ addUi.status = text || ''; addUi.tone = tone || ''; paintAdd(); }
  function connectHtml(){ return `<div class="tu-banner">${icon(ICONS.drive, 22)}<span>Connect your DATA folder first. Forms and their progress are saved there.</span>${byId('connectDataFolderBtn') ? '<button type="button" class="tu-btn small" data-tu-proxy="connectDataFolderBtn">Connect DATA folder</button>' : ''}</div>`; }
  function slotsHtml(){
    if(!storageReady()) return connectHtml();
    const slots = readSlots(); if(!slots.length) return '<span class="tu-note">The fixed form slots could not be loaded.</span>';
    const cats = []; slots.forEach(s => { if(!cats.includes(s.cat)) cats.push(s.cat); });
    if(!cats.includes(addUi.cat)) addUi.cat = cats[0];
    const q = addUi.q.trim().toLowerCase();
    const shown = q ? slots.filter(s => (s.id + ' ' + s.name + ' ' + s.cat).toLowerCase().includes(q)) : slots.filter(s => s.cat === addUi.cat);
    const dot = c => TAB_DOTS[c === 'NBME' ? 'N-Forms' : c] || TAB_DOTS.Custom;
    return `<div class="tu-chips" role="group" aria-label="Slot category">${cats.map(c => `<button type="button" class="tu-chip" aria-pressed="${!q && addUi.cat === c}" data-tu-slot-cat="${esc(c)}">${esc(c)} <span>${slots.filter(s => s.cat === c).length}</span></button>`).join('')}</div>` +
      `<div class="tu-slots">${shown.map(s => `<div class="tu-slot${s.loaded ? ' loaded' : ''}"><i style="background:${dot(s.cat)}"></i><span><b>${esc(s.id)}</b><small>${esc([s.name !== s.id ? s.name : '', s.exp ? s.exp + ' Qs' : '', s.loaded ? 'loaded' : ''].filter(Boolean).join(' · '))}</small></span><button type="button" class="tu-btn small ${s.loaded ? 'outline' : ''}" data-tu-slot="${esc(s.id)}" aria-label="${s.loaded ? 'Replace' : 'Import'} ${esc(s.id)}">${s.loaded ? 'Replace' : 'Import'}</button></div>`).join('') || `<span class="tu-note">No slots match “${esc(addUi.q)}”.</span>`}</div>`;
  }
  function customHtml(){
    if(!storageReady()) return connectHtml();
    const c = addUi.custom, tabs = libTabs().filter(t => t.key !== 'All').map(t => t.label === 'NBME' ? '' : t.label).filter(Boolean);
    const field = (k, label, attrs, span) => `<label class="tu-fieldin${span ? ' span2' : ''}"><span>${label}</span><input data-tu-cf="${k}" value="${esc(c[k])}" ${attrs}></label>`;
    return `<div class="tu-form-grid">${field('name', 'Display name', 'placeholder="e.g. CMS Mixed Review 01" autocomplete="off"', true)}${field('id', 'Form ID', 'placeholder="e.g. CUSTOM-01" autocomplete="off"')}` +
      `<label class="tu-fieldin"><span>Subject</span><select data-tu-cf="subject">${SUBJECTS.map(s => `<option${s === c.subject ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select></label>` +
      `${field('tab', 'Library tab', 'list="tuTabList" autocomplete="off"')}<datalist id="tuTabList">${tabs.map(t => `<option value="${esc(t)}">`).join('')}</datalist>` +
      `${field('block', 'Suggested questions per block', 'type="number" min="1" inputmode="numeric"')}${field('score', '3-digit score (optional)', 'placeholder="—" inputmode="numeric" maxlength="3"')}</div>` +
      `<button type="button" class="tu-dropbox" data-tu-custom-go>${icon(ICONS.upload, 28)}<b>Choose a JSON or ZIP</b><span>Images stay embedded until you choose Optimize images on the form.</span></button>`;
  }
  function bulkHtml(){
    const S = window.StepBulkImport && window.StepBulkImport.state ? window.StepBulkImport.state() : {busy:false, message:'', forms:[], ready:0};
    const rows = S.forms.map(f => `<div class="tu-trow"><span><b>${esc(f.id)}</b>${f.name && f.name !== f.id ? `<small>${esc(f.name)}</small>` : ''}</span><span>${f.total}</span><span>${f.assets}</span><span class="${f.installed ? 'tu-muted' : 'tu-oktext'}">${f.installed ? 'Installed · skipped' : 'New'}</span></div>`).join('');
    return `<div class="tu-bulk-top"><label class="tu-dropbox${S.busy ? ' tu-busy' : ''}">${icon(ICONS.upload, 28)}<b>${S.busy ? 'Working…' : 'Choose ZIP'}</b><input id="bulkFormZip" class="tu-sr" type="file" accept=".zip,application/zip"${S.busy ? ' disabled' : ''}></label>` +
      `<pre class="tu-pre">Forms.zip\n  UWSA2/UWSA2.json\n  UWSA2/assets/…\n  NBME14/NBME14.json\n  NBME14/assets/…</pre></div>` +
      `<div id="bulkPreview">${rows ? `<div class="tu-table" role="table" aria-label="Forms in the ZIP"><div class="tu-thead"><span>Form</span><span>Questions</span><span>Images</span><span>Result</span></div>${rows}</div>` : ''}</div>` +
      `<p id="bulkImportStatus" role="status" class="tu-status">${esc(S.message)}</p>` +
      `<div class="tu-end"><button type="button" id="bulkImportCommit" class="tu-btn"${!S.ready || S.busy ? ' disabled' : ''}>${S.busy ? 'Importing…' : S.ready ? 'Import ' + plural(S.ready, 'form') : 'Import forms'}</button></div>`;
  }
  /* online updates: the same view in the Add forms tab and in the header popover (board FormUpdates) */
  const UPD_CHIP = {New:'new', Revised:'rev', Installed:'ok', Skipped:'skip', Blocked:'bad'};
  function updState(){ try{ return window.StepFormUpdates.getState(); }catch(e){ return {message:'', forms:[], busy:false, percent:null}; } }
  function mb(n){ n = Number(n) || 0; return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  // Returns the status line and the body (progress, list, buttons) separately: the popover shows the status under its title.
  function updatesParts(){
    const st = updState(), forms = st.forms || [], act = forms.filter(f => f.status === 'New' || f.status === 'Revised');
    const list = forms.length ? `<div class="tu-updlist">${forms.map(f => { const status = f.reason && f.status !== 'Installed' ? 'Blocked' : f.status; return `<div class="tu-updrow"><div><i style="background:${TAB_DOTS[tabInternal(f.tab || '')] || TAB_DOTS.Custom}"></i><span><b>${esc(f.title || f.id)}</b><small>${esc([f.tab, (f.files || []).length ? mb(f.files.reduce((n, x) => n + (Number(x.size) || 0), 0)) : ''].filter(Boolean).join(' · '))}</small></span><em class="tu-updchip ${UPD_CHIP[status] || 'skip'}">${esc(status)}</em></div>${f.reason ? `<small class="tu-updwhy">${esc(f.reason)}</small>` : ''}</div>`; }).join('')}</div>` : '';
    const progress = st.percent != null ? `<div class="tu-updprog"><div><span>${st.percent < 90 ? 'Downloading' : 'Checking compatibility'}</span><span>${st.percent}%</span></div><span class="tu-tile-bar"><i style="width:${st.percent}%"></i></span></div>` : '';
    const checked = !!(st.message || forms.length), msg = st.message || 'Check for new and revised forms published for this app.';
    const tone = /up to date|^Installed|^Imported/i.test(msg) ? 'ok' : /offline|leave the active exam|failed|error|interrupted|mismatch/i.test(msg) ? 'warn' : '';
    return {
      status: `<span class="tu-updmsg ${tone}" role="status" aria-live="polite">${esc(msg)}</span>`,
      body: `${progress}${list}<div class="tu-actions">${act.length && byId('formUpdatesInstall') ? `<button type="button" class="tu-btn tu-grow" data-tu-proxy="formUpdatesInstall"${st.busy ? ' disabled' : ''}>Download &amp; install · ${act.length}</button>` : ''}<button type="button" class="tu-btn outline" data-tu-proxy="formUpdatesCheck"${st.busy ? ' disabled' : ''}>${st.busy ? 'Updating…' : checked ? 'Check again' : 'Check for updates'}</button></div>` +
        (act.length ? '<span class="tu-note">Installs everything listed in one go. Successful installs are reported to the app administrator. Your attempts are kept when question IDs match.</span>' : '')
    };
  }
  function updatesHtml(){ const u = updatesParts(); return u.status + u.body; }
  const ADD_TABS = () => [['slot', 'Fixed slot', 'NBME, CMS, UWSA, Free 120'], ['custom', 'Custom form', 'Any JSON or ZIP bank'], ['bulk', 'Bulk ZIP', 'Many forms in one go'], hasUpdates() ? ['online', 'Online updates', (() => { const n = (updState().forms || []).filter(f => f.status === 'New' || f.status === 'Revised').length; return n ? n + ' available' : 'Published forms'; })()] : null].filter(Boolean);
  const ADD_HEAD = {
    slot:['Fixed form slot', 'Pick the slot, then choose its JSON or ZIP. Loaded slots can be replaced; progress is kept when the questions match.'],
    custom:['Custom form', 'For your own JSON banks or anything without a fixed slot.'],
    bulk:['Bulk import from one ZIP', 'One folder per form, each with its JSON and an assets folder. Forms already in the library are skipped.'],
    online:['Online form updates', 'New and revised forms published for this app. Revisions keep your progress when question IDs match.']
  };
  function addShellHtml(){
    const tab = addUi.tab, [h, p] = ADD_HEAD[tab];
    const body = tab === 'slot' ? (storageReady() ? `<label class="tu-search tu-slotsearch">${icon(ICONS.search, 18)}<span class="tu-sr">Search slots</span><input type="search" id="tuSlotSearch" value="${esc(addUi.q)}" placeholder="Search N-10, C-IM, Psych…" autocomplete="off"></label>` : '') + '<div data-tu-r="slots"></div>'
      : tab === 'custom' ? customHtml() : tab === 'bulk' ? (storageReady() ? '<div data-tu-r="bulk"></div>' : connectHtml()) : '<div data-tu-r="online" class="tu-updbody"></div>';
    return `<div class="tu-add-nav"><h2 id="tuAddTitle">Add forms</h2><div role="tablist" aria-orientation="vertical" aria-label="Ways to add" data-tu-r="nav"></div><span class="tu-add-foot">Library forms are saved permanently with progress. For a throwaway run, use <button type="button" class="tu-link" data-tu-go-quick>Quick practice</button> instead.</span></div>` +
      `<div class="tu-add-main"><div class="tu-add-top"><button type="button" class="tu-round" data-tu-close aria-label="Close">${closeIco}</button></div><div class="tu-add-body" data-tu-scroll="add" role="tabpanel" aria-labelledby="tuAddTab-${tab}"><div class="tu-add-h"><h3>${h}</h3><span>${p}</span></div>${body}<div data-tu-r="status"></div></div></div>`;
  }
  function paintAdd(force){
    const el = byId('tuAdd'); if(!el || el.hidden) return;
    const box = el.querySelector('.tu-add');
    if(force || box.dataset.tab !== addUi.tab){ box.innerHTML = addShellHtml(); box.dataset.tab = addUi.tab; }
    const r = name => box.querySelector(`[data-tu-r="${name}"]`);
    swapHtml(r('nav'), ADD_TABS().map(([id, l, h]) => `<button type="button" role="tab" id="tuAddTab-${id}" aria-selected="${addUi.tab === id}" data-tu-add-tab="${id}"><b>${l}</b><span>${esc(h)}</span></button>`).join(''));
    swapHtml(r('status'), addUi.status ? `<p class="tu-status ${addUi.tone}" role="status">${esc(addUi.status)}</p>` : '<p class="tu-status" role="status"></p>');
    if(r('slots')) swapHtml(r('slots'), slotsHtml());
    if(r('bulk')) swapHtml(r('bulk'), bulkHtml());
    if(r('online')) swapHtml(r('online'), updatesHtml());
  }
  function openAdd(tab, from){
    const el = dialogLayer('tuAdd', 'tu-add', 'tuAddTitle', onAddClick, closeAdd);
    if(!el.dataset.tuInput){ el.dataset.tuInput = '1'; el.addEventListener('input', onAddInput); el.addEventListener('change', onAddInput); }
    Object.assign(addUi, {open:true, tab:tab || 'slot', status:'', tone:'', pending:null, returnTo:from || document.activeElement});
    if(addUi.tab === 'online' && !hasUpdates()) addUi.tab = 'slot';
    el.hidden = false; paintAdd(true);
    if(addUi.tab === 'online') maybeCheckUpdates();
    setTimeout(() => el.querySelector('.tu-add [data-tu-close]')?.focus(), 0);
  }
  function closeAdd(){
    const el = byId('tuAdd'); if(!el || el.hidden) return;
    el.hidden = true; addUi.open = false; addUi.pending = null;
    const box = el.querySelector('.tu-add'); box.innerHTML = ''; box.dataset.tab = ''; // the #bulk* controls must not linger hidden
    const root = byId('modalRoot');
    if(root){ if(root.querySelector('#slotList')){ root.classList.add('hidden'); root.innerHTML = ''; } delete root.dataset.tuGhost; }
    const back = addUi.returnTo; addUi.returnTo = null; back?.focus?.();
  }
  function maybeCheckUpdates(){ const st = updState(); if(!st.busy && !st.message && !(st.forms || []).length) byId('formUpdatesCheck')?.click(); }
  function onAddInput(e){
    const t = e.target;
    if(t.id === 'tuSlotSearch'){ addUi.q = t.value; paintAdd(); return; }
    if(t.dataset && t.dataset.tuCf) addUi.custom[t.dataset.tuCf] = t.value;
  }
  // The legacy import closes its modal on success and alerts on failure; either way it clears #slotJsonInput.
  // Success = the catalog changed (a library repaint may reopen the off-screen modal, so its state proves nothing).
  const catalogSig = () => { try{ return bridge().forms().map(f => [f.id, f.updatedAt, f.importedAt, f.totalQuestions, f.bankHash].join(':')).join('|'); }catch(e){ return ''; } };
  async function watchImport(){
    const p = addUi.pending; if(!p) return;
    const before = catalogSig();
    setAddStatus(`Importing ${p.label}…`, 'busy');
    const input = byId('slotJsonInput');
    for(let i = 0; i < 1200 && input && input.value; i++) await wait(100);
    if(addUi.pending !== p) return;
    addUi.pending = null;
    await wait(150);
    if(catalogSig() !== before) setAddStatus(`Added ${p.label} to your library.`, 'ok'); else setAddStatus('', '');
  }
  document.addEventListener('change', e => { if(e.target && e.target.id === 'slotJsonInput' && addUi.open && addUi.pending && e.target.files && e.target.files.length) watchImport(); }, true);
  function onAddClick(e){
    const t = e.target.closest('button, [data-tu-close]'); if(!t || t.disabled) return;
    if(t.hasAttribute('data-tu-close')){ closeAdd(); return; }
    if(t.dataset.tuAddTab){ addUi.tab = t.dataset.tuAddTab; addUi.status = ''; paintAdd(); byId('tuAddTab-' + addUi.tab)?.focus(); if(addUi.tab === 'online') maybeCheckUpdates(); return; }
    if(t.dataset.tuSlotCat){ addUi.cat = t.dataset.tuSlotCat; addUi.q = ''; const s = byId('tuSlotSearch'); if(s) s.value = ''; paintAdd(); return; }
    if(t.dataset.tuSlot){
      // must stay synchronous: the legacy slot button opens the file chooser from this click
      if(!legacyLoadModal()) return;
      let b = document.querySelector(`#modalRoot #slotList button[data-fixed-slot="${CSS.escape(t.dataset.tuSlot)}"]`);
      if(!b){ const s = byId('slotSearch'); if(s){ s.value = ''; s.dispatchEvent(new Event('input', {bubbles:true})); } b = document.querySelector(`#modalRoot #slotList button[data-fixed-slot="${CSS.escape(t.dataset.tuSlot)}"]`); }
      if(!b) return;
      addUi.pending = {label:t.dataset.tuSlot}; setAddStatus(`Choose the JSON or ZIP for ${t.dataset.tuSlot}.`, '');
      b.click(); return;
    }
    if(t.hasAttribute('data-tu-custom-go')){
      const c = addUi.custom;
      if(c.score && !/^\d{3}$/.test(c.score.trim())){ setAddStatus('The 3-digit score must be exactly 3 digits, or left empty.', 'bad'); return; }
      if(!legacyLoadModal()) return;
      const map = {customName:c.name, customId:c.id, customSubject:c.subject, customBlockSize:c.block, custom3Score:c.score.trim(), customFilter:c.tab};
      Object.keys(map).forEach(id => { const el = byId(id); if(el) el.value = map[id]; });
      addUi.pending = {label:c.name.trim() || c.id.trim() || 'the custom form'}; setAddStatus('Choose the JSON or ZIP for ' + addUi.pending.label + '.', '');
      byId('customImportBtn')?.click(); return;
    }
    if(t.hasAttribute('data-tu-go-quick')){ closeAdd(); byId('quickTab')?.click(); }
  }
  document.addEventListener('stepbulk:change', () => { if(addUi.open) paintAdd(); });

  /* header popover for Check for updates (iPad, board FormUpdates) */
  let updReturn = null;
  function openUpdates(from){
    const el = dialogLayer('tuUpd', 'tu-upd', 'tuUpdTitle', e => { const t = e.target.closest('button, [data-tu-close]'); if(t && t.hasAttribute('data-tu-close')) closeUpdates(); }, closeUpdates);
    updReturn = from || null;
    el.hidden = false; paintUpdates();
    if(!updState().busy) byId('formUpdatesCheck')?.click();
    setTimeout(() => el.querySelector('.tu-upd [data-tu-close]')?.focus(), 0);
  }
  function closeUpdates(){ const el = byId('tuUpd'); if(!el || el.hidden) return; el.hidden = true; el.querySelector('.tu-upd').dataset.html = ''; updReturn?.focus?.(); updReturn = null; }
  function paintUpdates(){
    const el = byId('tuUpd'); if(!el || el.hidden) return;
    const u = updatesParts();
    swapHtml(el.querySelector('.tu-upd'), `<header class="tu-upd-head"><span class="tu-upd-ico">${icon(ICONS.download, 22)}</span><div><h2 id="tuUpdTitle">Form updates</h2>${u.status}</div><button type="button" class="tu-round" data-tu-close aria-label="Close">${closeIco}</button></header><div class="tu-updbody" data-tu-scroll="upd">${u.body}</div>`);
  }

  /* ---------- Settings + Backup & sync (boards Settings, Sync, SyncStates) ----------
     New view, same engine: #tuSettings is drawn from StepLibraryBridge.settings() and the hidden legacy controls; every
     change sets or clicks the legacy control (switching the hidden legacy Settings tab first when the control lives on
     another tab), so the legacy saves, confirms and protections still run. The legacy panels stay in the DOM, off-screen.
     iPad: #tuSync sits over #progressSyncPanel. Local: Backup & sync is its own sidebar page (#tuSyncTab) drawn over the
     legacy Settings › Backup tab, whose buttons it proxies. */
  const SET_KEY = 'ThunderUSMLE.settingsSection', THEME_MODE = 'ThunderUSMLE.themeMode';
  const SET_SECTIONS = [['appearance', 'Appearance'], ['tabs', 'Library tabs'], ['qbank', 'Qbank'], ['safety', 'Safety'], ['advanced', 'Advanced'], ['admin', 'Admin'], ['about', 'About & updates']];
  const SET_LEGACY = {tabs:'library', qbank:'qbank', safety:'safety', admin:'admin'}; // the hidden legacy tab that holds each section's controls
  const SET_READY = {
    library:'[data-lib-meter]', order:'[data-v195-drag-tab]', custom:'.settings-panel-v195', qbank:'#setLinkQbank', safety:'#setDefaultMode', admin:'.fu-admin',
    backup: IPAD ? '[data-v101]' : '[data-local-compat]'
  };
  const SET_ICONS = {
    folder:'<path d="M3 7.5a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    grip:'<circle cx="9" cy="6" r="1.3" fill="currentColor"/><circle cx="15" cy="6" r="1.3" fill="currentColor"/><circle cx="9" cy="12" r="1.3" fill="currentColor"/><circle cx="15" cy="12" r="1.3" fill="currentColor"/><circle cx="9" cy="18" r="1.3" fill="currentColor"/><circle cx="15" cy="18" r="1.3" fill="currentColor"/>',
    trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', lock:'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    tick:'<path d="m5 12 5 5 9-10"/>', ext:'<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'
  };
  // the legacy "Order & colors" choices (select[data-v195-tab-color])
  const TAB_COLORS = [['', 'Default'], ['#0076b6', 'Blue'], ['#00a6a6', 'Teal'], ['#16a05d', 'Green'], ['#d9a300', 'Yellow'], ['#f28c28', 'Orange'], ['#d64242', 'Red'], ['#c2185b', 'Pink'], ['#7b5cff', 'Purple'], ['#8a5a2b', 'Brown'], ['#6b7280', 'Gray'], ['#334155', 'Slate'], ['#111827', 'Black']];
  const ATTEMPT_SOURCES = [['first', '1st attempts only'], ['latest_completed', 'Latest completed'], ['active', 'Active selected'], ['completed_qbank', 'Completed Qbank tests'], ['latest_qbank', 'Latest Qbank test'], ['all_qbank', 'All Qbank tests']];
  const TAB_FLAGS = [['meter', 'Meter', 'data-lib-meter'], ['overall', 'Overall', 'data-lib-overall'], ['completed', 'Completed', 'data-lib-overview'], ['chip', '3-digit', 'data-lib-scorechip']];
  const setUi = {sec: store.get(SET_KEY, 'appearance'), page:'settings', data:null, backups:null, storage:null, stale:true, seq:0, future:false, defaults:false, color:'', open:{}, focus:'', switching:false, qidBackup:false};
  let setQueued = false, setObserver = null, syncObserver = null, themeAuto = false;
  const setViews = {};

  const legacyActive = () => window.__v195BSettingsActive || window.__v195SettingsActive || 'library';
  const legacyReady = name => legacyActive() === name && !!document.querySelector(`#settingsPanel .settings-content-v195 ${SET_READY[name] || '*'}`);
  // switches the hidden legacy Settings tab and waits for its controls (their values are filled by an async read)
  async function legacySetTab(name){
    if(legacyReady(name)) return true;
    const b = document.querySelector(`#settingsPanel [data-v195b-settings-tab="${name}"]`); if(!b) return false;
    setUi.switching = true;
    try{
      b.click();
      for(let i = 0; i < 60 && !legacyReady(name); i++) await wait(25);
      await wait(120);
    }finally{ setUi.switching = false; }
    return legacyReady(name);
  }
  async function legacyDo(tab, fn){
    if(!legacyReady(tab) && !await legacySetTab(tab)){ console.warn('ThunderUI: legacy settings tab missing', tab); return false; }
    // the legacy saves read their files first, so look again once they have landed
    try{ return fn(); }finally{ scheduleSettings(true); setTimeout(() => scheduleSettings(true), 400); setTimeout(() => scheduleSettings(true), 1300); }
  }
  const legacyIn = sel => document.querySelector('#settingsPanel .settings-content-v195 ' + sel);
  function clickLegacy(sel){ const b = document.querySelector(sel); if(!b || b.disabled){ console.warn('ThunderUI: legacy control missing', sel); return false; } b.click(); return true; }
  function setLegacyEl(el, value){
    if(!el) return false;
    if(el.type === 'checkbox'){ if(el.checked === !!value) return false; el.checked = !!value; }
    else { if(String(el.value) === String(value)) return false; el.value = String(value); }
    el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true}));
    return true;
  }
  // a legacy button found again by its tag, id and data-* attributes (the legacy lists re-render often)
  function legacySel(b, scope){
    const parts = [b.id ? '#' + CSS.escape(b.id) : b.tagName.toLowerCase()];
    Array.from(b.attributes).filter(a => /^data-/.test(a.name) && !/^data-(tu|html)/.test(a.name)).forEach(a => parts.push(`[${a.name}="${CSS.escape(a.value)}"]`));
    return (scope ? scope + ' ' : '') + parts.join('');
  }
  function mirrorBtn(b, cls, label, scope){
    if(!b) return '';
    return `<button type="button" class="tu-btn ${cls}" data-tu-mirror="${esc(legacySel(b, scope))}"${b.disabled ? ' disabled' : ''}>${esc(label || b.textContent.trim())}</button>`;
  }
  const shownEl = el => !!el && !el.hidden && !el.closest('[hidden]');
  const bytes = n => (Number(n) || 0) >= 1073741824 ? ((Number(n) || 0) / 1073741824).toFixed(1) + ' GB' : mb(n);
  const txt = el => (el && el.textContent || '').replace(/\s+/g, ' ').trim();
  const swRow = (title, hint, attr, on, extra) => `<div class="tu-setrow"><div><b>${title}</b><span>${hint}</span></div><div class="tu-setctl">${extra || ''}<button type="button" class="tu-switch" role="switch" aria-checked="${!!on}" aria-label="${esc(title)}" ${attr}><i></i></button></div></div>`;
  const setRow = (title, hint, ctl) => `<div class="tu-setrow"><div><b>${title}</b>${hint ? `<span>${hint}</span>` : ''}</div><div class="tu-setctl">${ctl}</div></div>`;
  const setTile = (ico, tone) => `<span class="tu-settile ${tone || ''}">${icon(ico, 22)}</span>`;

  /* theme: Light, Dark or Match device (the legacy toggle stays the only writer of the theme) */
  const darkMq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const isDark = () => !!byId('menu')?.classList.contains('theme-dark');
  function themeMode(){ return store.get(THEME_MODE, '') === 'system' ? 'system' : isDark() ? 'dark' : 'light'; }
  function toggleTheme(){ themeAuto = true; try{ byId('themeToggle')?.click(); }finally{ themeAuto = false; } setTimeout(() => { brand(); scheduleSettings(); }, 0); }
  function applySystemTheme(){ if(store.get(THEME_MODE, '') === 'system' && darkMq && darkMq.matches !== isDark()) toggleTheme(); }
  function setTheme(mode){
    store.set(THEME_MODE, mode === 'system' ? 'system' : 'manual');
    const want = mode === 'system' ? !!(darkMq && darkMq.matches) : mode === 'dark';
    if(want !== isDark()) toggleTheme(); else scheduleSettings();
  }
  if(darkMq){ if(darkMq.addEventListener) darkMq.addEventListener('change', applySystemTheme); else if(darkMq.addListener) darkMq.addListener(applySystemTheme); }

  function sections(){ return SET_SECTIONS.filter(([id]) => id !== 'admin' || (IPAD && !!document.querySelector('#settingsPanel [data-v195b-settings-tab="admin"]'))); }
  function tabRows(){
    const d = setUi.data || {tabs:[]}, pills = {}; libTabs().forEach(t => { pills[t.internal] = t; });
    return d.tabs.map(t => {
      const p = pills[t.key], color = t.color || (p && p.color) || TAB_DOTS[t.key] || TAB_DOTS.Custom;
      const name = t.key === 'All' ? 'All forms' : t.key === 'N-Forms' ? 'NBME' : (p && p.label) || t.label || t.key;
      const kind = t.key === 'All' ? 'Every loaded form' : t.builtIn ? 'Built-in' : 'Custom tab · ' + plural(t.forms, 'form');
      return Object.assign({}, t, {name, kind, shown: color, custom: !t.builtIn});
    });
  }

  /* section bodies */
  function appearanceBody(){
    const mode = themeMode(), accent = currentAccent(), view = store.get(KEYS.view, 'grid') === 'list' ? 'list' : 'grid';
    const seg = (v, l, ico) => `<button type="button" role="radio" aria-checked="${mode === v}" data-tu-theme="${v}">${ico ? icon(ICONS[ico], 16) : ''}${l}</button>`;
    const swatch = id => `<button type="button" class="tu-swatch" role="radio" aria-checked="${accent === id}" data-tu-pick="${id}"><svg viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="116" fill="${ACCENTS[id].brand}"/><path d="${BOLT}" fill="#fff"/></svg>${ACCENTS[id].label}</button>`;
    return `<div class="tu-sechead"><h2>Appearance</h2></div>` +
      setRow('Theme', 'Library, Qbank and Settings', `<div class="tu-setseg" role="radiogroup" aria-label="Theme">${seg('light', 'Light', 'sun')}${seg('dark', 'Dark', 'moon')}${seg('system', 'Match device')}</div>`) +
      setRow('Accent color', 'Buttons, selection, progress rings and the app icon. Crimson is the default.' + (IPAD ? ' The Home Screen icon updates when you add the app to the Home Screen again.' : ''), `<div class="tu-swatches" role="radiogroup" aria-label="Accent color">${Object.keys(ACCENTS).map(swatch).join('')}</div>`) +
      setRow('Exam style', 'NBME looks like test day (default). Modern applies the new design to answering, review and explanations, and fits phones. Also in the exam’s Settings menu and on the Score Report.', `<div class="tu-setseg" role="radiogroup" aria-label="Exam style">${[['nbme', 'NBME'], ['modern', 'Modern']].map(([v, l]) => `<button type="button" role="radio" aria-checked="${examStyle() === v}" data-tu-examstyle="${v}">${l}</button>`).join('')}</div>`) +
      setRow('Card density', 'Comfortable cards, or a compact list for big libraries', `<label class="tu-setselect"><span class="tu-sr">Card density</span><select data-tu-density><option value="grid"${view === 'grid' ? ' selected' : ''}>Comfortable</option><option value="list"${view === 'list' ? ' selected' : ''}>Compact</option></select></label>`);
  }
  function tabsBody(){
    const d = setUi.data || {tabs:[], future:{}}, rows = tabRows(), f = d.future || {};
    const box = (r, k, label) => {
      const dis = k === 'overall' && !r.overallSettable;
      return `<span class="tu-tabcell"><span class="tu-tablbl">${label}</span><button type="button" class="tu-check" role="checkbox" aria-checked="${!!r[k]}" aria-label="${label} for ${esc(r.name)}" data-tu-flag="${k}" data-key="${esc(r.key)}"${dis ? ' disabled title="All forms is a filter, not a form group"' : ''}>${r[k] ? icon(SET_ICONS.tick, 14) : ''}</button></span>`;
    };
    const body = rows.map((r, i) => {
      const colorName = (TAB_COLORS.find(([v]) => v && v === r.color) || [0, r.color ? 'Custom' : 'Default'])[1];
      const pop = setUi.color === r.key ? `<div class="tu-colorpop" role="radiogroup" aria-label="Color for ${esc(r.name)}">${TAB_COLORS.map(([v, l]) => `<button type="button" role="radio" aria-checked="${(r.color || '') === v}" data-tu-setcolor="${esc(v)}" data-key="${esc(r.key)}" title="${l}"><i style="background:${v || esc(TAB_DOTS[r.key] || TAB_DOTS.Custom)}"></i>${l}</button>`).join('')}</div>` : '';
      return `<div class="tu-tabrow" data-key="${esc(r.key)}"><button type="button" class="tu-drag" data-tu-drag="${esc(r.key)}" data-i="${i}" aria-label="Move ${esc(r.name)}. Drag, or use the up and down arrow keys" title="Drag to reorder">${icon(SET_ICONS.grip, 18)}</button>` +
        `<button type="button" class="tu-colorbtn" data-tu-colorbtn="${esc(r.key)}" aria-expanded="${setUi.color === r.key}" aria-label="Color for ${esc(r.name)}: ${colorName}" title="Color: ${colorName}"><i style="background:${esc(r.shown)}"></i></button>` +
        `<span class="tu-tabname"><b>${esc(r.name)}</b><small>${esc(r.kind)}</small></span>${TAB_FLAGS.map(([k, l]) => box(r, k, l)).join('')}` +
        `<span class="tu-tabdel">${r.custom ? `<button type="button" class="tu-qticon bad" data-tu-deltab="${esc(r.key)}" aria-label="Delete the ${esc(r.name)} tab" title="Delete tab (its forms move to Custom)">${icon(SET_ICONS.trash, 18)}</button>` : ''}</span>${pop}</div>`;
    }).join('');
    const on = [['meter', 'Meter'], ['overall', 'Overall'], ['completed', 'Completed']].filter(([k]) => f[k] !== false).map(([, l]) => l);
    const futureText = on.length ? `start with ${on.length > 1 ? on.slice(0, -1).join(', ') + ' and ' + on[on.length - 1] : on[0]} on.` : 'start with everything off.';
    const future = setUi.future ? `<div class="tu-futbox">${swRow('Meter', 'Show the tab’s progress bar', 'data-tu-futsw="setLibFutureCustomMeters"', f.meter !== false)}${swRow('Overall', 'Count the tab in the main progress ring', 'data-tu-futsw="setLibFutureCustomOverall"', f.overall !== false)}${swRow('Completed', 'List its completed forms under Completed', 'data-tu-futsw="setLibFutureCustomOverview"', f.completed !== false)}</div>` : '';
    return `<div class="tu-sechead"><h2>Library tabs</h2><p>Drag to reorder. <b>Meter</b> shows the tab’s progress bar, <b>Overall</b> counts it in the main progress ring, <b>Completed</b> lists its forms under Completed, <b>3-digit</b> shows score chips on its cards.</p></div>` +
      `<div class="tu-tabtable" data-tu-tabtable><div class="tu-tabrow tu-tabhead" aria-hidden="true"><span></span><span>Color</span><span>Tab</span>${TAB_FLAGS.map(([, l]) => `<span>${l}</span>`).join('')}<span></span></div>${body || '<div class="tu-qtempty">No library tabs yet.</div>'}</div>` +
      `<div class="tu-tabfoot"><span><b>New custom tabs</b> ${futureText}</span><button type="button" class="tu-btn outline small" data-tu-future aria-expanded="${setUi.future}">Change defaults</button></div>${future}`;
  }
  function qbankBody(){
    const q = (setUi.data && setUi.data.qbank) || {}, src = (ATTEMPT_SOURCES.find(([v]) => v === q.defaultAttemptSource) || ATTEMPT_SOURCES[0])[1];
    const summary = [q.defaultMode === 'tutor' ? 'Tutor' : 'Testing', (q.defaultSecondsPerQuestion || 90) + ' s', plural(q.defaultBlockSize || 40, 'question') + ' per block', src].join(' · ');
    const edit = setUi.defaults ? `<div class="tu-futbox tu-defbox">` +
      setRow('Mode', '', `<div class="tu-setseg" role="radiogroup" aria-label="Default mode"><button type="button" role="radio" aria-checked="${q.defaultMode !== 'tutor'}" data-tu-defmode="testing">Testing</button><button type="button" role="radio" aria-checked="${q.defaultMode === 'tutor'}" data-tu-defmode="tutor">Tutor</button></div>`) +
      setRow('Seconds per question', '', `<input type="number" min="15" step="5" inputmode="numeric" class="tu-setnum" aria-label="Default seconds per question" data-tu-setin="setDefaultSpq">`) +
      setRow('Questions per block', '', `<input type="number" min="1" inputmode="numeric" class="tu-setnum" aria-label="Default questions per block" data-tu-setin="setDefaultBlock">`) +
      setRow('Linked attempt source', 'Used when a test counts progress from Form Library attempts', `<label class="tu-setselect"><span class="tu-sr">Linked attempt source</span><select data-tu-setsel="setAttemptSource">${ATTEMPT_SOURCES.map(([v, l]) => `<option value="${v}"${v === (q.defaultAttemptSource || 'first') ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`) + '</div>' : '';
    return `<div class="tu-sechead"><h2>Qbank</h2></div>` +
      swRow('Default to Form Library attempts', 'New Qbank tests start with “Form Library attempts” as the source', 'data-tu-setsw="setLinkQbank" data-tab="qbank"', q.linkToLibrary) +
      setRow('Library is read-only for Qbank', 'Always on: Qbank reads form attempts but never writes to them', `<span class="tu-lockchip">${icon(SET_ICONS.lock, 15)}Locked on</span>`) +
      setRow('Defaults for new tests', esc(summary), `<button type="button" class="tu-btn outline small" data-tu-defaults aria-expanded="${setUi.defaults}">${setUi.defaults ? 'Done' : 'Edit'}</button>`) + edit +
      setRow('Reset Qbank history', 'Clears used-question history and the Qbank test list. Form progress is untouched.', `<button type="button" class="tu-btn outline small tu-danger" data-tu-reset>Reset…</button>`);
  }
  function safetyBody(){
    const v = id => { const el = legacyIn('#' + id); return el ? el.checked : true; };
    return `<div class="tu-sechead"><h2>Safety</h2></div>` +
      swRow('Protect 1st attempts', 'Extra confirmation before any change to a first attempt', 'data-tu-setsw="setProtectFirst" data-tab="safety"', v('setProtectFirst')) +
      swRow('Confirm before deleting attempts', 'Always ask before progress is removed', 'data-tu-setsw="setConfirmDelete" data-tab="safety"', v('setConfirmDelete'));
  }
  function qidModel(){
    const card = byId('qidMigrationCard'), sum = txt(card && card.querySelector('.qid-summary'));
    const msg = txt(card && card.querySelector('.qid-message'));
    const m = sum.match(/(\d+)\s*\/\s*(\d+)/), migrated = m ? +m[1] : 0, total = m ? +m[2] : 0;
    const qb = (sum.match(/Qbank:\s*([A-Z ]+?)(?:\s·|$)/) || [0, ''])[1].trim();
    const rows = card ? Array.from(card.querySelectorAll('.qid-table-wrap tbody tr')).map(tr => Array.from(tr.cells).map(txt)) : [];
    const need = rows.filter(c => c.length > 7 && !/^MIGRATED$/i.test(c[7]) && c[0] !== 'Qbank / history');
    if(/recovery created|Recovery:/i.test(msg)) setUi.qidBackup = true;
    return {card, scanned: !!m, migrated, total, ok: !!m && migrated === total && (!qb || qb === 'MIGRATED'), qb, msg, need, baseline: (sum.match(/Cloud baseline:\s*(\w+)/) || [0, ''])[1],
      busy: !!card && Array.from(card.querySelectorAll('[data-qid-action]')).some(b => b.disabled), has: a => !!(card && card.querySelector(`[data-qid-action="${a}"]`))};
  }
  function advancedBody(){
    const q = qidModel();
    if(!q.card) return `<div class="tu-sechead"><h2>Question ID migration</h2><p>Loading the migration tools…</p></div>` + wipeHtml();
    const cur = !q.scanned ? 1 : !q.ok ? (setUi.qidBackup ? 3 : 2) : 5;
    const btn = (act, label, main) => q.has(act) ? `<button type="button" class="tu-btn small ${main ? '' : 'outline'}" data-tu-qid="${act}"${q.busy ? ' disabled' : ''}>${label}</button>` : '';
    const step = (n, title, meta, act, done) => {
      const state = done ? 'done' : n === cur ? 'now' : 'later';
      return `<li class="tu-qidstep ${state}"><span class="tu-qidnum">${done ? icon(SET_ICONS.tick, 14) : n}</span><span class="tu-qidtext"><b>${title}</b>${meta ? `<small>${meta}</small>` : ''}</span><span class="tu-qidact">${act}</span></li>`;
    };
    const scanMeta = q.scanned ? `<em class="${q.ok ? 'ok' : 'warn'}">${q.migrated} ready · ${q.total - q.migrated} need IDs${q.qb && q.qb !== 'MIGRATED' ? ' · Qbank ' + esc(q.qb.toLowerCase()) : ''}</em>` : 'Checks every form for question IDs';
    const needList = q.need.length ? `<div class="tu-qidneed"><b>Need IDs</b>${q.need.slice(0, 8).map(c => `<span>${esc(c[0])} · ${esc(c[7].toLowerCase())}</span>`).join('')}${q.need.length > 8 ? `<span>and ${q.need.length - 8} more</span>` : ''}</div>` : '';
    const notNeeded = q.ok ? 'Not needed: every form has IDs' : '';
    const last = IPAD ? `${btn('baseline', 'Establish cloud baseline', cur === 5)}<button type="button" class="tu-btn small outline" data-tu-gosync>Backup &amp; sync</button>` : `<button type="button" class="tu-btn small${cur === 5 ? '' : ' outline'}" data-tu-gosync>Open Backup &amp; sync</button>`;
    return `<div class="tu-sechead"><h2>Question ID migration</h2><p>Run once on your main device, then copy the library and progress to other devices. Never migrate on two devices separately.</p></div>` +
      `<ol class="tu-qidsteps">` +
      step(1, 'Scan forms', scanMeta, btn('scan', q.scanned ? 'Rescan' : 'Scan', cur === 1), q.scanned) +
      step(2, 'Create recovery backup', notNeeded || 'A copy of the library and progress, saved before anything changes', btn('backup', 'Create', cur === 2), q.ok || setUi.qidBackup) +
      step(3, 'Migrate missing IDs', notNeeded || 'Adds IDs to the forms that need them', btn('migrate', 'Migrate', cur === 3), q.ok) +
      step(4, 'Verify library', q.ok ? 'Every form verified' : 'Checks the result', btn('verify', 'Verify', cur === 4), false) +
      step(5, 'Export full library, then progress', IPAD ? `iPad: establish the new cloud baseline${q.baseline ? ' (' + esc(q.baseline) + ')' : ''}, then export from Backup &amp; sync` : 'From Backup &amp; sync, so other devices import the same IDs', last, false) +
      `</ol>${needList}${q.msg ? `<p class="tu-qidmsg" role="status">${esc(q.msg)}</p>` : ''}` +
      `<div class="tu-settools">${btn('restore', 'Restore pre-migration backup')}${byId('scanDataFolderBtn') ? '<button type="button" class="tu-btn small outline" data-tu-proxy="scanDataFolderBtn">Rebuild library index</button>' : ''}${byId('exportCatalogBtn') ? '<button type="button" class="tu-btn small outline" data-tu-proxy="exportCatalogBtn">Save library index</button>' : ''}</div>` + wipeHtml();
  }
  /* Advanced › Device data: erase this app's IndexedDB (phones where Safari's own "Remove website data" does not work). */
  function wipeHtml(){
    const hint = IPAD ? 'Deletes the forms, progress, Qbank and sync records stored in this browser. Google Drive backups and exported files are not touched; reconnect Backup &amp; sync afterwards to restore.' : 'Forgets the DATA folder link and other records kept in this browser. Files in your DATA folder are not touched.';
    return `<div class="tu-sechead" style="margin-top:28px"><h2>Device data</h2></div>` + setRow('Delete data on this device', hint, `<button type="button" class="tu-btn small danger" data-tu-wipe${wipeBusy ? ' disabled' : ''}>${wipeBusy ? 'Deleting…' : 'Delete data'}</button>`);
  }
  let wipeBusy = false;
  async function wipeDeviceData(){
    if(wipeBusy) return;
    if(!confirm(IPAD ? 'Delete everything this app stores on this device (forms, progress, Qbank, sync records)?\n\nGoogle Drive backups are not touched. Export or back up first if this device has progress that is not in Google Drive.' : 'Delete the browser data of this app (DATA folder link and records)?\n\nYour DATA folder files are not touched.')) return;
    if(IPAD && String(prompt('Type DELETE to erase this device\'s library and progress.') || '').trim().toUpperCase() !== 'DELETE') return;
    wipeBusy = true; scheduleSettings(true);
    let names = [];
    try{ names = indexedDB.databases ? (await indexedDB.databases()).map(d => d.name).filter(Boolean) : []; }catch(e){}
    // Open connections only delay a delete; it finishes when this page unloads, before the reloaded page opens anything.
    await Promise.all(names.map(n => new Promise(res => { try{ const r = indexedDB.deleteDatabase(n); r.onsuccess = r.onerror = res; r.onblocked = () => setTimeout(res, 300); }catch(e){ res(); } })));
    try{ sessionStorage.clear(); }catch(e){}
    location.reload();
  }
  function adminBody(){
    const box = legacyIn('.fu-admin');
    if(!box) return `<div class="tu-sechead"><h2>Form installations</h2><p>Loading…</p></div>`;
    const unlocked = !!box.querySelector('[data-fu="lock"]'), status = txt(box.querySelector('#fuAdminStatus'));
    const busy = !!box.querySelector('#fuAdminUnlock button[disabled], #fuAdminFilters button[disabled]');
    const rows = Array.from(box.querySelectorAll('.fu-admin-table tbody tr')).map(tr => Array.from(tr.cells).map(td => [txt(td.querySelector('b')) || txt(td.firstChild), txt(td.querySelector('small'))]));
    const empty = txt(box.querySelector('.fu-empty'));
    const head = `<div class="tu-sechead tu-adminhead"><div><h2>Form installations</h2><p>See which devices installed which online forms. iPad app only.</p></div><span class="tu-lockchip${unlocked ? ' open' : ''}">${icon(SET_ICONS.lock, 15)}${unlocked ? 'Unlocked' : 'Locked'}</span></div>`;
    const device = `<div class="tu-adminform"><label class="tu-setfield"><span>This device’s name</span><input type="text" maxlength="80" placeholder="e.g. iPad Pro" data-tu-admin="device" autocomplete="off"></label><button type="button" class="tu-btn small outline" data-tu-adminact="device">Save name</button></div>`;
    const body = !unlocked
      ? `<div class="tu-adminform"><label class="tu-setfield"><span>Admin password</span><input type="password" autocomplete="current-password" data-tu-admin="password"></label><button type="button" class="tu-btn small" data-tu-adminact="unlock"${busy ? ' disabled' : ''}>Unlock</button></div><p class="tu-note">Stays unlocked in this browser until you lock it.</p>`
      : `<div class="tu-adminform tu-adminfilters"><label class="tu-setfield"><span>Search</span><input type="search" placeholder="User, device or form" data-tu-admin="fuAdminSearch"></label><label class="tu-setfield"><span>Form ID</span><input type="text" data-tu-admin="fuAdminForm"></label><label class="tu-setfield"><span>Revision</span><input type="text" data-tu-admin="fuAdminRevision"></label><button type="button" class="tu-btn small outline" data-tu-adminact="filter"${busy ? ' disabled' : ''}>Refresh</button></div>` +
        `<div class="tu-admintable"><div class="tu-adminrow tu-adminth" aria-hidden="true"><span>Form</span><span>User / device</span><span>Installed</span></div>${rows.map(c => `<div class="tu-adminrow">${c.map(([a, b]) => `<span><b>${esc(a)}</b>${b ? `<small>${esc(b)}</small>` : ''}</span>`).join('')}</div>`).join('') || `<div class="tu-qtempty">${esc(empty || 'No installations to show.')}</div>`}</div>` +
        `<div class="tu-settools">${box.querySelector('[data-fu="more"]') ? `<button type="button" class="tu-btn small outline" data-tu-adminact="more"${busy ? ' disabled' : ''}>Load more</button>` : ''}<button type="button" class="tu-btn small outline" data-tu-adminact="lock">Lock admin</button></div>`;
    return head + device + body + (status ? `<p class="tu-qidmsg" role="status">${esc(status)}</p>` : '');
  }
  function syncBuild(){ const m = txt(document.querySelector('#progressSyncPanel .sync-footer')).match(/SYNC-(V[\d.]+)/i); return m ? m[1] : ''; }
  function aboutBody(){
    const file = decodeURIComponent(location.pathname.split('/').pop() || ''), lv = (file.match(/v(\d+(?:\.\d+)+)/i) || [0, ''])[1];
    const shell = IPAD ? Number((window.StepAppUpdates && window.StepAppUpdates.version) || txt(byId('appVersionLabel')).replace(/\D+/g, '')) || 0 : 0;
    const ver = ['Version ' + TU_RELEASE, IPAD ? (shell && shell !== TU_RELEASE ? 'app shell ' + shell + ' (reload to update)' : '') : 'Local app' + (lv ? ' · simulator ' + lv : ''), IPAD && syncBuild() ? 'sync ' + syncBuild() : ''].filter(Boolean).join(' · ');
    return `<div class="tu-sechead"><h2>About &amp; updates</h2></div>` + setRow('Version', esc(ver), '') +
      (IPAD && byId('updateAppShellBtn') ? setRow('Update app', 'Reloads the latest version. Your library and progress are kept.', '<button type="button" class="tu-btn small" data-tu-proxy="updateAppShellBtn">Update &amp; reload</button>') : !IPAD ? setRow('Updates', 'Replace this HTML file in your Step Simulator folder with the new version. Your DATA folder is not touched.', '') : '') +
      (IPAD ? setRow('Privacy policy', '', `<a class="tu-btn small outline" href="./privacy.html" target="_blank" rel="noopener">Open${icon(SET_ICONS.ext, 15)}</a>`) : '');
  }
  const SET_BODIES = {appearance:appearanceBody, tabs:tabsBody, qbank:qbankBody, safety:safetyBody, advanced:advancedBody, admin:adminBody, about:aboutBody};

  /* Backup & sync page */
  function storageHtml(){
    const status = byId('dataFolderStatus'), ok = !!status && status.classList.contains('connected');
    let n = 0; try{ n = bridge().forms().length; }catch(e){}
    const st = setUi.storage, pct = st && st.quota ? Math.min(100, Math.max(1, Math.round(st.usage / st.quota * 100))) : 0;
    const folder = (txt(status).match(/\(([^)]+)\)/) || [0, 'DATA'])[1];
    const meta = IPAD ? [plural(n, 'form'), st && st.quota ? `${bytes(st.usage)} of ${bytes(st.quota)} browser storage` : 'stored in this browser'].join(' · ') : ok ? `${folder} · ${plural(n, 'form')} · saved to disk automatically` : 'Connect your DATA folder to load your forms and progress.';
    const btns = (ok && byId('scanDataFolderBtn') ? '<button type="button" class="tu-btn small outline" data-tu-proxy="scanDataFolderBtn">Rescan</button>' : '') +
      (byId('connectDataFolderBtn') && (!IPAD || !ok) ? `<button type="button" class="tu-btn small ${ok ? 'outline' : ''}" data-tu-proxy="connectDataFolderBtn">${IPAD ? 'Start storage' : ok ? 'Change folder' : 'Connect DATA folder'}</button>` : '');
    return `<div class="tu-synchead">${setTile(SET_ICONS.folder, ok ? 'ok' : 'warn')}<div class="tu-syncttl"><div><h2>${IPAD ? 'Library on this iPad' : 'DATA folder'}</h2><em class="tu-statchip ${ok ? 'ok' : 'warn'}">${ok ? 'Connected' : 'Not connected'}</em></div><span>${esc(meta)}</span>${IPAD && pct ? `<span class="tu-meter" aria-hidden="true"><i style="width:${pct}%"></i></span>` : ''}</div><div class="tu-actions">${btns}</div></div>`;
  }
  const SYNC_LABELS = {connect:'Connect Google Drive', backup:'Sync now', 'restore-cloud':'Restore from Drive', disconnect:'Disconnect', check:'Reconnect'};
  function progressHtml(){
    const P = byId('progressSyncPanel'), sv = syncView() || {label:'Off', detail:'', tone:'offline'};
    const acts = P ? Array.from(P.querySelectorAll('#stepSyncActions button')) : [];
    const connected = acts.some(b => b.dataset.stepSyncAction === 'disconnect');
    const conn = acts.find(b => b.dataset.stepSyncAction === (connected ? 'disconnect' : 'connect')) || acts.find(b => b.dataset.stepSyncAction === 'check');
    const last = txt(byId('stepSyncLastText')), detail = txt(byId('stepSyncDetailText')) || sv.detail;
    const sub = [sv.label, detail && detail !== sv.label ? detail : '', last && last !== 'Never' ? 'last backup ' + last : connected ? '' : ''].filter(Boolean).join(' · ');
    const tr = byId('stepProgressTransfer'), trHtml = shownEl(tr) ? `<div class="tu-xfer"><div class="tu-xferhead"><b>${esc(txt(byId('stepTransferTitle')))}</b><span>${esc(txt(byId('stepTransferPct')))}</span></div><span class="tu-meter"><i style="width:${esc((byId('stepTransferBar') || {style:{}}).style.width || '0%')}"></i></span><div class="tu-xferfoot"><span>${esc(txt(byId('stepTransferForm')))} · ${esc(txt(byId('stepTransferBytes')))}</span></div></div>` : '';
    const decisions = P ? Array.from(P.querySelectorAll('#stepSyncDecisionNotice .sync-decision-row')).map(r => {
      const h = txt(r.querySelector('h4')), cmp = Array.from(r.querySelectorAll('.sync-compare > div')).map(txt);
      return `<div class="tu-banner tu-decide" role="group" aria-label="${esc(h)}"><div><b>${esc(h)}</b><span>Nothing is overwritten until you choose.${cmp.length ? ' ' + esc(cmp.join(' · ')) : ''}</span></div><div class="tu-actions">${Array.from(r.querySelectorAll('button')).map(b => mirrorBtn(b, b.classList.contains('primary') ? 'small tu-warnbtn' : 'small outline', null, '#stepSyncDecisionNotice')).join('')}</div></div>`;
    }).join('') : '';
    const btns = acts.filter(b => b !== conn || !connected).filter(b => b.dataset.stepSyncAction !== 'disconnect').map((b, i) => mirrorBtn(b, i ? 'small outline' : 'small', SYNC_LABELS[b.dataset.stepSyncAction] || null, '#stepSyncActions')).join('') +
      (connected && conn ? mirrorBtn(conn, 'small text', 'Disconnect', '#stepSyncActions') : '');
    const sw = conn ? `<button type="button" class="tu-switch" role="switch" aria-checked="${connected}" aria-label="Google Drive progress sync" data-tu-mirror="${esc(legacySel(conn, '#stepSyncActions'))}"${conn.disabled ? ' disabled' : ''}><i></i></button>` : '';
    return `<div class="tu-synchead">${setTile(ICONS.sync, sv.tone === 'good' ? 'ok' : sv.tone === 'error' ? 'bad' : '')}<div class="tu-syncttl"><h2>Google Drive progress sync</h2><span class="tu-synctone" data-tone="${esc(sv.tone)}">${esc(sub || 'Off')}</span></div>${sw}</div>${decisions}${trHtml}<div class="tu-actions tu-cardacts">${btns}</div>`;
  }
  function libraryCardHtml(){
    const card = byId('libraryBackupCard'); if(!card) return '';
    const msg = card.querySelector('#libraryBackupMessage'), pct = txt(byId('libraryTransferPct')), running = pct && pct !== 'Idle';
    const ctl = ['libraryTransferPause', 'libraryTransferResume', 'libraryTransferCancel'].map(id => byId(id)).filter(b => b && !b.hidden).map(b => mirrorBtn(b, b.id === 'libraryTransferCancel' ? 'small text tu-danger' : 'small outline')).join('');
    const xfer = running ? `<div class="tu-xfer"><div class="tu-xferhead"><b>${esc(txt(byId('libraryTransferCurrent')))}</b><span>${esc([txt(byId('libraryTransferSpeed')), txt(byId('libraryTransferEta'))].filter(x => x && x !== '—').join(' · ~') || pct)}</span></div><span class="tu-meter"><i style="width:${esc(byId('libraryTransferBar')?.style.width || '0%')}"></i></span><div class="tu-xferfoot"><span>${esc(pct)} · ${esc(txt(byId('libraryTransferBytes')))}</span><div class="tu-actions">${ctl}</div></div></div>` : '';
    const sub = [txt(msg && msg.querySelector('b')), txt(msg && msg.querySelector('span'))].filter(Boolean).join(' · ') || 'Forms and images only';
    const b = a => card.querySelector(`[data-library-action="${a}"]`);
    return `<div class="tu-synchead">${setTile(ICONS.library)}<div class="tu-syncttl"><h2>Full library in Google Drive</h2><span>${esc(sub)}</span></div></div>${xfer}<div class="tu-actions tu-cardacts">${mirrorBtn(b('backup'), 'small tonal', 'Back up library', '#libraryBackupCard')}${mirrorBtn(b('restore'), 'small outline', 'Download library', '#libraryBackupCard')}</div>`;
  }
  function collHtml(key, title, sub, body){
    const open = !!setUi.open[key];
    return `<button type="button" class="tu-collhead" aria-expanded="${open}" data-tu-coll="${key}"><span><b>${title}</b><small>${esc(sub)}</small></span>${icon(ICONS.chevron, 20)}</button>${open ? `<div class="tu-collbody">${body}</div>` : ''}`;
  }
  function rowsFrom(sel, scope){
    return Array.from(document.querySelectorAll(scope + ' ' + sel)).map(r => `<div class="tu-histrow"><span><b>${esc(txt(r.querySelector('h4')))}</b><small>${esc(txt(r.querySelector(':scope > div:not(.sync-row-actions)')))}</small></span><span class="tu-actions">${Array.from(r.querySelectorAll('button')).map(b => mirrorBtn(b, 'small outline', b.textContent.trim().replace(/^Restore Previous$/, 'Restore').replace(/^Delete Recovery$/, 'Delete').replace(/^Undo Last Cloud Restore$/, 'Undo restore'), scope)).join('')}</span></div>`).join('');
  }
  function historyHtml(){
    const P = byId('progressSyncPanel'); if(!P) return '';
    const hist = Array.from(P.querySelectorAll('#stepSyncHistory .sync-history-row')), daily = hist.filter(r => /^Daily/i.test(txt(r.querySelector('h4')))).length, rec = P.querySelectorAll('#stepSyncRecovery .sync-recovery-row').length;
    const sub = [plural(daily, 'daily snapshot'), plural(hist.length - daily, 'manual snapshot'), plural(rec, 'previous version')].join(' · ');
    const snap = P.querySelector('[data-step-sync-action="manual-snapshot"]');
    const body = (rowsFrom('.sync-history-row', '#stepSyncHistory') || '<div class="tu-histrow"><span><b>No snapshots yet</b><small>A daily snapshot is kept automatically once Google Drive is connected</small></span></div>') +
      rowsFrom('.sync-recovery-row', '#stepSyncRecovery') +
      `<div class="tu-histrow"><span><b>Full progress backup file</b><small>Saved on this iPad in progress/backups and downloaded</small></span><span class="tu-actions"><button type="button" class="tu-btn small outline" data-tu-v101="backup-full-progress">Save</button><button type="button" class="tu-btn small outline" data-tu-v101="import-full-progress">Import</button></span></div>` +
      (snap ? `<div class="tu-histrow"><span><b>New manual snapshot</b><small>Kept until you delete it</small></span><span class="tu-actions">${mirrorBtn(snap, 'small', 'Create', '#progressSyncPanel')}</span></div>` : '');
    return collHtml('hist', 'History &amp; recovery', sub, body);
  }
  function advancedSyncHtml(){
    const P = byId('progressSyncPanel'); if(!P) return '';
    const a = act => P.querySelector(`[data-step-sync-action="${act}"]`), lib = byId('libraryBackupCard'), clear = lib && lib.querySelector('[data-library-action="clear-extra"]');
    const metrics = Array.from(P.querySelectorAll('#stepSyncInventory .sync-metric')).map(m => `<span><small>${esc(txt(m.querySelector('span')))}</small><b>${esc(txt(m.querySelector('b')))}</b></span>`).join('');
    const diag = txt(byId('stepSyncDiagnostics'));
    const body = `<div class="tu-actions">${mirrorBtn(a('check'), 'small outline', 'Check cloud manifest', '#progressSyncPanel')}${mirrorBtn(a('diagnose'), 'small outline', 'Diagnose sync', '#progressSyncPanel')}${mirrorBtn(a('validate'), 'small outline', 'Validate local progress', '#progressSyncPanel')}</div>` +
      (metrics ? `<div class="tu-metrics">${metrics}</div>` : '') + (diag ? `<p class="tu-diag">${esc(diag.slice(0, 1200))}</p>` : '') +
      `<div class="tu-dangerzone"><b>Cloud reset</b><div class="tu-actions">${mirrorBtn(clear, 'small outline tu-danger', 'Clear extra cloud library data', '#libraryBackupCard')}${mirrorBtn(a('replace-cloud-progress'), 'small outline tu-danger', 'Replace cloud with this iPad', '#progressSyncPanel')}${mirrorBtn(a('clear-cloud-progress'), 'small outline tu-danger', 'Clear cloud progress', '#progressSyncPanel')}</div></div>` +
      `<p class="tu-note">Progress sync and history are separate from the full library backup. <a href="./privacy.html" target="_blank" rel="noopener">Privacy policy</a>${syncBuild() ? ' · sync ' + esc(syncBuild()) : ''}</p>`;
    return collHtml('adv', 'Advanced sync tools', 'Diagnostics and cloud reset. Rarely needed.', body);
  }
  function recoveryLocalHtml(){
    const list = setUi.backups || [];
    const body = list.length ? list.slice(0, 25).map(f => `<div class="tu-histrow"><span><b>${esc(f.name)}</b><small>${esc([f.modifiedAt ? new Date(f.modifiedAt).toLocaleString() : '', mb(f.size)].filter(Boolean).join(' · '))}</small></span></div>`).join('') + (list.length > 25 ? `<p class="tu-note">and ${list.length - 25} older copies</p>` : '') + '<p class="tu-note">To restore one, choose Import below and pick the file from DATA/progress/backups.</p>'
      : '<div class="tu-histrow"><span><b>No recovery copies yet</b><small>One is written before every import and export</small></span></div>';
    return collHtml('rec', 'Recovery copies in DATA/progress/backups', 'Written automatically before every import and export' + (list.length ? ' · ' + plural(list.length, 'copy').replace('copys', 'copies') : ''), body);
  }
  function moveHtml(){
    const pair = (n, title, sub, exp, imp) => `<div class="tu-movetile"><span class="tu-movenum">${n}</span><span><b>${title}</b><small>${sub}</small></span><span class="tu-actions">${exp}${imp}</span></div>`;
    const ip = (id, label) => byId(id) ? `<button type="button" class="tu-btn small outline" data-tu-proxy="${id}">${label}</button>` : '';
    const lc = (act, label) => `<button type="button" class="tu-btn small outline" data-tu-compat="${act}">${label}</button>`;
    const lib = IPAD ? [ip('exportFullLibraryBackupBtn', 'Export'), ip('importFullLibraryBackupBtn', 'Import')] : [lc('export-library', 'Export'), lc('import-library', 'Import')];
    const prog = IPAD ? [ip('exportProgressOnlyBackupBtn', 'Export'), ip('importProgressOnlyBackupBtn', 'Import')] : [lc('export-progress', 'Export'), lc('import-progress', 'Import')];
    const note = IPAD ? 'For moving to the Local app or a new device: import the library first, then the progress. Imports never inherit cloud history.' : 'Works with the iPad app: import the library first, then the progress. A copy of each export is also kept in DATA/progress/backups.';
    return `<div class="tu-sechead"><h2>Move between devices</h2><p>${note}</p></div><div class="tu-moves">${pair(1, 'Form library ZIP', 'Forms, images, tab setup', ...lib)}${pair(2, 'Progress ZIP', 'Attempts, Qbank, 3-digit scores', ...prog)}</div>`;
  }

  /* mounting and painting */
  function ensureSetView(panel, id){
    let v = setViews[id];
    if(!v){
      v = document.createElement('div'); v.id = id; v.className = 'tu-setview';
      v.innerHTML = id === 'tuSettings'
        ? `<header class="tu-sethead"><h1>Settings</h1><span>Applies to the library and Qbank. Exam-screen options stay in the exam’s own Settings menu.</span></header><div class="tu-setgrid"><nav class="tu-setnav" aria-label="Settings sections" data-tu-r="nav"></nav><section class="tu-card tu-setbody" data-tu-r="body"></section></div>`
        : `<header class="tu-sethead"><h1>Backup &amp; sync</h1><span>Your progress is saved on this device first. Everything else is an extra copy.</span></header><section class="tu-card tu-synccard" aria-label="Storage" data-tu-r="storage"></section>` +
          (IPAD ? `<div class="tu-syncgrid"><section class="tu-card tu-synccard" aria-label="Google Drive progress sync" data-tu-r="progress"></section><section class="tu-card tu-synccard" aria-label="Full library in Google Drive" data-tu-r="library"></section></div><section class="tu-card tu-synccoll" aria-label="History and recovery" data-tu-r="hist"></section><section class="tu-card tu-synccoll" aria-label="Advanced sync tools" data-tu-r="adv"></section>`
            : `<section class="tu-card tu-synccoll" aria-label="Recovery copies" data-tu-r="rec"></section>`) +
          `<section class="tu-card tu-synccard" aria-label="Move between devices" data-tu-r="move"></section>`;
      v.addEventListener('click', onSetClick);
      v.addEventListener('change', onSetChange);
      v.addEventListener('keydown', onSetKey);
      v.addEventListener('pointerdown', onDragStart);
      v.addEventListener('focusin', e => { const a = e.target; setUi.focus = a && a.attributes ? Array.from(a.attributes).filter(x => /^data-tu|^data-key$/.test(x.name)).map(x => `[${x.name}="${CSS.escape(x.value)}"]`).join('') : ''; });
      setViews[id] = v;
    }
    v.dataset.host = panel.id;
    if(v.parentNode !== panel){ panel.insertBefore(v, panel.firstChild); if(setUi.focus && document.activeElement === document.body) v.querySelector(setUi.focus)?.focus({preventScroll:true}); }
    return v;
  }
  const setRegion_ = (v, name) => v.querySelector(`[data-tu-r="${name}"]`);
  // number/text inputs are filled after each render (not in the markup), so typing never triggers a re-render
  function setSyncInputs(v){
    v.querySelectorAll('[data-tu-setin]').forEach(el => { if(el === document.activeElement) return; const src = legacyIn('#' + el.dataset.tuSetin); const q = (setUi.data && setUi.data.qbank) || {}; const val = src ? src.value : el.dataset.tuSetin === 'setDefaultSpq' ? q.defaultSecondsPerQuestion : q.defaultBlockSize; if(val != null && el.value !== String(val)) el.value = String(val); });
    v.querySelectorAll('[data-tu-admin]').forEach(el => { const k = el.dataset.tuAdmin; if(el === document.activeElement || k === 'password') return; const src = legacyIn(k === 'device' ? '#fuDeviceLabel' : '#' + k); if(src && el.value !== src.value) el.value = src.value; });
  }
  function paintSetView(panel){
    const v = ensureSetView(panel, 'tuSettings'), secs = sections();
    if(!secs.some(([id]) => id === setUi.sec)) setUi.sec = 'appearance';
    swapHtml(setRegion_(v, 'nav'), secs.map(([id, l]) => `<button type="button" data-tu-sec="${id}" aria-current="${setUi.sec === id ? 'page' : 'false'}">${esc(l)}${id === 'admin' ? '<small>iPad</small>' : ''}</button>`).join(''));
    swapHtml(setRegion_(v, 'body'), SET_BODIES[setUi.sec]());
    setSyncInputs(v);
    const want = SET_LEGACY[setUi.sec];
    if(want && !setUi.switching && !legacyReady(want) && !(setUi.sec === 'tabs' && ['order', 'custom'].includes(legacyActive()))) legacySetTab(want).then(() => scheduleSettings(true));
  }
  function paintSyncView(panel){
    const v = ensureSetView(panel, 'tuSync');
    swapHtml(setRegion_(v, 'storage'), storageHtml());
    if(IPAD){ swapHtml(setRegion_(v, 'progress'), progressHtml()); swapHtml(setRegion_(v, 'library'), libraryCardHtml()); swapHtml(setRegion_(v, 'hist'), historyHtml()); swapHtml(setRegion_(v, 'adv'), advancedSyncHtml()); }
    else swapHtml(setRegion_(v, 'rec'), recoveryLocalHtml());
    swapHtml(setRegion_(v, 'move'), moveHtml());
    // keep the hidden legacy Backup tab drawn, so its buttons (and the file pickers they open) answer at once
    if(!setUi.switching && !legacyReady('backup') && !(IPAD && byId('settingsPanel')?.classList.contains('active'))) legacySetTab('backup');
  }
  function scheduleSettings(fresh){
    if(fresh) setUi.stale = true;
    if(setQueued) return; setQueued = true;
    requestAnimationFrame(() => { setQueued = false; paintSettings().catch(e => console.warn('ThunderUI settings failed', e)); });
  }
  async function paintSettings(){
    const B = bridge(), panel = byId('settingsPanel'); if(!B || !B.settings || !panel) return;
    watchSettingsView();
    const syncPanel = IPAD ? byId('progressSyncPanel') : panel, onSet = panel.classList.contains('active');
    if(!IPAD && !onSet && setUi.page === 'sync') setSyncPage(false);
    const onSync = !!syncPanel && syncPanel.classList.contains('active') && (IPAD || setUi.page === 'sync'), showSet = onSet && !(!IPAD && setUi.page === 'sync');
    if(!onSync && !showSet) return;
    const draw = () => {
      panel.classList.add('tu-has-settings');
      if(showSet) paintSetView(panel);
      if(onSync){ syncPanel.classList.add('tu-has-sync'); paintSyncView(syncPanel); }
      if(setViews.tuSettings) setViews.tuSettings.hidden = !showSet;
      if(setViews.tuSync && !IPAD) setViews.tuSync.hidden = !onSync;
      heroTitle();
      setObserver && setObserver.takeRecords(); syncObserver && syncObserver.takeRecords();
    };
    if(setUi.stale || !setUi.data){
      if(setUi.data) draw(); // the cached data first, so the view is on screen in the frame the tab opens
      const n = ++setUi.seq; setUi.stale = false;
      const [d, bk, st] = await Promise.all([B.settings(), !IPAD && onSync && B.backups ? B.backups() : null, IPAD && onSync && navigator.storage && navigator.storage.estimate ? navigator.storage.estimate().catch(() => null) : null]);
      if(n !== setUi.seq) return;
      setUi.data = d; if(bk) setUi.backups = bk; if(st) setUi.storage = st;
    }
    draw();
  }
  // a panel that was just opened (or rewritten by the legacy code while open) is painted before the browser draws the
  // frame: MutationObserver callbacks run after the click handler and before paint, a requestAnimationFrame does not
  const openedNow = (recs, el) => el.classList.contains('active') && recs.some(r => r.target === el && (r.type === 'childList' || (r.attributeName === 'class' && !/(^|\s)active(\s|$)/.test(r.oldValue || ''))));
  // warm the Qbank and Settings data so a first visit can draw at once (pointerdown comes ~100 ms before the click)
  function prefetchViews(which, fresh){
    const B = bridge(); if(!B) return;
    if((!which || which === 'qbank') && B.qbank && (fresh || !qbUi.data)) B.qbank().then(d => { if(fresh || !qbUi.data) qbUi.data = d; }).catch(() => {});
    if((!which || which === 'settings') && B.settings && (fresh || !setUi.data)) B.settings().then(d => { if(fresh || !setUi.data) setUi.data = d; }).catch(() => {});
  }
  function watchSettingsView(){
    const ours = recs => recs.every(r => r.target.closest && r.target.closest('.tu-setview'));
    const p = byId('settingsPanel');
    if(p && !setObserver){
      setObserver = new MutationObserver(recs => {
        // the legacy renderSettings rewrites the panel and drops the views; put the same nodes back at once
        Object.values(setViews).forEach(v => { if(v.dataset.host === 'settingsPanel' && !p.contains(v)) ensureSetView(p, v.id); });
        if(ours(recs)) return;
        if(openedNow(recs, p)){ setUi.stale = true; paintSettings().catch(e => console.warn('ThunderUI settings failed', e)); } else scheduleSettings(true);
      });
      setObserver.observe(p, {childList:true, subtree:true, attributes:true, attributeOldValue:true, characterData:true, attributeFilter:['class', 'disabled', 'hidden']});
    }
    const s = IPAD ? byId('progressSyncPanel') : null;
    if(s && !syncObserver){
      syncObserver = new MutationObserver(recs => {
        if(ours(recs)) return;
        if(openedNow(recs, s)){ setUi.stale = true; paintSettings().catch(e => console.warn('ThunderUI settings failed', e)); } else scheduleSettings(true);
      });
      syncObserver.observe(s, {childList:true, subtree:true, attributes:true, attributeOldValue:true, characterData:true, attributeFilter:['class', 'disabled', 'hidden', 'style']});
    }
  }
  // Local: Backup & sync is its own sidebar page, drawn over the hidden legacy Settings › Backup tab
  function setSyncPage(on){
    setUi.page = on ? 'sync' : 'settings';
    const tab = byId('tuSyncTab'), st = byId('settingsTab');
    if(tab) tab.classList.toggle('active', on && !!byId('settingsPanel')?.classList.contains('active'));
    if(st && on) st.classList.remove('active');
    if(st && !on && byId('settingsPanel')?.classList.contains('active')) st.classList.add('active');
    heroTitle(); scheduleSettings(true);
  }
  function openSyncPage(){
    if(IPAD){ byId('progressSyncTab')?.click(); return; }
    setUi.page = 'sync';
    if(!byId('settingsPanel')?.classList.contains('active')) byId('settingsTab')?.click();
    setSyncPage(true);
    legacySetTab('backup').then(() => scheduleSettings(true));
  }
  function ensureSyncTab(){
    if(IPAD || byId('tuSyncTab')) return;
    const st = byId('settingsTab'); if(!st) return;
    const b = document.createElement('button'); b.type = 'button'; b.id = 'tuSyncTab'; b.className = 'menu-tab';
    b.innerHTML = icon(ICONS.sync, 22) + '<span class="tu-tab-label">Backup &amp; sync</span>';
    b.addEventListener('click', e => { e.preventDefault(); openSyncPage(); });
    st.parentNode.insertBefore(b, st);
  }

  /* actions */
  function goSection(id){
    setUi.sec = id; setUi.color = ''; store.set(SET_KEY, id);
    scheduleSettings(true);
    const want = SET_LEGACY[id]; if(want && !legacyReady(want)) legacySetTab(want).then(() => scheduleSettings(true));
  }
  function onSetClick(e){
    const t = e.target.closest('button,a'); if(!t || t.disabled || t.tagName === 'A') return;
    const ds = t.dataset;
    if(ds.tuSec){ goSection(ds.tuSec); return; }
    if(ds.tuTheme){ setTheme(ds.tuTheme); return; }
    if(ds.tuExamstyle){ setExamStyle(ds.tuExamstyle); return; }
    if(ds.tuFlag && ds.key){
      const f = TAB_FLAGS.find(([k]) => k === ds.tuFlag), on = t.getAttribute('aria-checked') !== 'true';
      t.setAttribute('aria-checked', String(on)); t.innerHTML = on ? icon(SET_ICONS.tick, 14) : '';
      legacyDo('library', () => setLegacyEl(legacyIn(`[${f[2]}="${CSS.escape(ds.key)}"]`), on)); return;
    }
    if(ds.tuColorbtn){ setUi.color = setUi.color === ds.tuColorbtn ? '' : ds.tuColorbtn; scheduleSettings(); return; }
    if(ds.tuSetcolor != null && ds.key){ const key = ds.key, val = ds.tuSetcolor; setUi.color = ''; legacyDo('order', () => setLegacyEl(legacyIn(`select[data-v195-tab-color="${CSS.escape(key)}"]`), val)); return; }
    if(ds.tuDeltab){ const key = ds.tuDeltab; legacyDo('custom', () => clickLegacy(`#settingsPanel [data-v195-delete-tab="${CSS.escape(key)}"]`)); return; }
    if(t.hasAttribute('data-tu-future')){ setUi.future = !setUi.future; scheduleSettings(); return; }
    if(ds.tuFutsw){ const id = ds.tuFutsw, on = t.getAttribute('aria-checked') !== 'true'; t.setAttribute('aria-checked', String(on)); legacyDo('library', () => setLegacyEl(legacyIn('#' + id), on)); return; }
    if(ds.tuSetsw){ const id = ds.tuSetsw, on = t.getAttribute('aria-checked') !== 'true'; t.setAttribute('aria-checked', String(on)); legacyDo(ds.tab, () => setLegacyEl(legacyIn('#' + id), on)); return; }
    if(t.hasAttribute('data-tu-defaults')){ setUi.defaults = !setUi.defaults; scheduleSettings(); if(setUi.defaults) legacySetTab('safety').then(() => scheduleSettings(true)); return; }
    if(ds.tuDefmode){ const v = ds.tuDefmode; legacyDo('safety', () => { setLegacyEl(legacyIn('#setDefaultMode'), v); setLegacy('qbankRunMode', v); }); return; }
    if(t.hasAttribute('data-tu-reset')){ legacyDo('qbank', () => clickLegacy('#settingsPanel [data-v9="settings-reset-qbank"]')); return; }
    if(ds.tuQid){ if(ds.tuQid === 'backup') setUi.qidBackup = false; clickLegacy(`#qidMigrationCard [data-qid-action="${ds.tuQid}"]`); scheduleSettings(true); return; }
    if(t.hasAttribute('data-tu-gosync')){ openSyncPage(); return; }
    if(t.hasAttribute('data-tu-wipe')){ wipeDeviceData(); return; }
    if(ds.tuAdminact) return adminAct(ds.tuAdminact, t);
    if(ds.tuColl){ setUi.open[ds.tuColl] = !setUi.open[ds.tuColl]; scheduleSettings(); return; }
    if(ds.tuMirror){ const b = document.querySelector(ds.tuMirror); if(!b || b.disabled){ console.warn('ThunderUI: legacy control missing', ds.tuMirror); return; } b.click(); scheduleSettings(true); return; }
    if(ds.tuV101){ const a = ds.tuV101; legacyDo('backup', () => clickLegacy(`#settingsPanel [data-v101="${a}"]`)); return; }
    if(ds.tuCompat){ const a = ds.tuCompat; legacyDo('backup', () => clickLegacy(`#settingsPanel [data-local-compat="${a}"]`)); return; }
  }
  function adminAct(act){
    const v = setViews.tuSettings, val = k => (v && v.querySelector(`[data-tu-admin="${k}"]`) || {}).value || '';
    legacyDo('admin', () => {
      if(act === 'device'){ const el = legacyIn('#fuDeviceLabel'); if(el) el.value = val('device'); return clickLegacy('#settingsPanel [data-fu="device"]'); }
      if(act === 'unlock'){
        const pw = v && v.querySelector('[data-tu-admin="password"]'), el = legacyIn('#fuAdminPassword'), form = legacyIn('#fuAdminUnlock');
        if(!pw || !pw.value || !el || !form) return false;
        el.value = pw.value; pw.value = ''; form.dispatchEvent(new Event('submit', {bubbles:true, cancelable:true})); return true;
      }
      if(act === 'filter'){ ['fuAdminSearch', 'fuAdminForm', 'fuAdminRevision'].forEach(k => { const el = legacyIn('#' + k); if(el) el.value = val(k); }); const f = legacyIn('#fuAdminFilters'); if(f) f.dispatchEvent(new Event('submit', {bubbles:true, cancelable:true})); return true; }
      if(act === 'more') return clickLegacy('#settingsPanel [data-fu="more"]');
      if(act === 'lock') return clickLegacy('#settingsPanel [data-fu="lock"]');
    });
  }
  function onSetChange(e){
    const t = e.target;
    if(t.hasAttribute('data-tu-density')){ store.set(KEYS.view, t.value === 'list' ? 'list' : 'grid'); scheduleLibrary(); scheduleSettings(); return; }
    if(t.dataset.tuSetsel){ const id = t.dataset.tuSetsel, val = t.value; legacyDo('safety', () => setLegacyEl(legacyIn('#' + id), val)); return; }
    if(t.dataset.tuSetin){
      const id = t.dataset.tuSetin, min = id === 'setDefaultSpq' ? 15 : 1, n = Math.max(min, parseInt(t.value, 10) || min); t.value = String(n);
      legacyDo('safety', () => { setLegacyEl(legacyIn('#' + id), n); if(id === 'setDefaultBlock') setLegacy('qbankBlockSize', n); });
    }
  }
  function onSetKey(e){
    const t = e.target;
    if(e.key === 'Enter' && t.dataset && t.dataset.tuAdmin){ e.preventDefault(); adminAct(t.dataset.tuAdmin === 'password' ? 'unlock' : t.dataset.tuAdmin === 'device' ? 'device' : 'filter'); return; }
    if(e.key === 'Enter' && t.dataset && t.dataset.tuSetin){ t.blur(); return; }
    if(t.dataset && t.dataset.tuDrag && (e.key === 'ArrowUp' || e.key === 'ArrowDown')){
      e.preventDefault();
      const rows = tabRows(), i = rows.findIndex(r => r.key === t.dataset.tuDrag), j = i + (e.key === 'ArrowUp' ? -1 : 1);
      if(i < 0 || j < 0 || j >= rows.length) return;
      setUi.focus = `[data-tu-drag="${CSS.escape(t.dataset.tuDrag)}"]`;
      moveTab(rows[i].key, rows[j].key, j > i);
    }
  }
  // reorder through the legacy drag-and-drop handlers on the hidden "Order & colors" rows
  function moveTab(key, target, after){
    legacyDo('order', () => {
      const h = legacyIn(`[data-v195-drag-tab="${CSS.escape(key)}"]`), row = legacyIn(`[data-v195-drop-tab="${CSS.escape(target)}"]`);
      if(!h || !row) return false;
      const r = row.getBoundingClientRect(), y = after ? r.bottom - 1 : r.top + 1;
      h.dispatchEvent(new MouseEvent('dragstart', {bubbles:true, cancelable:true}));
      row.dispatchEvent(new MouseEvent('dragover', {bubbles:true, cancelable:true, clientY:y}));
      row.dispatchEvent(new MouseEvent('drop', {bubbles:true, cancelable:true, clientY:y}));
      h.dispatchEvent(new MouseEvent('dragend', {bubbles:true}));
      return true;
    });
  }
  function onDragStart(e){
    const h = e.target.closest && e.target.closest('[data-tu-drag]'); if(!h || e.button > 0) return;
    const table = h.closest('[data-tu-tabtable]'), row = h.closest('.tu-tabrow'); if(!table || !row) return;
    e.preventDefault();
    const rows = Array.from(table.querySelectorAll('.tu-tabrow[data-key]')), start = e.clientY;
    let target = null, after = false;
    row.classList.add('tu-dragging'); try{ h.setPointerCapture(e.pointerId); }catch(err){}
    const move = ev => {
      row.style.transform = `translateY(${ev.clientY - start}px)`;
      rows.forEach(r => r.classList.remove('tu-dropbefore', 'tu-dropafter'));
      target = rows.find(r => { const b = r.getBoundingClientRect(); return r !== row && ev.clientY >= b.top && ev.clientY <= b.bottom; }) || null;
      if(target){ const b = target.getBoundingClientRect(); after = ev.clientY > b.top + b.height / 2; target.classList.add(after ? 'tu-dropafter' : 'tu-dropbefore'); }
    };
    const up = () => {
      h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up);
      row.classList.remove('tu-dragging'); row.style.transform = ''; rows.forEach(r => r.classList.remove('tu-dropbefore', 'tu-dropafter'));
      if(target) moveTab(row.dataset.key, target.dataset.key, after);
    };
    h.addEventListener('pointermove', move); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
  }

  window.addEventListener('click', e => {
    const t = e.target && e.target.closest ? e.target : null; if(!t) return;
    const acc = t.closest('[data-tu-pick]'); if(acc){ setAccent(acc.dataset.tuPick); return; }
    if(t.closest('#themeToggle')){ if(!themeAuto) store.set(THEME_MODE, 'manual'); setTimeout(() => { brand(); scheduleSettings(); }, 0); }
    const tab = t.closest('#menu aside.modern-sidebar .menu-tab');
    if(tab && tab.id !== 'tuSyncTab' && tab.id !== 'themeToggle' && setUi.page === 'sync' && !IPAD) setTimeout(() => setSyncPage(false), 0);
    if(tab) setTimeout(() => { heroTitle(); scheduleSettings(true); }, 0);
  }, true);
  document.addEventListener('click', e => {
    const proxy = e.target.closest && e.target.closest('[data-tu-proxy]');
    if(proxy){ e.preventDefault(); byId(proxy.dataset.tuProxy)?.click(); setTimeout(() => scheduleSettings(true), 300); }
  });

  /* ---------- Score Report ---------- */
  const LET = 'ABCDEFGHIJ';
  function fmtTime(sec){ sec = Math.max(0, Math.round(Number(sec) || 0)); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return h ? `${h} h ${String(m).padStart(2, '0')} m` : `${m}:${String(s).padStart(2, '0')}`; }
  function changedAnswer(a){
    try{ if(typeof answerWasChanged === 'function') return !!answerWasChanged(a.firstChosen, a.chosen, a.answerChangeLog); }catch(e){}
    return !!a.changed;
  }
  function questionFor(result, index, a){
    try{
      if(typeof activeBlocks === 'undefined' || !Array.isArray(activeBlocks)) return null;
      const blk = activeBlocks[(Number(result && result.blockIndex) || index + 1) - 1] || activeBlocks[index];
      return blk && Array.isArray(blk.questions) ? blk.questions[(Number(a.item) || 1) - 1] || null : null;
    }catch(e){ return null; }
  }
  function subjectOf(a, q){
    const m = (q && q.metadata) || {};
    let s = '';
    try{ if(a.subject || a.topic) s = typeof canonicalSubject === 'function' ? canonicalSubject(a.subject || a.topic) : (a.subject || a.topic); }catch(e){ s = a.subject || a.topic || ''; }
    if(!s || /^uncategori[sz]ed$/i.test(s)) s = m.subjectSystem || m.subject || m.system || m.discipline || s || 'Uncategorized';
    return String(s);
  }
  function topicOf(a, q){ const m = (q && q.metadata) || {}; return String(a.topic || m.broadTopic || m.conceptOrSourceObjective || ''); }
  function enhanceReport(){
    const ws = byId('workspace'), rep = ws && ws.querySelector('.modern-report'); if(!rep || rep.dataset.tu) return;
    reviewOnly = null;
    let results = [];
    try{ results = getCompletedResults(); }catch(e){}
    let blocks = results.length ? results : ((typeof activeSession !== 'undefined' && activeSession && activeSession.blocks) || []).map(b => b && b.result).filter(Boolean);
    const rows = [];
    blocks.forEach((r, bi) => (r.answers || []).forEach(a => { const q = questionFor(r, bi, a); rows.push({b:bi, a, q, subject:subjectOf(a, q), topic:topicOf(a, q), changed:changedAnswer(a)}); }));
    const total = rows.length, correct = rows.filter(x => x.a.chosen !== null && x.a.chosen !== undefined && (x.a.isCorrect || x.a.chosen === x.a.correct)).length;
    const blank = rows.filter(x => x.a.chosen === null || x.a.chosen === undefined).length, wrong = total - correct - blank;
    const marked = rows.filter(x => x.a.flagged).length, changed = rows.filter(x => x.changed).length;
    const secs = rows.reduce((n, x) => n + (Number(x.a.questionTimeSeconds) || 0), 0);
    const percent = total ? Math.round(correct / total * 100) : 0;
    const title = (typeof activeSession !== 'undefined' && activeSession && activeSession.title) || (typeof importedBank !== 'undefined' && importedBank && importedBank.title) || 'Exam';
    let attempt = '';
    try{ attempt = (activeSession && (activeSession.attemptLabel || activeSession.v9AttemptLabel || activeSession.attemptName)) || ''; }catch(e){}
    let done = '';
    try{ const at = (activeSession && activeSession.completedAt) || (blocks[blocks.length - 1] || {}).completedAt; if(at) done = 'completed ' + new Date(at).toLocaleDateString(undefined, {day:'numeric', month:'short', year:'numeric'}); }catch(e){}
    const meta = [attempt, done, blocks.length + (blocks.length === 1 ? ' block' : ' blocks'), secs ? fmtTime(secs) + ' answering' : ''].filter(Boolean).join(' · ');
    // subjects
    const subj = new Map();
    rows.forEach(x => { const s = subj.get(x.subject) || {n:0, c:0}; s.n++; if(x.a.chosen === x.a.correct) s.c++; subj.set(x.subject, s); });
    const subjects = Array.from(subj.entries()).sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0])).slice(0, 8);
    const subjColor = p => p >= 75 ? 'var(--tu-ok)' : p >= 60 ? 'var(--tu-p)' : p >= 45 ? 'var(--tu-warn)' : 'var(--tu-bad)';
    const subjectsHtml = subjects.length ? subjects.map(([name, s]) => { const p = Math.round(s.c / s.n * 100); return `<div class="tu-subj"><span title="${esc(name)}">${esc(name)}</span><span class="tu-bar"><i style="width:${p}%;background:${subjColor(p)}"></i></span><span><b>${p}%</b> · ${s.n} Q${s.n === 1 ? '' : 's'}</span></div>`; }).join('') : '<span class="tu-rep-meta">No answers yet.</span>';
    const firstWrong = rows.find(x => x.a.chosen !== x.a.correct);
    // build the new layout and move the existing controls (with their listeners) into it
    const wrap = document.createElement('div'); wrap.className = 'tu-rep-wrap';
    wrap.innerHTML = `<section class="tu-card tu-rep-hero"><div class="tu-rep-copy"><span class="tu-kicker">Score report</span><h1 class="tu-rep-title">${esc(title)}</h1><span class="tu-rep-meta">${esc(meta)}</span><div class="tu-rep-actions" data-tu-slot="review"><button type="button" class="tu-btn" data-tu-review="all">Review all</button>${wrong + blank ? `<button type="button" class="tu-btn tonal" data-tu-review="incorrect">Review incorrect (${wrong + blank})</button>` : ''}<div class="tu-revin" role="radiogroup" aria-label="Review in"><span>Review in</span>${[['nbme', 'NBME'], ['modern', 'Modern']].map(([v, l]) => `<button type="button" role="radio" aria-checked="${examStyle() === v}" data-tu-revin="${v}">${l}</button>`).join('')}</div></div><div class="tu-rep-actions secondary-row" data-tu-slot="files"></div></div>` +
      `<div class="tu-rep-score"><div class="tu-ring" style="--v:${percent}" role="img" aria-label="Score ${percent} percent, ${correct} of ${total} correct"><div><b>${percent}%</b><span>${correct} / ${total}</span></div></div><div class="tu-legend"><span><i style="background:var(--tu-ok)"></i><b>${correct}</b> correct</span><span><i style="background:var(--tu-bad)"></i><b>${wrong}</b> incorrect</span><span><i style="background:var(--tu-on3)"></i><b>${blank}</b> unanswered</span><span><i style="background:var(--tu-warn)"></i><b>${marked}</b> marked</span>${total ? `<span>${Math.round(secs / total)} s average per question</span>` : ''}</div></div></section>` +
      `<div class="tu-rep-row" data-tu-slot="row"><section class="tu-card tu-subjects" aria-label="By subject"><h2 class="tu-h">By subject</h2>${subjectsHtml}</section></div>` +
      `<section class="tu-card tu-qs" aria-label="Questions"><div class="tu-qs-head" data-tu-slot="qhead"><div class="tu-qs-tools" data-tu-slot="tools"><div class="tu-chips" role="group" aria-label="Show"></div></div></div><div data-tu-slot="blocks"></div><div class="tu-qs-foot" aria-live="polite"></div></section>`;
    const slot = n => wrap.querySelector(`[data-tu-slot="${n}"]`);
    const sm = byId('reportSaveMenu'), ex = byId('reportExport'), exi = byId('reportExportIncorrect');
    if(sm){ sm.textContent = 'Save & back to library'; slot('files').appendChild(sm); }
    if(ex){ ex.innerHTML = icon(ICONS.download, 17) + 'Export results'; slot('files').appendChild(ex); }
    if(exi){ exi.innerHTML = icon(ICONS.download, 17) + 'Export incorrect only'; slot('files').appendChild(exi); }
    const audit = rep.querySelector('.answer-change-audit');
    if(audit){
      const ci = Number(audit.querySelector('.answer-change-box.bad b')?.textContent) || 0, ic = Number(audit.querySelectorAll('.answer-change-box.good b')[0]?.textContent) || 0, net = ic - ci;
      audit.insertAdjacentHTML('afterbegin', `<div class="tu-audit-head"><h2 class="tu-h">Answer changes</h2><span class="tu-net" style="color:${net > 0 ? 'var(--tu-ok)' : net < 0 ? 'var(--tu-bad)' : 'var(--tu-on3)'}">Net ${net > 0 ? '+' : ''}${net} point${Math.abs(net) === 1 ? '' : 's'}</span></div>`);
      slot('row').insertBefore(audit, slot('row').firstChild);
    }
    const tabs = rep.querySelector('.report-tabs'); if(tabs) slot('qhead').insertBefore(tabs, slot('tools'));
    const sortc = rep.querySelector('.report-sort-controls');
    if(sortc){ sortc.removeAttribute('style'); sortc.querySelectorAll('[style]').forEach(n => n.removeAttribute('style')); const l1 = sortc.querySelector('label[for="reportSort"]'); if(l1) l1.textContent = 'Sort'; const l2 = sortc.querySelector('label[for="reportSortDirection"]'); if(l2) l2.textContent = 'Direction'; slot('tools').appendChild(sortc); }
    rep.querySelectorAll('.report-block').forEach(b => slot('blocks').appendChild(b));
    // enrich rows: topic/subject from the form metadata, marked flag, answer change, time bar
    const byKey = new Map(rows.map(x => [x.b + ':' + ((Number(x.a.item) || 1) - 1), x]));
    const slowest = Math.max(90, ...rows.map(x => Number(x.a.questionTimeSeconds) || 0));
    wrap.querySelectorAll('.report-block').forEach(block => {
      const headRow = block.querySelector('thead tr');
      if(headRow && !headRow.querySelector('.tu-th-chg')){ const th = document.createElement('th'); th.className = 'tu-th-chg'; th.textContent = 'Changed'; headRow.insertBefore(th, headRow.lastElementChild); const t1 = headRow.children[1]; if(t1) t1.textContent = 'Topic'; }
      block.querySelectorAll('tbody tr').forEach(tr => {
        const btn = tr.querySelector('.review-one'); if(!btn) return;
        const x = byKey.get(btn.dataset.b + ':' + btn.dataset.q); if(!x) return;
        const cells = tr.children;
        if(cells[1] && x.topic && /^Question$/.test(cells[1].textContent.trim())) cells[1].textContent = x.topic;
        if(cells[1]) cells[1].title = cells[1].textContent;
        if(cells[2] && /^Uncategori[sz]ed$/i.test(cells[2].textContent.trim()) && x.subject) cells[2].textContent = x.subject;
        if(cells[0] && x.a.flagged && !cells[0].querySelector('.tu-flag')) cells[0].insertAdjacentHTML('beforeend', `<svg class="tu-flag" width="13" height="13" viewBox="0 0 24 24" role="img" aria-label="Marked"><path d="M5 21V4h11l-2 4 2 4H5" fill="currentColor" stroke="currentColor" stroke-width="2"/></svg>`);
        if(cells[4] && !cells[4].querySelector('.tu-time')){ const sec = Number(x.a.questionTimeSeconds) || 0; cells[4].innerHTML = `<span class="tu-time"><i><em class="${sec > 90 ? 'slow' : ''}" style="width:${Math.round(sec / slowest * 100)}%"></em></i>${esc(cells[4].textContent)}</span>`; }
        const td = document.createElement('td');
        if(x.changed && x.a.firstChosen != null){ const good = x.a.chosen === x.a.correct; td.innerHTML = `<span class="tu-chg ${good ? 'good' : 'bad'}">${LET[x.a.firstChosen] || '?'} → ${x.a.chosen == null ? '—' : (LET[x.a.chosen] || '?')}</span>`; }
        else td.innerHTML = '<span class="tu-chg">—</span>';
        tr.insertBefore(td, tr.lastElementChild);
        tr.dataset.tuSt = x.a.chosen == null ? 'blank' : (x.a.chosen === x.a.correct ? 'ok' : 'bad');
        if(x.a.flagged) tr.dataset.tuFlag = '1';
        if(x.changed) tr.dataset.tuChg = '1';
      });
    });
    const counts = {all:total, bad:wrong, flag:marked, chg:changed, blank};
    const chips = wrap.querySelector('.tu-chips');
    chips.innerHTML = [['all','All'],['bad','Incorrect'],['flag','Marked'],['chg','Changed'],['blank','Unanswered']].map(([id, label]) => `<button type="button" class="tu-chip" data-tu-filter="${id}" aria-pressed="${id === 'all'}">${label}<span>${counts[id]}</span></button>`).join('');
    const applyFilter = () => {
      const f = chips.querySelector('[aria-pressed="true"]')?.dataset.tuFilter || 'all';
      const keep = tr => f === 'all' || (f === 'bad' && tr.dataset.tuSt === 'bad') || (f === 'blank' && tr.dataset.tuSt === 'blank') || (f === 'flag' && tr.dataset.tuFlag) || (f === 'chg' && tr.dataset.tuChg);
      wrap.querySelectorAll('.report-block tbody tr').forEach(tr => tr.classList.toggle('tu-hide', !keep(tr)));
      const vis = Array.from(wrap.querySelectorAll('.report-block')).find(b => b.style.display !== 'none');
      const all = vis ? vis.querySelectorAll('tbody tr').length : 0, shownN = vis ? vis.querySelectorAll('tbody tr:not(.tu-hide)').length : 0;
      const bi = vis ? Number(vis.dataset.reportBody) + 1 : 1;
      wrap.querySelector('.tu-qs-foot').textContent = `Showing ${shownN} of ${all} in block ${bi}`;
    };
    chips.addEventListener('click', e => { const c = e.target.closest('[data-tu-filter]'); if(!c) return; chips.querySelectorAll('[data-tu-filter]').forEach(b => b.setAttribute('aria-pressed', String(b === c))); applyFilter(); });
    wrap.querySelectorAll('.report-tab').forEach(t => t.addEventListener('click', () => setTimeout(applyFilter, 0)));
    wrap.addEventListener('click', e => {
      const rv = e.target.closest('[data-tu-revin]'); if(rv){ setExamStyle(rv.dataset.tuRevin); return; }
      const r = e.target.closest('[data-tu-review]'); if(!r) return;
      // Review incorrect opens the first incorrect (or unanswered) item and keeps Previous / Next on those items only
      const only = r.dataset.tuReview === 'incorrect' && firstWrong;
      const target = only ? firstWrong : rows[0];
      if(!target) return;
      const btn = wrap.querySelector(`.review-one[data-b="${target.b}"][data-q="${(Number(target.a.item) || 1) - 1}"]`);
      startOnly(only ? rows.filter(x => x.a.chosen !== x.a.correct).map(x => ({b:x.b, q:(Number(x.a.item) || 1) - 1})) : [], 'incorrect');
      onlyStarting = true; try{ btn?.click(); }finally{ onlyStarting = false; }
    });
    rep.querySelector('.report-hero')?.remove();
    rep.querySelector('.report-actions')?.remove();
    rep.innerHTML = '';
    rep.appendChild(wrap);
    rep.classList.add('tu-report'); rep.dataset.tu = '1';
    applyFilter();
  }
  function wrapReport(){
    if(typeof renderFinalReport !== 'function' || renderFinalReport.__tu) return;
    const base = renderFinalReport;
    const wrapped = function(){ const out = base.apply(this, arguments); try{ enhanceReport(); }catch(e){ console.warn('ThunderUI score report failed', e); } return out; };
    wrapped.__tu = true;
    renderFinalReport = wrapped; // eslint-disable-line no-global-assign
  }

  /* ---------- Modern exam style (A23 Phase E: boards ModernExam, Explanation; CurrentExam is the NBME reference) ----------
     NBME, the legacy exam interface, stays the default and draws exactly as before: Modern sets :root[data-tu-exam="modern"]
     and only then mounts its chrome (#tuxHead, #tuxNav, #tuxFoot) and decorates the question. New view, same engine: the
     chrome clicks the hidden legacy controls (#prevNav, #nextNav, #markQuestion, #labBtn, …) and the question, answers and
     explanation stay the legacy nodes, restyled, so highlights, strikes, notes and saves keep working. The style is stored
     once (ThunderUSMLE.examStyle) and switched from Settings › Appearance, the exam's Settings menu and the Score Report.
     Review incorrect: a review filter that steps Previous / Next through the incorrect items only (both styles); it writes nothing. */
  const EXAM_KEY = 'ThunderUSMLE.examStyle';
  const XI = {
    flag:'<path d="M5 21V4h11l-2 4 2 4H5"/>', home:'<path d="M4 11 12 4l8 7M6 9.5V20h4.5v-6h3v6H18V9.5"/>', prev:'<path d="m15 6-6 6 6 6"/>', next:'<path d="m9 6 6 6-6 6"/>',
    clock:'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>',
    labs:'<path d="M9 3h6M10 3v6L5 19a1.5 1.5 0 0 0 1.3 2h11.4A1.5 1.5 0 0 0 19 19l-5-10V3"/><path d="M7.5 14h9"/>',
    notes:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    calc:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/>',
    settings:'<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    full:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    strike:'<path d="M4 12h16M16 6.5C15.2 5 13.8 4 12 4c-2.5 0-4.5 1.4-4.5 3.5 0 1.2.6 2.1 1.7 2.8M8 17.5c.8 1.5 2.2 2.5 4 2.5 2.5 0 4.5-1.4 4.5-3.5"/>',
    lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    pause:'<path d="M9 5v14M15 5v14"/>', grid:'<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
    report:'<path d="M5 20V10M12 20V4M19 20v-7"/>', end:'<path d="M6 6l12 12M18 6 6 18"/>',
    more:'<circle cx="5" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.7" fill="currentColor" stroke="none"/>',
    down:'<path d="m6 9 6 6 6-6"/>'
  };
  const EXAM_TOOLS = [['labs', 'labBtn', 'Labs'], ['notes', 'notesBtn', 'Notes'], ['calc', 'calcBtn', 'Calculator'], ['settings', 'settingsBtn', 'Settings'], ['full', 'fullscreenBtn', 'Full screen']];
  const examUi = {drawer:false, more:false, anchor:null, watched:false};
  let reviewOnly = null, onlyStarting = false, examQueued = false;
  function examStyle(){ return store.get(EXAM_KEY, 'nbme') === 'modern' ? 'modern' : 'nbme'; }
  function modernOn(){ return document.documentElement.getAttribute('data-tu-exam') === 'modern'; }
  function setExamStyle(s){
    store.set(EXAM_KEY, s === 'modern' ? 'modern' : 'nbme');
    applyExamStyle(true); scheduleSettings(); paintReviewIn();
  }
  function setAttrIf(el, k, v){ if(!el) return; if(v == null){ if(el.hasAttribute(k)) el.removeAttribute(k); } else if(el.getAttribute(k) !== v) el.setAttribute(k, v); }
  function applyExamStyle(redraw){
    const on = examStyle() === 'modern', was = modernOn();
    setAttrIf(document.documentElement, 'data-tu-exam', on ? 'modern' : null);
    if(!on) teardownExam();
    // re-render the open question so its decorations are added (Modern) or dropped (NBME draws from a clean render)
    if(redraw && on !== was){ const m = examModel(); if(m && m.view === 'question'){ try{ renderQuestion(); }catch(e){} } }
    if(on) scheduleExam();
  }
  function teardownExam(){
    ['tuxHead', 'tuxNav', 'tuxFoot', 'tuxScrim', 'tuxMore'].forEach(id => byId(id)?.remove());
    const scr = byId('examScreen');
    if(scr) ['data-tux-view', 'data-tux-split', 'data-tux-drawer', 'data-tux-tutor'].forEach(a => scr.removeAttribute(a));
    examUi.drawer = false; examUi.more = false;
  }
  function examModel(){ try{ const b = bridge(); return b && typeof b.exam === 'function' ? b.exam() : null; }catch(e){ return null; } }
  function scheduleExam(){ if(examQueued || !modernOn()) return; examQueued = true; requestAnimationFrame(() => { examQueued = false; try{ paintExam(); }catch(e){ console.warn('ThunderUI modern exam failed', e); } }); }
  function shown(id){ const el = byId(id); return !!el && !el.hidden && !el.classList.contains('hidden') && !(el.closest && el.closest('.hidden')); }
  function phoneLayout(){ return innerWidth < 760 || innerHeight <= 520; }
  function endLabel(){ return /save/i.test(txt(byId('endBlockBtn'))) ? 'Save & exit' : 'End block'; }
  function ensureExamChrome(scr){
    if(byId('tuxHead') && byId('tuxHead').parentNode === scr && byId('tuxFoot')) return;
    ['tuxHead', 'tuxNav', 'tuxFoot', 'tuxScrim', 'tuxMore'].forEach(id => byId(id)?.remove());
    scr.insertAdjacentHTML('beforeend', '<header id="tuxHead" class="tux tux-head"></header><aside id="tuxNav" class="tux tux-nav" aria-label="Question navigator"></aside><footer id="tuxFoot" class="tux tux-foot"></footer><div id="tuxScrim" class="tux-scrim" data-tux="drawer"></div><div id="tuxMore" class="tux tux-morepop" role="menu" aria-label="More exam actions" hidden></div>');
  }
  function onlyPos(m){ if(!reviewOnly) return null; const i = reviewOnly.items.findIndex(x => x.b === m.block && x.q === m.current); return {i, n:reviewOnly.items.length}; }
  function examHeadHtml(m){
    const q = m.view === 'question' || m.view === 'review', it = m.items[m.current] || {};
    const flagged = !!it.flagged, ro = onlyPos(m);
    const item = m.view === 'report'
      ? `<div class="tux-item"><span class="tux-itemtxt"><b>Score report</b><span>${esc(m.title || '')}</span></span></div>`
      : `<button type="button" class="tux-item" data-tux="overview" title="Exam overview" aria-label="Item ${m.current + 1} of ${m.total}, block ${m.block + 1} of ${m.blocks}. Questions"><span class="tux-itemtxt"><b>Item ${m.current + 1} of ${m.total}</b><span>Block ${m.block + 1} of ${m.blocks}${m.title ? ' · ' + esc(m.title) : ''}</span></span><span class="tux-caret">${icon(XI.down, 18)}</span></button>`;
    const tags = (m.review && q ? '<span class="tux-tag">Review</span>' : '') + (ro && q ? `<span class="tux-tag">${esc(reviewOnly.label[0].toUpperCase() + reviewOnly.label.slice(1))} only</span>` : '');
    const mark = q ? `<button type="button" class="tux-mark" data-tux="mark" aria-pressed="${flagged}"${m.review || !byId('markQuestion') || byId('markQuestion').disabled ? ' disabled' : ''} aria-label="${flagged ? 'Marked' : 'Mark'}">${icon(XI.flag, 16)}<span>${flagged ? 'Marked' : 'Mark'}</span></button>` : '';
    const center = q ? `<div class="tux-center"><button type="button" class="tux-round" data-tux="prev" aria-label="Previous item"${byId('prevBtn') && byId('prevBtn').disabled && !ro ? ' disabled' : ''}>${icon(XI.prev, 18)}</button><span class="tux-count">${m.current + 1} / ${m.total}</span><button type="button" class="tux-round primary" data-tux="next" aria-label="Next item"${byId('nextBtn') && byId('nextBtn').disabled && !ro ? ' disabled' : ''}>${icon(XI.next, 18)}</button></div>` : '<span class="tux-spacer"></span>';
    const timer = q && !m.review && m.timed ? `<button type="button" class="tux-timer" data-tux="time" title="Block and day time remaining">${icon(XI.clock, 16)}<b data-tux-t="block"></b><span data-tux-t="day"></span></button>` : '';
    const tools = EXAM_TOOLS.filter(([, id]) => shown(id) || (id !== 'fullscreenBtn' && byId(id) && !byId(id).closest('.hidden'))).map(([k, id, l]) => `<button type="button" class="tux-tool" data-tux="tool" data-id="${id}" title="${l}"${id === 'notesBtn' ? ` aria-expanded="${byId(id).getAttribute('aria-expanded') === 'true'}"` : ''}>${icon(XI[k], 19)}${l}</button>`).join('');
    // Review has no block to finish: a visible way back to the library (same path as Save & exit)
    const exit = m.review && m.view !== 'report' && byId('endBlockBtn') ? `<button type="button" class="tux-round tux-exit" data-tux="end" title="Exit review" aria-label="Exit review and return to the library">${icon(XI.home, 19)}</button>` : '';
    return exit + item + tags + mark + center + timer + `<div class="tux-tools" role="toolbar" aria-label="Exam tools">${tools}</div>` + `<button type="button" class="tux-more" data-tux="more" aria-label="More exam actions" aria-expanded="${examUi.more}">${icon(XI.more, 20)}</button>`;
  }
  function examNavHtml(m){
    const answered = m.items.filter(x => x.answer != null).length, ro = onlyPos(m);
    const keep = i => !reviewOnly || reviewOnly.items.some(x => x.b === m.block && x.q === i);
    const cells = m.items.map((x, i) => {
      const done = x.answer != null, bad = m.review && x.answer !== x.correct;
      const cls = ['tux-q', done ? 'done' : '', bad ? 'bad' : '', keep(i) ? '' : 'dim'].filter(Boolean).join(' ');
      const st = m.review ? (x.answer == null ? 'unanswered' : x.answer === x.correct ? 'correct' : 'incorrect') : (done ? 'answered' : 'not answered');
      return `<button type="button" class="${cls}" data-tux-go="${i}" aria-current="${i === m.current}" aria-label="Item ${i + 1}, ${st}${x.flagged ? ', marked' : ''}">${i + 1}${x.flagged ? '<i></i>' : ''}</button>`;
    }).join('');
    const only = ro ? `<div class="tux-only"><span>${esc(reviewOnly.label[0].toUpperCase() + reviewOnly.label.slice(1))} only${ro.i >= 0 ? ` · ${ro.i + 1} of ${ro.n}` : ` · ${ro.n}`}</span><button type="button" data-tux="only-off">Show all</button></div>` : '';
    const legend = m.review
      ? '<span><i class="done"></i>Correct</span><span><i class="bad"></i>Incorrect or unanswered</span><span><i class="flag"></i>Marked</span><span><i class="cur"></i>Current</span>'
      : '<span><i class="done"></i>Answered</span><span><i class="open"></i>Not answered</span><span><i class="flag"></i>Marked</span><span><i class="cur"></i>Current</span>';
    return `<div class="tux-navhead"><b>Questions</b><span>${answered} / ${m.total} answered</span></div>${only}<div class="tux-grid">${cells}</div><div class="tux-legend">${legend}</div>`;
  }
  function examFootHtml(m){
    const q = m.view === 'question' || m.view === 'review', marked = m.items.filter(x => x.flagged).length, answered = m.items.filter(x => x.answer != null).length;
    const pct = m.total ? Math.round(m.items.filter(x => x.answer != null && x.answer === x.correct).length / m.total * 100) : 0;
    const note = m.review ? `Block ${m.block + 1} review · ${pct}%` : `${answered} of ${m.total} answered · ${marked} marked`;
    const ro = onlyPos(m), last = byId('nextBtn') && byId('nextBtn').disabled && !ro;
    const parts = [];
    if(shown('lockBtn') && !m.review) parts.push(`<button type="button" class="tux-fbtn" data-tux="lock">${icon(XI.lock, 16)}Lock</button>`);
    if(shown('suspendBtn')) parts.push('<button type="button" class="tux-fbtn" data-tux="suspend">Suspend</button>');
    if(q) parts.push('<button type="button" class="tux-fbtn ghost" data-tux="review">Review screen</button>');
    parts.push(`<span class="tux-note">${esc(note)}</span>`);
    if(shown('reviewScoreReportBtn')) parts.push('<button type="button" class="tux-fbtn tonal" data-tux="report">Score report</button>');
    if(byId('endBlockBtn')) parts.push(`<button type="button" class="tux-fbtn danger" data-tux="end">${endLabel()}</button>`);
    const pnav = q ? `<div class="tux-pnav"><button type="button" class="tux-round" data-tux="prev" aria-label="Previous item"${byId('prevBtn') && byId('prevBtn').disabled && !ro ? ' disabled' : ''}>${icon(XI.prev, 20)}</button><span class="tux-pcount">${m.current + 1} / ${m.total}</span><button type="button" class="tux-go" data-tux="next"${last ? ' disabled' : ''}>${last ? 'Last item' : 'Next item'}${icon(XI.next, 18)}</button></div>` : '';
    return parts.join('') + pnav;
  }
  function examMoreHtml(m){
    const row = (act, label, ico, extra, cls) => `<button type="button" role="menuitem" class="${cls || ''}" data-tux="${act}"${extra || ''}>${icon(ico, 20)}${label}</button>`;
    const tools = EXAM_TOOLS.filter(([, id]) => shown(id) || (id !== 'fullscreenBtn' && byId(id) && !byId(id).closest('.hidden'))).map(([k, id, l]) => row('tool', l, XI[k], ` data-id="${id}"`)).join('');
    const acts = [];
    if(m.view === 'question' || m.view === 'review') acts.push(row('review', 'Review screen', XI.grid));
    if(shown('lockBtn') && !m.review) acts.push(row('lock', 'Lock', XI.lock));
    if(shown('suspendBtn')) acts.push(row('suspend', 'Suspend', XI.pause));
    if(shown('reviewScoreReportBtn')) acts.push(row('report', 'Score report', XI.report));
    if(byId('endBlockBtn') && m.view !== 'report') acts.push(row('end', endLabel(), XI.end, '', 'danger'));
    return tools + (acts.length ? '<hr>' + acts.join('') : '');
  }
  function examSummaryHtml(m){
    const it = m.items[m.current] || {}, a = it.answer, c = it.correct;
    const st = a == null ? ['', 'Unanswered'] : a === c ? ['ok', 'Correct'] : ['bad', 'Incorrect'];
    const parts = [a == null ? 'Not answered' : `You chose <b>${LET[a] || '?'}</b>`, `correct is <b>${LET[c] || '?'}</b>`];
    if(m.seconds) parts.push(fmtTime(m.seconds));
    let chg = '';
    if(m.changes.length){
      const seq = [m.changes[0].from].concat(m.changes.map(x => x.to)).map(x => LET[x] || '?'), f = m.changes[0].from, l = m.changes[m.changes.length - 1].to;
      chg = `<div class="tux-exchg">You changed this answer: <b>${seq.join(' → ')}</b> (${f === c ? 'correct' : 'incorrect'} → ${l === c ? 'correct' : 'incorrect'})</div>`;
    }
    const obj = m.objective ? `<section class="tux-exobj"><span>Educational objective</span><p>${esc(m.objective)}</p></section>` : '';
    return `<div class="tux-exsum" aria-label="Your answer"><div class="tux-exrow"><span class="tux-pill ${st[0]}">${st[1]}</span><span>${parts.join(' · ')}</span></div>${chg}${obj}</div>`;
  }
  function layoutToggleHtml(){
    let l = 'split'; try{ l = getReviewExplanationLayout() === 'below' ? 'below' : 'split'; }catch(e){}
    return `<span class="tux-layout" role="radiogroup" aria-label="Explanation layout">${[['split', 'Split'], ['below', 'Below']].map(([v, t]) => `<button type="button" role="radio" aria-checked="${l === v}" data-tux-layout="${v}">${t}</button>`).join('')}</span>`;
  }
  // Decorations inside the legacy question (Modern only; the next renderQuestion drops them): choice letters, a strike
  // button per choice, a hint, the explanation summary and markers the CSS needs. Text inside the highlight containers
  // (#stem, .qbank-body) is never changed, so saved highlights re-attach.
  function decorateQuestion(m){
    const ws = byId('workspace'); if(!ws) return;
    const it = m.items[m.current] || {};
    ws.querySelectorAll('.answers .answer[data-choice]').forEach(a => {
      if(a.dataset.tuxDone) return; a.dataset.tuxDone = '1';
      const i = Number(a.dataset.choice), r = a.querySelector('.radio'); if(r) r.setAttribute('data-tux-letter', LET[i] || '');
      const ct = a.querySelector('.choice-text'), tn = ct && ct.firstChild;
      if(tn && tn.nodeType === 3){ const mm = tn.nodeValue.match(/^\s*[A-Z][.)]\s+/); if(mm){ const pre = document.createElement('span'); pre.className = 'tux-pre'; pre.textContent = mm[0]; tn.nodeValue = tn.nodeValue.slice(mm[0].length); ct.insertBefore(pre, tn); } }
      if(m.review || it.revealed) return;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'tux-strike'; b.title = 'Strike out (right-click also works)';
      b.setAttribute('aria-label', 'Strike out choice ' + (LET[i] || '')); b.setAttribute('aria-pressed', String(m.struck.includes(i)));
      b.innerHTML = icon(XI.strike, 18);
      b.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); a.dispatchEvent(new MouseEvent('contextmenu', {bubbles:true, cancelable:true, button:2})); });
      a.appendChild(b);
    });
    const main = ws.querySelector('.question-main'), go = byId('proceedBtn');
    if(main && go && go.parentNode === main && !main.querySelector('.tux-hint')){
      const h = document.createElement('span'); h.className = 'tux-hint';
      h.textContent = m.review ? 'Answers are locked in review. Highlights still work.' : 'Select text to highlight · strike a choice with its button or a right-click';
      main.insertBefore(h, go);
    }
    ws.querySelectorAll('.qbank-panel').forEach(p => {
      const tabs = p.querySelector('.qbank-tabs'), body = p.querySelector('.qbank-body');
      if(tabs && !tabs.querySelector('.tux-layout') && !phoneLayout() && (m.review || it.revealed)) tabs.insertAdjacentHTML('beforeend', layoutToggleHtml());
      if(body && !p.querySelector('.tux-exsum') && (m.review || it.revealed)) body.insertAdjacentHTML('beforebegin', examSummaryHtml(m));
      if(!body) return;
      body.querySelectorAll('.exp-section:not([data-tux-kind])').forEach(s => { const h = txt(s.querySelector(':scope>h3')).toLowerCase(); s.setAttribute('data-tux-kind', /trap/.test(h) ? 'trap' : /why|wrong|other/.test(h) ? 'wrong' : /correct/.test(h) ? 'correct' : 'exp'); });
      if(it.answer != null && it.answer !== it.correct) body.querySelectorAll('.exp-wrong:not([data-tux-yours])').forEach(w => { const l = txt(w.querySelector('b')).replace(/^choice\s+/i, '').trim().charAt(0).toUpperCase(); if(l && l === LET[it.answer]) w.setAttribute('data-tux-yours', ''); });
    });
  }
  function paintExamTimer(){
    const b = document.querySelector('#tuxHead [data-tux-t="block"]'), d = document.querySelector('#tuxHead [data-tux-t="day"]'); if(!b) return;
    const clean = s => String(s || '').trim().replace(/^00:(?=\d\d:\d\d$)/, '');
    const bt = clean(txt(byId('blockTime'))), dt = 'day ' + clean(txt(byId('dayTime')));
    if(b.textContent !== bt) b.textContent = bt; if(d && d.textContent !== dt) d.textContent = dt;
  }
  function paintExam(){
    const scr = byId('examScreen'); if(!scr || !modernOn()) return;
    const m = examModel();
    if(!m){ if(examUi.drawer || examUi.more){ examUi.drawer = examUi.more = false; } return; }
    ensureExamChrome(scr);
    const split = m.view === 'question' && !phoneLayout() && innerWidth >= 1100 && !!scr.querySelector('#workspace .explanation-split .right-panel-wrap');
    if(!phoneLayout()) examUi.drawer = false;
    setAttrIf(scr, 'data-tux-view', m.view === 'review' ? 'question' : m.view);
    setAttrIf(scr, 'data-tux-split', split ? '1' : null);
    setAttrIf(scr, 'data-tux-tutor', m.tutor && !m.review ? '1' : null);
    setAttrIf(scr, 'data-tux-drawer', examUi.drawer ? '1' : null);
    swapHtml(byId('tuxHead'), examHeadHtml(m));
    swapHtml(byId('tuxNav'), examNavHtml(m));
    swapHtml(byId('tuxFoot'), examFootHtml(m));
    const more = byId('tuxMore'); swapHtml(more, examUi.more ? examMoreHtml(m) : ''); more.hidden = !examUi.more;
    paintExamTimer();
    if(m.view === 'question') decorateQuestion(m);
  }
  function closeExamPops(){ if(examUi.drawer || examUi.more){ examUi.drawer = false; examUi.more = false; scheduleExam(); } }
  function fire(id){ const el = byId(id); if(!el) return false; el.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true, view:window})); return true; }
  function onExamClick(e){
    const lay = e.target.closest && e.target.closest('[data-tux-layout]');
    if(lay){ e.preventDefault(); try{ setReviewExplanationLayout(lay.dataset.tuxLayout); }catch(err){} return; }
    const go = e.target.closest && e.target.closest('#tuxNav [data-tux-go]');
    if(go){ const i = Number(go.dataset.tuxGo); examUi.drawer = false; const row = document.querySelector(`#statusRows [data-i="${i}"]`); if(row) row.click(); else { try{ goToQuestionIndex(i); }catch(err){} } scheduleExam(); return; }
    const t = e.target.closest && e.target.closest('.tux [data-tux], .tux-scrim[data-tux]'); if(!t || t.disabled) return;
    const act = t.dataset.tux, inMore = !!t.closest('#tuxMore');
    if(inMore) examUi.more = false;
    if(act === 'overview'){ if(phoneLayout()){ examUi.drawer = !examUi.drawer; examUi.more = false; scheduleExam(); } else fire('itemBox'); return; }
    if(act === 'drawer'){ examUi.drawer = false; scheduleExam(); return; }
    if(act === 'more'){ examUi.more = !examUi.more; examUi.drawer = false; scheduleExam(); return; }
    if(act === 'mark'){ const mk = byId('markQuestion'); if(mk && !mk.disabled) mk.click(); return; }
    if(act === 'prev'){ fire('prevNav'); return; }
    if(act === 'next'){ fire('nextNav'); return; }
    if(act === 'time'){ fire('timeBox'); return; }
    if(act === 'only-off'){ reviewOnly = null; scheduleExam(); return; }
    if(act === 'tool'){ examUi.anchor = inMore ? byId('tuxHead').querySelector('[data-tux="more"]') : t; scheduleExam(); fire(t.dataset.id); return; }
    if(act === 'lock'){ fire('lockBtn'); scheduleExam(); return; }
    if(act === 'suspend'){ fire('suspendBtn'); scheduleExam(); return; }
    if(act === 'review'){ scheduleExam(); try{ renderReview(); }catch(err){} return; }
    if(act === 'report'){ fire('reviewScoreReportBtn'); scheduleExam(); return; }
    if(act === 'end'){ fire('endBlockBtn'); scheduleExam(); return; }
  }
  function onExamKey(e){
    if(e.key === 'Escape' && (examUi.drawer || examUi.more) && modernOn()){ e.preventDefault(); closeExamPops(); }
  }
  // The exam's own Settings menu (#referenceSettingsDropdown, rebuilt on every open): an Exam style row in the menu's own
  // style, in both styles. In Modern the menu opens under the button that asked for it.
  function decorateExamSettings(){
    const box = byId('referenceSettingsDropdown'); if(!box || box.dataset.tux) return;
    box.dataset.tux = '1';
    if(!box.querySelector('[data-ref-action="layoutSplit"]')) return; // the break screen's short menu
    const cur = examStyle();
    box.insertAdjacentHTML('afterbegin', `<div class="review-layout-toggle tux-style-row"><div class="review-layout-title">Exam style</div><div class="segmented-toggle" role="radiogroup" aria-label="Exam style">${[['nbme', 'NBME'], ['modern', 'Modern']].map(([v, l]) => `<button type="button" role="radio" aria-checked="${cur === v}" class="${cur === v ? 'active' : ''}" data-tux-style="${v}">${l}</button>`).join('')}</div></div>`);
    box.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-tux-style]'); if(!b) return; e.preventDefault(); e.stopPropagation(); box.remove(); setExamStyle(b.dataset.tuxStyle); }, true);
    if(modernOn() && examUi.anchor && document.contains(examUi.anchor)){
      const r = examUi.anchor.getBoundingClientRect();
      box.style.top = Math.max(6, r.bottom + 6) + 'px'; box.style.right = Math.max(8, innerWidth - r.right) + 'px';
    }
    examUi.anchor = null;
  }
  // Review incorrect: Previous / Next (the legacy arrows, Proceed and the Modern buttons, which click them) step through
  // the chosen items only, across blocks, the way the report's own Review buttons open an item. Nothing is saved.
  function onlyKey(b, q){ return b * 100000 + q; }
  function startOnly(items, label){ reviewOnly = items.length ? {label, items:items.slice().sort((x, y) => onlyKey(x.b, x.q) - onlyKey(y.b, y.q))} : null; }
  function examToast(text){
    let t = byId('tuxToast');
    if(!t){ t = document.createElement('div'); t.id = 'tuxToast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = text; clearTimeout(examToast.timer); examToast.timer = setTimeout(() => t.remove(), 2600);
  }
  function goExamItem(b, q, m){
    if(b === m.block){ goToQuestionIndex(q); return; }
    try{ commitQuestionTime(); }catch(e){} try{ persistBlockProgress(); }catch(e){}
    if(typeof activeSession !== 'undefined' && activeSession) activeSession.currentBlockPointer = b;
    startBlock(b); goToQuestionIndex(q);
  }
  function onOnlyNav(e){
    if(!reviewOnly || !e.target || !e.target.closest) return;
    if(e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
    const t = e.target.closest('#nextNav,#prevNav,#proceedBtn'); if(!t) return;
    const m = examModel(); if(!m || !m.review || m.view !== 'question') return;
    e.preventDefault(); e.stopImmediatePropagation();
    const cur = onlyKey(m.block, m.current), list = reviewOnly.items, back = t.id === 'prevNav';
    const it = back ? list.slice().reverse().find(x => onlyKey(x.b, x.q) < cur) : list.find(x => onlyKey(x.b, x.q) > cur);
    if(!it){ examToast(back ? `This is the first ${reviewOnly.label} item.` : `That was the last ${reviewOnly.label} item.`); return; }
    try{ goExamItem(it.b, it.q, m); }catch(err){ console.warn('ThunderUI review filter failed', err); }
  }
  function paintReviewIn(){ const s = examStyle(); document.querySelectorAll('[data-tu-revin]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.tuRevin === s))); }
  function watchExam(){
    const scr = byId('examScreen'); if(!scr || examUi.watched) return;
    examUi.watched = true;
    new MutationObserver(recs => {
      if(scr.classList.contains('hidden')){ reviewOnly = null; if(examUi.drawer || examUi.more){ examUi.drawer = examUi.more = false; } }
      if(!modernOn()) return;
      if(recs.every(r => r.target.closest && r.target.closest('.tux'))) return;
      scheduleExam();
    }).observe(scr, {childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['class', 'disabled', 'aria-expanded', 'hidden']});
    scr.addEventListener('click', onExamClick);
    new MutationObserver(() => decorateExamSettings()).observe(document.body, {childList:true});
    document.addEventListener('click', onOnlyNav, true);
    document.addEventListener('keydown', onOnlyNav, true);
    document.addEventListener('keydown', onExamKey);
    document.addEventListener('click', e => { if(!onlyStarting && e.target.closest && e.target.closest('.review-one')) reviewOnly = null; if(examUi.more && modernOn() && e.target.closest && !e.target.closest('#tuxMore,[data-tux="more"]')){ examUi.more = false; scheduleExam(); } }, true);
    addEventListener('resize', () => scheduleExam());
  }

  /* ---------- boot ---------- */
  // The HTML head hides the page (#tuCloak) until this sets data-tu-ready, so the legacy UI never flashes on open.
  // Shown once the first view is drawn: Home is built, an exam runs, a dialog asks something, or a panel other than the
  // HTML's default Quick practice is open (startup switches to Library after its async scan, so Quick practice alone
  // is not a drawn view yet; the time cap covers a start that stays there).
  function revealWhenDrawn(){
    const root = document.documentElement; if(root.hasAttribute('data-tu-ready')) return;
    const start = Date.now();
    const drawn = () => {
      const menu = byId('menu'), lib = byId('libraryModePanel'), dlg = byId('appDialogLayer'), active = document.querySelector('#menu .mode-panel.active');
      if(!menu || menu.classList.contains('hidden') || (dlg && !dlg.classList.contains('hidden'))) return true;
      if(lib && lib.classList.contains('active')) return lib.classList.contains('tu-has-home') && !!byId('tuHome');
      return !!active && active.id !== 'quickModePanel';
    };
    const check = () => { if(root.hasAttribute('data-tu-ready')) return; if(drawn() || Date.now() - start > 1500) root.setAttribute('data-tu-ready', '1'); else requestAnimationFrame(check); };
    requestAnimationFrame(check);
  }
  function boot(){
    revealWhenDrawn();
    if(!byId('thunder-ui-css')){ const st = document.createElement('style'); st.id = 'thunder-ui-css'; st.textContent = STYLES + EXAM_STYLES; document.head.appendChild(st); }
    applyAccent(); applyExamStyle(); watchExam(); wrapReport(); brand(); scheduleLibrary(); applySystemTheme(); scheduleSettings(true);
    // Legacy scripts rename the tab ("Step Exam Simulator A22.x …") after boot; keep the ThunderUSMLE name.
    const titleEl = document.querySelector('head > title');
    if(titleEl) new MutationObserver(() => { if(document.title !== 'ThunderUSMLE') document.title = 'ThunderUSMLE'; }).observe(titleEl, {childList:true, characterData:true, subtree:true});
    const panel = byId('libraryModePanel');
    if(panel){ libraryObserver = new MutationObserver(() => scheduleLibrary()); libraryObserver.observe(panel, {childList:true, subtree:true}); }
    const side = document.querySelector('#menu aside.modern-sidebar');
    if(side){
      new MutationObserver(() => brand()).observe(side, {childList:true});
      side.addEventListener('pointerdown', e => { const t = e.target.closest && e.target.closest('#qbankTab,#qbankTestsTab,#settingsTab,#tuSyncTab,#progressSyncTab'); if(t) prefetchViews(/qbank/i.test(t.id) ? 'qbank' : 'settings', true); }, true);
      // Local: any other sidebar tab leaves the Backup & sync page before the legacy handler opens its panel
      if(!IPAD) side.addEventListener('click', e => { const t = e.target.closest && e.target.closest('button'); if(t && t.id !== 'tuSyncTab' && setUi.page === 'sync'){ setUi.page = 'settings'; byId('tuSyncTab')?.classList.remove('active'); } }, true);
    }
    setTimeout(() => prefetchViews(), 1500);
    const menu = byId('menu'); if(menu) new MutationObserver(() => { syncDarkFlag(); heroTitle(); scheduleStart(); scheduleQuick(); scheduleQbank(true); if(menu.classList.contains('hidden')){ closeAdd(); closeUpdates(); } }).observe(menu, {attributes:true, attributeFilter:['class']}); // a run hides the menu
    // the legacy setup (Quick practice and the start dialog's controls) repaints inside #quickModePanel
    const quick = byId('quickModePanel');
    if(quick){
      quickObserver = new MutationObserver(recs => { if(recs.some(r => !(r.target.closest && r.target.closest('#tuQuick')))){ scheduleStart(); scheduleQuick(); } });
      quickObserver.observe(quick, {childList:true, subtree:true, attributes:true, attributeFilter:['class', 'disabled']});
    }
    scheduleQuick(); scheduleQbank(true);
    const status = byId('dataFolderStatus'); if(status) new MutationObserver(() => { scheduleSettings(true); paintNav(); }).observe(status, {childList:true, characterData:true, subtree:true});
    const watchCloud = () => { const c = byId('googleBackupStatus'); if(!c || c.dataset.tuWatched) return; c.dataset.tuWatched = '1'; new MutationObserver(() => paintSyncBits()).observe(c, {childList:true, characterData:true, subtree:true, attributes:true, attributeFilter:['data-tone', 'title']}); paintSyncBits(); };
    watchCloud();
    // late modules (progress sync, form updates) add their tabs and panels after load
    let tries = 0; const late = setInterval(() => { brand(); wrapReport(); watchCloud(); scheduleLibrary(); qbWatch(); scheduleSettings(true); if(++tries > 20) clearInterval(late); }, 500);
  }
  window.ThunderUI = {version:1, setAccent, accent:currentAccent, accents:Object.keys(ACCENTS), examStyle, setExamStyle, refresh:() => { brand(); scheduleLibrary(); scheduleSettings(true); scheduleExam(); }};
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
