"use strict";

module.exports = `
.rec{display:grid;gap:16px;max-width:1200px}
.rec-buscar{background:#fff;border:1px solid #dae6ea;border-radius:10px;padding:14px 16px;display:flex!important;flex-direction:column;align-items:stretch!important;gap:8px;max-width:560px}
.rec-buscar label{display:block;width:auto;font-size:12px;font-weight:600;color:#42616e}
.rec-buscar div{display:flex;gap:8px;align-items:center}
.rec-buscar input{flex:1;min-width:0;font-size:16px;padding:12px 14px;border-radius:8px}
.rec-buscar button,.rec-buscar .btn{flex:none;font-size:14px;padding:12px 18px;border-radius:8px}
.rec-grupo{display:grid;gap:8px}
.rec-grupo h2{margin:6px 0 0;font-size:1rem;color:#1f3d4a;display:flex;align-items:center;gap:8px}
.rec-n{display:inline-grid;place-items:center;min-width:22px;height:22px;padding:0 6px;border-radius:11px;background:#e6f3f5;color:#16606a;font-size:.8125rem;font-weight:700}
.rec-grupo[data-grupo=atendidos] .rec-fila,.rec-grupo[data-grupo=no-asistieron] .rec-fila{background:#fafcfc;border-left-color:#cfdde2;opacity:.92}
.rec-lista{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.rec-fila{display:grid;grid-template-columns:72px minmax(150px,1.2fr) minmax(140px,1fr) minmax(220px,1.3fr) max-content;gap:14px;align-items:center;background:#fff;border:1px solid #dae6ea;border-left:5px solid #cfdde2;border-radius:10px;padding:9px 14px}
.rec-fila[data-doc=faltante]{border-left-color:#e0a400}
.rec-fila[data-doc=pendiente]{border-left-color:#e0a400}
.rec-fila[data-doc=validado]{border-left-color:#2e9e6f}
.rec-fila time{font-size:18px;font-weight:700;color:#1f3d4a;font-variant-numeric:tabular-nums}
.rec-paciente strong,.rec-cita span{display:block;font-size:15px;font-weight:600;color:#1f3d4a;overflow-wrap:anywhere}
.rec-paciente small,.rec-cita small{display:block;margin-top:2px;font-size:12px;color:#5f727c}
.rec-documento{display:flex;flex-wrap:wrap;gap:6px 8px;align-items:center;justify-content:flex-start}
.rec-documento form{margin:0!important;padding:0!important;background:none!important;border:0!important;display:block!important}
.rec-doc{display:inline-block;border-radius:999px;padding:3px 10px;font-size:12.5px;font-weight:600;line-height:1.3}
.rec-doc b{display:block;font-size:14px}.rec-doc small{display:block;margin-top:2px;font-size:11px;font-weight:400}
.rec-doc-falta{background:#fff1d6;color:#7a4a00;border:1px solid #f0cf8f}
.rec-doc-nota{display:block;font-size:12px;color:#5f727c}
.rec-doc-pend{background:#fff4cc;color:#7a5a00;border:1px solid #f0d77a}
.rec-doc-ok{background:#e1f5ea;color:#1d7a50;border:1px solid #b6e2cb;font-weight:700;font-size:14px}
.rec-btn-doc{font-size:13px!important;padding:5px 11px!important;border-radius:8px!important;font-weight:600;text-decoration:none;background:#fff!important;color:#16606a!important;border:1px solid #9bc4ca!important;display:inline-block}
.rec-btn-validar{background:#e0a400!important;border-color:#e0a400!important;color:#2d2100!important}
.rec-acciones{display:flex;flex-direction:row;gap:8px;align-items:center;justify-content:flex-end;flex-wrap:nowrap}
.rec-acciones form{margin:0!important;padding:0!important;background:none!important;border:0!important;display:block!important}
.rec-btn{font-size:14px!important;font-weight:700;padding:11px 18px!important;border-radius:8px!important;min-height:44px;cursor:pointer}
.rec-btn-llegada{background:#238a5e!important;border:1px solid #238a5e!important;color:#fff!important}
.rec-btn-llegada:hover{background:#1c7450!important}
.rec-btn-no{background:#fbeaed!important;border:1px solid #f0c3c9!important;color:#a3333f!important}
.rec-btn-no:hover{background:#f6d8dd!important}
.rec-estado{font-size:13px;font-weight:700;padding:8px 14px;border-radius:8px}
.rec-estado-ok{background:#e1f5ea;color:#1d7a50}.rec-estado-mal{background:#fbeaed;color:#a3333f}
@media(max-width:1100px){.rec-fila{grid-template-columns:72px minmax(0,1fr) minmax(0,1fr);}.rec-documento{grid-column:1/-1;grid-row:2}.rec-acciones{grid-column:1/-1;justify-content:flex-start;flex-wrap:wrap}}
@media(max-width:640px){.rec-fila{grid-template-columns:1fr;gap:10px}.rec-fila time{font-size:18px}.rec-documento{grid-column:auto;grid-row:auto}.rec-acciones{grid-column:auto;flex-wrap:wrap}.rec-acciones form,.rec-acciones .rec-btn{flex:1 1 100%;width:100%}.rec-buscar{max-width:none}.rec-buscar div{flex-wrap:wrap}.rec-buscar input{flex:1 1 100%}}
`;
