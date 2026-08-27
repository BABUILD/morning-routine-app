// ============================================================
// 設定値
// ============================================================
var CONFIG = {
  // 送信元ごとの設定：
  //   subject: 件名キーワード（'' なら件名不問）
  //   billable: false の場合、案件台帳で「除外」となり請求書に載らない
  TARGET_SENDERS: [
    { email: 'hashimoto@milaie.com', subject: '宅配依頼', billable: true },
    { email: 'oki@milaie.com',       subject: '宅配依頼', billable: true },
    { email: 'kls.posting@gmail.com', subject: '',        billable: false }
  ],
  SAVED_LABEL_NAME: '自動処理_保存済み',
  DRIVE_PARENT_FOLDER_ID: '1KYHg7ywHO__KCQyq_WHnpiNCghvZ7_iI',
  SPREADSHEET_ID: '1Yb3MSm6q793gLlCHsPtutnd-LrvY4EGoxTuhGvqtUqE',
  NOTIFY_EMAIL: 'namimatsukanta@gmail.com',
  LOG_SHEET_NAME: '処理ログ',
  LEDGER_SHEET_NAME: '案件台帳',
  SPREADSHEET_URL: 'https://docs.google.com/spreadsheets/d/1Yb3MSm6q793gLlCHsPtutnd-LrvY4EGoxTuhGvqtUqE/edit',
  MAX_EMAILS_PER_RUN: 8,
  LOOKBACK_DAYS: 3,
  LINE_CHANNEL_TOKEN: 'IJmmPEPsYCBjzsZvrfRZJTrZlCPIqA83QL/5mBNsOzFePxCPO63i1RDjC1nLXvLrpKg1Fm+XlmXr8ckBMlHBkkpBO+kdajBkjVFSMKhSdZewiv/dFFMpDs67AJVjKQqrijHUGvGV9OcuG+5GbVwwSQdB04t89/1O/w1cDnyilFU=',
  LINE_USER_ID: 'U56e0ed67aaa35a7aaf28af831431b025'
};

// ============================================================
// 通常運用：直近3日以内の未処理メールのみ対象
// タイマートリガーにはこの関数を設定する
// ============================================================
function processEmails() {
  runProcess('newer_than:' + CONFIG.LOOKBACK_DAYS + 'd');
}

// ============================================================
// 一時使用：7月分の未処理メールを再抽出（実行後は削除してOK）
// ============================================================
function reprocessJuly() {
  runProcess('after:2026/7/1');
}

// ============================================================
// 共通処理ループ
// ============================================================
function runProcess(dateFilter) {
  // 同時実行を防ぐ（トリガーの重複起動・手動実行の重なりによる二重処理対策）
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    Logger.log('他の処理が実行中のため中止しました');
    return;
  }

  try {
    runProcessInner(dateFilter);
  } finally {
    lock.releaseLock();
  }
}

function runProcessInner(dateFilter) {
  var savedLabel = getOrCreateLabel(CONFIG.SAVED_LABEL_NAME);
  var processedCount = 0;
  // 処理ログに成功記録があるメールIDは再処理しない（台帳への重複追記を防止）
  var processedIds = getProcessedMessageIds();

  for (var s = 0; s < CONFIG.TARGET_SENDERS.length; s++) {
    if (processedCount >= CONFIG.MAX_EMAILS_PER_RUN) break;
    var senderInfo = CONFIG.TARGET_SENDERS[s];
    var query = 'from:' + senderInfo.email +
                (senderInfo.subject ? ' subject:"' + senderInfo.subject + '"' : '') +
                ' -label:' + CONFIG.SAVED_LABEL_NAME +
                ' ' + dateFilter;
    var threads = GmailApp.search(query, 0, CONFIG.MAX_EMAILS_PER_RUN);

    for (var t = 0; t < threads.length; t++) {
      if (processedCount >= CONFIG.MAX_EMAILS_PER_RUN) break;
      var thread = threads[t];
      var messages = thread.getMessages();

      for (var m = 0; m < messages.length; m++) {
        if (processedCount >= CONFIG.MAX_EMAILS_PER_RUN) break;
        var message = messages[m];
        if (message.getFrom().indexOf(senderInfo.email) === -1) continue;
        if (senderInfo.subject && message.getSubject().indexOf(senderInfo.subject) === -1) continue;
        if (processedIds[message.getId()]) {
          Logger.log('処理済みのためスキップ: ' + message.getId() + ' / ' + message.getSubject());
          continue;
        }

        processSingleEmail(message, thread, savedLabel, senderInfo);
        processedIds[message.getId()] = true;
        processedCount++;
      }
    }
  }
}

