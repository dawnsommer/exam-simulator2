/* ThunderUSMLE UI layer (A23 Phase 1 + Phases A–C): brand, accent colors, the Library home view (rebuilt from the canvas
   boards over StepLibraryBridge), the form details sheet, the start dialog, Quick practice, Add forms, Qbank (build + history), Settings › Appearance, the iPad Backup & sync order and the Score Report. Shared by the Local and iPad apps; keep both copies identical.
   It restyles the existing screens and adds a few controls. It never removes or renames the IDs and data-* hooks
   the other modules use, and it does not touch the exam interface (except the Score Report shown inside it). */
(function(){
  'use strict';
  if(window.ThunderUI) return;
  const IPAD = window.__STEP_SIM_STORAGE_PROFILE === 'ipad-browser-library-primary';
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
.tu-home-top{display:flex;flex-wrap:wrap;gap:16px;align-items:stretch}
.tu-overall{flex:1 1 340px;max-width:460px;padding:18px 20px;display:flex;flex-direction:column;gap:14px}
.tu-sec-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
${H} #tuHome .tu-sec-head h2{font-size:16px!important;font-weight:800!important;letter-spacing:0!important}
.tu-sec-head>span{font-size:12px;font-weight:700;color:var(--tu-on3)}
.tu-rings{display:flex;gap:18px;align-items:center;justify-content:space-around}
.tu-ring112{width:112px;height:112px;border-radius:50%;background:conic-gradient(var(--c) calc(var(--v)*1%),var(--tu-s2) 0);display:flex;align-items:center;justify-content:center}
.tu-ring112>div{width:88px;height:88px;border-radius:50%;background:var(--tu-surface);display:flex;flex-direction:column;align-items:center;justify-content:center}
.tu-ring112 b{font-size:25px;font-weight:800;line-height:1.1}
.tu-ring112 span{font-size:10.5px;color:var(--tu-on3);font-weight:700;letter-spacing:.04em}
.tu-pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:auto}
.tu-pair>div{background:var(--tu-s1);border-radius:14px;padding:10px 12px;display:flex;flex-direction:column}
.tu-pair b{font-size:16px;font-weight:800}.tu-pair b small{font-weight:600;color:var(--tu-on3);font-size:13px}
.tu-pair span{font-size:12px;color:var(--tu-on3);font-weight:600}
.tu-recent{flex:999 1 360px;min-width:0;padding:16px 18px;display:flex;flex-direction:column;gap:4px}
.tu-recent .tu-sec-head{padding-bottom:6px}
${H} #tuHome .tu-recent-row{display:flex;align-items:center;gap:12px;min-height:44px;width:100%;padding:6px 10px!important;margin:0!important;border-radius:12px!important;border:0!important;background:transparent!important;color:var(--tu-on)!important;text-align:left;box-shadow:none!important;height:auto!important}
${H} #tuHome .tu-recent-row:hover{background:var(--tu-s1)!important}
.tu-recent-row>i{width:9px;height:9px;border-radius:50%;flex:none}
.tu-recent-row>b{flex:1;min-width:0;font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tu-recent-row>span{font-size:12.5px;color:var(--tu-on3);white-space:nowrap}
.tu-recent-row>strong{width:46px;text-align:right;font-size:15px;font-weight:800}
.tu-empty-note{color:var(--tu-on3);font-size:13.5px;padding:8px 10px}
.tu-cats{padding:18px 20px;display:flex;flex-direction:column;gap:12px}
.tu-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.tu-tiles.tu-clamp{max-height:142px;overflow:hidden}
${H} #tuHome .tu-tile{text-align:left;display:flex;flex-direction:column;gap:6px;padding:9px 12px!important;margin:0!important;height:auto!important;min-height:0!important;border-radius:14px!important;border:1.5px solid var(--tu-line2)!important;background:var(--tu-surface)!important;color:var(--tu-on)!important;box-shadow:none!important}
${H} #tuHome .tu-tile:hover{border-color:var(--tu-line)!important}
${H} #tuHome .tu-tile[aria-pressed="true"]{background:var(--tu-pc)!important;border-color:var(--tu-p)!important;color:var(--tu-onpc)!important}
.tu-tile-top{display:flex;align-items:center;gap:7px;width:100%}
.tu-tile-top i{width:9px;height:9px;border-radius:50%;flex:none}
.tu-tile-top b{font-weight:800;font-size:14px;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tu-tile-top span{font-size:12.5px;font-weight:700;opacity:.85}
.tu-tile-bar{width:100%;height:4px;border-radius:99px;background:var(--tu-s3);overflow:hidden}.tu-tile-bar i{display:block;height:100%;border-radius:99px}
.tu-tile>small{font-size:11.5px;opacity:.8}
.tu-tiles-more{align-self:center}
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
.tu-when-meta{display:none}
@container (max-width:420px){.tu-form-actions .tu-when{visibility:hidden}.tu-when-meta{display:inline}}
.tu-form-tag{display:flex;align-items:center;gap:8px}
.tu-form-tag>i{width:9px;height:9px;border-radius:50%;flex:none}
.tu-form-tag>span:not(.tu-st){font-size:12.5px;font-weight:700;color:var(--tu-on3);flex:1;min-width:0;letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tu-st{font-size:12px;font-weight:800;padding:4px 10px;border-radius:999px;white-space:nowrap}
.tu-st.done{background:var(--tu-okc);color:var(--tu-ok)}.tu-st.progress{background:var(--tu-pc);color:var(--tu-onpc)}.tu-st.suspended{background:var(--tu-warnc);color:var(--tu-warn)}.tu-st.new{background:var(--tu-s2);color:var(--tu-on2)}
.tu-form-name{display:flex;flex-direction:column;gap:3px;min-width:0}
.tu-form-name>span{display:flex;align-items:center;gap:8px;min-width:0}
.tu-form-name b{font-size:18px;font-weight:800;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tu-three{font-size:12px;font-weight:800;padding:3px 8px;border-radius:8px;border:1px solid var(--tu-line);color:var(--tu-on2);flex:none}
.tu-form-name small{font-size:13px;color:var(--tu-on3)}
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
.tu-when{flex:1;min-width:0;font-size:12px;color:var(--tu-on3);text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${H} #tuHome .tu-kebab{width:40px;height:40px;min-width:40px;border-radius:50%!important;border:0!important;background:transparent!important;color:var(--tu-on2)!important;display:inline-flex;align-items:center;justify-content:center;padding:0!important;box-shadow:none!important;margin:0!important}
${H} #tuHome .tu-kebab:hover{background:var(--tu-s2)!important}
.tu-nomatch{grid-column:1/-1;padding:36px;text-align:center;color:var(--tu-on3);background:var(--tu-surface);border:1px dashed var(--tu-line);border-radius:24px}
/* compact list */
.tu-grid.tu-list{grid-template-columns:minmax(0,1fr);gap:8px}
.tu-list .tu-form{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(250px,1fr) auto;grid-template-areas:"name stats actions" "tag stats actions";align-items:center;gap:2px 20px;padding:12px 16px;border-radius:18px}
.tu-list .tu-form-tag{grid-area:tag}.tu-list .tu-form-tag>span:not(.tu-st){flex:none}.tu-list .tu-when-meta{display:none}.tu-list .tu-form-actions .tu-when{visibility:visible}.tu-list .tu-form-name{grid-area:name}.tu-list .tu-form-stats{grid-area:stats}.tu-list .tu-form-actions{grid-area:actions}
.tu-list .tu-bar5,.tu-list .tu-form-name small{display:none}
.tu-list .tu-form-name b{font-size:15.5px}
.tu-list .tu-ring58{width:44px;height:44px}.tu-list .tu-ring58>b{width:34px;height:34px;font-size:12px}
.tu-list .tu-when{flex:none}
@media (max-width:1100px){.tu-list .tu-form{grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"name actions" "tag actions" "stats stats"}}

/* sidebar: board order, storage / Google Drive card */
${H} aside.modern-sidebar #tuAddForms{order:1}
${H} aside.modern-sidebar #libraryTab{order:2}${H} aside.modern-sidebar #qbankTab{order:3}${H} aside.modern-sidebar #qbankTestsTab{order:4}
${H} aside.modern-sidebar #quickTab{order:5}${H} aside.modern-sidebar #progressSyncTab{order:6}${H} aside.modern-sidebar #settingsTab{order:7}
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
@media (max-width:1000px){${H} .modern-main:has(#libraryModePanel.tu-has-home.active){padding:18px 20px 40px!important}.tu-overall{max-width:none}}
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
  .tu-home-top{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
  .tu-overall{display:contents}
  .tu-overall>:not(.tu-mini3){display:none!important}
  .tu-recent{display:none!important}
  .tu-cats{background:transparent;border:0;box-shadow:none;padding:0}
  .tu-cats .tu-sec-head{display:none}
  .tu-tiles{display:flex;flex-wrap:wrap;gap:6px}
  ${H} #tuHome .tu-tile{flex-direction:row;align-items:center;gap:7px;height:36px!important;padding:0 12px!important;border-radius:10px!important;border-width:1px!important}
  .tu-tile .tu-tile-bar,.tu-tile>small,.tu-tile-top span{display:none}
  .tu-tile-top{gap:7px;width:auto}
  .tu-tile-top b{font-weight:700}
  .tu-tile>em{font-style:normal;font-weight:600;opacity:.7;font-size:14px}
  .tu-tiles.tu-clamp{max-height:78px}
  .tu-resume-bar{display:none}
  .tu-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
  .tu-form{padding:16px;gap:12px}
  .tu-forms-bar .tu-shown{display:none}
}
.tu-mini3{display:none}
@media (max-width:900px){.tu-mini3{display:flex;flex-direction:column;background:var(--tu-surface);border:1px solid var(--tu-line2);border-radius:20px;padding:14px 16px}.tu-mini3 b{font-size:22px;font-weight:800}.tu-mini3 span{font-size:12.5px;color:var(--tu-on3);font-weight:600}}
.tu-tile>em{display:none}
@media (max-width:900px){.tu-tile>em{display:inline}}
@media (max-width:600px){.tu-grid{grid-template-columns:minmax(0,1fr)}${H} #tuHome .tu-search{width:100%;flex:1 1 100%}}

/* Settings › Appearance */
:root[data-tu] body #menu #settingsPanel .settings-nav-v195 button{border-radius:999px!important;color:var(--tu-on2)!important;font-weight:600!important;background:transparent!important;border:0!important;box-shadow:none!important}
:root[data-tu] body #menu #settingsPanel .settings-nav-v195 button:hover{background:var(--tu-s2)!important;color:var(--tu-on)!important}
:root[data-tu] body #menu #settingsPanel .settings-nav-v195 button.active{background:var(--tu-pc)!important;color:var(--tu-onpc)!important;font-weight:700!important}
:root[data-tu] body #menu #settingsPanel:not([data-tu-tab="backup"]) #qidMigrationCard{display:none!important}
.tu-settings-list{display:flex;flex-direction:column}
.tu-setting{display:flex;flex-wrap:wrap;align-items:center;gap:12px 20px;padding:16px 0;border-top:1px solid var(--tu-line2)}
.tu-setting:first-child{border-top:0}
.tu-setting>div:first-child{flex:1 1 260px;display:flex;flex-direction:column;gap:3px}
.tu-setting b{font-size:15px;color:var(--tu-on)}
.tu-setting span{font-size:13px;color:var(--tu-on3);line-height:1.45}
.tu-swatches{display:flex;gap:8px;flex-wrap:wrap}
.tu-swatch{display:flex;align-items:center;gap:9px;height:44px;padding:0 16px 0 10px;border-radius:999px;border:2px solid var(--tu-line);background:var(--tu-surface);color:var(--tu-on);font-weight:800;font-size:14px;cursor:pointer}
.tu-swatch[aria-checked="true"]{border-color:var(--tu-on)}
.tu-swatch svg{width:26px;height:26px}

/* iPad Backup & sync */
:root[data-tu] body #menu #progressSyncPanel .sync-layout{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:16px!important}
:root[data-tu] body #menu #progressSyncPanel .sync-layout>[data-tu-sync="storage"]{order:1;grid-column:1/-1}
:root[data-tu] body #menu #progressSyncPanel .sync-layout>[data-tu-sync]{grid-column:1/-1!important}
:root[data-tu] body #menu #progressSyncPanel .sync-layout>[data-tu-sync="progress"]{order:2}
:root[data-tu] body #menu #progressSyncPanel .sync-layout>[data-tu-sync="library"]{order:3}
:root[data-tu] body #menu #progressSyncPanel .sync-layout>[data-tu-sync="recovery"]{order:4}
:root[data-tu] body #menu #progressSyncPanel .sync-layout>[data-tu-sync="history"]{order:5}
:root[data-tu] body #menu #progressSyncPanel .sync-layout>[data-tu-sync="advanced"]{order:6;grid-column:1/-1}
:root[data-tu] body #menu #progressSyncPanel .sync-layout>[data-tu-sync="move"]{order:7;grid-column:1/-1}
:root[data-tu] body #menu #progressSyncPanel .sync-layout>[data-tu-collapsible]>h3{display:flex;align-items:center;gap:10px;cursor:pointer;margin:0!important;user-select:none}
:root[data-tu] body #menu #progressSyncPanel .sync-layout>[data-tu-collapsible]>h3::after{content:"";margin-left:auto;width:18px;height:18px;background:var(--tu-on2);-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.4' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") center/contain no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.4' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") center/contain no-repeat;transition:transform .15s}
:root[data-tu] body #menu #progressSyncPanel .sync-layout>[data-tu-collapsible].tu-open>h3::after{transform:rotate(180deg)}
:root[data-tu] body #menu #progressSyncPanel .sync-layout>[data-tu-collapsible]:not(.tu-open)>:not(h3){display:none!important}
:root[data-tu] body #menu #progressSyncPanel .sync-layout>[data-tu-collapsible]:not(.tu-open){padding-top:16px!important;padding-bottom:16px!important}
.tu-sync-card{padding:20px 22px!important;display:flex;flex-direction:column;gap:12px}
.tu-sync-card h3{margin:0!important;font-size:17px!important}
.tu-sync-card p{margin:0!important;font-size:13.5px!important;color:var(--tu-on3)!important}
.tu-sync-row{display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;padding:12px 14px;border-radius:16px;background:var(--tu-s1)}
.tu-sync-row>div:first-child{flex:1 1 220px;display:flex;flex-direction:column;gap:2px;min-width:0}
.tu-sync-row b{font-size:14.5px;color:var(--tu-on)}.tu-sync-row span{font-size:12.5px;color:var(--tu-on3)}
.tu-sync-row .tu-actions{display:flex;gap:8px;flex-wrap:wrap}
.tu-dot{width:10px;height:10px;border-radius:50%;background:var(--tu-on3);display:inline-block;margin-right:8px;vertical-align:middle}
.tu-dot.ok{background:var(--tu-ok)}

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
    if(document.querySelector('[data-tu-appearance]')) paintAppearance();
  }
  function syncDarkFlag(){
    const menu = byId('menu');
    if(menu && menu.classList.contains('theme-dark')) document.documentElement.dataset.tuDark = '1';
    else delete document.documentElement.dataset.tuDark;
  }

  const TAB_LABELS = {quickTab:['Quick practice','quick'], libraryTab:['Library','library'], qbankTab:['Qbank','qbank'], qbankTestsTab:['Qbank tests','tests'], progressSyncTab:['Backup & sync','sync'], settingsTab:['Settings','settings']};
  const TITLES = {quickTab:'Quick practice', libraryTab:'Library', qbankTab:'Qbank', qbankTestsTab:'Qbank tests', progressSyncTab:'Backup & sync', settingsTab:'Settings'};
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
  const TAB_DOTS = {'N-Forms':'#3B6FE0', IM:'#0F8B8D', OBGyn:'#C2417A', Surg:'#D9661F', Peds:'#7B5CD6', FM:'#3C9A4A', EM:'#D23F3F', Psych:'#5A67D8', Neuro:'#B7862A', Custom:'#7A8194', All:'#6B7280'};
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
    let chip = false; try{ chip = rec.type === 'N' && B.scoreChipOn(tabKey); }catch(e){}
    const blocks = s.blockCount || blockCountOf(rec), attempts = Number(s.attemptCount) || (s.answered || s.completed ? 1 : 0);
    const score = s.completed && s.scorePct != null ? Number(s.scorePct) : null;
    return {
      id: rec.id, rec, s, st, tabKey, tabLabel: tab.label, color: tab.color,
      title: rec.displayName || rec.id, tag: (tab.label + ' · ' + rec.id).toUpperCase(),
      three: chip && rec.threeDigitScore ? String(rec.threeDigitScore) : '',
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
  function openSync(){ byId('progressSyncTab')?.click(); }

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
  const homeUi = {resumeOpen:false, tabsOpen:false};
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
      `<div class="tu-home-top"><section class="tu-card tu-overall" aria-label="Overall performance" data-tu-r="overall"></section><section class="tu-card tu-recent" aria-label="Recently completed" data-tu-r="recent"></section></div>` +
      `<section class="tu-card tu-cats" aria-label="Categories"><div class="tu-sec-head"><h2>Categories</h2><button type="button" class="tu-link" id="tuCustomizeTabs">Customize tabs</button></div><div data-tu-r="cats" style="display:contents"></div></section>` +
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
    const [qa, qt] = qline.split('/').map(x => Number(String(x).replace(/[^\d]/g, '')) || 0);
    const fline = Array.from(legacy ? legacy.querySelectorAll('.library-overall-pill-v201') : []).map(x => x.textContent).find(t => /forms? complete/i.test(t)) || '';
    const fm = fline.match(/(\d+)\s*\/\s*(\d+)/);
    const fd = fm ? Number(fm[1]) : forms.filter(f => f.s.completed).length, ft = fm ? Number(fm[2]) : forms.length;
    const ring = (v, c, label) => `<div class="tu-ring112" style="--v:${v == null ? 0 : v};--c:${c}" role="img" aria-label="${label} ${v == null ? 'not available' : v + ' percent'}"><div><b>${v == null ? '—' : v + '%'}</b><span>${label.toUpperCase()}</span></div></div>`;
    return `<div class="tu-sec-head"><h2>Overall performance</h2><span>Included tabs only</span></div><div class="tu-rings">${ring(progress, 'var(--tu-p)', 'Progress')}${ring(score, 'var(--tu-ok)', 'Avg score')}</div>` +
      `<div class="tu-pair"><div><b>${qa.toLocaleString()} <small>/ ${qt.toLocaleString()}</small></b><span>Questions answered</span></div><div><b>${fd} <small>/ ${ft}</small></b><span>Forms complete</span></div></div>` +
      `<div class="tu-mini3"><b>${progress == null ? '—' : progress + '%'}</b><span>Overall progress</span></div><div class="tu-mini3"><b>${score == null ? '—' : score + '%'}</b><span>Average score</span></div><div class="tu-mini3"><b>${fd} / ${ft}</b><span>Forms done</span></div>`;
  }
  function recentHtml(forms){
    const B = bridge();
    const done = forms.filter(f => f.s.completed && (() => { try{ return B.completedOn(f.tabKey); }catch(e){ return true; } })())
      .sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt))).slice(0, 5);
    const rows = done.map(f => `<button type="button" class="tu-recent-row" data-tu-act="review" data-id="${esc(f.id)}" title="Open the score report for ${esc(f.title)}"><i style="background:${esc(f.color)}"></i><b>${esc(f.title)}</b><span>${esc([shortDate(f.completedAt), f.three].filter(Boolean).join(' · '))}</span><strong>${f.score == null ? '—' : f.score + '%'}</strong></button>`).join('');
    return `<div class="tu-sec-head"><h2>Recently completed</h2>${done.length ? '<button type="button" class="tu-link" data-tu-see-all>See all</button>' : ''}</div>${rows || '<span class="tu-empty-note">Completed forms will appear here.</span>'}`;
  }
  function catsHtml(tabs, forms, cat){
    const B = bridge();
    const tiles = tabs.map(t => {
      let recs = forms; if(t.key !== 'All'){ try{ const ids = new Set(B.recs(t.internal).map(r => r.id)); recs = forms.filter(f => ids.has(f.id)); }catch(e){ recs = []; } }
      const done = recs.filter(f => f.s.completed), scoreTotal = done.reduce((n, f) => n + (Number(f.s.scoreTotal) || 0), 0), scoreCorrect = done.reduce((n, f) => n + (Number(f.s.scoreCorrect) || 0), 0);
      const score = scoreTotal ? Math.round(scoreCorrect / scoreTotal * 100) + '%' : '—', pctDone = recs.length ? Math.round(done.length / recs.length * 100) : 0;
      let meter = true; if(t.key !== 'All'){ try{ meter = B.meterOn(t.internal); }catch(e){} }
      const on = cat === t.key;
      return `<button type="button" class="tu-tile" data-tu-cat="${esc(t.key)}" aria-pressed="${on}"><span class="tu-tile-top"><i style="background:${esc(t.color)}"></i><b>${esc(t.label)}</b>${meter ? `<span>${score}</span>` : ''}</span>${meter ? `<span class="tu-tile-bar"><i style="width:${pctDone}%;background:${esc(t.color)}"></i></span>` : ''}<small>${done.length} of ${recs.length} done</small><em>${recs.length}</em></button>`;
    }).join('');
    return `<div class="tu-tiles${homeUi.tabsOpen ? '' : ' tu-clamp'}" data-tu-tiles>${tiles}</div><button type="button" class="tu-link tu-tiles-more" data-tu-tabs-more hidden aria-expanded="${homeUi.tabsOpen}">${homeUi.tabsOpen ? 'Show fewer tabs' : 'Show all tabs'}</button>`;
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
    return `<article class="tu-card tu-form" data-tu-form="${esc(f.id)}"><div class="tu-form-tag"><i style="background:${esc(f.color)}"></i><span>${esc(f.tag)}</span><span class="tu-st ${f.st}">${ST_LABEL[f.st]}</span></div>` +
      `<div class="tu-form-name"><span><b title="${esc(f.title)}">${esc(f.title)}</b>${f.three ? `<span class="tu-three" title="3-digit score">${esc(f.three)}</span>` : ''}</span><small>${esc(f.meta)}${f.completedAt ? `<span class="tu-when-meta"> · Completed ${esc(shortDate(f.completedAt))}</span>` : ''}</small></div>` +
      `<div class="tu-form-stats"><div class="tu-ring58" style="--v:${f.score == null ? 0 : f.score};--c:${ring}" role="img" aria-label="Score ${f.score == null ? 'not available' : f.score + ' percent'}"><b>${f.score == null ? '—' : f.score + '%'}</b></div><div class="tu-three-stats"><div><b>${f.answered}%</b><span>Answered</span></div><div><b>${f.blocks}</b><span>Blocks</span></div><div><b>${f.marked}</b><span>Marked</span></div></div></div>` +
      `<div class="tu-bar5" aria-hidden="true"><i style="width:${f.answered}%;background:${esc(f.color)}"></i></div>` +
      `<div class="tu-form-actions">${primary}${f.canReview ? `<button type="button" class="tu-btn quiet" data-tu-act="review" data-id="${esc(f.id)}">Review</button>` : ''}<span class="tu-when">${f.completedAt ? 'Completed ' + esc(shortDate(f.completedAt)) : ''}</span><button type="button" class="tu-kebab" data-tu-act="sheet" data-id="${esc(f.id)}" aria-label="Details and more actions for ${esc(f.title)}" aria-haspopup="dialog">${kebab}</button></div></article>`;
  }
  function moreHtml(){
    const items = [['exportCatalogBtn', 'Save library index'], ['exportFullLibraryBackupBtn', 'Export form library ZIP'], ['importFullLibraryBackupBtn', 'Import form library ZIP'], ['exportProgressOnlyBackupBtn', 'Export progress file'], ['importProgressOnlyBackupBtn', 'Import progress file'], ['updateAppShellBtn', 'Reload latest version']].filter(([id]) => byId(id));
    if(!items.length) return '';
    const version = (byId('appVersionLabel')?.textContent || '').trim();
    return `<details class="tu-more"><summary class="tu-iconbtn" aria-label="More library actions" title="More">${icon('<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>', 20)}</summary><div class="tu-more-panel">${items.map(([id, l]) => `<button type="button" data-tu-proxy="${id}">${l}</button>`).join('')}${version ? `<small>${esc(version)}</small>` : ''}</div></details>`;
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
    const qs = forms.reduce((n, f) => n + (Number(f.rec.totalQuestions) || 0), 0);
    setRegion('count', forms.length ? esc(plural(forms.length, 'form') + ' · ' + qs.toLocaleString() + ' questions') : '');
    const upd = byId('formUpdatesCheck');
    setRegion('updates', upd ? `<button type="button" class="tu-iconbtn" data-tu-updates aria-haspopup="dialog" aria-label="Check for form updates" title="Check for form updates">${icon(ICONS.download, 19)}</button>` : '');
    setRegion('more', moreHtml());
    setRegion('overall', overallHtml(forms));
    setRegion('recent', recentHtml(forms));
    setRegion('cats', catsHtml(tabs, forms, cat));
    const r = home.querySelector('[data-tu-r="resume"]'), rh = resumeHtml(forms); setRegion('resume', rh); r.hidden = !rh;
    // forms in the selected tab, then search, status and sort
    let inCat = forms;
    if(cat !== 'All'){ try{ const ids = new Set(B.recs(tabInternal(cat)).map(x => x.id)); inCat = forms.filter(f => ids.has(f.id)); }catch(e){} }
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
    const tabLabel = cat === 'All' ? '' : ' in ' + ((tabs.find(t => t.key === cat) || {}).label || cat);
    setRegion('shown', forms.length ? `Showing ${shown.length} of ${plural(inCat.length, 'form')}${tabLabel}` : '');
    const empty = !forms.length ? `<div class="tu-nomatch">No forms yet. Use <b>Add forms</b> to load your first form.</div>` : `<div class="tu-nomatch">${q ? 'No forms match “' + esc(q) + '”.' : 'No forms with this status' + esc(tabLabel) + '.'}</div>`;
    setRegion('cards', shown.length ? shown.map(cardHtml).join('') : empty);
    const view = store.get(KEYS.view, 'grid') === 'list' ? 'list' : 'grid';
    home.querySelector('[data-tu-r="cards"]').classList.toggle('tu-list', view === 'list');
    home.querySelectorAll('[data-tu-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tuView === view)));
    paintSyncBits();
    // "Show all tabs" only when the tiles overflow the collapsed height
    const tiles = home.querySelector('[data-tu-tiles]'), more = home.querySelector('[data-tu-tabs-more]');
    if(tiles && more){ tiles.classList.add('tu-clamp'); const over = tiles.scrollHeight > tiles.clientHeight + 2; tiles.classList.toggle('tu-clamp', !homeUi.tabsOpen); more.hidden = !over; }
    if(sheetState.id) paintSheet();
    if(addUi.open) paintAdd();
    paintUpdates();
    heroTitle();
    if(libraryObserver) libraryObserver.takeRecords();
  }
  function onHomeClick(e){
    const t = e.target.closest('button, [data-tu-cat]'); if(!t || !byId('tuHome').contains(t)) return;
    if(t.dataset.tuCat){ document.querySelector(`#libraryFilters .filter-pill[data-filter="${CSS.escape(t.dataset.tuCat)}"]`)?.click(); scheduleLibrary(); return; }
    if(t.dataset.tuStatus){ store.set(KEYS.status, t.dataset.tuStatus); scheduleLibrary(); return; }
    if(t.dataset.tuView){ store.set(KEYS.view, t.dataset.tuView); scheduleLibrary(); return; }
    if(t.hasAttribute('data-tu-resume-more')){ homeUi.resumeOpen = !homeUi.resumeOpen; scheduleLibrary(); return; }
    if(t.hasAttribute('data-tu-tabs-more')){ homeUi.tabsOpen = !homeUi.tabsOpen; scheduleLibrary(); return; }
    if(t.hasAttribute('data-tu-see-all')){ store.set(KEYS.status, 'done'); if(bridge().filter() !== 'All') document.querySelector('#libraryFilters .filter-pill[data-filter="All"]')?.click(); scheduleLibrary(); byId('tuHome').querySelector('.tu-forms')?.scrollIntoView({behavior:'smooth', block:'start'}); return; }
    if(t.hasAttribute('data-tu-updates')){ openUpdates(t); return; }
    if(t.id === 'tuCustomizeTabs'){ window.__v195BSettingsActive = 'order'; window.__v195SettingsActive = 'order'; window.__tuSettingsAppearance = false; byId('settingsTab')?.click(); return; }
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
      const o = new MutationObserver(recs => { if(recs.some(r => !(r.target.closest && r.target.closest('#' + view)))) scheduleQbank(true); });
      o.observe(p, {childList:true, subtree:true, attributes:true, attributeFilter:['class', 'max', 'disabled']});
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
    if(qbUi.stale || !qbUi.data){
      const n = ++qbUi.seq; qbUi.stale = false;
      const d = await B.qbank(); if(n !== qbUi.seq) return;
      qbUi.data = d;
    }
    if(showBuild) paintQbBuild(build);
    if(showTests) paintQbHistory(tests);
    heroTitle();
    qbObservers.forEach(o => o.takeRecords());
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
  function slotCat(id){ if(/^N-/i.test(id)) return 'NBME'; const m = id.match(/^C-([A-Za-z]+)-/); return m ? m[1] : 'Other'; }
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
  const ADD_TABS = () => [['slot', 'Fixed slot', 'NBME N-06…16, C-IM, C-OBGyn…'], ['custom', 'Custom form', 'Any JSON or ZIP bank'], ['bulk', 'Bulk ZIP', 'Many forms in one go'], hasUpdates() ? ['online', 'Online updates', (() => { const n = (updState().forms || []).filter(f => f.status === 'New' || f.status === 'Revised').length; return n ? n + ' available' : 'Published forms'; })()] : null].filter(Boolean);
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

  /* ---------- Settings › Appearance ---------- */
  function appearanceHtml(){
    const dark = !!byId('menu')?.classList.contains('theme-dark');
    const accent = currentAccent(), view = store.get(KEYS.view, 'grid') === 'list' ? 'list' : 'grid';
    const swatch = id => `<button type="button" class="tu-swatch" role="radio" aria-checked="${accent === id}" data-tu-pick="${id}"><svg viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="116" fill="${ACCENTS[id].brand}"/><path d="${BOLT}" fill="#fff"/></svg>${ACCENTS[id].label}</button>`;
    return `<section class="settings-panel-v195" data-tu-appearance><h3>Appearance</h3><p>How ThunderUSMLE looks on this ${IPAD ? 'iPad' : 'computer'}. Your exam screens are not changed.</p><div class="tu-settings-list">` +
      `<div class="tu-setting"><div><b>Theme</b><span>Library, Qbank and Settings</span></div><div class="tu-seg" role="radiogroup" aria-label="Theme"><button type="button" role="radio" aria-checked="${!dark}" data-tu-theme="light">${icon(ICONS.sun, 16)}Light</button><button type="button" role="radio" aria-checked="${dark}" data-tu-theme="dark">${icon(ICONS.moon, 16)}Dark</button></div></div>` +
      `<div class="tu-setting"><div><b>Accent color</b><span>Buttons, selection, progress rings and the app icon. Crimson is the default.${IPAD ? ' The Home Screen icon updates when you add the app to the Home Screen again.' : ''}</span></div><div class="tu-swatches" role="radiogroup" aria-label="Accent color">${Object.keys(ACCENTS).map(swatch).join('')}</div></div>` +
      `<div class="tu-setting"><div><b>Form cards</b><span>Comfortable cards, or a compact list for big libraries</span></div><div class="tu-seg" role="radiogroup" aria-label="Form cards"><button type="button" role="radio" aria-checked="${view === 'grid'}" data-tu-cards="grid">${icon(ICONS.grid, 16)}Cards</button><button type="button" role="radio" aria-checked="${view === 'list'}" data-tu-cards="list">${icon(ICONS.list, 16)}List</button></div></div>` +
      `</div></section>`;
  }
  function paintAppearance(){ const box = document.querySelector('#settingsPanel [data-tu-appearance]'); if(box) box.outerHTML = appearanceHtml(); }
  function decorateSettings(){
    const p = byId('settingsPanel'); if(!p) return;
    const nav = p.querySelector('.settings-nav-v195'), content = p.querySelector('.settings-content-v195');
    const on = !!window.__tuSettingsAppearance;
    p.dataset.tuTab = on ? 'appearance' : (window.__v195BSettingsActive || window.__v195SettingsActive || 'library');
    if(!nav || !content) return;
    let btn = nav.querySelector('[data-tu-settings-tab]');
    if(!btn){ btn = document.createElement('button'); btn.type = 'button'; btn.dataset.tuSettingsTab = 'appearance'; btn.textContent = 'Appearance'; nav.insertBefore(btn, nav.firstChild); }
    btn.classList.toggle('active', on);
    if(on){
      if(content.querySelector('[data-tu-appearance]') && btn.classList.contains('active') && p.dataset.tuShown === '1') return;
      p.dataset.tuShown = '1';
      nav.querySelectorAll('[data-v195b-settings-tab],[data-v195-settings-tab]').forEach(b => b.classList.remove('active'));
      if(!content.querySelector('[data-tu-appearance]')) content.innerHTML = appearanceHtml();
    } else delete p.dataset.tuShown;
  }
  let settingsObserver = null;
  function watchSettings(){
    const p = byId('settingsPanel'); if(!p || settingsObserver) return;
    settingsObserver = new MutationObserver(() => { try{ decorateSettings(); }catch(e){ console.warn('ThunderUI settings failed', e); } settingsObserver.takeRecords(); });
    settingsObserver.observe(p, {childList:true});
    decorateSettings(); settingsObserver.takeRecords();
  }
  window.addEventListener('click', e => {
    const t = e.target && e.target.closest ? e.target : null; if(!t) return;
    if(t.closest('[data-tu-settings-tab]')){ e.preventDefault(); e.stopPropagation(); window.__tuSettingsAppearance = true; decorateSettings(); return; }
    if(t.closest('[data-v195b-settings-tab],[data-v195-settings-tab]')) window.__tuSettingsAppearance = false;
    const acc = t.closest("[data-tu-pick]"); if(acc){ setAccent(acc.dataset.tuPick); return; }
    const th = t.closest('[data-tu-theme]');
    if(th){ const dark = !!byId('menu')?.classList.contains('theme-dark'); if((th.dataset.tuTheme === 'dark') !== dark) byId('themeToggle')?.click(); setTimeout(() => { brand(); paintAppearance(); }, 0); return; }
    const cv = t.closest('[data-tu-cards]'); if(cv){ store.set(KEYS.view, cv.dataset.tuCards); paintAppearance(); scheduleLibrary(); return; }
    if(t.closest('#themeToggle')) setTimeout(brand, 0);
    if(t.closest('#menu aside.modern-sidebar .menu-tab')) setTimeout(() => { heroTitle(); paintSync(); }, 0);
  }, true);

  /* ---------- iPad Backup & sync ---------- */
  function proxyButton(id, label, cls){ return byId(id) ? `<button type="button" class="tu-btn ${cls || 'outline small'}" data-tu-proxy="${id}">${label}</button>` : ''; }
  function paintSync(){
    const panel = byId('progressSyncPanel'), layout = panel && panel.querySelector('.sync-layout'); if(!layout) return;
    const hero = panel.querySelector('.sync-hero');
    if(hero && !hero.dataset.tu){ const p = hero.querySelector('p'); if(p) p.textContent = 'Progress is saved on this iPad first, then backed up to your Google Drive. When two devices disagree, nothing is overwritten until you choose.'; const h = hero.querySelector('h2'); if(h) h.textContent = 'Google Drive backup'; hero.dataset.tu = '1'; }
    Array.from(layout.children).forEach(sec => {
      if(sec.dataset.tuSync) return;
      const h = (sec.querySelector(':scope > h3')?.textContent || '').trim();
      let kind = '';
      if(sec.id === 'libraryBackupCard') kind = 'library';
      else if(/^Current Progress Sync/i.test(h)) kind = 'progress';
      else if(/^Recovery/i.test(h)) kind = 'recovery';
      else if(/History/i.test(h)) kind = 'history';
      else if(/Advanced|Inventory|Diagnos/i.test(h) || sec.querySelector('.sync-maintenance')) kind = 'advanced';
      if(!kind) return;
      sec.dataset.tuSync = kind;
      if(kind === 'progress'){ const t = sec.querySelector(':scope > h3'); if(t) t.textContent = 'Google Drive progress sync'; }
      if(kind === 'recovery' || kind === 'history' || kind === 'advanced'){
        sec.dataset.tuCollapsible = '1';
        const t = sec.querySelector(':scope > h3');
        if(t){
          if(kind === 'recovery') t.textContent = 'Recovery';
          if(kind === 'history') t.textContent = 'Backup history';
          if(kind === 'advanced') t.textContent = 'Advanced sync tools';
          t.setAttribute('role', 'button'); t.tabIndex = 0; t.setAttribute('aria-expanded', 'false');
        }
      }
    });
    if(!layout.querySelector('[data-tu-sync="storage"]')){
      const s = document.createElement('section'); s.className = 'sync-card tu-sync-card'; s.dataset.tuSync = 'storage';
      layout.insertBefore(s, layout.firstChild);
    }
    const storage = layout.querySelector('[data-tu-sync="storage"]');
    const status = byId('dataFolderStatus'), connected = !!status && status.classList.contains('connected');
    const sHtml = `<h3>Library on this iPad</h3><div class="tu-sync-row"><div><b><span class="tu-dot ${connected ? 'ok' : ''}"></span>${esc(status ? status.textContent.replace(/^iPad Browser Library:\s*/i, 'Storage ') : 'Storage')}</b><span>Forms, images and progress are stored in this browser on this iPad. Back them up below.</span></div><div class="tu-actions">${proxyButton('scanDataFolderBtn', 'Rescan')}${connected ? '' : proxyButton('connectDataFolderBtn', 'Start storage', '')}</div></div>`;
    if(storage.innerHTML !== sHtml) storage.innerHTML = sHtml;
    if(!layout.querySelector('[data-tu-sync="move"]')){
      const m = document.createElement('section'); m.className = 'sync-card tu-sync-card'; m.dataset.tuSync = 'move';
      m.innerHTML = `<h3>Move between devices</h3><p>Files you can save and open on another iPad or the Local app.</p>` +
        (byId('exportFullLibraryBackupBtn') || byId('importFullLibraryBackupBtn') ? `<div class="tu-sync-row"><div><b>Form library ZIP</b><span>All forms and images, without progress</span></div><div class="tu-actions">${proxyButton('exportFullLibraryBackupBtn', icon(ICONS.download, 16) + 'Export')}${proxyButton('importFullLibraryBackupBtn', icon(ICONS.upload, 16) + 'Import')}</div></div>` : '') +
        (byId('exportProgressOnlyBackupBtn') || byId('importProgressOnlyBackupBtn') ? `<div class="tu-sync-row"><div><b>Progress file</b><span>Attempts, answers, marks and notes for every form</span></div><div class="tu-actions">${proxyButton('exportProgressOnlyBackupBtn', icon(ICONS.download, 16) + 'Export')}${proxyButton('importProgressOnlyBackupBtn', icon(ICONS.upload, 16) + 'Import')}</div></div>` : '');
      layout.appendChild(m);
    }
  }
  document.addEventListener('click', e => {
    const proxy = e.target.closest && e.target.closest('[data-tu-proxy]');
    if(proxy){ e.preventDefault(); byId(proxy.dataset.tuProxy)?.click(); setTimeout(paintSync, 300); return; }
    const head = e.target.closest && e.target.closest('#progressSyncPanel [data-tu-collapsible] > h3');
    if(head){ const sec = head.parentElement; sec.classList.toggle('tu-open'); head.setAttribute('aria-expanded', String(sec.classList.contains('tu-open'))); }
  });
  document.addEventListener('keydown', e => {
    if(e.key !== 'Enter' && e.key !== ' ') return;
    const head = e.target.closest && e.target.closest('#progressSyncPanel [data-tu-collapsible] > h3');
    if(head){ e.preventDefault(); head.click(); }
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
    wrap.innerHTML = `<section class="tu-card tu-rep-hero"><div class="tu-rep-copy"><span class="tu-kicker">Score report</span><h1 class="tu-rep-title">${esc(title)}</h1><span class="tu-rep-meta">${esc(meta)}</span><div class="tu-rep-actions" data-tu-slot="review"><button type="button" class="tu-btn" data-tu-review="all">Review all</button>${wrong + blank ? `<button type="button" class="tu-btn tonal" data-tu-review="incorrect">Review incorrect (${wrong + blank})</button>` : ''}</div><div class="tu-rep-actions secondary-row" data-tu-slot="files"></div></div>` +
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
      const r = e.target.closest('[data-tu-review]'); if(!r) return;
      const target = r.dataset.tuReview === 'incorrect' && firstWrong ? firstWrong : rows[0];
      if(!target) return;
      const btn = wrap.querySelector(`.review-one[data-b="${target.b}"][data-q="${(Number(target.a.item) || 1) - 1}"]`);
      btn?.click();
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

  /* ---------- boot ---------- */
  function boot(){
    if(!byId('thunder-ui-css')){ const st = document.createElement('style'); st.id = 'thunder-ui-css'; st.textContent = STYLES; document.head.appendChild(st); }
    applyAccent(); watchSettings(); wrapReport(); brand(); scheduleLibrary(); paintSync();
    const panel = byId('libraryModePanel');
    if(panel){ libraryObserver = new MutationObserver(() => scheduleLibrary()); libraryObserver.observe(panel, {childList:true, subtree:true}); }
    const side = document.querySelector('#menu aside.modern-sidebar');
    if(side) new MutationObserver(() => brand()).observe(side, {childList:true});
    const menu = byId('menu'); if(menu) new MutationObserver(() => { syncDarkFlag(); heroTitle(); scheduleStart(); scheduleQuick(); scheduleQbank(true); if(menu.classList.contains('hidden')){ closeAdd(); closeUpdates(); } }).observe(menu, {attributes:true, attributeFilter:['class']}); // a run hides the menu
    // the legacy setup (Quick practice and the start dialog's controls) repaints inside #quickModePanel
    const quick = byId('quickModePanel');
    if(quick){
      quickObserver = new MutationObserver(recs => { if(recs.some(r => !(r.target.closest && r.target.closest('#tuQuick')))){ scheduleStart(); scheduleQuick(); } });
      quickObserver.observe(quick, {childList:true, subtree:true, attributes:true, attributeFilter:['class', 'disabled']});
    }
    scheduleQuick(); scheduleQbank(true);
    const sync = byId('progressSyncPanel'); if(sync) new MutationObserver(() => paintSync()).observe(sync, {childList:true});
    const status = byId('dataFolderStatus'); if(status) new MutationObserver(() => { paintSync(); paintNav(); }).observe(status, {childList:true, characterData:true, subtree:true});
    const watchCloud = () => { const c = byId('googleBackupStatus'); if(!c || c.dataset.tuWatched) return; c.dataset.tuWatched = '1'; new MutationObserver(() => paintSyncBits()).observe(c, {childList:true, characterData:true, subtree:true, attributes:true, attributeFilter:['data-tone', 'title']}); paintSyncBits(); };
    watchCloud();
    // late modules (progress sync, form updates) add their tabs and panels after load
    let tries = 0; const late = setInterval(() => { brand(); paintSync(); watchSettings(); wrapReport(); watchCloud(); scheduleLibrary(); qbWatch(); if(byId('progressSyncPanel') && !sync && !late.__obs){ late.__obs = true; new MutationObserver(() => paintSync()).observe(byId('progressSyncPanel'), {childList:true}); } if(++tries > 20) clearInterval(late); }, 500);
  }
  window.ThunderUI = {version:1, setAccent, accent:currentAccent, accents:Object.keys(ACCENTS), refresh:() => { brand(); scheduleLibrary(); paintSync(); }};
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
