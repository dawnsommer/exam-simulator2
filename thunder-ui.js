/* ThunderUSMLE UI layer (A23 Phase 1): brand, accent colors, the Library home layout, Settings › Appearance,
   the iPad Backup & sync order and the Score Report. Shared by the Local and iPad apps; keep both copies identical.
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
:root[data-tu] body #menu .modern-main :is(input[type=text],input[type=number],input[type=search],select,textarea):not(#tuSearch):not(#tuSort){border-radius:12px!important;border:1px solid var(--tu-line)!important;background:var(--tu-surface)!important;color:var(--tu-on)!important}

/* library layout */
:root[data-tu] body #menu #libraryModePanel.active{display:grid!important;grid-template-columns:repeat(12,minmax(0,1fr));grid-template-areas:"actions actions actions actions actions actions find find find find find find" "overall overall overall overall overall recent recent recent recent recent recent recent" "cathead cathead cathead cathead cathead cathead cathead cathead cathead cathead cathead cathead" "cats cats cats cats cats cats cats cats cats cats cats cats" "resume resume resume resume resume resume resume resume resume resume resume resume" "status status status status status status status status status status status status" "grid grid grid grid grid grid grid grid grid grid grid grid";gap:16px;align-items:stretch}
:root[data-tu] body #menu #libraryModePanel.active>:not(#tuFind):not(#tuCatsHead):not(#tuResume):not(#tuStatusBar):not(#libraryTopV195B):not(#libraryFilters):not(#libraryGrid){grid-column:1/-1}
:root[data-tu] body #menu #libraryModePanel :is(#libraryTopV195B,.library-hero-left-v195b,.library-hero-right-v195b,.workflow-card-v201){display:contents!important}
:root[data-tu] body #menu #libraryModePanel #libraryTopV195B .workflow-divider-v217{display:none!important}
:root[data-tu] body #menu #libraryModePanel .library-actions{grid-area:actions!important;display:flex!important;flex-direction:row!important;flex-wrap:wrap!important;align-items:center!important;gap:8px!important;margin:0!important;padding:0!important;background:transparent!important;border:0!important;box-shadow:none!important;min-width:0}
:root[data-tu] body #menu #libraryModePanel .library-actions :is(button,summary){height:40px!important;min-height:0!important;padding:0 16px!important;border-radius:999px!important;font-size:13.5px!important;font-weight:700!important;box-shadow:none!important;width:auto!important;margin:0!important}
:root[data-tu] body #menu #libraryModePanel .library-actions .exam-final-actionbar.fu-toolbar{display:flex!important;flex-direction:row!important;width:auto!important;flex-wrap:wrap!important;gap:8px!important;align-items:center!important;grid-template-columns:none!important;background:transparent!important;border:0!important;padding:0!important;box-shadow:none!important}
:root[data-tu] body #menu #libraryModePanel .library-actions details{width:auto!important;position:relative!important}
:root[data-tu] body #menu #libraryModePanel .library-actions .fu-more>summary{border:1px solid var(--tu-line)!important;background:transparent!important;color:var(--tu-on)!important;list-style:none!important;display:flex!important;align-items:center!important}
:root[data-tu] body #menu #libraryModePanel .library-actions .exam-toolbar-menu-panel{background:var(--tu-surface)!important;border:1px solid var(--tu-line2)!important;border-radius:16px!important;box-shadow:0 10px 30px rgba(0,0,0,.18)!important;padding:6px!important;z-index:40!important}
:root[data-tu] body #menu #libraryModePanel .library-actions .exam-toolbar-menu-panel button{width:100%!important;justify-content:flex-start!important;text-align:left!important;border:0!important;border-radius:10px!important;height:38px!important;background:transparent!important;color:var(--tu-on)!important}
:root[data-tu] body #menu #libraryModePanel .library-actions .exam-toolbar-menu-panel button:hover{background:var(--tu-s2)!important}
:root[data-tu] body #menu #libraryModePanel .library-actions #loadNewFormBtn{background:var(--tu-p)!important;color:var(--tu-onp)!important;border:0!important}
:root[data-tu] body #menu #libraryModePanel #formUpdatesPanel:not([hidden]){flex:1 0 100%;border-radius:16px!important;background:var(--tu-surface)!important;border:1px solid var(--tu-line2)!important;color:var(--tu-on)!important}
#tuFind{grid-area:find!important;display:flex;flex-wrap:nowrap;align-items:center;justify-content:flex-end;gap:8px;min-width:0}
#tuFind .tu-search{display:flex;align-items:center;gap:8px;height:40px;padding:0 14px;flex:1 1 150px;width:auto;max-width:260px;min-width:0;border-radius:999px;background:var(--tu-s2);color:var(--tu-on3)}
#tuFind select{flex:0 1 auto;min-width:0;max-width:170px}
:root[data-tu] body #menu #tuFind .tu-search input{-webkit-appearance:none!important;appearance:none!important;border:0!important;background:transparent!important;outline:none!important;flex:1;min-width:0;font-size:14px!important;color:var(--tu-on)!important;padding:0!important;box-shadow:none!important;height:auto!important}
:root[data-tu] body #menu #tuFind select{height:40px;border-radius:999px!important;border:0!important;background:var(--tu-s2)!important;color:var(--tu-on2)!important;padding:0 12px!important;font-weight:700!important;font-size:13px!important}
.tu-seg{display:flex;height:40px;border-radius:999px;overflow:hidden;background:var(--tu-s2)}
.tu-seg button{border:0;background:transparent;color:var(--tu-on2);display:flex;align-items:center;justify-content:center;gap:6px;padding:0 14px;min-width:44px;font-weight:700;font-size:13.5px;cursor:pointer}
.tu-seg button[aria-pressed="true"],.tu-seg button[aria-checked="true"]{background:var(--tu-pc);color:var(--tu-onpc)}
:root[data-tu] body #menu #libraryModePanel #libraryOverallMainV195B{grid-area:overall!important;display:flex!important;flex-direction:column!important;gap:12px!important;padding:18px 20px!important;margin:0!important;height:auto!important;min-height:0!important;background:var(--tu-surface)!important;border:1px solid var(--tu-line2)!important;border-radius:24px!important;box-shadow:var(--tu-shadow)!important;color:var(--tu-on)!important;overflow:hidden!important}
:root[data-tu] body #menu #libraryModePanel #libraryOverallMainV195B::before,:root[data-tu] body #menu #libraryModePanel #libraryOverallMainV195B::after{display:none!important}
:root[data-tu] body #menu #libraryModePanel .library-overall-copy-v201{display:flex!important;align-items:baseline!important;justify-content:space-between!important;gap:8px!important;text-align:left!important}
:root[data-tu] body #menu #libraryModePanel .library-overall-copy-v201 h2{margin:0!important;font-size:16px!important;font-weight:800!important;letter-spacing:0!important;text-transform:none!important;color:var(--tu-on)!important}
:root[data-tu] body #menu #libraryModePanel .library-question-count-v201{font-size:13px!important;font-weight:800!important;color:var(--tu-on)!important;margin:0!important}
:root[data-tu] body #menu #libraryModePanel .library-question-count-v201 span{margin-left:5px!important;font-weight:600!important;color:var(--tu-on3)!important;text-transform:none!important;letter-spacing:0!important;font-size:12.5px!important}
:root[data-tu] body #menu #libraryModePanel .library-ring-pair-v201{display:flex!important;justify-content:space-around!important;gap:16px!important;margin:0!important}
:root[data-tu] body #menu #libraryModePanel .library-main-ring-v201{width:112px!important;height:112px!important;border-radius:50%!important;background:conic-gradient(var(--tu-ring-c) calc(var(--p,0)*1%),var(--tu-s2) 0)!important;display:flex!important;align-items:center!important;justify-content:center!important;box-shadow:none!important;border:0!important;padding:0!important;--tu-ring-c:var(--tu-p)}
:root[data-tu] body #menu #libraryModePanel .library-main-ring-v201.score{--tu-ring-c:var(--tu-ok)}
:root[data-tu] body #menu #libraryModePanel .library-main-ring-v201::before,:root[data-tu] body #menu #libraryModePanel .library-main-ring-v201::after{display:none!important}
:root[data-tu] body #menu #libraryModePanel .library-ring-inner-v201{width:88px!important;height:88px!important;border-radius:50%!important;background:var(--tu-surface)!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;box-shadow:none!important;border:0!important;inset:auto!important;position:static!important}
:root[data-tu] body #menu #libraryModePanel .library-ring-inner-v201 b{font-size:24px!important;font-weight:800!important;color:var(--tu-on)!important;line-height:1.05!important}
:root[data-tu] body #menu #libraryModePanel .library-ring-inner-v201 span{font-size:10.5px!important;font-weight:700!important;letter-spacing:.04em!important;text-transform:uppercase!important;color:var(--tu-on3)!important}
:root[data-tu] body #menu #libraryModePanel .library-overall-statsline-v201{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important;margin:auto 0 0!important}
:root[data-tu] body #menu #libraryModePanel .library-overall-pill-v201{background:var(--tu-s1)!important;border:0!important;border-radius:14px!important;padding:9px 12px!important;color:var(--tu-on2)!important;font-size:12.5px!important;font-weight:700!important;text-align:left!important;box-shadow:none!important}
:root[data-tu] body #menu #libraryModePanel .workflow-card-v201>div:not(.library-actions),:root[data-tu] body #menu #libraryModePanel .workflow-recent-pane-v217{grid-area:recent!important;display:flex!important;flex-direction:column!important;gap:2px!important;padding:16px 18px!important;margin:0!important;min-width:0!important;background:var(--tu-surface)!important;border:1px solid var(--tu-line2)!important;border-radius:24px!important;box-shadow:var(--tu-shadow)!important;color:var(--tu-on)!important}
:root[data-tu] body #menu #libraryModePanel .workflow-card-v201 .panel-kicker{display:none!important}
:root[data-tu] body #menu #libraryModePanel .workflow-card-v201 h2::before{content:"Recently completed";font-size:16px}
:root[data-tu] body #menu #libraryModePanel .workflow-card-v201 h2{margin:0 0 6px!important;font-size:0!important;font-weight:800!important;color:var(--tu-on)!important;background:none!important;-webkit-text-fill-color:currentColor!important}
:root[data-tu] body #menu #libraryModePanel .recent-completed-v201{overflow:visible!important;max-height:none!important;padding:0!important;margin:0!important;background:transparent!important;border:0!important}
:root[data-tu] body #menu #libraryModePanel .recent-completed-list-v201{display:flex!important;flex-direction:column!important;gap:2px!important;overflow:visible!important;flex-wrap:nowrap!important;grid-template-columns:none!important}
:root[data-tu] body #menu #libraryModePanel .recent-completed-item-v201{display:flex!important;align-items:center!important;gap:12px!important;min-height:42px!important;padding:6px 10px!important;margin:0!important;border-radius:12px!important;border:0!important;background:transparent!important;box-shadow:none!important;width:auto!important;min-width:0!important;max-width:none!important;flex:none!important;color:var(--tu-on)!important}
:root[data-tu] body #menu #libraryModePanel .recent-completed-item-v201[data-tu-open]{cursor:pointer}
:root[data-tu] body #menu #libraryModePanel .recent-completed-item-v201[data-tu-open]:hover{background:var(--tu-s1)!important}
:root[data-tu] body #menu #libraryModePanel .recent-completed-item-v201::before{content:"";width:9px;height:9px;border-radius:50%;background:var(--tu-ok);flex:none}
:root[data-tu] body #menu #libraryModePanel .recent-completed-item-v201 b{flex:1!important;min-width:0!important;font-weight:700!important;font-size:14px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;color:var(--tu-on)!important}
:root[data-tu] body #menu #libraryModePanel .recent-completed-item-v201 span{font-size:12.5px!important;color:var(--tu-on3)!important;white-space:nowrap!important;margin:0!important}
:root[data-tu] body #menu #libraryModePanel .recent-completed-item-v201 .tu-recent-score{font-style:normal;width:46px;text-align:right;font-weight:800;font-size:14.5px;color:var(--tu-on)!important}
:root[data-tu] body #menu #libraryModePanel .recent-empty-v201{color:var(--tu-on3)!important;font-size:13.5px!important;background:transparent!important;border:0!important;padding:8px 0!important}
#tuCatsHead{grid-area:cathead!important;display:flex;align-items:center;justify-content:space-between;gap:12px;margin:4px 0 -6px}
#tuCatsHead h2,#tuFormsHead h2{margin:0!important;font-size:16px!important;font-weight:800!important}
.tu-link{border:0;background:transparent;color:var(--tu-p);font-weight:700;font-size:13px;cursor:pointer;padding:6px 4px}
:root[data-tu] body #menu #libraryModePanel #libraryFilters .library-tab-strip{grid-column:1/-1!important;width:auto!important;max-width:none!important}
:root[data-tu] body #menu #libraryModePanel #libraryFilters .library-tabs-toggle{grid-column:1/-1!important;justify-self:center!important;height:34px!important;padding:0 14px!important;border-radius:999px!important;border:1px solid var(--tu-line)!important;background:var(--tu-surface)!important;color:var(--tu-on2)!important;font-weight:700!important;font-size:12.5px!important;box-shadow:none!important;width:auto!important;margin:0!important}
:root[data-tu] body #menu #libraryModePanel #libraryFilters{grid-area:cats!important;display:grid!important;grid-template-columns:repeat(auto-fill,minmax(150px,1fr))!important;gap:8px!important;margin:0!important;padding:0!important;background:transparent!important;border:0!important;box-shadow:none!important;overflow:visible!important;flex-wrap:nowrap!important}
:root[data-tu] body #menu #libraryModePanel #libraryFilters .library-tab-strip{grid-column:1/-1!important;grid-row:auto!important;width:auto!important;display:grid!important;grid-template-columns:repeat(auto-fill,minmax(150px,1fr))!important;gap:8px!important;margin:0!important;padding:0!important;background:transparent!important;border:0!important}
:root[data-tu] body #menu #libraryModePanel #libraryFilters .library-tab-strip:not(.expanded){max-height:160px!important;overflow:hidden!important}
:root[data-tu] body #menu #libraryModePanel #libraryFilters .library-tab-strip .filter-pill{width:auto!important;min-width:0!important;max-width:none!important;flex:none!important;min-height:0!important}
:root[data-tu] body #menu #libraryModePanel #libraryFilters .filter-pill{display:flex!important;flex-direction:column!important;align-items:stretch!important;justify-content:flex-start!important;gap:6px!important;min-height:0!important;height:76px!important;overflow:hidden!important;width:auto!important;min-width:0!important;padding:9px 12px!important;margin:0!important;border-radius:14px!important;border:1.5px solid var(--tu-line2)!important;background:var(--tu-surface)!important;color:var(--tu-on)!important;box-shadow:none!important;text-align:left!important;transform:none!important}
:root[data-tu] body #menu #libraryModePanel #libraryFilters .filter-pill:hover{border-color:var(--tu-line)!important}
:root[data-tu] body #menu #libraryModePanel #libraryFilters .filter-pill.active{background:var(--tu-pc)!important;border-color:var(--tu-p)!important;color:var(--tu-onpc)!important}
:root[data-tu] body #menu #libraryModePanel #libraryFilters .filter-pill *{color:inherit!important;text-shadow:none!important}
:root[data-tu] body #menu #libraryModePanel #libraryFilters .v214-tab-body{display:flex!important;flex-direction:column!important;gap:5px!important;width:100%!important}
:root[data-tu] body #menu #libraryModePanel #libraryFilters .filter-title{display:flex!important;align-items:center!important;gap:7px!important;font-weight:800!important;font-size:14px!important;margin:0!important}
:root[data-tu] body #menu #libraryModePanel #libraryFilters .tab-sphere-v201{width:9px!important;height:9px!important;min-width:9px!important;flex:0 0 9px!important;border-radius:50%!important;box-shadow:none!important;border:0!important;transform:none!important}
:root[data-tu] body #menu #libraryModePanel #libraryFilters .v214-meters{display:flex!important;flex-direction:column!important;gap:3px!important;width:100%!important;margin:0!important}
:root[data-tu] body #menu #libraryModePanel #libraryFilters .v214-meter{min-height:0!important;height:auto!important;padding:0!important;display:grid!important;grid-template-columns:64px 1fr!important;align-items:center!important;gap:6px!important;margin:0!important}
:root[data-tu] body #menu #libraryModePanel #libraryFilters .v214-meter-name{font-size:10.5px!important;font-weight:700!important;letter-spacing:.03em!important;text-transform:uppercase!important;opacity:.75!important;text-align:left!important;margin:0!important}
:root[data-tu] body #menu #libraryModePanel #libraryFilters .v214-meter-row{display:flex!important;align-items:center!important;gap:6px!important;margin:0!important}
:root[data-tu] body #menu #libraryModePanel #libraryFilters .v214-meter-row b{font-size:11.5px!important;font-weight:800!important;min-width:30px!important;text-align:right!important;order:2!important}
:root[data-tu] body #menu #libraryModePanel #libraryFilters .v214-track{flex:1!important;height:4px!important;border-radius:99px!important;background:var(--tu-s3)!important;overflow:hidden!important;box-shadow:none!important;border:0!important;margin:0!important}
:root[data-tu] body #menu #libraryModePanel #libraryFilters .v214-fill{border-radius:99px!important;box-shadow:none!important}
:root[data-tu] body #menu #libraryModePanel #libraryFilters .v214-fill.score{background:var(--tu-ok)!important}
:root[data-tu] body #menu #libraryModePanel #libraryFilters .v214-fill.completed{background:var(--tu-p)!important}
:root[data-tu] body #menu #libraryModePanel #libraryFilters .filter-pill.active .v214-fill.completed{background:var(--tu-onpc)!important}
#tuResume{grid-area:resume!important;background:var(--tu-surface);border:1px solid var(--tu-line2);border-radius:22px;box-shadow:var(--tu-shadow);overflow:hidden}
#tuResume[hidden]{display:none!important}
.tu-resume-row{display:flex;flex-wrap:wrap;align-items:center;gap:14px;padding:12px 14px 12px 16px}
.tu-resume-row+.tu-resume-row{border-top:1px solid var(--tu-line2);padding-left:70px}
.tu-resume-ico{width:40px;height:40px;border-radius:50%;background:var(--tu-pc);color:var(--tu-onpc);display:flex;align-items:center;justify-content:center;flex:none}
.tu-resume-text{flex:1 1 240px;min-width:0;display:flex;flex-direction:column;gap:2px}
.tu-resume-text b{font-weight:800;font-size:15px;color:var(--tu-on)}
.tu-resume-text span{font-size:13px;color:var(--tu-on3)}
.tu-resume-bar{width:120px;height:5px;border-radius:99px;background:var(--tu-s2);overflow:hidden}.tu-resume-bar i{display:block;height:100%;background:var(--tu-p);border-radius:99px}
.tu-btn{height:40px;padding:0 20px;border-radius:999px;border:0;background:var(--tu-p);color:var(--tu-onp);font-weight:800;font-size:14px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.tu-btn.tonal{background:var(--tu-pc);color:var(--tu-onpc)}
.tu-btn.outline{background:transparent;color:var(--tu-on);border:1px solid var(--tu-line);font-weight:700}
.tu-btn.text{background:transparent;color:var(--tu-p);padding:0 12px;font-weight:700}
.tu-btn.small{height:36px;padding:0 16px;font-size:13.5px}
.tu-btn:disabled{opacity:.45;cursor:not-allowed}
#tuStatusBar{grid-area:status!important;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px}
#tuStatusBar .tu-seg{background:var(--tu-surface);border:1px solid var(--tu-line)}
#tuStatusBar .tu-seg button{border-right:1px solid var(--tu-line)}#tuStatusBar .tu-seg button:last-child{border-right:0}
#tuStatusBar .tu-seg button span{font-weight:600;opacity:.75}
#tuStatusBar .tu-shown{font-size:13.5px;color:var(--tu-on3)}
:root[data-tu] body #menu #libraryModePanel #libraryGrid{grid-area:grid!important;display:grid!important;grid-template-columns:repeat(auto-fill,minmax(290px,1fr))!important;gap:16px!important;margin:0!important;padding:0!important}
:root[data-tu] body #menu #libraryModePanel #libraryGrid .tu-hide{display:none!important}
:root[data-tu] body #menu #libraryModePanel #libraryGrid .tu-empty{grid-column:1/-1;padding:36px;text-align:center;color:var(--tu-on3);background:var(--tu-surface);border:1px dashed var(--tu-line);border-radius:24px}
:root[data-tu] body #menu #libraryGrid :is(.v75-card,.v75-card *){font-family:var(--tu-font)!important}
:root[data-tu] body #menu #libraryGrid .v75-card{display:flex!important;flex-direction:column!important;gap:12px!important;padding:18px!important;margin:0!important;background:var(--tu-surface)!important;border:1px solid var(--tu-line2)!important;border-radius:24px!important;box-shadow:var(--tu-shadow)!important;color:var(--tu-on)!important;overflow:visible!important;min-height:0!important;transform:none!important}
:root[data-tu] body #menu #libraryGrid .v75-card::before,:root[data-tu] body #menu #libraryGrid .v75-card::after{display:none!important}
:root[data-tu] body #menu #libraryGrid .v75-card.suspended-card{border-color:var(--tu-warn)!important}
:root[data-tu] body #menu #libraryGrid .v75-head{display:flex!important;flex-direction:column-reverse!important;gap:8px!important;margin:0!important;padding:0!important}
:root[data-tu] body #menu #libraryGrid .v75-head-right{align-self:stretch!important;min-width:0!important;max-width:none!important;flex:none!important;width:auto!important;margin:0!important;padding:0!important;position:static!important;transform:none!important}
:root[data-tu] body #menu #libraryGrid .v75-badge-row{width:100%!important;min-width:0!important;max-width:none!important;display:flex!important;flex-direction:row-reverse!important;justify-content:space-between!important;align-items:center!important;gap:8px!important;flex-wrap:nowrap!important;margin:0!important}
:root[data-tu] body #menu #libraryGrid .v201-tab-identity{margin:0!important;position:static!important;transform:none!important;display:inline-flex!important;align-items:center!important;gap:7px!important;font-size:12.5px!important;font-weight:700!important;letter-spacing:.02em!important;color:var(--tu-on3)!important;background:transparent!important;border:0!important;padding:0!important;box-shadow:none!important;text-transform:uppercase!important}
:root[data-tu] body #menu #libraryGrid .v201-tab-identity i{position:static!important;margin:0!important;transform:none!important;width:9px!important;height:9px!important;border-radius:50%!important;box-shadow:none!important;border:0!important}
:root[data-tu] body #menu #libraryGrid .v75-badge{font-size:12px!important;font-weight:800!important;padding:4px 10px!important;border-radius:999px!important;background:var(--tu-s2)!important;color:var(--tu-on2)!important;border:0!important;box-shadow:none!important;text-transform:none!important;letter-spacing:0!important}
:root[data-tu] body #menu #libraryGrid .v75-badge.done{background:var(--tu-okc)!important;color:var(--tu-ok)!important}
:root[data-tu] body #menu #libraryGrid .v75-badge.partial{background:var(--tu-pc)!important;color:var(--tu-onpc)!important}
:root[data-tu] body #menu #libraryGrid .v75-badge.suspended{background:var(--tu-warnc)!important;color:var(--tu-warn)!important}
:root[data-tu] body #menu #libraryGrid :is(.v75-three-chip,.v75-chip){font-size:12px!important;font-weight:800!important;padding:3px 9px!important;border-radius:8px!important;border:1px solid var(--tu-line)!important;background:transparent!important;color:var(--tu-on2)!important;box-shadow:none!important}
:root[data-tu] body #menu #libraryGrid .v75-three-chip *{color:inherit!important}
:root[data-tu] body #menu #libraryGrid .v75-title{display:flex!important;align-items:center!important;gap:6px!important;font-size:18px!important;font-weight:800!important;letter-spacing:-.01em!important;color:var(--tu-on)!important;line-height:1.25!important}
:root[data-tu] body #menu #libraryGrid .v75-title .rename-btn{width:28px!important;height:28px!important;min-width:0!important;padding:0!important;border-radius:50%!important;border:0!important;background:transparent!important;color:var(--tu-on3)!important;box-shadow:none!important;opacity:.0;transition:opacity .15s}
:root[data-tu] body #menu #libraryGrid .v75-card:is(:hover,:focus-within) .v75-title .rename-btn{opacity:1}
@media (hover:none){:root[data-tu] body #menu #libraryGrid .v75-title .rename-btn{opacity:.7}}
:root[data-tu] body #menu #libraryGrid :is(.v75-sub,.v9-card-note){font-size:13px!important;color:var(--tu-on3)!important;margin:2px 0 0!important;font-weight:500!important}
:root[data-tu] body #menu #libraryGrid .v75-score-row{display:flex!important;align-items:center!important;gap:14px!important;margin:0!important}
:root[data-tu] body #menu #libraryGrid .v75-bigmetric{width:58px!important;height:58px!important;min-width:58px!important;border-radius:50%!important;padding:0!important;border:0!important;box-shadow:none!important;background:conic-gradient(var(--tu-card-ring,var(--tu-p)) calc(var(--tu-score,0)*1%),var(--tu-s2) 0)!important;display:flex!important;align-items:center!important;justify-content:center!important;position:relative!important;color:var(--tu-on)!important}
:root[data-tu] body #menu #libraryGrid .completed-card .v75-bigmetric{--tu-card-ring:var(--tu-ok)}
:root[data-tu] body #menu #libraryGrid .v75-bigmetric::before{content:"";position:absolute;inset:6px;border-radius:50%;background:var(--tu-surface)}
:root[data-tu] body #menu #libraryGrid .v75-bigmetric b{position:relative!important;font-size:14px!important;font-weight:800!important;color:var(--tu-on)!important}
:root[data-tu] body #menu #libraryGrid .v75-bigmetric span{display:none!important}
:root[data-tu] body #menu #libraryGrid .v75-mini-metrics{flex:1!important;display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important;margin:0!important}
:root[data-tu] body #menu #libraryGrid :is(.v75-mini,.v75-mini *){overflow:visible!important;text-indent:0!important;clip-path:none!important;-webkit-mask:none!important;mask:none!important;transform:none!important}
:root[data-tu] body #menu #libraryGrid .v75-mini{display:flex!important;flex-direction:column!important;align-items:flex-start!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important;min-height:0!important}
:root[data-tu] body #menu #libraryGrid .v75-mini b{font-size:15px!important;font-weight:800!important;color:var(--tu-on)!important}
:root[data-tu] body #menu #libraryGrid .v75-mini span{font-size:11.5px!important;font-weight:600!important;color:var(--tu-on3)!important;text-transform:none!important;letter-spacing:0!important}
:root[data-tu] body #menu #libraryGrid .v75-progress{height:5px!important;border-radius:99px!important;background:var(--tu-s2)!important;overflow:hidden!important;margin:0!important;box-shadow:none!important;border:0!important}
:root[data-tu] body #menu #libraryGrid .v75-progress>div{background:var(--tu-p)!important;border-radius:99px!important;height:100%!important}
:root[data-tu] body #menu #libraryGrid .completed-card .v75-progress>div{background:var(--tu-ok)!important}
:root[data-tu] body #menu #libraryGrid .v75-chiprow{display:flex!important;flex-wrap:wrap!important;gap:6px!important;margin:0!important}
:root[data-tu] body #menu #libraryGrid .v75-chip.green{border-color:transparent!important;background:var(--tu-okc)!important;color:var(--tu-ok)!important}
:root[data-tu] body #menu #libraryGrid :is(.v75-resume-chip,.v75-chip.amber,.v75-chip.orange){border-color:transparent!important;background:var(--tu-warnc)!important;color:var(--tu-warn)!important}
:root[data-tu] body #menu #libraryGrid .v75-card-footer{display:flex!important;align-items:center!important;gap:8px!important;margin:auto 0 0!important;padding:0!important;border:0!important}
:root[data-tu] body #menu #libraryGrid .v75-primary-actions{display:flex!important;flex-wrap:wrap!important;gap:8px!important;flex:1!important;margin:0!important}
:root[data-tu] body #menu #libraryGrid .v75-primary-actions button{height:40px!important;min-height:0!important;padding:0 18px!important;border-radius:999px!important;font-size:14px!important;font-weight:700!important;box-shadow:none!important;width:auto!important;flex:none!important;margin:0!important}
:root[data-tu] body #menu #libraryGrid .v75-primary-actions button.primary{background:var(--tu-p)!important;color:var(--tu-onp)!important;border:0!important}
:root[data-tu] body #menu #libraryGrid .v75-primary-actions button.secondary{background:var(--tu-s2)!important;color:var(--tu-on)!important;border:0!important}
:root[data-tu] body #menu #libraryGrid .v75-primary-actions button:disabled{display:none!important}
:root[data-tu] body #menu #libraryGrid details.v75-menu{position:relative!important;margin:0 0 0 auto!important}
:root[data-tu] body #menu #libraryGrid details.v75-menu>summary{width:40px!important;height:40px!important;min-height:0!important;padding:0!important;border-radius:50%!important;border:0!important;background:transparent!important;color:transparent!important;font-size:0!important;display:flex!important;align-items:center!important;justify-content:center!important;list-style:none!important;box-shadow:none!important;cursor:pointer!important}
:root[data-tu] body #menu #libraryGrid details.v75-menu>summary::-webkit-details-marker{display:none}
:root[data-tu] body #menu #libraryGrid details.v75-menu>summary::before{content:"";width:20px;height:20px;background:var(--tu-on2);-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='5' r='1.9'/%3E%3Ccircle cx='12' cy='12' r='1.9'/%3E%3Ccircle cx='12' cy='19' r='1.9'/%3E%3C/svg%3E") center/contain no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='5' r='1.9'/%3E%3Ccircle cx='12' cy='12' r='1.9'/%3E%3Ccircle cx='12' cy='19' r='1.9'/%3E%3C/svg%3E") center/contain no-repeat}
:root[data-tu] body #menu #libraryGrid details.v75-menu>summary:hover,:root[data-tu] body #menu #libraryGrid details.v75-menu[open]>summary{background:var(--tu-s2)!important}
:root[data-tu] body #menu #libraryGrid .v75-menu-panel{position:absolute!important;right:0!important;bottom:46px!important;top:auto!important;left:auto!important;min-width:230px!important;padding:6px!important;background:var(--tu-surface)!important;border:1px solid var(--tu-line2)!important;border-radius:16px!important;box-shadow:0 12px 32px rgba(0,0,0,.2)!important;z-index:30!important;display:flex!important;flex-direction:column!important;gap:0!important}
:root[data-tu] body #menu #libraryGrid .v75-menu-panel button{display:flex!important;width:100%!important;height:38px!important;min-height:0!important;padding:0 12px!important;margin:0!important;border:0!important;border-radius:10px!important;background:transparent!important;color:var(--tu-on)!important;font-size:13.5px!important;font-weight:600!important;text-align:left!important;justify-content:flex-start!important;align-items:center!important;box-shadow:none!important}
:root[data-tu] body #menu #libraryGrid .v75-menu-panel button:hover{background:var(--tu-s2)!important}
:root[data-tu] body #menu #libraryGrid .v75-menu-panel button.dangerish{color:var(--tu-bad)!important}
:root[data-tu] body #menu #libraryGrid .v75-menu-panel :not(.dangerish)+button.dangerish{margin-top:7px!important;position:relative!important}
:root[data-tu] body #menu #libraryGrid .v75-menu-panel :not(.dangerish)+button.dangerish::before{content:"";position:absolute;left:8px;right:8px;top:-4px;border-top:1px solid var(--tu-line2)}
:root[data-tu] body #menu #libraryModePanel #libraryGrid.tu-list{grid-template-columns:minmax(0,1fr)!important;gap:8px!important}
:root[data-tu] body #menu #libraryModePanel #libraryGrid.tu-list .v75-card{flex-direction:row!important;flex-wrap:wrap!important;align-items:center!important;gap:10px 18px!important;padding:12px 16px!important;border-radius:18px!important}
:root[data-tu] body #menu #libraryModePanel #libraryGrid.tu-list .v75-head{flex:1 1 260px!important;min-width:0!important}
:root[data-tu] body #menu #libraryModePanel #libraryGrid.tu-list .v75-score-row{flex:0 1 330px!important}
:root[data-tu] body #menu #libraryModePanel #libraryGrid.tu-list :is(.v75-progress,.v75-chiprow){display:none!important}
:root[data-tu] body #menu #libraryModePanel #libraryGrid.tu-list .v75-card-footer{margin:0!important;flex:0 0 auto!important}
:root[data-tu] body #menu #libraryModePanel #libraryGrid.tu-list .v75-primary-actions{flex:none!important}
@media (max-width:1300px) and (min-width:1001px){:root[data-tu] body #menu #libraryModePanel.active{grid-template-areas:"actions actions actions actions actions actions find find find find find find" "overall overall overall overall overall overall recent recent recent recent recent recent" "cathead cathead cathead cathead cathead cathead cathead cathead cathead cathead cathead cathead" "cats cats cats cats cats cats cats cats cats cats cats cats" "resume resume resume resume resume resume resume resume resume resume resume resume" "status status status status status status status status status status status status" "grid grid grid grid grid grid grid grid grid grid grid grid"}}
@media (max-width:1000px){:root[data-tu] body #menu #libraryModePanel.active{grid-template-columns:minmax(0,1fr);grid-template-areas:"actions" "find" "overall" "recent" "cathead" "cats" "resume" "status" "grid"}#tuFind{justify-content:flex-start}}
@media (max-width:600px){#tuFind{flex-wrap:wrap}#tuFind .tu-search{flex:1 1 100%;max-width:none}:root[data-tu] body #menu #libraryModePanel #libraryFilters{grid-template-columns:repeat(2,minmax(0,1fr))!important}}

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
      add.type = 'button'; add.id = 'tuAddForms'; add.innerHTML = icon(ICONS.plus, 22) + 'Add forms';
      add.addEventListener('click', () => { const tab = byId('libraryTab'); if(tab && !tab.classList.contains('active')) tab.click(); setTimeout(() => byId('loadNewFormBtn')?.click(), 0); });
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
  }
  function heroTitle(){
    const hero = document.querySelector('#menu .modern-hero'); if(!hero) return;
    const h1 = hero.querySelector('h1'), p = hero.querySelector('h1 + p, p');
    const active = document.querySelector('#menu aside.modern-sidebar .menu-tab.active');
    const t = (active && TITLES[active.id]) || 'Library';
    if(h1 && h1.textContent !== t) h1.textContent = t;
    if(p){
      let line = '';
      if(t === 'Library'){
        try{
          const forms = (typeof catalog !== 'undefined' && catalog && Array.isArray(catalog.forms)) ? catalog.forms : [];
          const qs = forms.reduce((n, f) => n + (Number(f.totalQuestions) || 0), 0);
          if(forms.length) line = forms.length + (forms.length === 1 ? ' form' : ' forms') + (qs ? ' · ' + qs.toLocaleString() + ' questions' : '');
        }catch(e){}
      }
      if(p.textContent !== line) p.textContent = line;
    }
  }

  /* ---------- Library home ---------- */
  const STATUSES = [['all','All'],['progress','In progress'],['done','Completed'],['new','Not started']];
  function cardStatus(card){
    const b = card.querySelector('.v75-badge');
    if(b && b.classList.contains('done')) return 'done';
    if(b && (b.classList.contains('partial') || b.classList.contains('suspended'))) return 'progress';
    if(card.classList.contains('completed-card')) return 'done';
    if(card.classList.contains('suspended-card')) return 'progress';
    return 'new';
  }
  const cardTitle = card => { const t = card.querySelector('.v75-title'); return t ? Array.from(t.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim() : (card.dataset.formId || ''); };
  const pct = text => { const m = String(text || '').match(/(\d+(?:\.\d+)?)\s*%/); return m ? Number(m[1]) : null; };
  function ensureLibraryChrome(panel){
    if(!byId('tuFind')){
      const find = document.createElement('div'); find.id = 'tuFind';
      find.innerHTML = `<label class="tu-search">${icon(ICONS.search, 18)}<span class="tu-sr">Search forms</span><input type="search" id="tuSearch" placeholder="Search forms" autocomplete="off"></label>` +
        `<label><span class="tu-sr">Sort forms</span><select id="tuSort" title="Sort forms"><option value="default">Library order</option><option value="name">Name A–Z</option><option value="score">Score: high to low</option><option value="answered">Most answered</option><option value="status">Status</option></select></label>` +
        `<div class="tu-seg" role="group" aria-label="View"><button type="button" data-tu-view="grid" aria-label="Grid view" title="Grid view">${icon(ICONS.grid, 16)}</button><button type="button" data-tu-view="list" aria-label="List view" title="List view">${icon(ICONS.list, 16)}</button></div>`;
      panel.insertBefore(find, panel.firstChild);
      find.querySelector('#tuSearch').addEventListener('input', () => scheduleLibrary());
      const sort = find.querySelector('#tuSort'); sort.value = store.get(KEYS.sort, 'default');
      sort.addEventListener('change', () => { store.set(KEYS.sort, sort.value); scheduleLibrary(); });
      find.addEventListener('click', e => { const v = e.target.closest('[data-tu-view]'); if(v){ store.set(KEYS.view, v.dataset.tuView); scheduleLibrary(); } });
    }
    if(!byId('tuCatsHead')){
      const head = document.createElement('div'); head.id = 'tuCatsHead';
      head.innerHTML = '<h2>Categories</h2><button type="button" class="tu-link" id="tuCustomizeTabs">Customize tabs</button>';
      panel.insertBefore(head, byId('libraryFilters'));
      head.querySelector('#tuCustomizeTabs').addEventListener('click', () => { window.__v195BSettingsActive = 'order'; window.__v195SettingsActive = 'order'; window.__tuSettingsAppearance = false; byId('settingsTab')?.click(); });
    }
    if(!byId('tuResume')){
      const r = document.createElement('section'); r.id = 'tuResume'; r.hidden = true; r.setAttribute('aria-label', 'Resume');
      panel.insertBefore(r, byId('libraryGrid'));
      r.addEventListener('click', e => {
        const b = e.target.closest('[data-tu-resume]'); if(b){ const card = document.querySelector(`#libraryGrid .v75-card[data-form-id="${CSS.escape(b.dataset.tuResume)}"] [data-action="resume"]`); card?.click(); return; }
        if(e.target.closest('[data-tu-resume-more]')){ r.classList.toggle('tu-open'); paintResume(true); }
      });
    }
    if(!byId('tuStatusBar')){
      const s = document.createElement('div'); s.id = 'tuStatusBar';
      s.innerHTML = '<div class="tu-seg" role="group" aria-label="Status"></div><span class="tu-shown" aria-live="polite"></span>';
      panel.insertBefore(s, byId('libraryGrid'));
      s.addEventListener('click', e => { const b = e.target.closest('[data-tu-status]'); if(b){ store.set(KEYS.status, b.dataset.tuStatus); scheduleLibrary(); } });
    }
  }
  let resumeItems = [];
  function paintResume(keep){
    const r = byId('tuResume'); if(!r) return;
    if(!resumeItems.length){ r.hidden = true; r.innerHTML = ''; return; }
    const open = r.classList.contains('tu-open');
    const row = (it, first) => `<div class="tu-resume-row">${first ? `<span class="tu-resume-ico">${icon(ICONS.play, 18)}</span>` : ''}<div class="tu-resume-text"><b>${esc(it.title)}</b><span>${esc(it.meta)}</span></div>${it.answered != null ? `<span class="tu-resume-bar" aria-hidden="true"><i style="width:${Math.max(0, Math.min(100, it.answered))}%"></i></span>` : ''}${first && resumeItems.length > 1 ? `<button type="button" class="tu-btn text" data-tu-resume-more aria-expanded="${open}">${open ? 'Hide' : (resumeItems.length - 1) + ' more in progress'}</button>` : ''}<button type="button" class="tu-btn${first ? '' : ' outline small'}" data-tu-resume="${esc(it.id)}">Resume</button></div>`;
    const html = resumeItems.slice(0, open ? resumeItems.length : 1).map((it, i) => row(it, i === 0)).join('');
    if(r.innerHTML !== html) r.innerHTML = html;
    r.hidden = false;
  }
  let libraryQueued = false, libraryObserver = null;
  function scheduleLibrary(){ if(libraryQueued) return; libraryQueued = true; requestAnimationFrame(() => { libraryQueued = false; try{ paintLibrary(); }catch(e){ console.warn('ThunderUI library paint failed', e); } }); }
  function paintLibrary(){
    const panel = byId('libraryModePanel'), grid = byId('libraryGrid'); if(!panel || !grid) return;
    ensureLibraryChrome(panel);
    const cards = Array.from(grid.querySelectorAll(':scope > .v75-card'));
    let seq = 0;
    cards.forEach(card => {
      if(!card.dataset.tuIdx) card.dataset.tuIdx = String(seq);
      seq++;
      const score = pct(card.querySelector('.v75-bigmetric b')?.textContent);
      card.style.setProperty('--tu-score', score == null ? 0 : score);
      const sum = card.querySelector('details.v75-menu > summary'); if(sum && !sum.getAttribute('aria-label')) sum.setAttribute('aria-label', 'More actions for ' + cardTitle(card));
    });
    // status filter + search
    const q = (byId('tuSearch')?.value || '').trim().toLowerCase();
    let status = store.get(KEYS.status, 'all'); if(!STATUSES.some(s => s[0] === status)) status = 'all';
    const counts = {all:0, progress:0, done:0, new:0};
    const matchQ = card => !q || (cardTitle(card) + ' ' + (card.querySelector('.v75-sub')?.textContent || '') + ' ' + (card.dataset.formId || '')).toLowerCase().includes(q);
    let shown = 0;
    cards.forEach(card => {
      const st = cardStatus(card), mq = matchQ(card);
      if(mq){ counts.all++; counts[st]++; }
      const show = mq && (status === 'all' || status === st);
      card.classList.toggle('tu-hide', !show);
      if(show) shown++;
    });
    const seg = document.querySelector('#tuStatusBar .tu-seg');
    if(seg){
      const html = STATUSES.map(([id, label]) => `<button type="button" data-tu-status="${id}" aria-pressed="${status === id}">${label} <span>${counts[id]}</span></button>`).join('');
      if(seg.innerHTML !== html) seg.innerHTML = html;
      const lab = document.querySelector('#tuStatusBar .tu-shown'), txt = cards.length ? `Showing ${shown} of ${cards.length} in this tab` : '';
      if(lab && lab.textContent !== txt) lab.textContent = txt;
    }
    let empty = grid.querySelector(':scope > .tu-empty');
    if(cards.length && !shown){ if(!empty){ empty = document.createElement('div'); empty.className = 'tu-empty'; grid.appendChild(empty); } empty.textContent = q ? 'No forms match “' + q + '”.' : 'No forms with this status in this tab.'; }
    else if(empty) empty.remove();
    // sort (moves the existing cards within the grid; they keep their nodes and listeners)
    const sort = store.get(KEYS.sort, 'default');
    const sel = byId('tuSort'); if(sel && sel.value !== sort) sel.value = sort;
    const rank = {progress:0, new:1, done:2};
    const keyed = cards.slice().sort((a, b) => {
      const ia = Number(a.dataset.tuIdx), ib = Number(b.dataset.tuIdx);
      if(sort === 'name') return cardTitle(a).localeCompare(cardTitle(b), undefined, {numeric:true}) || ia - ib;
      if(sort === 'score') return (pct(b.querySelector('.v75-bigmetric b')?.textContent) ?? -1) - (pct(a.querySelector('.v75-bigmetric b')?.textContent) ?? -1) || ia - ib;
      if(sort === 'answered') return (pct(b.querySelector('.v75-mini b')?.textContent) ?? -1) - (pct(a.querySelector('.v75-mini b')?.textContent) ?? -1) || ia - ib;
      if(sort === 'status') return rank[cardStatus(a)] - rank[cardStatus(b)] || ia - ib;
      return ia - ib;
    });
    if(keyed.some((c, i) => c !== cards[i])){ const anchor = grid.querySelector(':scope > .tu-empty'); keyed.forEach(c => grid.insertBefore(c, anchor)); }
    // view
    const view = store.get(KEYS.view, 'grid') === 'list' ? 'list' : 'grid';
    grid.classList.toggle('tu-list', view === 'list');
    document.querySelectorAll('#tuFind [data-tu-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tuView === view)));
    // resume strip, from the cards that offer Resume
    resumeItems = Array.from(document.querySelectorAll('#libraryGrid .v75-card [data-action="resume"]:not([disabled])')).map(btn => {
      const card = btn.closest('.v75-card');
      const note = card.querySelector('.v75-resume-chip')?.textContent || card.querySelector('.v9-card-note')?.textContent || '';
      const st = card.querySelector('.v75-badge')?.textContent || '';
      return {id:card.dataset.formId, title:cardTitle(card), meta:[st, note].filter(Boolean).join(' · ').replace(/\s+/g, ' ').trim(), answered:pct(card.querySelector('.v75-mini b')?.textContent)};
    }).filter(it => it.id);
    paintResume();
    // recently completed: add each form's score and open its review on click
    document.querySelectorAll('#libraryModePanel .recent-completed-item-v201').forEach(item => {
      const name = item.querySelector('b')?.getAttribute('title') || item.querySelector('b')?.textContent || '';
      const card = Array.from(document.querySelectorAll('#libraryGrid .v75-card')).find(c => c.dataset.formId === name || cardTitle(c) === name);
      if(!card) return;
      const score = card.querySelector('.v75-bigmetric b')?.textContent || '';
      let s = item.querySelector('.tu-recent-score'); if(!s){ s = document.createElement('em'); s.className = 'tu-recent-score'; item.appendChild(s); }
      if(s.textContent !== score) s.textContent = score;
      if(card.querySelector('[data-action="review"]:not([disabled])') && !item.dataset.tuOpen){
        item.dataset.tuOpen = card.dataset.formId; item.tabIndex = 0; item.setAttribute('role', 'button'); item.title = 'Review ' + name;
      }
    });
    heroTitle();
    if(libraryObserver) libraryObserver.takeRecords();
  }
  function openRecent(item){
    const id = item.dataset.tuOpen; if(!id) return;
    document.querySelector(`#libraryGrid .v75-card[data-form-id="${CSS.escape(id)}"] [data-action="review"]`)?.click();
  }
  window.addEventListener('click', e => { const item = e.target.closest && e.target.closest('#libraryModePanel .recent-completed-item-v201[data-tu-open]'); if(item){ e.preventDefault(); e.stopPropagation(); setTimeout(() => openRecent(item), 0); } }, true);
  document.addEventListener('keydown', e => { if(e.key !== 'Enter' && e.key !== ' ') return; const item = e.target.closest && e.target.closest('#libraryModePanel .recent-completed-item-v201[data-tu-open]'); if(item){ e.preventDefault(); setTimeout(() => openRecent(item), 0); } });

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
    p.dataset.tuTab = on ? 'appearance' : (window.__v195BSettingsActive || window.__v195SettingsActive || 'bulk');
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
    const menu = byId('menu'); if(menu) new MutationObserver(() => { syncDarkFlag(); heroTitle(); }).observe(menu, {attributes:true, attributeFilter:['class']});
    const sync = byId('progressSyncPanel'); if(sync) new MutationObserver(() => paintSync()).observe(sync, {childList:true});
    const status = byId('dataFolderStatus'); if(status) new MutationObserver(() => { paintSync(); heroTitle(); }).observe(status, {childList:true, characterData:true, subtree:true});
    // late modules (progress sync, form updates) add their tabs and panels after load
    let tries = 0; const late = setInterval(() => { brand(); paintSync(); watchSettings(); wrapReport(); if(byId('progressSyncPanel') && !sync && !late.__obs){ late.__obs = true; new MutationObserver(() => paintSync()).observe(byId('progressSyncPanel'), {childList:true}); } if(++tries > 20) clearInterval(late); }, 500);
  }
  window.ThunderUI = {version:1, setAccent, accent:currentAccent, accents:Object.keys(ACCENTS), refresh:() => { brand(); scheduleLibrary(); paintSync(); }};
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
