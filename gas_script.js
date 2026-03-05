// =====================================================
// 票選系統 GAS 後端 v2.0 (含資安強化)
// =====================================================

// ── 管理員密碼 Hash（SHA-256）──────────────────────────
// 預設密碼: "Admin@2024"
// 若要更換，在 GAS 控制台執行: Logger.log(hashSHA256('新密碼'))，然後貼在下方
const ADMIN_PWD_HASH = 'b3f0f5188c6cbe2fe5f42dcda52effb5f4df2bd15f82b41fdb2a88dba381d3c0'; // 密碼已更新

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 工具：SHA-256 Hash
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function hashSHA256(str) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Admin Token 管理
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function generateAdminToken() {
  var token = Utilities.getUuid();
  var props = PropertiesService.getScriptProperties();
  props.setProperty('ADMIN_TOKEN', token);
  props.setProperty('ADMIN_TOKEN_EXP', (Date.now() + 2 * 3600 * 1000).toString()); // 2 小時
  return token;
}

function verifyAdmin(token) {
  if (!token) throw new Error('需要管理員授權');
  var props = PropertiesService.getScriptProperties();
  var saved = props.getProperty('ADMIN_TOKEN');
  var exp = Number(props.getProperty('ADMIN_TOKEN_EXP') || 0);
  if (token !== saved || Date.now() > exp) {
    throw new Error('管理員 Token 無效或已過期，請重新登入');
  }
}

