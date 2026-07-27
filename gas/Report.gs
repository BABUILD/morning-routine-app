// ============================================================
// 配布完了報告：配布日を過ぎた案件のメール下書きを自動作成する
// タイマー（毎日1回・朝推奨）に createCompletionReportDraft を設定
// 台帳O列「完了報告」で報告済み管理（二重報告防止）
// ============================================================

var REPORT_CONFIG = {
  DRAFT_TO: 'namimatsukanta@gmail.com',
  REPORT_STATUS_COL: 15,          // O列：完了報告ステータス
  REPORT_STATUS_DONE: '下書き作成済み'
};

function createCompletionReportDraft() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.LEDGER_SHEET_NAME);
  if (!sheet) return;

  // O列ヘッダーがなければ作成
  if (sheet.getRange(1, REPORT_CONFIG.REPORT_STATUS_COL).getValue() === '') {
    sheet.getRange(1, REPORT_CONFIG.REPORT_STATUS_COL).setValue('完了報告');
  }

  var data = sheet.getDataRange().getValues();
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  // 報告対象を収集：配布最終日が昨日以前・未報告の行
  var targets = [];   // { rowIdx, projectName, deliveryDate, method, qty, endDate }
  for (var i = 1; i < data.length; i++) {
    var receivedAt = data[i][0];   // A: 受信日時
    var projectName = data[i][3];  // D: 案件名
    var deliveryDate = String(data[i][4] || '');  // E: 配布日（例 7/16～7/18）
    var method = data[i][5];       // F: 配布方式
    var qty = data[i][6];          // G: 部数
    var reported = data[i][REPORT_CONFIG.REPORT_STATUS_COL - 1]; // O列

    if (!projectName || projectName === '未抽出') continue;
    if (reported) continue;

    var endDate = parseDeliveryEndDate(deliveryDate, receivedAt);
    if (!endDate) continue;
    if (endDate >= today) continue;  // まだ配布期間中・当日はスキップ

    targets.push({
      rowIdx: i + 1,
      projectName: projectName,
      deliveryDate: deliveryDate,
      method: method,
      qty: qty,
      endDate: endDate
    });
  }

  if (targets.length === 0) {
    Logger.log('本日の報告対象はありません');
    return;
  }

  // 案件ごとにまとめる
  var order = [];
  var projects = {};
  targets.forEach(function(t) {
    var key = t.projectName + '|' + t.deliveryDate;
    if (!projects[key]) {
      projects[key] = { projectName: t.projectName, deliveryDate: t.deliveryDate, details: [], total: 0 };
      order.push(key);
    }
    var q = parseInt(t.qty, 10);
    projects[key].details.push((t.method || '') + (t.qty && t.qty !== '未抽出' ? t.qty + '部' : ''));
    if (!isNaN(q)) projects[key].total += q;
  });

  // 下書き本文
  var bodyLines = [
    'お世話になっております。',
    'P.Post並松です。',
    '',
    '下記案件の配布が完了しましたのでご報告いたします。',
    ''
  ];
  order.forEach(function(key) {
    var p = projects[key];
    bodyLines.push('■ ' + p.projectName);
    bodyLines.push('　配布期間：' + p.deliveryDate);
    if (p.total > 0) bodyLines.push('　配布部数：' + p.total + '部（' + p.details.join('、') + '）');
    bodyLines.push('');
  });
  bodyLines.push('ご確認のほどよろしくお願いいたします。');
  bodyLines.push('');
  bodyLines.push('P.Post　並松幹太');

  var todayStr = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'M/d');
  var subject = '【配布完了報告】' + todayStr + '時点　' + order.length + '案件';

  GmailApp.createDraft(REPORT_CONFIG.DRAFT_TO, subject, bodyLines.join('\n'));

  // 台帳に報告済みマーク
  var stamp = REPORT_CONFIG.REPORT_STATUS_DONE + '（' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd') + '）';
  targets.forEach(function(t) {
    sheet.getRange(t.rowIdx, REPORT_CONFIG.REPORT_STATUS_COL).setValue(stamp);
  });

  Logger.log('完了報告の下書きを作成しました：' + order.length + '案件 / ' + targets.length + '行');
}

// 配布日文字列（例「7/16～7/18」「7/9～7/13」）から最終日のDateを返す
// 年は受信日時から推定（年末年始またぎにも対応）
function parseDeliveryEndDate(deliveryDate, receivedAt) {
  var m = String(deliveryDate).match(/(\d{1,2})\/(\d{1,2})\s*[～〜\-–]\s*(\d{1,2})\/(\d{1,2})/);
  var endMonth, endDay;
  if (m) {
    endMonth = parseInt(m[3], 10);
    endDay = parseInt(m[4], 10);
  } else {
    var s = String(deliveryDate).match(/^(\d{1,2})\/(\d{1,2})$/);
    if (!s) return null;
    endMonth = parseInt(s[1], 10);
    endDay = parseInt(s[2], 10);
  }

  var base = (receivedAt instanceof Date) ? receivedAt : new Date(receivedAt);
  if (isNaN(base.getTime())) base = new Date();
  var year = base.getFullYear();

  // 受信が12月で配布が1月なら翌年
  if (base.getMonth() + 1 === 12 && endMonth === 1) year += 1;

  var d = new Date(year, endMonth - 1, endDay);
  d.setHours(0, 0, 0, 0);
  return d;
}
