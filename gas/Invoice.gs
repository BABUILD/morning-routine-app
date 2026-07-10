// ============================================================
// 請求書生成スクリプト
// 案件台帳から対象月の行を集めて請求書スプレッドシートを作成する
// 使い方：INVOICE_CONFIG.TARGET_MONTH を設定して createMonthlyInvoice() を実行
// ============================================================

var INVOICE_CONFIG = {
  TARGET_MONTH: '2026-06',            // 請求対象月（yyyy-MM）
  COMPANY_NAME: 'P.Post　並松幹太',
  COMPANY_ADDRESS: '大阪市西区南堀江4-4-20',
  BILL_TO: '株式会社未来絵 御中',
  TAX_RATE: 0.10,
  BANK_INFO: [
    '【お振込先】',
    'PayPay銀行　店番号：005',
    '普通　5929440',
    'ピーポストナミマツカンタ'
  ],
  OUTPUT_FOLDER_ID: '13lq7apKY9vcYdzuzpoHeDT4DZRcg1du9',  // 出力先Driveフォルダ（請求書用）
  IMAGE_FOLDER_ID: '1lQiAIua9O1zaOiouGIRhxr2UauZ6Pc9b',   // ロゴ・印鑑画像の入ったフォルダ
  LOGO_NAME_KEYWORD: 'logo',
  STAMP_NAME_KEYWORD: 'stamp',
  COLOR_HEADER_BG: '#fce5cd',
  COLOR_CUMULATIVE: '#1155cc'
};

function createMonthlyInvoice() {
  var month = INVOICE_CONFIG.TARGET_MONTH;
  var parts = month.split('-');
  var year = parseInt(parts[0], 10);
  var mon = parseInt(parts[1], 10);

  var ledger = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
                 .getSheetByName(CONFIG.LEDGER_SHEET_NAME);
  var data = ledger.getDataRange().getValues();

  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var receivedAt = data[i][0];
    var projectName = data[i][3];
    var deliveryDate = data[i][4];
    var method = data[i][5];
    var qty = data[i][6];
    var price = data[i][7];
    var billStatus = data[i][12];

    if (!projectName) continue;
    if (billStatus === '除外') continue;

    var d = (receivedAt instanceof Date) ? receivedAt : new Date(receivedAt);
    if (isNaN(d.getTime())) continue;
    if (d.getFullYear() !== year || d.getMonth() + 1 !== mon) continue;

    rows.push([projectName, deliveryDate, method, qty, price]);
  }

  if (rows.length === 0) {
    Logger.log('対象月 ' + month + ' の請求対象データがありません');
    return;
  }

  var ssName = '請求書_' + year + Utilities.formatString('%02d', mon) + '_ピーポスト';
  var ss = SpreadsheetApp.create(ssName);
  var sheet = ss.getSheets()[0];
  sheet.setName('請求書');

  buildInvoiceSheet(sheet, rows, year, mon);

  var file = DriveApp.getFileById(ss.getId());
  DriveApp.getFolderById(INVOICE_CONFIG.OUTPUT_FOLDER_ID).addFile(file);
  DriveApp.getRootFolder().removeFile(file);

  Logger.log('請求書を作成しました：' + ss.getUrl());
}