// 処理ログから「成功」済みのメールIDを集める
function getProcessedMessageIds() {
  var ids = {};
  try {
    var sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
                  .getSheetByName(CONFIG.LOG_SHEET_NAME);
    if (!sheet) return ids;
    var last = sheet.getLastRow();
    if (last < 2) return ids;

    // E列＝メールID、M列＝処理ステータス
    var values = sheet.getRange(2, 5, last - 1, 9).getValues();
    values.forEach(function(r) {
      var messageId = r[0];        // E列
      var status = r[8];           // M列
      if (messageId && status === '成功') ids[messageId] = true;
    });
  } catch (e) {
    Logger.log('処理済みIDの取得に失敗: ' + e.message);
  }
  return ids;
}

// ============================================================
// 1通のメールを処理する
// ============================================================
function processSingleEmail(message, thread, savedLabel, senderInfo) {
  var logData = {
    processedAt: formatDateJST(new Date()),
    receivedAt: formatDateJST(message.getDate()),
    sender: message.getFrom(),
    subject: message.getSubject(),
    messageId: message.getId(),
    threadId: thread.getId(),
    folderUrl: '',
    htmlFileUrl: '',
    attachmentUrls: '',
    notifyResult: '',
    labelResult: '',
    archiveResult: '',
    status: '',
    errorDetail: ''
  };

  try {
    var extracted = extractEmailData(message);
    var correctionInfo = detectCorrection(message);

    var saveResult = saveEmailToDrive(message, extracted, correctionInfo);
    logData.folderUrl = saveResult.folderUrl;
    logData.htmlFileUrl = saveResult.htmlFileUrl;
    logData.attachmentUrls = saveResult.attachmentUrls.join('\n');

    saveMetadata(saveResult.folder, message, saveResult, extracted, correctionInfo);

    var notifyResult = sendCompletionEmail(message, saveResult, extracted, correctionInfo, logData);
    logData.notifyResult = notifyResult ? '成功' : '失敗';

    if (!notifyResult) {
      throw new Error('完了メール送信に失敗しました');
    }

    writeProcessLog(logData);
    writeLedger(message, saveResult, extracted, correctionInfo, senderInfo);
    sendLineNotification(message, extracted, correctionInfo, saveResult);

    savedLabel.addToThread(thread);
    thread.moveToArchive();
    logData.labelResult = '成功';
    logData.archiveResult = '成功';
    logData.status = '成功';

  } catch (e) {
    logData.status = '失敗';
    logData.errorDetail = e.message;
    writeProcessLog(logData);
    Logger.log('エラー: ' + e.message + ' | メールID: ' + logData.messageId);
  }
}

// ============================================================
// Google Driveへ保存（警告HTMLを先頭に付与）
// ============================================================
function saveEmailToDrive(message, extracted, correctionInfo) {
  var receivedDate = message.getDate();
  var year = Utilities.formatDate(receivedDate, 'Asia/Tokyo', 'yyyy');
  var yearMonth = Utilities.formatDate(receivedDate, 'Asia/Tokyo', 'yyyyMM');
  var dateStr = Utilities.formatDate(receivedDate, 'Asia/Tokyo', 'yyyyMMdd');

  var senderEmail = extractEmailAddress(message.getFrom());
  var senderShort = senderEmail.split('@')[0].replace(/[^\w\-]/g, '');
  var subjectShort = sanitizeFileName(message.getSubject()).substring(0, 20);
  var folderName = dateStr + '_' + senderShort + '_' + subjectShort + '_' + message.getId();

  var parentFolder = DriveApp.getFolderById(CONFIG.DRIVE_PARENT_FOLDER_ID);
  var yearFolder = getOrCreateSubFolder(parentFolder, year);
  var yearMonthFolder = getOrCreateSubFolder(yearFolder, yearMonth);
  var mailFolder = yearMonthFolder.createFolder(folderName);

  var warningBanner = buildWarningBanner(extracted, correctionInfo);
  var htmlContent = warningBanner + message.getBody();
  var htmlFile = mailFolder.createFile('mail.html', htmlContent, 'text/html');

  var attachmentUrls = [];
  message.getAttachments().forEach(function(att) {
    var attFile = mailFolder.createFile(att);
    attFile.setName(sanitizeFileName(att.getName()));
    attachmentUrls.push(attFile.getUrl());
  });

  return {
    folder: mailFolder,
    folderUrl: mailFolder.getUrl(),
    htmlFileUrl: htmlFile.getUrl(),
    attachmentUrls: attachmentUrls
  };
}

