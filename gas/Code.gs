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

    writeLedger(message, saveResult, extracted, correctionInfo, senderInfo);

    // 台帳記録まで完了した時点で「成功」扱いにする
    // （これ以降の失敗で再処理させると台帳が二重になるため）
    logData.status = '成功';

    sendLineNotification(message, extracted, correctionInfo, saveResult);

    // ラベル付与・アーカイブの失敗はステータスを変えず各列に記録する
    try {
      savedLabel.addToThread(thread);
      logData.labelResult = '成功';
    } catch (e2) {
      logData.labelResult = '失敗: ' + e2.message;
    }
    try {
      thread.moveToArchive();
      logData.archiveResult = '成功';
    } catch (e3) {
      logData.archiveResult = '失敗: ' + e3.message;
    }

  } catch (e) {
    logData.status = '失敗';
    logData.errorDetail = e.message;
    Logger.log('エラー: ' + e.message + ' | メールID: ' + logData.messageId);
  }

  // 処理ログは最後に1回だけ書く（確定したステータスが必ずM列に入る）
  writeProcessLog(logData);
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

  // 部数不一致・単価異常などの整合性警告
  if (extracted.warnings && extracted.warnings.length > 0) {
    warnings.push(
      '<div style="background:#ffe0e0;border:3px solid #cc0000;padding:14px;margin:10px 0;font-size:15px;font-family:sans-serif;">' +
      '<span style="color:#cc0000;font-weight:bold;font-size:18px;">⚠️ 抽出内容に確認が必要な点があります</span><br>' +
      extracted.warnings.map(function(w) {
        return '<span style="color:#cc0000;">・' + w + '</span>';
      }).join('<br>') +
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

  if (/変更|修正|訂正|取消|キャンセル|削除|再送|追加|差し?替/.test(subject)) {
    return { isCorrection: true, reason: '件名に変更・修正・追加ワードを含む' };
  }

  // 本文冒頭（挨拶〜依頼文）に修正・差し替え・追加を示す記述があるか
  var bodyTop = body.substring(0, 500);
  if (/破棄|差し?替え|前回(送っ|お送り|送付)/.test(bodyTop)) {
    return { isCorrection: true, reason: '本文に「前回分の破棄・差し替え」の記述あり → 前回分の台帳行を削除してください' };
  }
  if (/なくなりました|変更(です|になりました|しました|しております)|修正(です|しました|しております|した)|訂正(です|しました)|取り消し|キャンセル|誤りがありました|間違いがありました/.test(bodyTop)) {
    return { isCorrection: true, reason: '本文に変更・修正を示す記述を検知' };
  }
  if (/追加の(宅配|配布|依頼)|追加依頼|追加で/.test(bodyTop)) {
    return { isCorrection: true, reason: '本文に「追加依頼」の記述あり → 既存案件との重複がないか確認してください' };
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
      rows: [{ projectName: '未抽出', deliveryDate: '未抽出', method: '未抽出', quantity: '未抽出', unitPrice: '未抽出', amount: '未計算', note: '' }],
      warnings: []
    };
  }

  var allRows = [];
  var warnings = [];   // メール全体の警告（完了メール・LINE・HTMLバナーに表示）
  for (var p = 0; p < headers.length; p++) {
    var header = headers[p];
    var endIdx = p + 1 < headers.length ? headers[p + 1].lineIdx : lines.length;
    var blockLines = lines.slice(header.lineIdx + 1, endIdx);

    // ヘッダー行自身＋明細行の両方を解析対象にする
    var detailLines = [header.headerLine].concat(blockLines);
    var rows = parseDetailLines(detailLines, header.projectName, header.deliveryDate);

    // 本文に書かれた総部数（例「13500部」）を控えておく
    var totalMatch = header.headerLine.match(/(\d[\d,，]*)部/);
    var headerTotal = totalMatch ? parseInt(totalMatch[1].replace(/[,，]/g, ''), 10) : null;

    // 明細が取れない場合、ヘッダー行の総部数だけでも拾う
    if (rows.length === 0) {
      rows.push({
        projectName: header.projectName,
        deliveryDate: header.deliveryDate,
        method: '未抽出',
        quantity: headerTotal !== null ? String(headerTotal) : '未抽出',
        unitPrice: '未抽出',
        amount: '未計算',
        note: ''
      });
    }

    // 案件ブロック全体の注記（※で始まる独立行、ヘッダー行の※部分）
    var blockNotes = collectBlockNotes(header.headerLine, blockLines);

    // 総部数と明細合計の照合（拾い漏れ・誤記の検知）
    var detailSum = 0;
    var allNumeric = true;
    rows.forEach(function(r) {
      var q = parseInt(r.quantity, 10);
      if (isNaN(q)) allNumeric = false; else detailSum += q;
    });
    var mismatchNote = '';
    if (headerTotal !== null && allNumeric && rows[0].method !== '未抽出' && detailSum !== headerTotal) {
      mismatchNote = '⚠️部数不一致（本文' + headerTotal + '部／明細合計' + detailSum + '部）';
      warnings.push(header.projectName + '：' + mismatchNote);
    }

    rows.forEach(function(r) {
      var notes = [];
      if (blockNotes) notes.push(blockNotes);
      if (r.note) notes.push(r.note);
      if (mismatchNote) notes.push(mismatchNote);

      // 単価の異常値（入力ミス・小数点抜け等）を警告
      var priceNum = parseFloat(r.unitPrice);
      if (!isNaN(priceNum) && (priceNum < 3 || priceNum > 10)) {
        var priceNote = '⚠️単価要確認（' + r.unitPrice + '円）';
        notes.push(priceNote);
        warnings.push(r.projectName + ' ' + r.method + '：' + priceNote);
      }
      r.note = notes.join(' / ');
    });

    allRows = allRows.concat(rows);
  }

  return {
    projectName: headers[0].projectName,
    deliveryDate: headers[0].deliveryDate,
    rows: allRows,
    warnings: warnings
  };
}

