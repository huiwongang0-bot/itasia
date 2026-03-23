// Netlify Function: Notion API 프록시 (CORS 완전 해결)
const https = require('https');

const NOTION_SECRET = process.env.NOTION_SECRET;
const NOTION_VERSION = '2022-06-28';

const DB_IDS = {
  suppliers:      '32a8bd0b0ab4805987d1fc754fdf778d',
  customers:      '32a8bd0b0ab4803b941dd06930ed4165',
  products:       '32a8bd0b0ab4801ab07cc4f7253ce45e',
  shipments:      '32a8bd0b0ab4801c8649e14b37bb1be8',
  sales:          '32a8bd0b0ab480188a59c0301d53e0c6',
  payments:       '32a8bd0b0ab480e98b78f0a9d721c810',
  docAttachments: '32a8bd0b0ab48013b965c11c01ab38b3',
  emailLog:       '32a8bd0b0ab480aa8da2faa6509b4aae'
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (!NOTION_SECRET) return { statusCode: 500, headers: CORS, body: JSON.stringify({error:'NOTION_SECRET not set'}) };

  try {
    const body = JSON.parse(event.body || '{}');
    const { action, sheet, data } = body;
    const dbId = DB_IDS[sheet];

    if (!dbId) return { statusCode: 400, headers: CORS, body: JSON.stringify({error:'invalid sheet: '+sheet}) };

    // ── 읽기 ──
    if (action === 'read') {
      const pages = await notionQuery(dbId);
      const result = pages.map(p => {
        const raw = p.properties.data && p.properties.data.rich_text[0];
        const pageId = p.id;
        if (!raw) return null;
        try {
          const obj = JSON.parse(raw.plain_text);
          obj.__notion_page_id = pageId;
          return obj;
        } catch(e) { return null; }
      }).filter(Boolean);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ok:true, data:result}) };
    }

    // ── 쓰기 (전체 덮어쓰기) ──
    if (action === 'save') {
      // 1. 기존 페이지 모두 삭제
      const existing = await notionQuery(dbId);
      await Promise.all(existing.map(p => notionArchive(p.id)));

      // 2. 새 데이터 삽입
      if (data && data.length > 0) {
        await Promise.all(data.map((item, idx) => {
          const key = item.code || item.id || String(idx);
          const json = JSON.stringify(item);
          return notionCreate(dbId, key, json);
        }));
      }
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ok:true}) };
    }

    return { statusCode: 400, headers: CORS, body: JSON.stringify({error:'unknown action'}) };

  } catch(err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({error: err.message}) };
  }
};

// Notion DB 전체 조회
function notionQuery(dbId) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ page_size: 100 });
    const options = {
      hostname: 'api.notion.com',
      path: `/v1/databases/${dbId}/query`,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + NOTION_SECRET,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(options, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d).results || []); }
        catch(e) { reject(new Error('Query parse error: ' + d.slice(0,200))); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Notion 페이지 생성
function notionCreate(dbId, key, jsonStr) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      parent: { database_id: dbId },
      properties: {
        key: { title: [{ text: { content: String(key).slice(0,100) } }] },
        data: { rich_text: [{ text: { content: jsonStr.slice(0,2000) } }] }
      }
    });
    const options = {
      hostname: 'api.notion.com',
      path: '/v1/pages',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + NOTION_SECRET,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(options, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Notion 페이지 아카이브(삭제)
function notionArchive(pageId) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ archived: true });
    const options = {
      hostname: 'api.notion.com',
      path: '/v1/pages/' + pageId,
      method: 'PATCH',
      headers: {
        'Authorization': 'Bearer ' + NOTION_SECRET,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(options, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve());
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}