// ============================================================
// 未抽出・修正検知の警告バナーHTML生成
// ============================================================
function buildWarningBanner(extracted, correctionInfo) {
  var warnings = [];

  if (correctionInfo.isCorrection) {
    warnings.push(
      '<div style="background:#fff3cd;border:3px solid #ff6600;padding:14px;margin:10px 0;font-size:15px;font-family:sans-serif;">' +
      '<span style="color:#cc0000;font-weight:bold;font-size:18px;">⚠️ 修正・変更メールの可能性があります</span><br>' +
      '<span style="color:#cc0000;">理由：' + correctionInfo.reason + '</span><br>' +
      '<span style="color:#333;">元の案件と内容を照合し、請求書作成前に必ず確認してください。</span>' +
      '</div>'
    );
  }

  var unextracted = getUnextractedFields(extracted);
  if (unextracted.length > 0) {
    warnings.push(
      '<div style="background:#ffe0e0;border:3px solid #cc0000;padding:14px;margin:10px 0;font-size:15px;font-family:sans-serif;">' +
      '<span style="color:#cc0000;font-weight:bold;font-size:18px;">⚠️ 未抽出項目があります</span><br>' +
      '<span style="color:#cc0000;font-weight:bold;">未抽出：' + unextracted.join('、') + '</span><br>' +
      '<span style="color:#333;">メール本文を確認し、スプレッドシートに手動で入力してください。</span>' +
      '</div>'
    );
  }

  if (warnings.length === 0) return '';
  return '<div style="margin:0;padding:0;">' + warnings.join('') + '</div>';
}

function getUnextractedFields(extracted) {
  var unextracted = [];
  if (extracted.projectName === '未抽出') unextracted.push('案件名');
  if (extracted.deliveryDate === '未抽出') unextracted.push('配布日');
  var hasUnextractedMethod = false, hasUnextractedQty = false, hasUnextractedPrice = false;
  extracted.rows.forEach(function(row) {
    if (row.method === '未抽出') hasUnextractedMethod = true;
    if (row.quantity === '未抽出') hasUnextractedQty = true;
    if (row.unitPrice === '未抽出') hasUnextractedPrice = true;
  });
  if (hasUnextractedMethod) unextracted.push('配布方式');
  if (hasUnextractedQty) unextracted.push('部数');
  if (hasUnextractedPrice) unextracted.push('単価');
  return unextracted;
}

// ============================================================
// 修正・変更メール検知
// ============================================================
function detectCorrection(message) {
  var subject = message.getSubject().trim();
  var body = (message.getPlainBody() || stripHtmlTags(message.getBody())).substring(0, 800);

  if (/^(RE|Re|FW|Fwd|FWD)\s*:/i.test(subject)) {
    return { isCorrection: true, reason: '返信メール（RE:）のため修正・追加の可能性あり' };
  }

  if (/変更|修正|訂正|取消|キャンセル|削除|再送/.test(subject)) {
    return { isCorrection: true, reason: '件名に変更・修正ワードを含む' };
  }

  var bodyTop = body.substring(0, 300);
  if (/なくなりました|変更です|変更になりました|修正です|訂正です|取り消し|キャンセル|誤りがありました|間違いがありました/.test(bodyTop)) {
    return { isCorrection: true, reason: '本文に変更・修正を示す記述を検知' };
  }

  return { isCorrection: false, reason: '' };
}