// ブロック内の「※」注記を集める（ヘッダー行の※以降 ＋ ※で始まる独立行）
// 明細行に付いた※は parseDetailLines 側でその行の明細に付ける
function collectBlockNotes(headerLine, blockLines) {
  var notes = splitNotes(headerLine);
  blockLines.forEach(function(l) {
    if (/^[※＊]/.test(l) && !/(集合|戸建|ローラー)[\s　]*\d/.test(l)) {
      notes = notes.concat(splitNotes(l));
    }
  });
  return notes.join(' / ');
}

// 1行に含まれる「※…」注記を個別に取り出す
// 例「※重量があるので単価上げます。※請求書に特別単価とご記入ください」→ 2件
function splitNotes(text) {
  var idx = String(text).search(/[※＊]/);
  if (idx === -1) return [];
  return String(text).substring(idx)
    .split(/(?=[※＊])/)
    .map(function(s) { return s.trim(); })
    .filter(function(s) { return s.length > 1; });
}

// 日付ヘッダー・市区名＋配布方式の直前に改行を入れる
// （HTMLメールで本文が1行に潰れた場合の保険。通常の本文には影響しない）
function normalizeBodyForParsing(s) {
  s = s.replace(/(\d{1,2}\/\d{1,2}\s*[～〜\-–]\s*\d{1,2}\/\d{1,2})/g, '\n$1');
  s = s.replace(/([^\n\s　:：]{2,}[都道府県市区町村])([\s　:：]*(?:集合|戸建|ローラー))/g, '\n$1$2');
  return s;
}

// ============================================================
// 診断用：抽出ロジックが最新版かどうかを確認する（実物メールを元にしたサンプル）
// 期待するログ：
//   ・明細6行（サンクレイドル1行・ワコーレシティ2行・ジェイグランシティ3行）
//   ・サンクレイドルの備考に※注記が3件（重量／特別単価／きっちり配布）
//   ・ジェイグランシティの3行目「戸建4500部」が（加古川市）になっている
//   ・警告なし（総部数と明細合計が全て一致）
// ============================================================
function testExtraction() {
  var sample = [
    '並松様',
    '',
    'いつもお世話になっております。',
    '',
    '8/27～8/29　サンクレイドル岸和田春木　泉大津市・忠岡町　10000部　在庫有ります',
    '集合10000部　4.5円/部',
    '※チラシの重量が有りますので少し単価上げます。※請求書に特別単価とご記入ください',
    '※非常にうるさいクライアントですのできっちり配布でお願いします。',
    '',
    '8/27～8/28　ワコーレシティ西鈴蘭台駅前　神戸市北区　10000部　在庫有ります',
    '集合4000部　4円/部',
    '戸建6000部　5円/部',
    '',
    '8/27～8/28　ジェイグランシティ西明石タワーウエスト　明石市・加古川市　9500部　在庫有ります',
    '明石市：集合1000部　5円/部',
    '加古川市：集合4000部　6円/部',
    '　　　　　戸建4500部　6円/部',
    '',
    '宜しくお願い致します。',
    '',
    'ポスティング・プロ　橋本'
  ].join('\n');

  var fakeMessage = {
    getPlainBody: function() { return sample; },
    getBody: function() { return sample; }
  };

  var result = extractEmailData(fakeMessage);
  Logger.log('抽出行数: ' + result.rows.length);
  result.rows.forEach(function(r, i) {
    Logger.log((i + 1) + '. ' + r.projectName + ' | ' + r.deliveryDate + ' | ' +
               r.method + ' | ' + r.quantity + '部 | ' + r.unitPrice + '円 | ' + r.amount +
               (r.note ? ' | 備考: ' + r.note : ''));
  });
  Logger.log('警告: ' + (result.warnings.length ? result.warnings.join(' / ') : 'なし'));
}