function revokeAdminToken() {
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty('ADMIN_TOKEN');
  props.deleteProperty('ADMIN_TOKEN_EXP');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Session Token 管理（委員用）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function generateSessionToken(committeeCode) {
  var token = Utilities.getUuid();
  var props = PropertiesService.getScriptProperties();
  var sessionData = JSON.stringify({
    code: committeeCode,
    exp: Date.now() + 8 * 3600 * 1000 // 8 小時
  });
  props.setProperty('SESS_' + token, sessionData);
  return token;
}

function verifySession(token) {
  if (!token) throw new Error('需要登入 Session，請重新登入');
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty('SESS_' + token);
  if (!raw) throw new Error('Session 無效，請重新登入');
  var sess = JSON.parse(raw);
  if (Date.now() > sess.exp) {
    props.deleteProperty('SESS_' + token);
    throw new Error('Session 已過期，請重新登入');
  }
  return sess; // { code, exp }
}

function revokeSession(token) {
  if (!token) return;
  PropertiesService.getScriptProperties().deleteProperty('SESS_' + token);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Rate Limiting（防暴力破解）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
var MAX_FAILS = 5;

function checkRateLimit(key) {
  var props = PropertiesService.getScriptProperties();
  var failKey = 'FAIL_' + key;
  var fails = Number(props.getProperty(failKey) || 0);
  if (fails >= MAX_FAILS) {
    throw new Error('嘗試次數過多，帳號已鎖定，請聯絡管理員解鎖');
  }
}

function recordFail(key) {
  var props = PropertiesService.getScriptProperties();
  var failKey = 'FAIL_' + key;
  var fails = Number(props.getProperty(failKey) || 0);
  props.setProperty(failKey, (fails + 1).toString());
}

function clearRateLimit(key) {
  PropertiesService.getScriptProperties().deleteProperty('FAIL_' + key);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HTTP 入口
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function doGet(e) {
  return handleRequest(e, 'GET');
}

function doPost(e) {
  return handleRequest(e, 'POST');
}

function handleRequest(e, method) {
  try {
    var action = e.parameter.action;
    var data = {};

    if (method === 'POST' && e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
      action = data.action || action;
    }

    var result;
    switch (action) {
      // ── 公開 API（無需授權）─────────────────────
      case 'getCommittees':
        result = getCommittees();
        break;
      case 'getCandidates':
        result = getCandidates();
        break;
      case 'login':
        result = login(data.name, data.login_code);
        break;
      case 'adminLogin':
        result = adminLogin(data.acc, data.pwd);
        break;

      // ── 委員 API（需要 sessionToken）────────────
      case 'getVotes':
        result = getVotes(data.sessionToken);
        break;
      case 'vote':
        result = submitVote(data.sessionToken, data.votes);
        break;
      case 'voterLogout':
        result = voterLogout(data.sessionToken);
        break;

      // ── 管理員 API（需要 adminToken）────────────
      case 'getResults':
        verifyAdmin(data.adminToken);
        result = getResults();
        break;
      case 'addCandidate':
        verifyAdmin(data.adminToken);
        result = addCandidate(data);
        break;
      case 'updateCandidate':
        verifyAdmin(data.adminToken);
        result = updateCandidate(data);
        break;
      case 'deleteCandidate':
        verifyAdmin(data.adminToken);
        result = deleteCandidate(data.id);
        break;
      case 'uploadImage':
        verifyAdmin(data.adminToken);
        result = uploadImage(data.id, data.image_url);
        break;
      case 'addCommittee':
        verifyAdmin(data.adminToken);
        result = addCommittee(data);
        break;
      case 'updateCommittee':
        verifyAdmin(data.adminToken);
        result = updateCommittee(data);
        break;
      case 'deleteCommittee':
        verifyAdmin(data.adminToken);
        result = deleteCommittee(data.id);
        break;
      case 'adminLogout':
        verifyAdmin(data.adminToken);
        revokeAdminToken();
        result = { success: true };
        break;
      case 'unlockUser':
        verifyAdmin(data.adminToken);
        clearRateLimit(data.name);
        result = { success: true };
        break;
      case 'setup':
        result = setupSheets();
        break;

      default:
        result = { success: false, message: 'Unknown action: ' + action };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Spreadsheet 工具
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet(sheetName, headers) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (headers) sheet.appendRow(headers);
  }
  return sheet;
}

function getSheetData(sheetName) {
  var sheet = getSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var headers = data[0];
  var result = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }
    result.push(obj);
  }
  return result;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 資料 Headers & Mappers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
var COMMITTEE_HEADERS = ['委員ID', '部門', '委員姓名', '登入代號(密碼)'];
var CANDIDATE_HEADERS = ['候選人ID', '部門', '姓名', '優良事蹟簡介', '照片'];
var VOTE_HEADERS = ['投票ID', '委員代號', '候選人ID', '分數'];

// 委員：對外不回傳 login_code 明文
function mapCommitteePublic(row) {
  return {
    id: row['委員ID'],
    department: row['部門'],
    name: row['委員姓名']
    // login_code 不回傳！
  };
}

function mapCommitteeInternal(row) {
  return {
    id: row['委員ID'],
    department: row['部門'],
    name: row['委員姓名'],
    login_code: row['登入代號(密碼)'] ? row['登入代號(密碼)'].toString() : ''
  };
}

function mapCandidate(row) {
  return {
    id: row['候選人ID'],
    department: row['部門'],
    name: row['姓名'],
    description: row['優良事蹟簡介'],
    image_url: row['照片'] || null
  };
}

function mapVote(row) {
  return {
    id: row['投票ID'],
    committee_code: row['委員代號'] ? row['委員代號'].toString() : '',
    candidate_id: row['候選人ID'],
    score: row['分數']
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 公開 API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 取得委員清單（不含密碼）
function getCommittees() {
  return getSheetData('委員').map(mapCommitteePublic);
}

// 取得候選人清單
function getCandidates() {
  return getSheetData('候選人').map(mapCandidate);
}

// 委員登入：發 sessionToken，不把 login_code 回傳前端
function login(name, login_code) {
  var key = name || 'unknown';
  checkRateLimit(key);

  var committees = getSheetData('委員').map(mapCommitteeInternal);
  var user = committees.find(function (c) {
    return c.name === name && c.login_code === login_code;
  });

  if (!user) {
    recordFail(key);
    return { success: false, message: '姓名或密碼錯誤' };
  }

  clearRateLimit(key);
  var sessionToken = generateSessionToken(user.login_code);

  return {
    success: true,
    sessionToken: sessionToken,
    committee: {
      id: user.id,
      department: user.department,
      name: user.name
      // login_code 不回傳！
    }
  };
}

// 管理員登入：驗 SHA-256 hash，發 adminToken
function adminLogin(acc, pwd) {
  var key = 'ADMIN';
  checkRateLimit(key);

  var pwdHash = hashSHA256(pwd || '');
  if (acc !== 'admin' || pwdHash !== ADMIN_PWD_HASH) {
    recordFail(key);
    return { success: false, message: '帳號或密碼錯誤' };
  }

  clearRateLimit(key);
  var token = generateAdminToken();
  return { success: true, adminToken: token };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 委員 API（需 sessionToken）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getVotes(sessionToken) {
  var sess = verifySession(sessionToken);
  var data = getSheetData('投票紀錄').map(mapVote);
  return data.filter(function (v) { return v.committee_code === sess.code; });
}

function submitVote(sessionToken, votes) {
  var sess = verifySession(sessionToken);
  var committeeCode = sess.code;

  var sheet = getSpreadsheet().getSheetByName('投票紀錄');
  if (!sheet) return { success: false, message: '找不到投票紀錄工作表' };

  // 刪除舊紀錄
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][1].toString() === committeeCode) {
      sheet.deleteRow(i + 1);
    }
  }

  // 新增新紀錄
  votes.forEach(function (vote) {
    sheet.appendRow([
      new Date().getTime() + Math.floor(Math.random() * 1000),
      committeeCode,
      vote.candidateId,
      vote.score
    ]);
  });

  return { success: true };
}

function voterLogout(sessionToken) {
  revokeSession(sessionToken);
  return { success: true };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 管理員 API（呼叫前已在 handleRequest 做 verifyAdmin）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getResults() {
  var candidates = getCandidates();
  var votes = getSheetData('投票紀錄').map(mapVote);

  var results = candidates.map(function (candidate) {
    var cv = votes.filter(function (v) { return v.candidate_id == candidate.id; });
    var total = cv.reduce(function (s, v) { return s + Number(v.score); }, 0);
    var avg = cv.length > 0 ? (total / cv.length).toFixed(2) : '0.00';
    return {
      id: candidate.id,
      department: candidate.department,
      name: candidate.name,
      description: candidate.description,
      image_url: candidate.image_url,
      totalScore: total,
      voteCount: cv.length,
      average: avg
    };
  });

  results.sort(function (a, b) { return b.totalScore - a.totalScore; });
  return results;
}

function addCandidate(data) {
  var sheet = getSpreadsheet().getSheetByName('候選人');
  if (!sheet) return { success: false, message: '找不到候選人工作表' };
  var id = new Date().getTime();
  sheet.appendRow([id, data.department, data.name, data.description, '']);
  return { success: true, id: id };
}

function updateCandidate(data) {
  var sheet = getSpreadsheet().getSheetByName('候選人');
  if (!sheet) return { success: false, message: '找不到候選人工作表' };
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] == data.id) {
      sheet.getRange(i + 1, 2).setValue(data.department);
      sheet.getRange(i + 1, 3).setValue(data.name);
      sheet.getRange(i + 1, 4).setValue(data.description);
      return { success: true };
    }
  }
  return { success: false, message: '找不到該候選人' };
}

function deleteCandidate(id) {
  var sheet = getSpreadsheet().getSheetByName('候選人');
  if (!sheet) return { success: false, message: '找不到候選人工作表' };
  var rows = sheet.getDataRange().getValues();
  for (var i = rows.length - 1; i >= 1; i--) {
    if (rows[i][0] == id) {
      sheet.deleteRow(i + 1);
      var voteSheet = getSpreadsheet().getSheetByName('投票紀錄');
      if (voteSheet) {
        var vr = voteSheet.getDataRange().getValues();
        for (var j = vr.length - 1; j >= 1; j--) {
          if (vr[j][2] == id) voteSheet.deleteRow(j + 1);
        }
      }
      return { success: true };
    }
  }
  return { success: false, message: '找不到該候選人' };
}

function uploadImage(id, image_url) {
  // 驗證是否為圖片 Base64
  if (!image_url || !image_url.startsWith('data:image/')) {
    return { success: false, message: '只接受圖片格式' };
  }
  var sheet = getSpreadsheet().getSheetByName('候選人');
  if (!sheet) return { success: false, message: '找不到候選人工作表' };
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] == id) {
      sheet.getRange(i + 1, 5).setValue(image_url);
      return { success: true };
    }
  }
  return { success: false, message: '找不到該候選人' };
}