// ============================================================
// metadata.json を保存
// ============================================================
function saveMetadata(folder, message, saveResult, extracted, correctionInfo) {
  var metadata = {
    receivedAt: formatDateJST(message.getDate()),
    savedAt: formatDateJST(new Date()),
    sender: message.getFrom(),
    to: message.getTo(),
    subject: message.getSubject(),
    messageId: message.getId(),
    threadId: message.getThread().getId(),
    htmlFileUrl: saveResult.htmlFileUrl,
    attachmentUrls: saveResult.attachmentUrls,
    projectName: extracted.projectName,
    deliveryDate: extracted.deliveryDate,
    rows: extracted.rows,
    isCorrection: correctionInfo.isCorrection,
    correctionReason: correctionInfo.reason,
    status: '処理中'
  };
  folder.createFile('metadata.json', JSON.stringify(metadata, null, 2), 'application/json');
}

// ============================================================
// メール本文から案件情報を抽出
// 全角数字・「6月12日～6月14日」形式・単価なし行・複数案件・
// 市区名プレフィックス（スペース/コロン/直結）に対応
// ============================================================
function extractEmailData(message) {
  var body = message.getPlainBody() || stripHtmlTags(message.getBody());

  var quoteCutIdx = body.search(/\nFrom:\s/);
  if (quoteCutIdx > 0) body = body.substring(0, quoteCutIdx);

  // 全角数字・記号を半角に正規化してから解析する
  body = normalizeNumbers(body);
  // 本文が1行に潰れている場合でも解析できるよう改行を補う
  body = normalizeBodyForParsing(body);

  var lines = body.split(/\r?\n/).map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0; });

  var dateRe = /(\d{1,2}\/\d{1,2})\s*[～〜\-–]\s*(\d{1,2}\/\d{1,2})/;
  var dateKanjiRe = /(\d{1,2})月(\d{1,2})日?\s*[～〜\-–]\s*(?:(\d{1,2})月)?(\d{1,2})日?/;

  // 日付ヘッダー行を全て検出（1通に複数案件対応）
  var headers = [];
  for (var i = 0; i < lines.length; i++) {
    var deliveryDate = null;
    var dm = lines[i].match(dateRe);
    if (dm) {
      deliveryDate = dm[1] + '～' + dm[2];
    } else {
      var dk = lines[i].match(dateKanjiRe);
      if (dk) {
        var endMonth = dk[3] || dk[1];
        deliveryDate = dk[1] + '/' + dk[2] + '～' + endMonth + '/' + dk[4];
      }
    }
    if (deliveryDate) {
      headers.push({
        lineIdx: i,
        deliveryDate: deliveryDate,
        projectName: parseProjectName(lines[i], dateRe, dateKanjiRe),
        headerLine: lines[i]
      });
    }
  }

  if (headers.length === 0) {
    return {
      projectName: '未抽出',
      deliveryDate: '未抽出',
      rows: [{ projectName: '未抽出', deliveryDate: '未抽出', method: '未抽出', quantity: '未抽出', unitPrice: '未抽出', amount: '未計算' }]
    };
  }

  var allRows = [];
  for (var p = 0; p < headers.length; p++) {
    var header = headers[p];
    var endIdx = p + 1 < headers.length ? headers[p + 1].lineIdx : lines.length;

    // ヘッダー行自身＋明細行の両方を解析対象にする
    var detailLines = [header.headerLine].concat(lines.slice(header.lineIdx + 1, endIdx));
    var rows = parseDetailLines(detailLines, header.projectName, header.deliveryDate);

    // 明細が取れない場合、ヘッダー行の総部数だけでも拾う
    if (rows.length === 0) {
      var totalMatch = header.headerLine.match(/(\d[\d,，]*)部/);
      rows.push({
        projectName: header.projectName,
        deliveryDate: header.deliveryDate,
        method: '未抽出',
        quantity: totalMatch ? totalMatch[1].replace(/[,，]/g, '') : '未抽出',
        unitPrice: '未抽出',
        amount: '未計算'
      });
    }
    allRows = allRows.concat(rows);
  }

  return {
    projectName: headers[0].projectName,
    deliveryDate: headers[0].deliveryDate,
    rows: allRows
  };
}

