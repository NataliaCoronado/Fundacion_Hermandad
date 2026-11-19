"use strict";
const xml = (s) =>
  String(s ?? "").replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
function crc32(buf) {
  let crc = -1;
  for (const b of buf) {
    crc ^= b;
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ -1) >>> 0;
}
function zip(files) {
  let offset = 0;
  const local = [],
    central = [];
  for (const [name, value] of Object.entries(files)) {
    const n = Buffer.from(name),
      b = Buffer.from(value),
      h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0);
    h.writeUInt16LE(20, 4);
    h.writeUInt32LE(crc32(b), 14);
    h.writeUInt32LE(b.length, 18);
    h.writeUInt32LE(b.length, 22);
    h.writeUInt16LE(n.length, 26);
    local.push(h, n, b);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt32LE(crc32(b), 16);
    c.writeUInt32LE(b.length, 20);
    c.writeUInt32LE(b.length, 24);
    c.writeUInt16LE(n.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, n);
    offset += h.length + n.length + b.length;
  }
  const cd = Buffer.concat(central),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, cd, end]);
}
function excel(graficos, contexto) {
  const rows = [
    ["Instituto de Caridad Hermandad de Dolores"],
    ["Período y filtros", contexto],
  ];
  for (const g of graficos) {
    rows.push(
      [],
      [g.titulo],
      ["Categoría", "Valor"],
      ...g.filas.map((x) => [x.nombre, x.n]),
    );
  }
  const cell = (v, i, r) => {
    let col = "";
    for (let n = i + 1; n; n = Math.floor((n - 1) / 26))
      col = String.fromCharCode(65 + ((n - 1) % 26)) + col;
    return typeof v === "number"
      ? `<c r="${col}${r}"><v>${v}</v></c>`
      : `<c r="${col}${r}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
  };
  return zip({
    "[Content_Types].xml":
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    "_rels/.rels":
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    "xl/workbook.xml":
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Datos del reporte" sheetId="1" r:id="rId1"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels":
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    "xl/worksheets/sheet1.xml": `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="48" customWidth="1"/><col min="2" max="2" width="70" customWidth="1"/></cols><sheetData>${rows.map((row, r) => `<row r="${r + 1}">${row.map((v, i) => cell(v, i, r + 1)).join("")}</row>`).join("")}</sheetData></worksheet>`,
  });
}
const pdfText = (s) =>
  String(s ?? "")
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\xFF]/g, "")
    .replace(/[\\()]/g, "\\$&");
function pdf(graficos, contexto) {
  const objects = [],
    put = (s) => {
      objects.push(s);
      return objects.length;
    };
  put("");
  put("");
  const font = put(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    ),
    pages = [];
  const draw = (g, filas, parte) => {
    let stream = "";
    const text = (x, y, s, size = 11) => {
      stream += `BT /F1 ${size} Tf ${x} ${y} Td (${pdfText(s)}) Tj ET\n`;
    };
    stream += "0.06 0.23 0.29 rg\n";
    text(40, 796, "HERMANDAD DE DOLORES", 11);
    text(40, 765, g.titulo + (parte ? " (continuación)" : ""), 17);
    const contextoLineas = contexto.match(/.{1,95}(?:\s|$)|.{1,95}/g) || [
      contexto,
    ];
    contextoLineas
      .slice(0, 4)
      .forEach((linea, i) => text(40, 741 - i * 13, linea, 9));
    const max = Math.max(1, ...g.filas.map((x) => x.n));
    filas.forEach((x, i) => {
      const y = 660 - i * 31;
      text(40, y + 4, x.nombre.slice(0, 45), 9);
      stream += "0.11 0.54 0.57 rg\n";
      stream += `280 ${y} ${Math.max(0, (x.n / max) * 210)} 13 re f\n0.06 0.23 0.29 rg\n`;
      text(503, y + 3, x.n, 9);
    });
    text(
      40,
      43,
      "Datos agregados - sin identificadores de pacientes. Cada consulta se cuenta una vez.",
      8,
    );
    const content = put(
      `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}endstream`,
    );
    pages.push(
      put(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`,
      ),
    );
  };
  for (const g of graficos) {
    if (!g.filas.length)
      draw(g, [{ nombre: "Sin datos para el período", n: 0 }], false);
    else
      for (let i = 0; i < g.filas.length; i += 18)
        draw(g, g.filas.slice(i, i + 18), i > 0);
  }
  objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[1] = `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((n) => n + " 0 R").join(" ")}] >>`;
  let out = "%PDF-1.4\n",
    offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const start = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => String(n).padStart(10, "0") + " 00000 n \n")
    .join(
      "",
    )}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return Buffer.from(out, "latin1");
}
function png(svg,titulo,contexto){
 const {Resvg}=require('@resvg/resvg-js');
 const match=/viewBox="0 0 (\d+) (\d+)"/.exec(svg),ancho=Number(match?.[1]||640),alto=Number(match?.[2]||270);
 const lineas=contexto.match(/.{1,90}(?:\s|$)|.{1,90}/g)||[contexto];
 const cab=100+lineas.length*15,svgInner=svg.replace(/<svg[^>]*>/,'').replace(/<\/svg>$/,'');
 const documento=`<svg xmlns="http://www.w3.org/2000/svg" width="${ancho+60}" height="${alto+cab+30}" viewBox="0 0 ${ancho+60} ${alto+cab+30}"><rect width="100%" height="100%" fill="white"/><text x="25" y="30" font-family="sans-serif" font-size="12" fill="#5a7782">HERMANDAD DE DOLORES</text><text x="25" y="58" font-family="sans-serif" font-size="16" fill="#214754">${xml(titulo)}</text>${lineas.map((l,i)=>`<text x="25" y="${80+i*15}" font-family="sans-serif" font-size="10" fill="#5a7782">${xml(l)}</text>`).join('')}<g transform="translate(30,${cab})">${svgInner}</g></svg>`;
 return new Resvg(documento,{fitTo:{mode:'width',value:1400},font:{defaultFontFamily:'sans-serif',loadSystemFonts:true}}).render().asPng();
}
module.exports = { excel, pdf, zip, png };
