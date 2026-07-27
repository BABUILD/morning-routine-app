// ============================================================
// 配布完了報告：配布日を過ぎた案件のメール下書きを自動作成する
// タイマー（毎日1回・朝推奨）に createCompletionReportDraft を設定
// 台帳O列「完了報告」で報告済み管理（二重報告防止）
// ============================================================

var REPORT_CONFIG = {
  DRAFT_TO: 'namimatsukanta@gmail.com',
  NOTIFY_TO: 'namimatsukanta@gmail.com',   // 下書き作成の通知先
  GREETING_TO: 'ポスティングプロ　橋本様',
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
  var targets = [];
  for (var i = 1; i < data.length; i++) {
    var receivedAt = data[i][0];   // A: 受信日時
    var projectName = data[i][3];  // D: 案件名
    var deliveryDate = String(data[i][4] || '');  // E: 配布日（例 7/16～7/18）
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
      qty: qty,
      endDate: endDate
    });
  }

  if (targets.length === 0) {
    Logger.log('本日の報告対象はありません');
    return;
  }

  // 完了日ごと → 案件ごとに部数を合算
  var dateOrder = [];
  var byDate = {};
  targets.forEach(function(t) {
    var dateKey = Utilities.formatDate(t.endDate, 'Asia/Tokyo', 'M月d日');
    if (!byDate[dateKey]) {
      byDate[dateKey] = { order: [], projects: {} , sortKey: t.endDate.getTime() };
      dateOrder.push(dateKey);
    }
    var g = byDate[dateKey];
    // 案件名の（市区名）は報告では外してまとめる
    var name = t.projectName.replace(/（[^）]+）$/, '');
    if (!g.projects[name]) {
      g.projects[name] = 0;
      g.order.push(name);
    }
    var q = parseInt(t.qty, 10);
    if (!isNaN(q)) g.projects[name] += q;
  });
  dateOrder.sort(function(a, b) { return byDate[a].sortKey - byDate[b].sortKey; });

  // 下書き本文（実際の報告フォーマットに準拠）
  var bodyLines = [
    REPORT_CONFIG.GREETING_TO,
    '',
    'おはようございます！！',
    '',
    '下記案件につきまして、配布指定期間内にすべて配布完了いたしましたので、ご報告いたします。',
    ''
  ];

  dateOrder.forEach(function(dateKey) {
    var g = byDate[dateKey];
    bodyLines.push('【' + dateKey + ' 配布完了】');
    bodyLines.push('');
    g.order.forEach(function(name) {
      var qty = g.projects[name];
      bodyLines.push('■' + name + '　' + (qty > 0 ? formatNumber(qty) + '部' : '部数要確認'));
      bodyLines.push('');
    });
    bodyLines.push('');
  });

  bodyLines.push('以上、ご確認のほどよろしくお願いいたします。');
  bodyLines.push('');
  bodyLines.push('P.Post並松');

  var todayStr = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'M/d');
  var subject = '【配布完了報告】' + todayStr;
  var draftBody = bodyLines.join('\n');

  GmailApp.createDraft(REPORT_CONFIG.DRAFT_TO, subject, draftBody);

  // 台帳に報告済みマーク
  var stamp = REPORT_CONFIG.REPORT_STATUS_DONE + '（' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd') + '）';
  targets.forEach(function(t) {
    sheet.getRange(t.rowIdx, REPORT_CONFIG.REPORT_STATUS_COL).setValue(stamp);
  });

  // 下書き作成の通知メール
  sendDraftNotification(subject, draftBody, dateOrder, targets.length);

  Logger.log('完了報告の下書きを作成しました：' + targets.length + '行');
}

// 下書きを作成したことを知らせる通知メール
function sendDraftNotification(draftSubject, draftBody, dateOrder, rowCount) {
  try {
    var lines = [
      '配布完了報告のメール下書きを作成しました。',
      '',
      '【下書き件名】',
      draftSubject,
      '',
      '【対象】',
      '・完了日：' + dateOrder.join('、'),
      '・台帳行数：' + rowCount + '行',
      '',
      '【下書き本文プレビュー】',
      '----------------------------------------',
      draftBody,
      '----------------------------------------',
      '',
      'Gmailの下書きを開く：',
      'https://mail.google.com/mail/u/0/#drafts',
      '',
      '内容を確認のうえ、宛先を取引先に変更して送信してください。'
    ];

    MailApp.sendEmail(
      REPORT_CONFIG.NOTIFY_TO,
      '【下書き作成完了】' + draftSubject,
      lines.join('\n')
    );
  } catch (e) {
    Logger.log('下書き通知メールの送信に失敗: ' + e.message);
  }
}

function formatNumber(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// 配布日文字列（例「7/16～7/18」）から最終日のDateを返す
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