// 日付ヘッダー・市区名＋配布方式の直前に改行を入れる
// （HTMLメールで本文が1行に潰れた場合の保険。通常の本文には影響しない）
function normalizeBodyForParsing(s) {
  s = s.replace(/(\d{1,2}\/\d{1,2}\s*[～〜\-–]\s*\d{1,2}\/\d{1,2})/g, '\n$1');
  s = s.replace(/([^\n\s　:：]{2,}[都道府県市区町村])([\s　:：]*(?:集合|戸建|ローラー))/g, '\n$1$2');
  return s;
}

// ============================================================
// 診断用：抽出ロジックが最新版かどうかを確認する
// 実行してログに2案件・4明細が出れば最新版が動いている
// ============================================================
function testExtraction() {
  var sample = [
    '並松様',
    '',
    'いつもお世話になっております。',
    '宅配依頼です。',
    '',
    '7/30〜7/31　ワコーレノイエ垂水歌敷山　13500部　在庫あり',
    '垂水区　集合6600部　4円/部　戸建6900部　5円/部',
    '禁止リストがありますのでスタッフ間で共有願います。',
    '',
    '7/30〜8/2　サンクレイドル岸和田春木　6000部　在庫あり',
    '泉北郡忠岡町　集合1500部　4.2円/部',
    '貝塚市　集合4500部　4.2円/部',
    '',
    '沖'
  ].join('\n');

  var fakeMessage = {
    getPlainBody: function() { return sample; },
    getBody: function() { return sample; }
  };

  var result = extractEmailData(fakeMessage);
  Logger.log('抽出行数: ' + result.rows.length);
  result.rows.forEach(function(r, i) {
    Logger.log((i + 1) + '. ' + r.projectName + ' | ' + r.deliveryDate + ' | ' +
               r.method + ' | ' + r.quantity + '部 | ' + r.unitPrice + '円 | ' + r.amount);
  });
}

// 全角数字・小数点・スラッシュを半角へ
function normalizeNumbers(s) {
  return s.replace(/[０-９]/g, function(ch) {
    return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
  }).replace(/．/g, '.').replace(/／/g, '/');
}

function parseProjectName(line, dateRe, dateKanjiRe) {
  var rest = line.replace(dateRe, '').replace(dateKanjiRe, '').trim();
  rest = rest.replace(/[\s　]\d[\d,，]*部.*$/, '').trim();
  rest = rest.replace(/[\s　](在庫|受け渡し|受渡).*$/i, '').trim();
  var parts = rest.split(/[\s　]+/).filter(function(p) { return p.length > 0; });
  if (parts.length === 0) return '未抽出';
  var lastName = parts[parts.length - 1];
  if (parts.length >= 2 && lastName.match(/[都道府県市区町村]$/)) {
    return parts.slice(0, parts.length - 1).join('') + '（' + lastName + '）';
  }
  return parts.join('');
}

function parseDetailLines(lines, projectName, deliveryDate) {
  var rows = [];
  // 市区名プレフィックス：スペース・コロン区切りに加え、
  // 「富田林市集合16000部」のような直結パターンにも対応
  var cityRe = /^([^\s　:：]{2,}[都道府県市区町村])(?=[\s　:：]|集合|戸建|ローラー)/;
  // 単価は任意（書かれていない案件もある）
  var methodGlobalRe = /(集合|戸建|ローラー)[\s　]*(\d[\d,，]*)部(?:[^\d集戸ロ\n]*([\d.]+)円)?/g;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (!/(集合|戸建|ローラー)/.test(line)) continue;

    var cityMatch = line.match(cityRe);
    var city = cityMatch ? cityMatch[1].trim() : null;
    var rowProjectName = city
      ? projectName.replace(/（[^）]+）$/, '') + '（' + city + '）'
      : projectName;

    methodGlobalRe.lastIndex = 0;
    var match;
    while ((match = methodGlobalRe.exec(line)) !== null) {
      var qty = match[2].replace(/[,，]/g, '');
      var price = match[3] || '未抽出';
      rows.push({
        projectName: rowProjectName,
        deliveryDate: deliveryDate,
        method: match[1],
        quantity: qty,
        unitPrice: price,
        amount: price === '未抽出' ? '未計算' : calcAmt(qty, price)
      });
    }
  }
  return rows;
}

function calcAmt(quantity, unitPrice) {
  var q = parseFloat(quantity);
  var u = parseFloat(unitPrice);
  if (isNaN(q) || isNaN(u)) return '未計算';
  return String(Math.round(q * u));
}

