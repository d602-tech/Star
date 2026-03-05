// -------------------------------------------------------------
// GAS 後端 API 邏輯 (code.gs)
// 部署方式：網頁應用程式 (執行身分：我，存取權限：所有人)
// -------------------------------------------------------------

const SHEET_COMMITTEES = '委員';
const SHEET_CANDIDATES = '候選人';
const SHEET_VOTES = '投票紀錄';

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    let result = {};

    switch (action) {
      case 'getCommittees': result = getCommittees(); break;
      case 'getCandidates': result = getCandidates(); break;
      case 'getVotes': result = getVotes(payload.committee_code); break;
      case 'getResults': result = getResults(); break;
      case 'login': result = login(payload.name, payload.login_code); break;
      case 'vote': result = submitVotes(payload.committee_code, payload.votes); break;
      case 'addCandidate': result = addCandidate(payload); break;
      case 'updateCandidate': result = updateCandidate(payload); break;
      case 'deleteCandidate': result = deleteCandidate(payload.id); break;
      case 'uploadImage': result = uploadImage(payload.id, payload.image_url); break;
      case 'addCommittee': result = addCommittee(payload); break;
      case 'updateCommittee': result = updateCommittee(payload); break;
      case 'deleteCommittee': result = deleteCommittee(payload.id); break;
      default: throw new Error('未知的操作: ' + action);
    }

    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

// 供 OPTIONS 解析 (以防不慎發送 CORS Preflight，雖已用 text/plain 規避)
function doOptions(e) {
  return ContentService.createTextOutput()
    .setMimeType(ContentService.MimeType.TEXT);
}

// 通用讀取資料庫
function getSheetData(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return []; // 只有表頭或空白
  const headers = data[0];
  return data.slice(1).map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = row[i] !== undefined ? row[i] : '');
    return obj;
  });
}

function getCommittees() {
  return getSheetData(SHEET_COMMITTEES);
}

function getCandidates() {
  let candidates = getSheetData(SHEET_CANDIDATES);
  // 防呆機制：若候選人ID空白，自動提取姓名作為ID
  candidates.forEach(c => {
    if (!c['候選人ID']) c['候選人ID'] = c['姓名'];
  });
  return candidates;
}

function getVotes(committeeCode) {
  return getSheetData(SHEET_VOTES).filter(v => String(v['委員代號']) === String(committeeCode));
}

function getResults() {
  const candidates = getCandidates();
  const votes = getSheetData(SHEET_VOTES);

  const scoreMap = {};
  votes.forEach(v => {
    const cid = v['候選人ID'];
    const score = Number(v['分數']) || 0;
    if (!scoreMap[cid]) scoreMap[cid] = { totalScore: 0, voteCount: 0 };
    scoreMap[cid].totalScore += score;
    scoreMap[cid].voteCount += 1;
  });

  const results = candidates.map(c => {
    const cid = c['候選人ID'];
    const stat = scoreMap[cid] || { totalScore: 0, voteCount: 0 };
    return {
      id: cid,
      name: c['姓名'],
      department: c['部門'],
      totalScore: stat.totalScore,
      voteCount: stat.voteCount,
      average: stat.voteCount > 0 ? (stat.totalScore / stat.voteCount).toFixed(2) : 0
    };
  });

  // 排序：總分降冪
  results.sort((a, b) => b.totalScore - a.totalScore);
  return results;
}

function login(name, loginCode) {
  const committees = getCommittees();
  const c = committees.find(x => String(x['委員姓名']) === String(name) && String(x['登入代號(密碼)']) === String(loginCode));
  if (c) {
    return { success: true, committee: c };
  }
  return { success: false, message: '姓名或專屬代號不正確。' };
}

function submitVotes(committeeCode, votes) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_VOTES);
  if (!sheet) throw new Error('找不到投票紀錄工作表');
  
  // 1. 先刪除該委員的舊紀錄 (由下往上刪)
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][1]) === String(committeeCode)) { // 委員代號欄位 index 1
      sheet.deleteRow(i + 1);
    }
  }

  // 2. 批次寫入新紀錄
  if (votes && votes.length > 0) {
    const timestamp = new Date().getTime();
    const newRows = votes.map((v, idx) => [
      timestamp + idx, // 投票ID
      committeeCode,
      v.candidateId,
      v.score
    ]);
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 4).setValues(newRows);
  }
  
  return { success: true };
}

function addCandidate(p) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CANDIDATES);
  const id = new Date().getTime();
  sheet.appendRow([id, p.department, p.name, p.description, '']);
  return { success: true, id: id };
}

function updateCandidate(p) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CANDIDATES);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    let currentId = data[i][0] ? data[i][0] : data[i][2]; // 防呆：ID 或 姓名
    if (String(currentId) === String(p.id)) {
      sheet.getRange(i + 1, 2).setValue(p.department);
      sheet.getRange(i + 1, 3).setValue(p.name);
      sheet.getRange(i + 1, 4).setValue(p.description);
      return { success: true };
    }
  }
  throw new Error('找不到指定的候選人。');
}

function deleteCandidate(id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CANDIDATES);
  const data = sheet.getDataRange().getValues();
  let deleted = false;
  for (let i = data.length - 1; i >= 1; i--) {
     let currentId = data[i][0] ? data[i][0] : data[i][2];
     if (String(currentId) === String(id)) {
       sheet.deleteRow(i + 1);
       deleted = true;
       break;
     }
  }

  // 同步刪除關聯投票紀錄
  if (deleted) {
    const vSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_VOTES);
    const vData = vSheet.getDataRange().getValues();
    for (let i = vData.length - 1; i >= 1; i--) {
      // 候選人ID 欄位 index 2
      if (String(vData[i][2]) === String(id)) { 
        vSheet.deleteRow(i + 1);
      }
    }
  }

  return { success: true };
}

function uploadImage(id, base64Str) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CANDIDATES);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    let currentId = data[i][0] ? data[i][0] : data[i][2];
    if (String(currentId) === String(id)) {
      sheet.getRange(i + 1, 5).setValue(base64Str);
      return { success: true };
    }
  }
  throw new Error('找不到指定的候選人。');
}

function addCommittee(p) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_COMMITTEES);
  const id = new Date().getTime();
  sheet.appendRow([id, p.department, p.name, p.login_code]);
  return { success: true, id: id };
}

function updateCommittee(p) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_COMMITTEES);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(p.id)) {
      sheet.getRange(i + 1, 2).setValue(p.department);
      sheet.getRange(i + 1, 3).setValue(p.name);
      sheet.getRange(i + 1, 4).setValue(p.login_code);
      return { success: true };
    }
  }
  throw new Error('找不到指定的委員。');
}

function deleteCommittee(id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_COMMITTEES);
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  throw new Error('找不到指定的委員。');
}
