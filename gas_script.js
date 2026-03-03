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
      case 'getCommittees':
        result = getCommittees();
        break;
      case 'getCandidates':
        result = getCandidates();
        break;
      case 'getVotes':
        result = getVotes(e.parameter.committee_code);
        break;
      case 'getResults':
        result = getResults();
        break;
      case 'login':
        result = login(data.name, data.login_code);
        break;
      case 'vote':
        result = submitVote(data.committee_code, data.votes);
        break;
      case 'addCandidate':
        result = addCandidate(data);
        break;
      case 'updateCandidate':
        result = updateCandidate(data);
        break;
      case 'deleteCandidate':
        result = deleteCandidate(data.id);
        break;
      case 'uploadImage':
        result = uploadImage(data.id, data.image_url);
        break;
      case 'addCommittee':
        result = addCommittee(data);
        break;
      case 'updateCommittee':
        result = updateCommittee(data);
        break;
      case 'deleteCommittee':
        result = deleteCommittee(data.id);
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

// 取得當前綁定的 Google Sheet
function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

// 取得或建立工作表
function getSheet(sheetName, headers) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (headers) {
      sheet.appendRow(headers);
    }
  }
  return sheet;
}

// 將工作表資料轉換為物件陣列
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

// 委員資料映射
const COMMITTEE_HEADERS = ['委員ID', '部門', '委員姓名', '登入代號(密碼)'];
function mapCommittee(row) {
  return {
    id: row['委員ID'],
    department: row['部門'],
    name: row['委員姓名'],
    login_code: row['登入代號(密碼)'] ? row['登入代號(密碼)'].toString() : ''
  };
}

// 候選人資料映射
const CANDIDATE_HEADERS = ['候選人ID', '部門', '姓名', '優良事蹟簡介', '照片'];
function mapCandidate(row) {
  return {
    id: row['候選人ID'],
    department: row['部門'],
    name: row['姓名'],
    description: row['優良事蹟簡介'],
    image_url: row['照片'] || null
  };
}

// 投票紀錄資料映射
const VOTE_HEADERS = ['投票ID', '委員代號', '候選人ID', '分數'];
function mapVote(row) {
  return {
    id: row['投票ID'],
    committee_code: row['委員代號'] ? row['委員代號'].toString() : '',
    candidate_id: row['候選人ID'],
    score: row['分數']
  };
}

// 初始化工作表 (可透過 ?action=setup 呼叫)
function setupSheets() {
  getSheet('委員', COMMITTEE_HEADERS);
  getSheet('候選人', CANDIDATE_HEADERS);
  getSheet('投票紀錄', VOTE_HEADERS);
  
  // 確保有管理員帳號
  var committees = getSheetData('委員');
  var hasAdmin = committees.some(function(c) { return c['登入代號(密碼)'] == 'ADMIN'; });
  if (!hasAdmin) {
    var sheet = getSpreadsheet().getSheetByName('委員');
    sheet.appendRow([new Date().getTime(), '系統', '管理員', 'ADMIN']);
  }
  
  return { success: true, message: '工作表初始化完成' };
}

function getCommittees() {
  var data = getSheetData('委員');
  return data.map(mapCommittee);
}

function getCandidates() {
  var data = getSheetData('候選人');
  return data.map(mapCandidate);
}

function getVotes(committee_code) {
  var data = getSheetData('投票紀錄');
  var votes = data.map(mapVote);
  if (committee_code) {
    votes = votes.filter(function(v) { return v.committee_code === committee_code; });
  }
  return votes;
}

function login(name, login_code) {
  var committees = getCommittees();
  var user = committees.find(function(c) { 
    return c.name === name && c.login_code === login_code; 
  });
  
  if (user) {
    return { success: true, committee: user };
  } else {
    return { success: false, message: '姓名或密碼錯誤' };
  }
}

function submitVote(committee_code, votes) {
  var sheet = getSpreadsheet().getSheetByName('投票紀錄');
  if (!sheet) return { success: false, message: '找不到投票紀錄工作表' };
  
  // 刪除該委員舊的投票紀錄
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][1].toString() === committee_code) {
      sheet.deleteRow(i + 1);
    }
  }
  
  // 新增新的投票紀錄
  votes.forEach(function(vote) {
    sheet.appendRow([
      new Date().getTime() + Math.floor(Math.random() * 1000), // ID
      committee_code,
      vote.candidateId,
      vote.score
    ]);
  });
  
  return { success: true };
}

function getResults() {
  var candidates = getCandidates();
  var votes = getSheetData('投票紀錄').map(mapVote);
  
  var results = candidates.map(function(candidate) {
    var candidateVotes = votes.filter(function(v) { return v.candidate_id == candidate.id; });
    var totalScore = candidateVotes.reduce(function(sum, v) { return sum + Number(v.score); }, 0);
    
    return {
      id: candidate.id,
      department: candidate.department,
      name: candidate.name,
      description: candidate.description,
      image_url: candidate.image_url,
      total_score: totalScore,
      vote_count: candidateVotes.length
    };
  });
  
  // 依總分降冪排序
  results.sort(function(a, b) { return b.total_score - a.total_score; });
  
  return results;
}

function addCandidate(data) {
  var sheet = getSpreadsheet().getSheetByName('候選人');
  if (!sheet) return { success: false, message: '找不到候選人工作表' };
  
  var id = new Date().getTime();
  sheet.appendRow([
    id,
    data.department,
    data.name,
    data.description,
    '' // image_url
  ]);
  
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
      
      // 同時刪除相關的投票紀錄
      var voteSheet = getSpreadsheet().getSheetByName('投票紀錄');
      if (voteSheet) {
        var voteRows = voteSheet.getDataRange().getValues();
        for (var j = voteRows.length - 1; j >= 1; j--) {
          if (voteRows[j][2] == id) {
            voteSheet.deleteRow(j + 1);
          }
        }
      }
      
      return { success: true };
    }
  }
  return { success: false, message: '找不到該候選人' };
}

function uploadImage(id, image_url) {
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

function addCommittee(data) {
  var sheet = getSpreadsheet().getSheetByName('委員');
  if (!sheet) return { success: false, message: '找不到委員工作表' };
  
  var id = new Date().getTime();
  sheet.appendRow([
    id,
    data.department,
    data.name,
    data.login_code
  ]);
  
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
      sheet.getRange(i + 1, 4).setValue(data.login_code);
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