// ============================================================
// 完了メール送信
// ============================================================
function sendCompletionEmail(message, saveResult, extracted, correctionInfo, logData) {
  try {
    var headerWarnings = [];

    if (correctionInfo.isCorrection) {
      headerWarnings.push('【⚠️ 修正・変更メールの可能性】' + correctionInfo.reason);
    }
    var unextracted = getUnextractedFields(extracted);
    if (unextracted.length > 0) {
      headerWarnings.push('【⚠️ 未抽出項目あり】' + unextracted.join('、') + ' → 手動確認が必要です');
    }

    var rowsText = extracted.rows.map(function(row, i) {
      return [
        '  【内訳' + (i + 1) + '】',
        '  ・案件名：' + row.projectName,
        '  ・配布日：' + (row.deliveryDate || extracted.deliveryDate),
        '  ・配布方式：' + row.method,
        '  ・部数：' + row.quantity,
        '  ・単価：' + row.unitPrice,
        '  ・金額：' + row.amount
      ].join('\n');
    }).join('\n\n');

    var attachmentUrlsStr = saveResult.attachmentUrls.length > 0
      ? saveResult.attachmentUrls.map(function(u, i) { return '  ' + (i + 1) + '. ' + u; }).join('\n')
      : '  （添付ファイルなし）';

    var bodyLines = [];
    if (headerWarnings.length > 0) {
      bodyLines.push('========================================');
      headerWarnings.forEach(function(w) { bodyLines.push(w); });
      bodyLines.push('========================================');
      bodyLines.push('');
    }

    bodyLines = bodyLines.concat([
      '【抽出内容】',
      '',
      rowsText,
      '',
      '【元メール情報】',
      '・送信元：' + message.getFrom(),
      '・宛先：' + message.getTo(),
      '・件名：' + message.getSubject(),
      '・受信日時：' + logData.receivedAt,
      '・メールID：' + logData.messageId,
      '・スレッドID：' + logData.threadId,
      '',
      '【保存先】',
      '・Google Drive保存フォルダURL：' + saveResult.folderUrl,
      '・メールHTMLファイルURL：' + saveResult.htmlFileUrl,
      '・添付ファイルURL一覧：',
      attachmentUrlsStr,
      '',
      '【スプレッドシート】',
      '・処理ログURL：' + CONFIG.SPREADSHEET_URL + '#gid=0',
      '・案件台帳URL：' + CONFIG.SPREADSHEET_URL,
      '',
      '【処理情報】',
      '・処理日時：' + logData.processedAt,
      '・Gmail処理：保存済みラベル付与済み / アーカイブ済み / 自動削除なし',
      '',
      '保存内容を確認し、問題なければ元Gmail側の該当メールを手動で削除してください。'
    ]);

    var subjectPrefix = correctionInfo.isCorrection ? '【⚠️要確認】' : '【保存完了】';
    MailApp.sendEmail(CONFIG.NOTIFY_EMAIL, subjectPrefix + message.getSubject(), bodyLines.join('\n'));
    return true;
  } catch (e) {
    Logger.log('完了メール送信エラー: ' + e.message);
    return false;
  }
}

// ============================================================
// LINE通知
// ============================================================
function sendLineNotification(message, extracted, correctionInfo, saveResult) {
  try {
    var prefix = correctionInfo.isCorrection ? '【⚠️要確認】' : '【宅配依頼】保存完了';

    var projectOrder = [];
    var projects = {};
    extracted.rows.forEach(function(row) {
      var key = row.projectName;
      if (!projects[key]) {
        projects[key] = {
          deliveryDate: row.deliveryDate || extracted.deliveryDate,
          methods: [],
          total: 0
        };
        projectOrder.push(key);
      }
      var qty = parseInt(row.quantity, 10) || 0;
      projects[key].methods.push(row.method + '、' + (row.quantity === '未抽出' ? '未抽出' : row.quantity + '部'));
      if (!isNaN(qty)) projects[key].total += qty;
    });

    var lines = [prefix];

    projectOrder.forEach(function(name) {
      var p = projects[name];
      lines.push('');
      lines.push('案件名：' + name);
      lines.push('配布日：' + p.deliveryDate);
      lines.push('部数：' + (p.total > 0 ? p.total + '部' : '未抽出'));
      lines.push('配布方式ごと：');
      p.methods.forEach(function(m) { lines.push('  ' + m); });
    });

    if (saveResult.attachmentUrls.length > 0) {
      lines.push('');
      lines.push('📎 添付ファイル：');
      saveResult.attachmentUrls.forEach(function(url, i) {
        lines.push((i + 1) + '. ' + url);
      });
    }

    if (correctionInfo.isCorrection) {
      lines.push('');
      lines.push('⚠️ ' + correctionInfo.reason);
    }

    UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + CONFIG.LINE_CHANNEL_TOKEN
      },
      payload: JSON.stringify({
        to: CONFIG.LINE_USER_ID,
        messages: [{ type: 'text', text: lines.join('\n') }]
      }),
      muteHttpExceptions: true
    });
  } catch (e) {
    Logger.log('LINE送信エラー: ' + e.message);
  }
}

