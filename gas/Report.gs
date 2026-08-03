// ============================================================
// 配布完了報告：配布日を過ぎた案件のメール下書きを自動作成する
// タイマー（毎日1回・早朝）に createCompletionReportDraft を設定
// 台帳O列「完了報告」で報告済み管理（二重報告防止）
// ============================================================

var REPORT_CONFIG = {
  DRAFT_TO: 'hashimoto@milaie.com',        // 下書きの宛先（送信は手動）
  NOTIFY_TO: 'namimatsukanta@gmail.com',   // 下書き作成の通知先
  GREETING_TO: 'ポスティングプロ　橋本様',
  REPORT_STATUS_COL: 15,          // O列：完了報告ステータス
  REPORT_STATUS_DONE: '下書き作成済み',
  LOOKBACK_DAYS: 7                // 完了日が直近N日以内の案件のみ報告対象
};

function createCompletionReportDraft() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.LEDGER_SHEET_NAME);
  if (!sheet) return;

  if (sheet.getRange(1, REPORT_CONFIG.REPORT_STATUS_COL).getValue() === '') {
    sheet.getRange(1, REPORT_CONFIG.REPORT_STATUS_COL).setValue('完了報告');
  }

  var data = sheet.getDataRange().getValues();
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  // 古すぎる案件は対象外にする（初回や実行漏れ時の大量報告を防止）
  var oldestAllowed = new Date(today.getTime());
  oldestAllowed.setDate(oldestAllowed.getDate() - REPORT_CONFIG.LOOKBACK_DAYS);

  var targets = [];
  for (var i = 1; i < data.length; i++) {
    var receivedAt = data[i][0];   // A: 受信日時
    var projectName = data[i][3];  // D: 案件名
    var deliveryDate = String(data[i][4] || '');  // E: 配布日
    var qty = data[i][6];          // G: 部数
    var reported = data[i][REPORT_CONFIG.REPORT_STATUS_COL - 1]; // O列

    if (!projectName || projectName === '未抽出') continue;
    if (reported) continue;

    var endDate = parseDeliveryEndDate(deliveryDate, receivedAt);
    if (!endDate) continue;
    if (endDate >= today) continue;         // まだ配布期間中・当日はスキップ
    if (endDate < oldestAllowed) continue;  // 古い案件はスキップ

    targets.push({
      rowIdx: i + 1,
      projectName: projectName,
      deliveryDate: deliveryDate,
      qty: qty,
      endDate: endDate,
      receivedAt: (receivedAt instanceof Date) ? receivedAt.getTime() : new Date(receivedAt).getTime()
    });
  }

  if (targets.length === 0) {
    Logger.log('本日の報告対象はありません');
    return;
  }

  // 同じ案件＋配布日の行が複数ある場合（修正メール・再処理による重複）、
  // 最新の受信メール由来の行だけを部数集計に使う
  var latestByProject = {};
  targets.forEach(function(t) {
    var key = String(t.projectName).replace(/（[^）]+）$/, '').replace(/[\s　]+/g, '') + '|' + t.deliveryDate;
    if (!latestByProject[key] || t.receivedAt > latestByProject[key]) {
      latestByProject[key] = t.receivedAt;
    }
  });
  var countTargets = targets.filter(function(t) {
    var key = String(t.projectName).replace(/（[^）]+）$/, '').replace(/[\s　]+/g, '') + '|' + t.deliveryDate;
    return t.receivedAt === latestByProject[key];
  });

  // 完了日ごと → 案件ごとに部数を合算（最新メール由来の行のみ）
  var dateOrder = [];
  var byDate = {};
  countTargets.forEach(function(t) {
    var dateKey = Utilities.formatDate(t.endDate, 'Asia/Tokyo', 'M月d日');
    if (!byDate[dateKey]) {
      byDate[dateKey] = { order: [], projects: {}, sortKey: t.endDate.getTime() };
      dateOrder.push(dateKey);
    }
    var g = byDate[dateKey];
    // 案件名の（市区名）を外し、余分な空白を正規化してまとめる
    var name = String(t.projectName).replace(/（[^）]+）$/, '').replace(/[\s　]+/g, ' ').trim();
    if (!g.projects[name]) {
      g.projects[name] = 0;
      g.order.push(name);
    }
    var q = parseInt(t.qty, 10);
    if (!isNaN(q)) g.projects[name] += q;
  });
  dateOrder.sort(function(a, b) { return byDate[a].sortKey - byDate[b].sortKey; });

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

  var stamp = REPORT_CONFIG.REPORT_STATUS_DONE + '（' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd') + '）';
  targets.forEach(function(t) {
    sheet.getRange(t.rowIdx, REPORT_CONFIG.REPORT_STATUS_COL).setValue(stamp);
  });

  sendDraftNotification(subject, draftBody, dateOrder, targets.length);

  Logger.log('完了報告の下書きを作成しました：' + targets.length + '行');
}

// ============================================================
// 一時使用：指定日より前に完了した案件を「報告済み（手動）」にする
// 過去分の一括クリア用。CUTOFF より前の完了案件が対象
// 実行後はこの関数を削除してOK
// ============================================================
function markOldRowsAsReported() {
  var CUTOFF = new Date(2026, 6, 28);   // 2026/7/28 より前に完了した案件を対象
  CUTOFF.setHours(0, 0, 0, 0);

  var sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
                .getSheetByName(CONFIG.LEDGER_SHEET_NAME);
  var data = sheet.getDataRange().getValues();
  var count = 0;

  for (var i = 1; i < data.length; i++) {
    if (data[i][REPORT_CONFIG.REPORT_STATUS_COL - 1]) continue;
    var endDate = parseDeliveryEndDate(String(data[i][4] || ''), data[i][0]);
    if (!endDate) continue;
    if (endDate >= CUTOFF) continue;

    sheet.getRange(i + 1, REPORT_CONFIG.REPORT_STATUS_COL).setValue('報告済み（手動）');
    count++;
  }
  Logger.log('過去分を報告済みにしました：' + count + '行');
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
      '宛先は ' + REPORT_CONFIG.DRAFT_TO + ' が入力済みです。',
      '内容を確認のうえ送信してください。'
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

  if (base.getMonth() + 1 === 12 && endMonth === 1) year += 1;

  var d = new Date(year, endMonth - 1, endDay);
  d.setHours(0, 0, 0, 0);
  return d;
}
