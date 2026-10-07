import { strToU8, zipSync } from "fflate";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function columnName(index: number) {
  let result = "";
  let current = index + 1;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }
  return result;
}

function inlineCell(reference: string, value: string, style = 0) {
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function numberCell(reference: string, value: number) {
  return `<c r="${reference}"><v>${value}</v></c>`;
}

function worksheet(
  rows: string[],
  columnWidths: number[],
  options: { freeze?: boolean; filter?: string } = {},
) {
  const columns = columnWidths
    .map(
      (width, index) =>
        `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`,
    )
    .join("");
  const pane = options.freeze
    ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
  const filter = options.filter ? `<autoFilter ref="${options.filter}"/>` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${pane}<cols>${columns}</cols><sheetData>${rows.join("")}</sheetData>${filter}<pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>`;
}

export function createGrowthTrackerWorkbook() {
  const trackerHeaders = [
    "Day",
    "Date",
    "Daily intention",
    "Small action",
    "Mood (1-5)",
    "Reflection",
    "Completed",
  ];
  const trackerRows = [
    `<row r="1" ht="28" customHeight="1">${trackerHeaders.map((header, index) => inlineCell(`${columnName(index)}1`, header, 1)).join("")}</row>`,
    ...Array.from({ length: 40 }, (_, index) => {
      const rowNumber = index + 2;
      return `<row r="${rowNumber}" ht="34" customHeight="1">${[
        numberCell(`A${rowNumber}`, index + 1),
        inlineCell(`B${rowNumber}`, ""),
        inlineCell(`C${rowNumber}`, ""),
        inlineCell(`D${rowNumber}`, ""),
        inlineCell(`E${rowNumber}`, ""),
        inlineCell(`F${rowNumber}`, ""),
        inlineCell(`G${rowNumber}`, ""),
      ].join("")}</row>`;
    }),
  ];
  const guideRows = [
    `<row r="1" ht="28" customHeight="1">${inlineCell("A1", "Your 40-Day Cosmic Growth Tracker", 1)}</row>`,
    `<row r="3">${inlineCell("A3", "HOW TO USE", 2)}</row>`,
    `<row r="4">${inlineCell("A4", "1. Choose one small, meaningful intention for each day.")}</row>`,
    `<row r="5">${inlineCell("A5", "2. Write the smallest action you can take to support it.")}</row>`,
    `<row r="6">${inlineCell("A6", "3. Note your mood from 1 (low) to 5 (great), then reflect.")}</row>`,
    `<row r="7">${inlineCell("A7", "4. Mark Completed when you have taken your action.")}</row>`,
    `<row r="9">${inlineCell("A9", "GENTLE REMINDER", 2)}</row>`,
    `<row r="10">${inlineCell("A10", "Progress is not perfection. Begin again whenever you need.")}</row>`,
    `<row r="12">${inlineCell("A12", "SMALL STEPS. A WHOLE NEW UNIVERSE.")}</row>`,
  ];
  const workbookXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets><sheet name="40-Day Tracker" sheetId="1" r:id="rId1"/><sheet name="Start Here" sheetId="2" r:id="rId2"/></sheets><calcPr calcId="191029"/></workbook>';
  const stylesXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFF4F0FF"/><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FF9C7BE0"/><sz val="11"/><name val="Aptos"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF211B36"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFE0D8EE"/></left><right style="thin"><color rgb="FFE0D8EE"/></right><top style="thin"><color rgb="FFE0D8EE"/></top><bottom style="thin"><color rgb="FFE0D8EE"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    ),
    "_rels/.rels": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    ),
    "xl/workbook.xml": strToU8(workbookXml),
    "xl/_rels/workbook.xml.rels": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    ),
    "xl/styles.xml": strToU8(stylesXml),
    "xl/worksheets/sheet1.xml": strToU8(
      worksheet(trackerRows, [8, 14, 30, 28, 14, 38, 13], {
        freeze: true,
        filter: "A1:G41",
      }),
    ),
    "xl/worksheets/sheet2.xml": strToU8(worksheet(guideRows, [82])),
  };

  return zipSync(files, { level: 6 });
}