// ============================================================
// スプレッドシートへ書き込み
// ============================================================
function writeProcessLog(logData) {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.LOG_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.LOG_SHEET_NAME);
    sheet.appendRow(['処理日時','受信日時','送信元','件名','メールID','スレッドID','保存フォルダURL','HTMLファイルURL','添付ファイルURL','完了メール送信結果','Gmailラベル付与結果','アーカイブ結果','処理ステータス','エラー内容']);
  }
  sheet.appendRow([logData.processedAt,logData.receivedAt,logData.sender,logData.subject,logData.messageId,logData.threadId,logData.folderUrl,logData.htmlFileUrl,logData.attachmentUrls,logData.notifyResult,logData.labelResult,logData.archiveResult,logData.status,logData.errorDetail]);
}

function writeLedger(message, saveResult, extracted, correctionInfo, senderInfo) {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.LEDGER_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.LEDGER_SHEET_NAME);
    sheet.appendRow(['受信日時','送信元','件名','案件名','配布日','配布方式','部数','単価','金額','元メールHTML URL','添付ファイルURL','確認ステータス','請求書反映ステータス','備考']);
  }
  var receivedAt = formatDateJST(message.getDate());
  var attachmentUrlsStr = saveResult.attachmentUrls.join(', ') || '（なし）';

  var unextracted = getUnextractedFields(extracted);
  var notes = [];
  if (correctionInfo.isCorrection) notes.push('⚠️修正メールの可能性（' + correctionInfo.reason + '）');
  if (unextracted.length > 0) notes.push('⚠️未抽出：' + unextracted.join('、'));
  var noteStr = notes.join(' / ');

  var confirmStatus = correctionInfo.isCorrection ? '⚠️要確認' : '未確認';

  // 請求対象外の取引先は「除外」で記録（請求書生成でスキップされる）
  var billable = !senderInfo || senderInfo.billable !== false;
  var billStatus = billable ? '未反映' : '除外';
  if (!billable) {
    noteStr = (noteStr ? noteStr + ' / ' : '') + '別請求（' + extractEmailAddress(message.getFrom()) + '）';
  }

  extracted.rows.forEach(function(row) {
    sheet.appendRow([
      receivedAt, message.getFrom(), message.getSubject(),
      row.projectName, row.deliveryDate || extracted.deliveryDate, row.method,
      row.quantity, row.unitPrice, row.amount,
      saveResult.htmlFileUrl, attachmentUrlsStr,
      confirmStatus, billStatus, noteStr
    ]);
  });
}

// ============================================================
// ユーティリティ
// ============================================================
function getOrCreateLabel(labelName) {
  var labels = GmailApp.getUserLabels();
  for (var i = 0; i < labels.length; i++) {
    if (labels[i].getName() === labelName) return labels[i];
  }
  return GmailApp.createLabel(labelName);
}

function getOrCreateSubFolder(parentFolder, folderName) {
  var iter = parentFolder.getFoldersByName(folderName);
  return iter.hasNext() ? iter.next() : parentFolder.createFolder(folderName);
}

function extractEmailAddress(fromStr) {
  var match = fromStr.match(/<(.+?)>/);
  return match ? match[1] : fromStr.trim();
}

function sanitizeFileName(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim();
}

function stripHtmlTags(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatDateJST(date) {
  return Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
}