function buildInvoiceSheet(sheet, rows, year, mon) {
  var lastDay = new Date(year, mon, 0).getDate();
  var C = INVOICE_CONFIG;

  sheet.getRange('B1').setValue('請　求　書').setFontSize(20).setFontWeight('bold');
  sheet.getRange('A3').setValue(C.BILL_TO).setFontSize(14).setFontWeight('bold');

  sheet.getRange('F2').setValue('請求日：' + year + '/' + mon + '/' + lastDay);
  sheet.getRange('F3').setValue('請求書番号：' + year + Utilities.formatString('%02d', mon) + '-001');
  sheet.getRange('F4').setValue(C.COMPANY_NAME);
  sheet.getRange('F5').setValue(C.COMPANY_ADDRESS);

  sheet.getRange('A5').setValue('下記の通りご請求申し上げます。');

  sheet.getRange('A6').setValue('ご請求金額').setFontSize(14).setFontWeight('bold');
  sheet.getRange('B7').setFormula('=G10')
       .setFontSize(18).setFontWeight('bold')
       .setNumberFormat('#,##0').setHorizontalAlignment('right');
  sheet.getRange('C7').setValue('円（税込）')
       .setFontSize(18).setFontWeight('bold');
  sheet.getRange('A6:C7').setBorder(true, true, true, true, false, false);

  // ---- 振込口座情報（A8〜、請求金額ボックスの下）----
  for (var b = 0; b < C.BANK_INFO.length; b++) {
    var r = sheet.getRange(8 + b, 1).setValue(C.BANK_INFO[b]);
    if (b === 0) r.setFontWeight('bold');
  }

  sheet.getRange('F8').setValue('小計').setFontWeight('bold').setBackground(C.COLOR_HEADER_BG);
  sheet.getRange('G8').setFormula('=SUM(G12:G1012)');
  sheet.getRange('F9').setValue('消費税（10%）').setFontWeight('bold').setBackground(C.COLOR_HEADER_BG);
  sheet.getRange('G9').setFormula('=G8/10');
  sheet.getRange('F10').setValue('合計').setFontWeight('bold').setBackground(C.COLOR_HEADER_BG);
  sheet.getRange('G10').setFormula('=SUM(G8:G9)').setFontWeight('bold');
  sheet.getRange('F8:G10').setBorder(true, true, true, true, true, true);
  sheet.getRange('G8:G10').setNumberFormat('#,##0');

  var headerRow = 12;
  var headers = ['No.', '案件名', '配布日', '配布方法', '数量（部）', '単価', '金額', '累計'];
  sheet.getRange(headerRow, 1, 1, headers.length).setValues([headers])
       .setFontWeight('bold').setBackground(C.COLOR_HEADER_BG);

  var detailValues = rows.map(function(r, i) {
    return [i + 1, r[0], r[1], r[2], r[3], r[4]];
  });
  sheet.getRange(headerRow + 1, 1, detailValues.length, 6).setValues(detailValues);

  var amountFormulas = rows.map(function(r, i) {
    var rowNum = headerRow + 1 + i;
    return ['=PRODUCT(E' + rowNum + ',F' + rowNum + ')'];
  });
  sheet.getRange(headerRow + 1, 7, amountFormulas.length, 1).setFormulas(amountFormulas);

  var firstDataRow = headerRow + 1;
  var cumulValues = rows.map(function(r, i) {
    if (i === 0) return ['―'];
    var rowNum = firstDataRow + i;
    return ['=SUM($G$' + firstDataRow + ':G' + rowNum + ')'];
  });
  sheet.getRange(firstDataRow, 8, cumulValues.length, 1).setValues(cumulValues);
  sheet.getRange(firstDataRow, 8, cumulValues.length, 1)
       .setFontColor(C.COLOR_CUMULATIVE).setNumberFormat('#,##0')
       .setHorizontalAlignment('right');

  try {
    var logoBlob = findImageInFolder(C.IMAGE_FOLDER_ID, C.LOGO_NAME_KEYWORD);
    if (logoBlob) sheet.insertImage(logoBlob, 8, 1).setWidth(60).setHeight(60);
  } catch (e) {
    Logger.log('ロゴ画像の挿入に失敗: ' + e.message);
  }
  try {
    var stampBlob = findImageInFolder(C.IMAGE_FOLDER_ID, C.STAMP_NAME_KEYWORD);
    if (stampBlob) sheet.insertImage(stampBlob, 5, 8).setWidth(70).setHeight(70);
  } catch (e) {
    Logger.log('印鑑画像の挿入に失敗: ' + e.message);
  }

  sheet.setColumnWidth(1, 40);
  sheet.setColumnWidth(2, 280);
  sheet.setColumnWidth(3, 100);
  sheet.setColumnWidth(4, 80);
  sheet.setColumnWidth(5, 90);
  sheet.setColumnWidth(6, 90);
  sheet.setColumnWidth(7, 100);
  sheet.setColumnWidth(8, 100);
  sheet.getRange(headerRow, 1, detailValues.length + 1, 8).setBorder(true, true, true, true, true, true);
  sheet.getRange(headerRow + 1, 5, detailValues.length, 3).setNumberFormat('#,##0.##');
  sheet.getRange(headerRow + 1, 7, detailValues.length, 1).setNumberFormat('#,##0');
}

// フォルダ内からファイル名にキーワードを含む画像を探し、
// 縮小版（幅400px）で取得して返す（insertImageの2MB/100万画素制限対策）
function findImageInFolder(folderId, keyword) {
  if (!folderId) return null;
  var files = DriveApp.getFolderById(folderId).getFiles();
  while (files.hasNext()) {
    var file = files.next();
    var name = file.getName().toLowerCase();
    var mime = file.getMimeType();
    if (mime.indexOf('image/') === 0 && name.indexOf(keyword.toLowerCase()) !== -1) {
      var url = 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w400';
      var resp = UrlFetchApp.fetch(url, {
        headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
        muteHttpExceptions: true
      });
      if (resp.getResponseCode() === 200) {
        return resp.getBlob();
      }
      return file.getBlob();
    }
  }
  Logger.log('画像が見つかりません（キーワード: ' + keyword + '）');
  return null;
}
