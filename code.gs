// =====================================================
// 票選系統 GAS 後端 v2.1 (含管理功能與資安強化)
// =====================================================

// ── 管理員密碼 Hash（SHA-256）──────────────────────────
// 預設密碼: "Admin@2024"
const ADMIN_PWD_HASH = 'b3f0f5188c6cbe2fe5f42dcda52effb5f4df2bd15f82b41fdb2a88dba381d3c0';

const SHEET_COMMITTEES = '委員';
const SHEET_CANDIDATES = '候選人';
const SHEET_VOTES = '投票紀錄';

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
      case 'getCommittees': result = getCommittees(); break;
      case 'getCandidates': result = getCandidates(); break;
      case 'login': result = login(data.name, data.login_code); break;
      case 'adminLogin': result = adminLogin(data.acc, data.pwd); break;

      // 委員 API
      case 'getVotes': result = getVotes(data.sessionToken); break;
      case 'vote': result = submitVote(data.sessionToken, data.votes); break;
      case 'voterLogout': result = voterLogout(data.sessionToken); break;

      // 管理員 API
      case 'getResults': verifyAdmin(data.adminToken); result = getResults(); break;
      case 'addCandidate': verifyAdmin(data.adminToken); result = addCandidate(data); break;
      case 'updateCandidate': verifyAdmin(data.adminToken); result = updateCandidate(data); break;
      case 'deleteCandidate': verifyAdmin(data.adminToken); result = deleteCandidate(data.id); break;
      case 'uploadImage': verifyAdmin(data.adminToken); result = uploadImage(data.id, data.image_url); break;
      case 'addCommittee': verifyAdmin(data.adminToken); result = addCommittee(data); break;
      case 'updateCommittee': verifyAdmin(data.adminToken); result = updateCommittee(data); break;
      case 'deleteCommittee': verifyAdmin(data.adminToken); result = deleteCommittee(data.id); break;
      case 'adminLogout': verifyAdmin(data.adminToken); revokeAdminToken(); result = { success: true }; break;
      case 'unlockUser': verifyAdmin(data.adminToken); clearRateLimit(data.name); result = { success: true }; break;
      case 'setup': result = setupSheets(); break;
      default: result = { success: false, message: '未知的操作: ' + action };
    }

    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 核心邏輯
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function getSheetData(sheetName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var headers = data[0];
  var result = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i], obj = {};
    for (var j = 0; j < headers.length; j++) { obj[headers[j]] = row[j]; }
    result.push(obj);
  }
  return result;
}

function getCommittees() {
  return getSheetData(SHEET_COMMITTEES).map(function(row) {
    return { id: row['委員ID'], department: row['部門'], name: row['委員姓名'] };
  });
}

function getCandidates() {
  return getSheetData(SHEET_CANDIDATES).map(function(row) {
    return { id: row['候選人ID'], department: row['部門'], name: row['姓名'], description: row['優良事蹟簡介'], image_url: row['照片'] || null };
  });
}

function login(name, login_code) {
  checkRateLimit(name || 'unknown');
  var committees = getSheetData(SHEET_COMMITTEES);
  var user = committees.find(function(c) { return c['委員姓名'] === name && String(c['登入代號(密碼)']) === String(login_code); });
  if (!user) { recordFail(name || 'unknown'); return { success: false, message: '姓名或密碼錯誤' }; }
  clearRateLimit(name);
  return { success: true, sessionToken: generateSessionToken(String(user['登入代號(密碼)'])), committee: { id: user['委員ID'], department: user['部門'], name: user['委員姓名'] } };
}

function adminLogin(acc, pwd) {
  checkRateLimit('ADMIN');
  if (acc !== 'admin' || hashSHA256(pwd || '') !== ADMIN_PWD_HASH) { recordFail('ADMIN'); return { success: false, message: '帳號或密碼錯誤' }; }
  clearRateLimit('ADMIN');
  return { success: true, adminToken: generateAdminToken() };
}

function getVotes(sessionToken) {
  var sess = verifySession(sessionToken);
  return getSheetData(SHEET_VOTES).filter(function(v) { return String(v['委員代號']) === String(sess.code); }).map(function(row) {
    return { candidate_id: row['候選人ID'], score: row['分數'] };
  });
}

function submitVote(sessionToken, votes) {
  var sess = verifySession(sessionToken);
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_VOTES);
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) { if (String(data[i][1]) === String(sess.code)) sheet.deleteRow(i + 1); }
  votes.forEach(function(v) { sheet.appendRow([Date.now() + Math.random(), sess.code, v.candidateId, v.score]); });
  return { success: true };
}

function getResults() {
  var candidates = getCandidates(), votes = getSheetData(SHEET_VOTES);
  var results = candidates.map(function(c) {
    var cv = votes.filter(function(v) { return v['候選人ID'] == c.id; });
    var total = cv.reduce(function(s, v) { return s + Number(v['分數']); }, 0);
    return { id: c.id, department: c.department, name: c.name, description: c.description, image_url: c.image_url, totalScore: total, voteCount: cv.length, average: cv.length > 0 ? (total / cv.length).toFixed(2) : '0.00' };
  });
  return results.sort(function(a, b) { return b.totalScore - a.totalScore; });
}

function addCandidate(d) { SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CANDIDATES).appendRow([Date.now(), d.department, d.name, d.description, '']); return { success: true }; }
function updateCandidate(d) { /* 實作細節略... */ return { success: true }; }
function deleteCandidate(id) { /* 實作細節略... */ return { success: true }; }
function uploadImage(id, url) { /* 實作細節略... */ return { success: true }; }
function addCommittee(d) { SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_COMMITTEES).appendRow([Date.now(), d.department, d.name, d.login_code]); return { success: true }; }
function updateCommittee(d) { /* 實作細節略... */ return { success: true }; }
function deleteCommittee(id) { /* 實作細節略... */ return { success: true }; }
function voterLogout(t) { revokeSession(t); return { success: true }; }
function setupSheets() { /* 略 */ return { success: true }; }
