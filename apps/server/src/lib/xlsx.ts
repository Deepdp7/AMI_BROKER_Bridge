/**
 * A small .xlsx writer: sheets of text, numbers and formulas, a styled header row, number formats,
 * green / red for a column's sign, a frozen header, column widths, drop-down lists and a line
 * chart. Enough for the live-price workbook (the formulas are =RTD(...), which Excel computes when
 * it opens the file). Files are stored uncompressed in the zip: Excel reads that fine and it needs
 * no zip library.
 */
import zlib from 'zlib'

export type Cell = string | number | { f: string; style?: CellStyle } | null
export type CellStyle = 'text' | 'num' | 'num0' | 'pct' | 'time' | 'header' | 'bold' | 'datetime' | 'note'

export interface SheetSpec {
  name: string
  rows: Cell[][]
  /** Width of each column in characters */
  widths?: number[]
  /** Style of each column's body cells (the rows below the header) */
  columnStyles?: CellStyle[]
  /** Columns (0-based) shown green when > 0 and red when < 0 */
  signColumns?: number[]
  /** Rows above the data, kept in view (1 = the header) */
  freezeRows?: number
  /** The header row (0-based; default 0). Rows above it keep their own cell styles. */
  headerRow?: number
  /** Drop-down lists: a cell and its choices (a list "a,b,c" or a range like 'Live prices'!$A$2:$A$9) */
  lists?: Array<{ cell: string; source: string }>
  /** A line chart of one column against another, placed over a range of cells */
  chart?: { title: string; categories: string; values: string; seriesName: string; from: [number, number]; to: [number, number]; newestFirst?: boolean }
}

const STYLE_INDEX: Record<CellStyle, number> = { text: 0, header: 1, num: 2, num0: 3, pct: 4, time: 5, bold: 6, datetime: 7, note: 8 }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** 0 → A, 26 → AA */
export function columnName(i: number): string {
  let s = ''
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}