// 委員管理：前端顯示用，密碼欄位遮罩
function getCommitteesAdmin() {
  return getSheetData('委員').map(function (row) {
    return {
      id: row['委員ID'],
      department: row['部門'],
      name: row['委員姓名'],
      hasCode: !!(row['登入代號(密碼)']) // 只告知有沒有設定，不回傳明文
    };
  });
}

function addCommittee(data) {
  var sheet = getSpreadsheet().getSheetByName('委員');
  if (!sheet) return { success: false, message: '找不到委員工作表' };
  var id = new Date().getTime();
  sheet.appendRow([id, data.department, data.name, data.login_code]);
  return { success: true, id: id };
}

function updateCommittee(data) {
  var sheet = getSpreadsheet().getSheetByName('委員');
  if (!sheet) return { success: false, message: '找不到委員工作表' };
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] == data.id) {
      sheet.getRange(i + 1, 2).setValue(data.department);
      sheet.getRange(i + 1, 3).setValue(data.name);
      if (data.login_code) sheet.getRange(i + 1, 4).setValue(data.login_code);
      return { success: true };
    }
  }
  return { success: false, message: '找不到該委員' };
}

function deleteCommittee(id) {
  var sheet = getSpreadsheet().getSheetByName('委員');
  if (!sheet) return { success: false, message: '找不到委員工作表' };
  var rows = sheet.getDataRange().getValues();
  for (var i = rows.length - 1; i >= 1; i--) {
    if (rows[i][0] == id) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, message: '找不到該委員' };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 初始化
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function setupSheets() {
  getSheet('委員', COMMITTEE_HEADERS);
  getSheet('候選人', CANDIDATE_HEADERS);
  getSheet('投票紀錄', VOTE_HEADERS);
  return { success: true, message: '工作表初始化完成' };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 工具函式：產生 ADMIN_PWD_HASH（在 GAS 控制台執行後把結果貼到最上方）
// function generateHash() { Logger.log(hashSHA256('你的新密碼')); }
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