// ============================================================
// 診断用：修正メール検知の確認
// 期待するログ：3件とも isCorrection = true
// ============================================================
function testCorrectionDetection() {
  var cases = [
    { subject: '26.8.31～9.9　宅配依頼',
      body: '並松様\n \nいつもお世話になっております。\n中楽坊の追加の宅配依頼と前回送りました。\n豊中市の分も若干修正しましたのでご確認お願いします。\n前回送った宅配依頼は破棄してください。\n' },
    { subject: 'RE: 26.6.6～6.8　宅配依頼', body: '宅配依頼です。' },
    { subject: '26.2.28～3.2　宅配依頼', body: '昨日お伝えしました。\nジオ神戸三宮の変更です。\n東灘区はなくなりました\n' }
  ];
  cases.forEach(function(c, i) {
    var fake = {
      getSubject: function() { return c.subject; },
      getPlainBody: function() { return c.body; },
      getBody: function() { return c.body; }
    };
    var r = detectCorrection(fake);
    Logger.log((i + 1) + '. ' + c.subject + ' → ' + (r.isCorrection ? '検知' : '未検知') + (r.reason ? '（' + r.reason + '）' : ''));
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

  // 直前の明細行の地区を、地区なしの継続行（字下げ行）に引き継ぐ
  //   加古川市：集合4000部　6円/部
  //   　　　　　戸建4500部　6円/部   ← この行は加古川市扱い
  var lastCity = null;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (!/(集合|戸建|ローラー)/.test(line)) continue;

    var cityMatch = line.match(cityRe);
    var city = cityMatch ? cityMatch[1].trim() : lastCity;
    if (cityMatch) lastCity = city;
    var rowProjectName = city
      ? projectName.replace(/（[^）]+）$/, '') + '（' + city + '）'
      : projectName;

    // 明細行に付いた注記（例「…5円/部　※重量特別単価」）はその行の明細に付ける
    var lineNote = splitNotes(line).join(' / ');

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
        amount: price === '未抽出' ? '未計算' : calcAmt(qty, price),
        note: lineNote
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
    if (extracted.warnings && extracted.warnings.length > 0) {
      extracted.warnings.forEach(function(w) {
        headerWarnings.push('【⚠️ 要確認】' + w);
      });
    }

    var rowsText = extracted.rows.map(function(row, i) {
      var lines = [
        '  【内訳' + (i + 1) + '】',
        '  ・案件名：' + row.projectName,
        '  ・配布日：' + (row.deliveryDate || extracted.deliveryDate),
        '  ・配布方式：' + row.method,
        '  ・部数：' + row.quantity,
        '  ・単価：' + row.unitPrice,
        '  ・金額：' + row.amount
      ];
      if (row.note) lines.push('  ・備考：' + row.note);
      return lines.join('\n');
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
          notes: [],
          total: 0
        };
        projectOrder.push(key);
      }
      var qty = parseInt(row.quantity, 10) || 0;
      var methodLine = row.method + '、' + (row.quantity === '未抽出' ? '未抽出' : row.quantity + '部');
      if (row.note && /重量|特別単価/.test(row.note)) methodLine += '　※重量特別単価';
      projects[key].methods.push(methodLine);
      if (!isNaN(qty)) projects[key].total += qty;

      // 先方からの※注記（配布指示など）は内部向けのLINEには全文載せる
      if (row.note) {
        row.note.split(/\s*\/\s*/).forEach(function(n) {
          if (/^[※＊]/.test(n) && projects[key].notes.indexOf(n) === -1) {
            projects[key].notes.push(n);
          }
        });
      }
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
      p.notes.forEach(function(n) { lines.push('  ' + n); });
    });

    if (extracted.warnings && extracted.warnings.length > 0) {
      lines.push('');
      extracted.warnings.forEach(function(w) { lines.push('⚠️ ' + w); });
    }

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
    // 行ごとの注記（※重量特別単価・部数不一致・単価異常）をメール共通の備考に続けて記録
    var rowNote = noteStr;
    if (row.note) rowNote = (rowNote ? rowNote + ' / ' : '') + row.note;

    sheet.appendRow([
      receivedAt, message.getFrom(), message.getSubject(),
      row.projectName, row.deliveryDate || extracted.deliveryDate, row.method,
      row.quantity, row.unitPrice, row.amount,
      saveResult.htmlFileUrl, attachmentUrlsStr,
      confirmStatus, billStatus, rowNote
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