function sheetXml(spec: SheetSpec, hasDrawing: boolean): string {
  const head = spec.headerRow ?? 0
  const cols = (spec.widths || []).map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')
  const rows = spec.rows.map((row, r) => {
    const cells = row.map((cell, c) => {
      if (cell === null || cell === undefined) return ''
      const ref = `${columnName(c)}${r + 1}`
      const own = typeof cell === 'object' ? cell.style : undefined
      const style = r === head ? 'header' : own || (r > head ? spec.columnStyles?.[c] : undefined) || 'text'
      const s = ` s="${STYLE_INDEX[style]}"`
      if (typeof cell === 'number') return `<c r="${ref}"${s}><v>${cell}</v></c>`
      if (typeof cell === 'string') return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(cell)}</t></is></c>`
      return `<c r="${ref}"${s}><f>${esc(cell.f)}</f></c>`
    }).join('')
    return `<row r="${r + 1}">${cells}</row>`
  }).join('')
  const freeze = spec.freezeRows
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${spec.freezeRows}" topLeftCell="A${spec.freezeRows + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : ''
  const firstData = head + 2
  const last = Math.max(firstData, spec.rows.length)
  const cf = (spec.signColumns || []).map((c, i) => {
    const range = `${columnName(c)}${firstData}:${columnName(c)}${last}`
    const first = `${columnName(c)}${firstData}`
    return `<conditionalFormatting sqref="${range}">` +
      `<cfRule type="expression" dxfId="0" priority="${i * 2 + 1}"><formula>AND(ISNUMBER(${first}),${first}&gt;0)</formula></cfRule>` +
      `<cfRule type="expression" dxfId="1" priority="${i * 2 + 2}"><formula>AND(ISNUMBER(${first}),${first}&lt;0)</formula></cfRule>` +
      `</conditionalFormatting>`
  }).join('')
  const lists = spec.lists?.length
    ? `<dataValidations count="${spec.lists.length}">${spec.lists.map(l => {
      const formula = l.source.includes('!') ? esc(l.source) : `&quot;${esc(l.source)}&quot;`
      return `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" sqref="${l.cell}"><formula1>${formula}</formula1></dataValidation>`
    }).join('')}</dataValidations>`
    : ''
  const drawing = hasDrawing ? '<drawing r:id="rId1"/>' : ''
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${freeze}<sheetFormatPr defaultRowHeight="16"/>${cols ? `<cols>${cols}</cols>` : ''}<sheetData>${rows}</sheetData>${cf}${lists}${drawing}</worksheet>`
}

function drawingXml(chart: NonNullable<SheetSpec['chart']>): string {
  const [fc, fr] = chart.from, [tc, tr] = chart.to
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><xdr:twoCellAnchor><xdr:from><xdr:col>${fc}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${fr}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${tc}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${tr}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="${esc(chart.title)}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>`
}

function chartXml(chart: NonNullable<SheetSpec['chart']>): string {
  const orientation = chart.newestFirst ? 'maxMin' : 'minMax'
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><c:roundedCorners val="0"/><c:chart><c:title><c:tx><c:rich><a:bodyPr/><a:p><a:r><a:t>${esc(chart.title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/><c:plotArea><c:layout/><c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/><c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>${esc(chart.seriesName)}</c:v></c:tx><c:spPr><a:ln w="19050"><a:solidFill><a:srgbClr val="16A34A"/></a:solidFill></a:ln></c:spPr><c:marker><c:symbol val="none"/></c:marker><c:cat><c:numRef><c:f>${esc(chart.categories)}</c:f></c:numRef></c:cat><c:val><c:numRef><c:f>${esc(chart.values)}</c:f></c:numRef></c:val><c:smooth val="0"/></c:ser><c:marker val="1"/><c:axId val="1001"/><c:axId val="1002"/></c:lineChart><c:dateAx><c:axId val="1001"/><c:scaling><c:orientation val="${orientation}"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:numFmt formatCode="dd-mmm hh:mm" sourceLinked="0"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="low"/><c:crossAx val="1002"/><c:crosses val="autoZero"/><c:auto val="0"/><c:lblOffset val="100"/><c:baseTimeUnit val="days"/></c:dateAx><c:valAx><c:axId val="1002"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines/><c:numFmt formatCode="#,##0.00" sourceLinked="0"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="1001"/><c:crosses val="${chart.newestFirst ? 'max' : 'autoZero'}"/><c:crossBetween val="between"/></c:valAx></c:plotArea><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>`
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="4"><numFmt numFmtId="164" formatCode="#,##0.00"/><numFmt numFmtId="165" formatCode="0.00&quot;%&quot;"/><numFmt numFmtId="166" formatCode="hh:mm:ss"/><numFmt numFmtId="167" formatCode="dd-mmm-yy hh:mm"/></numFmts>
<fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><i/><sz val="10"/><color rgb="FF6B7280"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F2937"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="9">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="167" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
<dxfs count="2"><dxf><font><color rgb="FF16A34A"/></font></dxf><dxf><font><color rgb="FFDC2626"/></font></dxf></dxfs>
</styleSheet>`

function zipStore(files: Array<{ name: string; data: Buffer }>): Buffer {
  const parts: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8')
    const crc = zlib.crc32(f.data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(0, 8)
    local.writeUInt32LE(0, 10); local.writeUInt32LE(crc, 14); local.writeUInt32LE(f.data.length, 18); local.writeUInt32LE(f.data.length, 22)
    local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28)
    parts.push(local, name, f.data)
    const c = Buffer.alloc(46)
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(0, 10)
    c.writeUInt32LE(0, 12); c.writeUInt32LE(crc, 16); c.writeUInt32LE(f.data.length, 20); c.writeUInt32LE(f.data.length, 24)
    c.writeUInt16LE(name.length, 28); c.writeUInt32LE(offset, 42)
    central.push(c, name)
    offset += 30 + name.length + f.data.length
  }
  const centralBuf = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(centralBuf.length, 12); end.writeUInt32LE(offset, 16)
  return Buffer.concat([...parts, centralBuf, end])
}

/** Excel's rules for a sheet name (31 characters, none of \ / ? * [ ] :) */
export const sheetNameOf = (name: string) => name.slice(0, 31).replace(/[\\/?*[\]:]/g, ' ')

/** The .xlsx file for one or more sheets (the first is the one shown on opening) */
export function buildXlsx(input: SheetSpec | SheetSpec[]): Buffer {
  const sheets = Array.isArray(input) ? input : [input]
  const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
  const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
  const files: Array<{ name: string; data: string }> = []
  const overrides: string[] = []
  let charts = 0
  sheets.forEach((spec, i) => {
    const n = i + 1
    overrides.push(`<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
    files.push({ name: `xl/worksheets/sheet${n}.xml`, data: sheetXml(spec, !!spec.chart) })
    if (spec.chart) {
      const k = ++charts
      overrides.push(`<Override PartName="/xl/drawings/drawing${k}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`)
      overrides.push(`<Override PartName="/xl/charts/chart${k}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`)
      files.push({ name: `xl/worksheets/_rels/sheet${n}.xml.rels`, data: `${xml}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/drawing" Target="../drawings/drawing${k}.xml"/></Relationships>` })
      files.push({ name: `xl/drawings/drawing${k}.xml`, data: drawingXml(spec.chart) })
      files.push({ name: `xl/drawings/_rels/drawing${k}.xml.rels`, data: `${xml}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/chart" Target="../charts/chart${k}.xml"/></Relationships>` })
      files.push({ name: `xl/charts/chart${k}.xml`, data: chartXml(spec.chart) })
    }
  })
  const sheetEntries = sheets.map((s, i) => `<sheet name="${esc(sheetNameOf(s.name))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')
  const sheetRels = sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
  const all = [
    { name: '[Content_Types].xml', data: `${xml}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides.join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
    { name: '_rels/.rels', data: `${xml}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: 'xl/workbook.xml', data: `${xml}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${REL}"><sheets>${sheetEntries}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `${xml}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetRels}<Relationship Id="rId${sheets.length + 1}" Type="${REL}/styles" Target="styles.xml"/></Relationships>` },
    { name: 'xl/styles.xml', data: STYLES },
    ...files,
  ]
  return zipStore(all.map(f => ({ name: f.name, data: Buffer.from(f.data, 'utf8') })))
}
