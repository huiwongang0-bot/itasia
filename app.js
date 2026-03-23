// ── Google Sheets 실시간 연동 설정 ───────────────────────
// Apps Script 웹앱 배포 후 아래 두 줄을 수정하세요
// Notion 연동 — 항상 활성 (Netlify 환경변수로 관리)
var USE_CLOUD = true;
var _syncTimer = null;
// ────────────────────────────────────────────────────────

/* ============================================================
   직수입 통합 관리 시스템 v5 — app.js
   HS코드 10자리 (한국 관세청 기준) + 밀가루 추가
   서류 관리: Google Drive 링크 + 로컬 파일 첨부
   ============================================================ */

// ── HS CODE DB (한국 10자리 = 국제 6자리 + 한국 4자리) ────
// 형식: XXXXXX-XXXX (표시용) / 내부 저장: "1101001000"
var HS_DB = [
  // ── 밀가루 / 곡물분 (Chapter 11) ──
  {code:'1101001000', disp:'1101.00-1000', name:'밀가루 (소맥분)', nameIT:'Farina di frumento',
   duty:4.2, fta_eu:0, vat:10, quarantine:false, note:'한-EU FTA 무관세. 피자·파스타용'},
  {code:'1101002000', disp:'1101.00-2000', name:'혼합곡물 밀가루 (메슬린분)',nameIT:'Farina di frumento segalato',
   duty:4.2, fta_eu:0, vat:10, quarantine:false, note:'밀+호밀 혼합'},
  {code:'1102200000', disp:'1102.20-0000', name:'옥수수 가루 (콘밀)', nameIT:'Farina di granturco',
   duty:4.0, fta_eu:0, vat:10, quarantine:false, note:''},
  {code:'1102901000', disp:'1102.90-1000', name:'쌀가루', nameIT:'Farina di riso',
   duty:8.0, fta_eu:0, vat:10, quarantine:false, note:''},
  // ── 올리브유 (Chapter 15) ──
  {code:'1509100000', disp:'1509.10-0000', name:'엑스트라 버진 올리브오일', nameIT:"Olio d'oliva vergine extra",
   duty:8.0, fta_eu:0, vat:10, quarantine:false, note:'한-EU FTA 무관세. DOP 인증 확인'},
  {code:'1509901000', disp:'1509.90-1000', name:'퓨어 올리브오일 (정제)', nameIT:"Olio d'oliva raffinato",
   duty:8.0, fta_eu:0, vat:10, quarantine:false, note:''},
  {code:'1509909000', disp:'1509.90-9000', name:'기타 올리브오일', nameIT:'Altro olio di oliva',
   duty:8.0, fta_eu:0, vat:10, quarantine:false, note:''},
  // ── 와인 (Chapter 22) ──
  {code:'2204211000', disp:'2204.21-1000', name:'와인 (포도주) 750ml 이하', nameIT:'Vino in bottiglia ≤750ml',
   duty:15.0, fta_eu:0, vat:10, quarantine:false, note:'한-EU FTA 무관세. 주세 별도 부과'},
  {code:'2204212000', disp:'2204.21-2000', name:'와인 750ml 초과~2L', nameIT:'Vino 750ml~2L',
   duty:15.0, fta_eu:0, vat:10, quarantine:false, note:'주세 별도'},
  {code:'2204291000', disp:'2204.29-1000', name:'와인 벌크 (2L 초과 10L 이하)', nameIT:'Vino sfuso 2L~10L',
   duty:15.0, fta_eu:0, vat:10, quarantine:false, note:''},
  // ── 치즈 (Chapter 04) ──
  {code:'0406101000', disp:'0406.10-1000', name:'신선 모짜렐라 치즈', nameIT:'Mozzarella fresca',
   duty:36.0, fta_eu:36.0, vat:10, quarantine:true, note:'검역필증 필수. FTA 세율 동일'},
  {code:'0406102000', disp:'0406.10-2000', name:'기타 신선 치즈 (리코타 등)', nameIT:'Altri formaggi freschi',
   duty:36.0, fta_eu:36.0, vat:10, quarantine:true, note:'냉장 운송 필수'},
  {code:'0406201000', disp:'0406.20-1000', name:'강판용 치즈 (파르미지아노)', nameIT:'Parmigiano Reggiano DOP',
   duty:36.0, fta_eu:36.0, vat:10, quarantine:true, note:'DOP 인증 확인 필요'},
  {code:'0406202000', disp:'0406.20-2000', name:'강판용 페코리노 치즈', nameIT:'Pecorino grattugiato',
   duty:36.0, fta_eu:36.0, vat:10, quarantine:true, note:''},
  {code:'0406901000', disp:'0406.90-1000', name:'고르곤졸라·블루치즈', nameIT:'Gorgonzola e formaggi erborinati',
   duty:36.0, fta_eu:36.0, vat:10, quarantine:true, note:'냉장 운송 필수'},
  {code:'0406909000', disp:'0406.90-9000', name:'기타 치즈 (그라나 파다노 등)', nameIT:'Altri formaggi',
   duty:36.0, fta_eu:36.0, vat:10, quarantine:true, note:''},
  // ── 파스타 (Chapter 19) ──
  {code:'1902110000', disp:'1902.11-0000', name:'파스타 (무란 계란, 건면)', nameIT:"Pasta secca non all'uovo",
   duty:8.0, fta_eu:0, vat:10, quarantine:false, note:''},
  {code:'1902191000', disp:'1902.19-1000', name:'계란 파스타 (탈리아텔레 등)', nameIT:"Pasta all'uovo",
   duty:8.0, fta_eu:0, vat:10, quarantine:false, note:''},
  {code:'1902199000', disp:'1902.19-9000', name:'기타 파스타 (냉동·생면)', nameIT:'Altra pasta',
   duty:8.0, fta_eu:0, vat:10, quarantine:false, note:''},
  // ── 토마토/소스 (Chapter 20) ──
  {code:'2002101000', disp:'2002.10-1000', name:'홀 토마토 (통조림)', nameIT:'Pomodori pelati interi',
   duty:27.0, fta_eu:0, vat:10, quarantine:false, note:''},
  {code:'2002901000', disp:'2002.90-1000', name:'토마토 소스 / 패사타', nameIT:'Passata/Salsa di pomodoro',
   duty:27.0, fta_eu:0, vat:10, quarantine:false, note:''},
  {code:'2002909000', disp:'2002.90-9000', name:'기타 토마토 조제품', nameIT:'Altre preparazioni di pomodoro',
   duty:27.0, fta_eu:0, vat:10, quarantine:false, note:''},
  // ── 소스류 (Chapter 21) ──
  {code:'2103901000', disp:'2103.90-1000', name:'페스토 소스', nameIT:'Pesto alla genovese',
   duty:8.0, fta_eu:0, vat:10, quarantine:false, note:''},
  {code:'2103909000', disp:'2103.90-9000', name:'기타 소스류 (아마트리치아나 등)', nameIT:'Altre salse',
   duty:8.0, fta_eu:0, vat:10, quarantine:false, note:'성분분석표 필요'},
  {code:'2106901000', disp:'2106.90-1000', name:'기타 식품 조제품', nameIT:'Altre preparazioni alimentari',
   duty:8.0, fta_eu:0, vat:10, quarantine:false, note:'성분분석표 필요'},
  // ── 커피 (Chapter 21) ──
  {code:'2101111000', disp:'2101.11-1000', name:'커피 원두 (로스팅)', nameIT:'Caffè torrefatto in grani',
   duty:2.0, fta_eu:0, vat:10, quarantine:false, note:''},
  {code:'2101119000', disp:'2101.11-9000', name:'커피 분말 (에스프레소용)', nameIT:'Caffè macinato',
   duty:2.0, fta_eu:0, vat:10, quarantine:false, note:''},
  {code:'2101120000', disp:'2101.12-0000', name:'커피 조제품 (캡슐·믹스)', nameIT:'Preparazioni a base di caffè',
   duty:8.0, fta_eu:0, vat:10, quarantine:false, note:''},
  // ── 육가공품 (Chapter 16) ──
  {code:'1601001000', disp:'1601.00-1000', name:'살라미 (돼지고기)', nameIT:'Salame di maiale',
   duty:22.5, fta_eu:22.5, vat:10, quarantine:true, note:'동물검역 필수. ASF 청정국 확인'},
  {code:'1602491000', disp:'1602.49-1000', name:'프로슈토 (프로슈토 디 파르마)', nameIT:'Prosciutto di Parma DOP',
   duty:22.5, fta_eu:22.5, vat:10, quarantine:true, note:'DOP 인증. 냉장 수송'},
  {code:'1602499000', disp:'1602.49-9000', name:'기타 돼지고기 가공품', nameIT:'Altre preparazioni di suino',
   duty:22.5, fta_eu:22.5, vat:10, quarantine:true, note:''},
  // ── 초콜릿/과자 (Chapter 18/19) ──
  {code:'1805000000', disp:'1805.00-0000', name:'코코아 파우더 (무가당)', nameIT:'Cacao in polvere non zuccherato',
   duty:8.0, fta_eu:0, vat:10, quarantine:false, note:''},
  {code:'1806321000', disp:'1806.32-1000', name:'초콜릿 블록·정사각형', nameIT:'Cioccolato in blocchi',
   duty:8.0, fta_eu:0, vat:10, quarantine:false, note:''},
  {code:'1806909000', disp:'1806.90-9000', name:'기타 초콜릿 제품', nameIT:'Altri prodotti al cioccolato',
   duty:8.0, fta_eu:0, vat:10, quarantine:false, note:''},
  {code:'1905311000', disp:'1905.31-1000', name:'스위트 비스킷', nameIT:'Biscotti dolci',
   duty:8.0, fta_eu:0, vat:10, quarantine:false, note:''},
  {code:'1905901000', disp:'1905.90-1000', name:'크래커·그리시니', nameIT:'Cracker e grissini',
   duty:8.0, fta_eu:0, vat:10, quarantine:false, note:''},
  // ── 주스 (Chapter 20) ──
  {code:'2009891000', disp:'2009.89-1000', name:'과일 주스 (오렌지·레몬)', nameIT:'Succhi di arancia/limone',
   duty:30.0, fta_eu:0, vat:10, quarantine:false, note:'방사능 검사 필요 (이탈리아산)'},
  // ── 버섯/채소 건조 (Chapter 07) ──
  {code:'0711901000', disp:'0711.90-1000', name:'건조 포르치니 버섯', nameIT:'Porcini secchi',
   duty:27.0, fta_eu:0, vat:10, quarantine:true, note:'식물검역 필요'}
];

var STAGE_DOCS = [
  ['계약서 (PI / Proforma Invoice)','신용장(L/C) 또는 T/T 확인서','수출입 라이센스 (해당시)','서명 계약서 (원본 또는 스캔)'],
  ['선하증권 (B/L)','패킹 리스트 (Packing List)','상업송장 (Commercial Invoice)','원산지증명서 (CO)','식품위생증명서','수출신고필증 (이탈리아)'],
  ['수입신고 준비서류','Arrival Notice (항만청 발행)','화물 도착 통보서','방사능 검사증명서 (식품)'],
  ['수입신고서 (수리필증)','관부가세 세금계산서','식품검역증 (검역소 발행)','식품안전검사서 (식약처)','라벨링 검토확인서','성분분석표 (CoA)'],
  ['창고 입고확인서','냉장/냉동 온도기록지 (해당시)','운송의뢰서','Delivery Order (D/O)'],
  ['세금계산서 (판매용)','거래명세서','식품이력추적 등록확인서','유통기한 확인서'],
  ['최종정산서','클레임 처리결과 (해당시)','수입실적 보고서','종결보고서']
];

var STAGES = ['계약','선적','입항','통관','이동','판매','완료'];
var STAGES_EN = ['Contract','Shipment','Arrival','Customs','Transport','Sales','Complete'];
var FOOD_CATS = ['올리브오일/오일류','밀가루/제분','와인/주류','치즈/유제품','파스타/곡물','소스/조미료','통조림/가공품','스낵/과자류','커피/차','유기농/프리미엄','기타 식품'];
var SC = [
  {bg:'#e6f1fb',b:'#b5d4f4',t:'#0c447c',d:'#185FA5'},
  {bg:'#e1f5ee',b:'#9fe1cb',t:'#085041',d:'#1D9E75'},
  {bg:'#faeeda',b:'#fac775',t:'#633806',d:'#BA7517'},
  {bg:'#faece7',b:'#f5c4b3',t:'#712b13',d:'#D85A30'},
  {bg:'#eeedfe',b:'#cecbf6',t:'#3c3489',d:'#534AB7'},
  {bg:'#fbeaf0',b:'#f4c0d1',t:'#72243e',d:'#993356'},
  {bg:'#eaf3de',b:'#c0dd97',t:'#27500a',d:'#639922'}
];
var STOR_CLS = {상온:'s-amb',냉장:'s-cold',냉동:'s-frz',건조:'s-dry'};

// ── STATE ──────────────────────────────────────────────────
var lang = 'ko', page = 'dashboard';
var pendId = null, pendStage = null;
var selFoodCat = '';
var saleItemCount = 1;
var rates = {eurKrw:1480, usdKrw:1340, eurUsd:1.10};
var selectedDocShipId = null;

// Document attachments storage: { "SHIPID_SI_DI": { name, type, gdrive, fileData, fileName, fileSize, notes, issued, expires } }
var docAttachments = {};

var suppliers = [
  {code:'SUP-001',name:'Frantoio Muraglia SRL',nameKo:'프란토이오 무라글리아',country:'Italy',city:'Andria, Puglia',
   type:'올리브오일 생산자',contact:'Giuseppe Muraglia',titlePerson:'CEO',email:'export@muraglia.it',
   phone:'+39 0883 569088',whatsapp:'+39 333 1234567',web:'https://muraglia.it',
   payment:'T/T (전신환)',currency:'EUR',moq:'100 BTL',lead:45,certs:'DOP, Bio, ISO22000',grade:'A',notes:''},
  {code:'SUP-002',name:'Barilla G. e R. Fratelli SpA',nameKo:'바릴라',country:'Italy',city:'Parma',
   type:'파스타/밀가루 생산자',contact:'Export Dept',titlePerson:'Export Manager',email:'export@barilla.com',
   phone:'+39 0521 2621',whatsapp:'',web:'https://barilla.com',
   payment:'L/C (신용장)',currency:'EUR',moq:'500 PKG',lead:60,certs:'ISO9001, FSSC22000',grade:'A',notes:''},
  {code:'SUP-003',name:'Mutti SpA',nameKo:'무티',country:'Italy',city:'Montechiarugolo, Parma',
   type:'소스/가공식품 생산자',contact:'Marco Rossi',titlePerson:'Sales Director',email:'b2b@mutti-parma.com',
   phone:'+39 0521 689611',whatsapp:'+39 340 9876543',web:'https://mutti-parma.com',
   payment:'T/T (전신환)',currency:'EUR',moq:'200 BTL',lead:40,certs:'ISO22000, BIO',grade:'A',notes:''},
  {code:'SUP-004',name:'Latteria Soresina Soc. Coop. Agr.',nameKo:'라테리아 소레시나',country:'Italy',city:'Soresina, Cremona',
   type:'치즈/유제품 생산자',contact:'Luigi Ferrari',titlePerson:'Export Manager',email:'export@lattsoresina.it',
   phone:'+39 0374 340070',whatsapp:'',web:'https://lattsoresina.it',
   payment:'T/T (전신환)',currency:'EUR',moq:'50 PCS',lead:30,certs:'DOP, ISO22000',grade:'B',notes:'냉장 운송 필수'},
  {code:'SUP-005',name:'Molino Agugiaro & Figna SpA',nameKo:'몰리노 아구자로 피냐 (5 스타지오니)',country:'Italy',city:'Curtarolo, Padova',
   type:'파스타/밀가루 생산자',contact:'Andrea Bianchi',titlePerson:'Export Manager',email:'export@agugiaro.it',
   phone:'+39 049 558 0111',whatsapp:'+39 340 1112233',web:'https://5stagioni.it',
   payment:'T/T (전신환)',currency:'EUR',moq:'50 SAC',lead:50,certs:'ISO22000, HACCP',grade:'A',notes:'피자·포카치아 전용 밀가루'}
];

var customers = [
  {code:'CUS-001',name:'(주)이탈로키친',bizno:'123-45-67890',type:'음식점/레스토랑',grade:'VIP',region:'서울 강남구',
   contact:'김민준',contactTitle:'구매팀장',email:'buy@italokitchen.co.kr',phone:'02-1234-5678',
   payTerms:30,credit:50000000,notes:'이탈리안 레스토랑 체인 15개점'},
  {code:'CUS-002',name:'그랜드 인터컨티넨탈 서울',bizno:'234-56-78901',type:'호텔/리조트',grade:'VIP',region:'서울 강남구',
   contact:'이수진',contactTitle:'F&B 구매담당',email:'fb@grandicseoul.com',phone:'02-2345-6789',
   payTerms:45,credit:100000000,notes:'5성급 호텔, 매월 정기 발주'},
  {code:'CUS-003',name:'(주)프리미엄푸드',bizno:'345-67-89012',type:'식품 도매',grade:'A',region:'경기 성남시',
   contact:'박지현',contactTitle:'영업부장',email:'order@premiumfood.kr',phone:'031-3456-7890',
   payTerms:30,credit:30000000,notes:''},
  {code:'CUS-004',name:'이마트 바이어스',bizno:'456-78-90123',type:'식품 소매/마트',grade:'A',region:'서울 중구',
   contact:'최영호',contactTitle:'바이어',email:'buyer@emart.com',phone:'02-4567-8901',
   payTerms:60,credit:80000000,notes:'PB상품 개발 관심'}
];

var products = [
  {code:'100123',nameKo:'5스타지오니 슈페리오레 (피자 밀가루)',nameIt:'5 Stagioni Superiore',unit:'10kg/SAC',pack:'1SAC / 5BOX',storage:'건조',hs:'1101001000',cat:'밀가루/제분',cert:'HACCP',buyEur:8.50,sellKrw:22000,supplierCode:'SUP-005',notes:'W300 강력분. 피자·포카치아 전용'},
  {code:'100124',nameKo:'5스타지오니 블루 (강력분)',nameIt:'5 Stagioni Blu',unit:'25kg/SAC',pack:'1SAC / 4BOX',storage:'건조',hs:'1101001000',cat:'밀가루/제분',cert:'HACCP',buyEur:18.00,sellKrw:52000,supplierCode:'SUP-005',notes:'W320 고강력분. 하드계 빵 전용'},
  {code:'200456',nameKo:'무티 파사타 디 포모도로 700ml',nameIt:'Mutti Passata di Pomodoro 700ml',unit:'700ml/BTL',pack:'12BTL / 1BOX',storage:'상온',hs:'2002901000',cat:'소스/조미료',cert:'',buyEur:1.80,sellKrw:5500,supplierCode:'SUP-003',notes:''},
  {code:'300789',nameKo:'무라글리아 EVOO 500ml',nameIt:'Muraglia EVOO 500ml',unit:'500ml/BTL',pack:'6BTL / 1BOX',storage:'상온',hs:'1509100000',cat:'올리브오일/오일류',cert:'DOP',buyEur:9.20,sellKrw:28000,supplierCode:'SUP-001',notes:'암포라 도자기 패키지. 깨짐 주의'},
  {code:'400012',nameKo:'파르미지아노 레지아노 DOP 1kg',nameIt:'Parmigiano Reggiano DOP 1kg',unit:'1kg/PCS',pack:'1PCS / 1BOX',storage:'냉장',hs:'0406201000',cat:'치즈/유제품',cert:'DOP',buyEur:14.00,sellKrw:42000,supplierCode:'SUP-004',notes:'냉장 운송 필수'}
];

var shipments = [
  {id:'IMP-2024-001',product:'Extra Virgin Olive Oil (EVOO) 500ml',supplierCode:'SUP-001',category:'올리브오일/오일류',qty:'1,000 BTL',amount:18500,eta:'2024-03-15',inco:'FOB',stage:3,hs:'1509100000',cert:'DOP, Bio',notes:'',pmCode:'300789',docs:[[true,true,false,false],[true,true,true,true,true,false],[true,false,false,false],[false,false,false,false,false,false],[],[],[]]},
  {id:'IMP-2024-002',product:'Parmigiano Reggiano DOP 1kg',supplierCode:'SUP-004',category:'치즈/유제품',qty:'200 PCS',amount:9800,eta:'2024-04-02',inco:'CIF',stage:1,hs:'0406201000',cert:'DOP',notes:'냉장 필수',pmCode:'400012',docs:[[true,true,true,true],[false,false,false,false,false,false],[],[],[],[],[]]},
  {id:'IMP-2024-003',product:'Barilla Spaghetti No.5 500g',supplierCode:'SUP-002',category:'파스타/곡물',qty:'2,000 PKG',amount:4200,eta:'2024-02-28',inco:'DAP',stage:5,hs:'1902110000',cert:'',notes:'',pmCode:'',docs:[[true,true,true,true],[true,true,true,true,false,true],[true,true,true,true],[true,true,true,true,true,true],[true,false,true,true],[],[]]},
  {id:'IMP-2024-004',product:'Mutti Passata 700ml',supplierCode:'SUP-003',category:'소스/조미료',qty:'500 BTL',amount:3100,eta:'2024-03-20',inco:'EXW',stage:2,hs:'2002901000',cert:'',notes:'방사능검사',pmCode:'200456',docs:[[true,true,true,false],[true,true,false,false,false,false],[],[],[],[],[]]},
  {id:'IMP-2024-005',product:'5 Stagioni Superiore (피자 밀가루) 10kg',supplierCode:'SUP-005',category:'밀가루/제분',qty:'200 SAC',amount:7200,eta:'2024-04-10',inco:'CIF',stage:0,hs:'1101001000',cert:'HACCP',notes:'',pmCode:'100123',docs:[[],[],[],[],[],[],[]]}
];

var sales = [
  {code:'ORD-2024-001',date:'2024-02-05',custCode:'CUS-001',status:'청구',items:[{pmCode:'300789',name:'무라글리아 EVOO 500ml',qty:50,price:28000},{pmCode:'200456',name:'무티 파사타 700ml',qty:100,price:5500}],dueDate:'2024-02-28',payDue:'2024-03-07',notes:''},
  {code:'ORD-2024-002',date:'2024-02-12',custCode:'CUS-002',status:'완료',items:[{pmCode:'400012',name:'파르미지아노 레지아노 1kg',qty:20,price:42000}],dueDate:'2024-02-20',payDue:'2024-03-13',notes:''},
  {code:'ORD-2024-003',date:'2024-02-20',custCode:'CUS-003',status:'수주',items:[{pmCode:'100123',name:'5스타지오니 슈페리오레 10kg',qty:10,price:22000}],dueDate:'2024-02-28',payDue:'2024-03-22',notes:''},
  {code:'ORD-2024-004',date:'2024-03-01',custCode:'CUS-001',status:'견적',items:[{pmCode:'300789',name:'무라글리아 EVOO 500ml',qty:100,price:27000}],dueDate:'2024-03-15',payDue:'2024-03-31',notes:''}
];

var payments = [
  {code:'PAY-2024-001',date:'2024-03-10',custCode:'CUS-002',saleCode:'ORD-2024-002',billed:840000,amount:840000,balance:0,method:'계좌이체',account:'신한 110-123-456789',status:'입금완료',notes:''},
  {code:'PAY-2024-002',date:'2024-03-12',custCode:'CUS-001',saleCode:'ORD-2024-001',billed:1950000,amount:1000000,balance:950000,method:'계좌이체',account:'신한 110-123-456789',status:'부분입금',notes:'잔금 3/31 예정'}
];

var emailLog = [
  {time:'2024-02-01 09:22',code:'IMP-2024-003',stage:'이동',subject:'[수입알림] IMP-2024-003 - 이동 단계',to:'korea@yourcompany.com',ch:['gmail']},
  {time:'2024-01-28 14:05',code:'IMP-2024-004',stage:'선적',subject:'[수입알림] IMP-2024-004 - 선적 단계',to:'korea@yourcompany.com',ch:['gmail','telegram']}
];

// ── HELPERS ────────────────────────────────────────────────
function el(id){ return document.getElementById(id); }
function setText(id,v){ var e=el(id); if(e) e.textContent=v; }
function sc(i){ return SC[i]||SC[0]; }
function pct(s){ return Math.round((s/6)*100); }
function fmtKrw(v){ return Math.round(v).toLocaleString('ko-KR')+'원'; }
function fmtEur(v){ return '€'+Number(v).toLocaleString('en',{minimumFractionDigits:0,maximumFractionDigits:0}); }
function today(){ return new Date().toISOString().slice(0,10); }
function nowStr(){ return new Date().toLocaleString('ko-KR').slice(0,16); }
function badge(i){ var c=sc(i); return '<span class="badge" style="background:'+c.bg+';color:'+c.t+';border:1px solid '+c.b+'">'+STAGES[i]+'</span>'; }
function statusBadge(s){ return '<span class="badge status-'+s+'">'+s+'</span>'; }
function gradeBadge(g){ return '<span class="grade-badge grade-'+g+'">'+g+'</span>'; }
function getSupplierName(code){ var s=suppliers.filter(function(x){return x.code===code;})[0]; return s?s.name:code||'—'; }
function getCustomerName(code){ var c=customers.filter(function(x){return x.code===code;})[0]; return c?c.name:code||'—'; }
function getProductName(code){ var p=products.filter(function(x){return x.code===code;})[0]; return p?p.nameKo:code||'—'; }
function getHsDisp(code){ var h=HS_DB.filter(function(x){return x.code===code;})[0]; return h?h.disp:code||'—'; }
function calcSaleAmounts(items){ var s=0; items.forEach(function(it){s+=it.qty*it.price;}); var v=Math.round(s*0.1); return{subtotal:s,vat:v,total:s+v}; }
function getOutstanding(saleCode){
  var sale=sales.filter(function(s){return s.code===saleCode;})[0]; if(!sale) return 0;
  var a=calcSaleAmounts(sale.items);
  var paid=payments.filter(function(p){return p.saleCode===saleCode;}).reduce(function(a,p){return a+p.amount;},0);
  return Math.max(0,a.total-paid);
}

// ── 전체 데이터 Notion으로 업로드 ─────────────────────────
function uploadAllData(){
  var btn = el('btn-upload-all');
  if(btn){ btn.disabled=true; btn.textContent='업로드 중... (시간이 걸립니다)'; }
  cloudStatus('saving');
  var data = {
    suppliers:suppliers, customers:customers, products:products,
    shipments:shipments, sales:sales, payments:payments, emailLog:emailLog,
    docAttachments: Object.keys(docAttachments).map(function(k){ return Object.assign({key:k},docAttachments[k]); })
  };
  var keys=Object.keys(data), done=0, allOk=true;
  keys.forEach(function(k){
    fetch('/api/notion?sheet='+k, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action:'save', sheet:k, data:data[k]})
    })
    .then(function(r){ return r.json(); })
    .then(function(res){
      if(!res.ok) allOk=false;
      if(++done===keys.length){
        cloudStatus(allOk?'ok':'error');
        var result=el('gas-test-result');
        if(result) result.textContent = allOk ? '✓ Notion 업로드 완료! 이탈리아에서 동기화 가능합니다.' : '✗ 일부 업로드 실패';
        if(btn){ btn.disabled=false; btn.textContent='전체 데이터 Notion으로 업로드'; }
        if(allOk) showToast('Notion 업로드 완료!');
      }
    })
    .catch(function(err){
      allOk=false;
      if(++done===keys.length){
        cloudStatus('error');
        if(btn){ btn.disabled=false; btn.textContent='전체 데이터 Notion으로 업로드'; }
        var result=el('gas-test-result');
        if(result) result.textContent='✗ 오류: '+err.message;
      }
    });
  });
}

// ── Notion 연동 유틸 ──────────────────────────────────────
function testGasConnection(){
  var res=el('gas-test-result'); if(res) res.textContent='테스트 중...';
  fetch('/api/notion?action=read&sheet=suppliers')
    .then(function(r){return r.json();})
    .then(function(d){ if(res) res.textContent = d.ok ? '✓ Notion 연결 성공! 항목: '+d.data.length+'개' : '✗ 오류: '+d.error; })
    .catch(function(e){ if(res) res.textContent='✗ 연결 실패: '+e.message; });
}
function syncNow(){
  loadData();
  showToast('Notion에서 데이터를 불러옵니다...');
}
function updateGasUrl(){
  var badge=el('cloud-badge');
  if(badge){ badge.textContent='✓ Notion 연동 활성'; badge.style.background='#e1f5ee'; badge.style.color='#0F6E56'; }
  var uploadBtn=el('btn-upload-all');
  if(uploadBtn) uploadBtn.disabled=false;
}

function showToast(msg){ var t=el('toast');t.textContent=msg;t.classList.add('show');setTimeout(function(){t.classList.remove('show');},2500); }
// ── 클라우드 상태 표시 ─────────────────────────────────
function cloudStatus(state){
  var el2=document.getElementById('cloud-status');
  if(!el2) return;
  var map={loading:{t:'☁ 불러오는 중...',c:'#BA7517'},saving:{t:'☁ 저장 중...',c:'#BA7517'},ok:{t:'☁ 동기화 완료 ✓',c:'#1D9E75'},error:{t:'☁ 연결 실패 — 로컬 저장됨',c:'#D85A30'}};
  var s=map[state]||map.ok;
  el2.textContent=s.t; el2.style.color=s.c; el2.style.opacity='1';
  if(state==='ok') setTimeout(function(){el2.style.opacity='0';},3000);
}
function showSaveInd(){ var s=el('save-ind');s.classList.add('show');setTimeout(function(){s.classList.remove('show');},2000); }
function closeM(id){ el(id).classList.remove('open'); }
function toggleSidebar(){ el('sidebar').classList.toggle('open'); }
function openQuickAdd(){ el('modal-quick').classList.add('open'); }
function openDriveHelp(){ el('modal-drive-help').classList.add('open'); }

// ── LOCALSTORAGE ───────────────────────────────────────────
function loadData(){
  // 언어·설정은 항상 로컬에서
  try{
    var lg=localStorage.getItem('fim5_lang'); if(lg) lang=lg;
    var st=localStorage.getItem('fim5_settings');
    if(st){ var s=JSON.parse(st); ['kr-email','it-email','cu-email','ex-email','tg-token','tg-chat'].forEach(function(id){var e=el(id);if(e&&s[id])e.value=s[id];}); }
  }catch(e){}

  if(USE_CLOUD){
    // Google Sheets에서 실시간 로드
    cloudStatus('loading');
    var keys=['suppliers','customers','products','shipments','sales','payments','emailLog','docAttachments'];
    var done=0;
    keys.forEach(function(k){
      fetch('/api/notion?sheet='+k)
        .then(function(r){return r.json();})
        .then(function(res){
          if(res.ok && res.data){
            if(k==='docAttachments'){
              docAttachments={};
              res.data.forEach(function(r){ if(r.key) docAttachments[r.key]=r; });
            } else { eval(k+'=res.data'); }
          }
          if(++done===keys.length){
            cloudStatus('ok');
            STAGES=I18N[lang].stagesArr; STAGE_DOCS=I18N[lang].stageDocs; FOOD_CATS=I18N[lang].foodCats;
            applyI18n(); renderDashboard(); renderTable(); renderNotif();
            populateHsSelects(); populateProcSels(); populatePmcSel();
          }
        }).catch(function(){ if(++done===keys.length) cloudStatus('error'); });
    });
  } else {
    // localStorage 폴백
    try{
      ['suppliers','customers','products','shipments','sales','payments','emailLog','docAttachments'].forEach(function(k){
        var v=localStorage.getItem('fim5_'+k); if(v) eval(k+'=JSON.parse(v)');
      });
    }catch(e){}
  }
}
function saveData(){
  // localStorage 백업 (항상)
  try{
    ['suppliers','customers','products','shipments','sales','payments','emailLog','docAttachments'].forEach(function(k){
      localStorage.setItem('fim5_'+k,JSON.stringify(eval(k)));
    });
    localStorage.setItem('fim5_lang',lang);
  }catch(e){}

  if(USE_CLOUD){
    // 디바운스 500ms — 연속 저장 방지
    clearTimeout(_syncTimer);
    _syncTimer = setTimeout(function(){
      showSaveInd();
      cloudStatus('saving');
      var data={
        suppliers:suppliers, customers:customers, products:products,
        shipments:shipments, sales:sales, payments:payments, emailLog:emailLog,
        docAttachments: Object.keys(docAttachments).map(function(k){ return Object.assign({key:k},docAttachments[k]); })
      };
      var sheetKeys=Object.keys(data), done=0, allOk=true;
      sheetKeys.forEach(function(k){
        fetch('/api/notion',{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({action:'save',sheet:k,data:data[k]})})
          .then(function(r){return r.json();})
          .then(function(res){ if(!res.ok) allOk=false; if(++done===sheetKeys.length) cloudStatus(allOk?'ok':'error'); })
          .catch(function(){ allOk=false; if(++done===sheetKeys.length) cloudStatus('error'); });
      });
    }, 500);
  } else {
    showSaveInd();
  }
}
function saveSettings(){
  try{ var s={}; ['kr-email','it-email','cu-email','ex-email','tg-token','tg-chat'].forEach(function(id){var e=el(id);if(e)s[id]=e.value;}); localStorage.setItem('fim5_settings',JSON.stringify(s)); }catch(e){}
}

// ── EXCHANGE RATES ─────────────────────────────────────────
function fetchRates(){
  var rs=el('rate-status'); if(rs) rs.textContent='업데이트 중...';
  fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json')
    .then(function(r){return r.json();})
    .then(function(d){
      if(d.eur&&d.eur.krw) rates.eurKrw=d.eur.krw;
      if(d.eur&&d.eur.usd){rates.eurUsd=d.eur.usd;rates.usdKrw=d.eur.krw/d.eur.usd;}
      updateRateUI(d.date||today());
      if(rs) rs.textContent='✓ 실시간';
    }).catch(function(){ updateRateUI('오프라인'); if(rs) rs.textContent='오프라인'; });
}
function updateRateUI(dt){
  var fmt=function(v){return v.toLocaleString('ko-KR',{minimumFractionDigits:0,maximumFractionDigits:0});};
  setText('sb-rate-val',fmt(rates.eurKrw)); setText('sb-rate-sub',dt);
  setText('rate-eur-krw',fmt(rates.eurKrw)); setText('rate-date',dt);
  setText('rate-usd-krw',fmt(rates.usdKrw)); setText('rate-eur-usd',rates.eurUsd.toFixed(4));
}

// ── LANGUAGE ───────────────────────────────────────────────
// ── I18N 번역 테이블 ──────────────────────────────────────────
var I18N = {
ko:{
  sbname:'직수입 관리',
  ns:['대시보드','마스터 관리','마스터 관리','마스터 관리','수입 관리','수입 관리','수입 관리','수입 관리','영업/재무','영업/재무','설정','설정'],
  nl:{dashboard:'대시보드',products:'상품 마스터',suppliers:'해외 협력사',customers:'고객 마스터',shipments:'수입 목록',process:'프로세스 관리',documents:'서류 관리',hscode:'HS코드/관세율',sales:'매출 관리',payments:'입금 관리',notifications:'알림 설정',emaillog:'발송 로그'},
  gmailLbl:'Gmail 연동 준비됨',
  btnExcel:'⬇ Excel 수출', btnNew:'+ 신규 등록',
  pageTitle:{dashboard:'대시보드',products:'상품 마스터',suppliers:'해외 협력사',customers:'고객 마스터',shipments:'수입 목록',process:'프로세스 관리',documents:'서류 관리 (Google Drive 연동)',hscode:'HS코드 / 관세율 조회 (10자리)',sales:'매출 관리',payments:'입금 관리',notifications:'알림 설정',emaillog:'발송 로그'},
  baserate:'기준환율', crossrate:'크로스환율', rateRefresh:'↻ 환율 갱신',
  pipeTitle:'수입 단계별 현황',
  lblRecent:'최근 수입 건', lblAr:'미수금 현황', lblAlerts:'식품 규정 알림',
  thCode:'코드', thProd:'상품명', thSupp:'공급업체', thCat:'분류', thKrw:'KRW(환산)', thStage:'단계', thProg:'진행',
  thOrdno:'주문번호', thOrddate:'주문일', thCustco:'고객사', thItem:'상품명', thQty:'수량', thSupply:'공급가액', thTotal:'합계', thSaleStatus:'상태', thAr:'미수금',
  thPayno:'입금번호', thPaydate:'입금일', thPaycust:'고객사', thLinkord:'연결주문', thBilled:'청구금액', thPaid:'입금금액', thBalance:'잔액', thMethod:'입금방법', thPaystatus:'상태',
  btnNewSale:'+ 매출 등록', btnNewPay:'+ 입금 등록',
  searchPm:'코드/상품명 검색...', searchSup:'업체명/국가 검색...', searchCust:'업체명/담당자 검색...', searchShip:'코드/상품 검색...', searchSales:'주문번호/고객/상품...', searchPay:'고객/입금번호...', searchHs:'HS코드 또는 품목 검색...',
  hsTitle:'식품 HS코드 관세율 DB (한국 10자리 기준)',
  hsSub:'국제 6자리 + 한국 고유 4자리 = 10자리 | 관세청 UNIPASS 기준',
  calcTitle:'💰 관세 자동 계산기',
  calcL1:'과세가격 (EUR)', calcL2:'HS코드 (10자리)', calcL3:'과세가격 (KRW)', calcBtn:'계산',
  hscols:['HS코드(10자리)','한국 품목명','이탈리아어명','기본관세율','한-EU FTA세율','부가세','검역','비고'],
  hsNote:'⚠ 위 세율은 참고용입니다. 정확한 세율은 관세청 UNIPASS 또는 관세사를 통해 확인하세요.',
  docBannerTitle:'Google Drive 연동 서류 관리',
  docBannerDesc:'서류를 Google Drive에 업로드 후 링크 등록 — 한국·이탈리아 양쪽 팀 동시 접근',
  docBannerBtn:'연동 방법 안내', docHint:'왼쪽에서 수입 건을 선택하세요',
  notifRecip:'수신자 설정', notifTg:'텔레그램 설정', notifStages:'단계별 알림 설정',
  lKr:'한국 사무실', lIt:'이탈리아 사무소', lCu:'통관/물류 담당', lEx:'추가 수신자',
  btnTestTg:'텔레그램 테스트', btnSave:'저장',
  mqTitle:'빠른 등록',
  qb:['📦 수입 건 등록','🏷 상품 마스터 등록','🌍 해외 협력사 등록','👥 고객 등록','💰 매출 등록','🏦 입금 등록'],
  mnTitle:'신규 수입 등록', mnBasic:'기본 정보', mnFood:'식품 분류', mnEmailPrev:'📧 등록 알림 미리보기',
  lImp:['수입 코드 (자동채번)','상품 마스터 코드','상품명 *','공급업체','수량','금액 (EUR)','예상 입항일','인코텀즈','HS 코드 (10자리)','인증서','비고'],
  kpLabels:['계약금액 (EUR)','적용 환율','예상 관세율 (기본)','원화 환산'],
  mnSubmit:'등록 + Gmail 발송',
  pmRefTitle:'📋 기존 마스터 참조하여 생성', pmRefApply:'참조 복사', pmRefClear:'초기화',
  pmS:['식별 정보','규격 정보','가격 정보','비고'],
  pmL:['관리 코드 *','상품명 (한국어) *','상품명 (이탈리아어)','단위','포장단위','보관 방법','HS 코드 (10자리)','카테고리','인증서','매입단가 (EUR)','권장 판매가 (KRW)','주요 공급업체'],
  mpTitleNew:'상품 마스터 등록', mpTitleEdit:'상품 수정',
  storagOpts:['상온','냉장 (0~10°C)','냉동 (-18°C이하)','건조 창고'],
  supS:['기본 정보','연락처','거래 조건','비고'],
  supL:['업체 코드 *','업체명 (현지어) *','업체명 (한국어)','국가','도시/지역','업종','담당자','직함','이메일','전화번호','웹사이트','결제 조건','거래 통화','MOQ','리드타임 (일)','주요 인증','거래 등급'],
  msupTitleNew:'해외 협력사 등록', msupTitleEdit:'협력사 수정',
  supTypes:['올리브오일 생산자','치즈/유제품 생산자','파스타/밀가루 생산자','소스/가공식품 생산자','와인 생산자','커피 생산자','종합 식품 제조사','무역상/에이전트','기타'],
  supPayments:['T/T (전신환)','L/C (신용장)','D/P','D/A','Open Account'],
  supGrades:['A (우수)','B (양호)','C (보통)','신규'],
  custS:['기본 정보','담당자 정보','거래 조건'],
  custL:['고객 코드 *','업체명 *','사업자번호','업종','고객 등급','지역','담당자 이름','직함','이메일','전화번호','결제 조건 (일)','신용한도 (KRW)'],
  mcustTitleNew:'고객 등록', mcustTitleEdit:'고객 수정',
  custTypes:['음식점/레스토랑','호텔/리조트','식품 도매','식품 소매/마트','온라인 쇼핑몰','급식/케이터링','식품 제조업','기타'],
  saleS:['주문 정보','상품 정보','결제/배송'],
  saleL:['주문번호 (자동채번)','주문일 *','고객사 *','상태','납기일','결제 기한','비고'],
  saleTotals:['공급가액 소계','부가세 (10%)','합계 금액'],
  saleAddItem:'+ 상품 추가',
  msaleTitleNew:'매출 등록', msaleTitleEdit:'주문 수정',
  saleStatuses:['견적','수주','출고','청구','완료','취소'],
  payL:['입금번호 (자동채번)','입금일 *','고객사 *','연결 주문','청구금액','입금금액 *','잔액','입금방법','입금 계좌','상태'],
  mpayTitleNew:'입금 등록',
  payMethods:['계좌이체','현금','카드','어음','기타'],
  payStatuses:['입금완료','부분입금','미수','연체'],
  stageCancel:'취소', stageAdv:'진행 + Gmail 발송',
  dlS1:'서류 정보', dlLName:'서류명', dlLType:'서류 유형',
  dlGdriveTitle:'☁ Google Drive 링크 (권장)', dlGdriveLbl:'Google Drive 공유 링크', dlGdriveHint:'Drive에서 파일 → 공유 → 링크 복사 → 붙여넣기',
  dlFileTitle:'📁 로컬 파일 첨부 (소용량 권장)', dlFileHint:'PDF, JPG, PNG, Excel, Word · 최대 10MB',
  dlLNotes:'비고', dlLIssued:'발급일', dlLExpires:'만료일 (해당시)',
  dlTypes:['계약서/PI','선하증권 B/L','상업송장 CI','패킹리스트','원산지증명서 CO','식품위생증명서','수입신고서','식품검역증','성분분석표 CoA','라벨링 확인서','기타'],
  dhTitle:'Google Drive 연동 안내',
  cancel:'취소', save:'저장', allStages:'전체 단계', allStatuses:'전체 상태',
  pmCats:['올리브오일/오일류','밀가루/제분','와인/주류','치즈/유제품','파스타/곡물','소스/조미료','통조림/가공품','스낵/과자류','커피/차','유기농/프리미엄','기타'],
  stagesArr:['계약','선적','입항','통관','이동','판매','완료'],
  foodCats:['올리브오일/오일류','밀가루/제분','와인/주류','치즈/유제품','파스타/곡물','소스/조미료','통조림/가공품','스낵/과자류','커피/차','유기농/프리미엄','기타 식품'],
  stageDocs:[['계약서 (PI)','신용장(L/C) 또는 T/T','수출입 라이센스','서명 계약서'],['선하증권 (B/L)','패킹 리스트','상업송장 (CI)','원산지증명서 (CO)','식품위생증명서','수출신고필증'],['수입신고 준비서류','Arrival Notice','화물 도착 통보서','방사능 검사증명서'],['수입신고서 (수리필증)','관부가세 세금계산서','식품검역증 (검역소)','식품안전검사서 (식약처)','라벨링 검토확인서','성분분석표 (CoA)'],['창고 입고확인서','냉장/냉동 온도기록지','운송의뢰서','Delivery Order (D/O)'],['세금계산서 (판매용)','거래명세서','식품이력추적 등록확인서','유통기한 확인서'],['최종정산서','클레임 처리결과','수입실적 보고서','종결보고서']],
  alertMsgs:[{t:'d',m:'IMP-2024-004 — 방사능 검사 서류 기한 3일 남음'},{t:'w',m:'IMP-2024-002 — 식품 라벨링 미달 (한글 표시사항 누락)'},{t:'ok',m:'IMP-2024-003 — 식품 검역 통과 완료'}]
},
en:{
  sbname:'Import Manager',
  ns:['Dashboard','Master Data','Master Data','Master Data','Import','Import','Import','Import','Sales/Finance','Sales/Finance','Settings','Settings'],
  nl:{dashboard:'Dashboard',products:'Product Master',suppliers:'Suppliers',customers:'Customers',shipments:'Imports',process:'Process',documents:'Documents',hscode:'HS Code/Tariff',sales:'Sales',payments:'Payments',notifications:'Notifications',emaillog:'Email Log'},
  gmailLbl:'Gmail Ready',
  btnExcel:'⬇ Export Excel', btnNew:'+ New',
  pageTitle:{dashboard:'Dashboard',products:'Product Master',suppliers:'Suppliers',customers:'Customer Master',shipments:'Import List',process:'Process Management',documents:'Document Management (Google Drive)',hscode:'HS Code / Tariff (10-digit)',sales:'Sales Management',payments:'Payment Management',notifications:'Notifications',emaillog:'Email Log'},
  baserate:'Base Rate', crossrate:'Cross Rate', rateRefresh:'↻ Refresh Rates',
  pipeTitle:'Import Stage Overview',
  lblRecent:'Recent Imports', lblAr:'Accounts Receivable', lblAlerts:'Food Compliance Alerts',
  thCode:'Code', thProd:'Product', thSupp:'Supplier', thCat:'Category', thKrw:'KRW (Est.)', thStage:'Stage', thProg:'Progress',
  thOrdno:'Order No.', thOrddate:'Date', thCustco:'Customer', thItem:'Product', thQty:'Qty', thSupply:'Supply Amt', thTotal:'Total', thSaleStatus:'Status', thAr:'AR',
  thPayno:'Pay No.', thPaydate:'Date', thPaycust:'Customer', thLinkord:'Order Ref', thBilled:'Billed', thPaid:'Paid', thBalance:'Balance', thMethod:'Method', thPaystatus:'Status',
  btnNewSale:'+ New Sale', btnNewPay:'+ New Payment',
  searchPm:'Code/product name...', searchSup:'Company/country...', searchCust:'Company/contact...', searchShip:'Code/product...', searchSales:'Order/customer/product...', searchPay:'Customer/payment no...', searchHs:'HS code or product...',
  hsTitle:'Food HS Code Tariff DB (Korea 10-digit)',
  hsSub:'International 6-digit + Korea 4-digit = 10-digit | Korea Customs UNIPASS',
  calcTitle:'💰 Auto Tariff Calculator',
  calcL1:'Customs Value (EUR)', calcL2:'HS Code (10-digit)', calcL3:'Customs Value (KRW)', calcBtn:'Calculate',
  hscols:['HS Code (10-digit)','Korean Description','Italian Name','Basic Tariff','Korea-EU FTA','VAT','Quarantine','Notes'],
  hsNote:'⚠ For reference only. Verify with Korea Customs UNIPASS or a customs broker.',
  docBannerTitle:'Google Drive Document Management',
  docBannerDesc:'Upload to Google Drive, register link — Korea & Italy offices both access',
  docBannerBtn:'How to Connect', docHint:'Select an import on the left',
  notifRecip:'Email Recipients', notifTg:'Telegram Setup', notifStages:'Stage Notification Settings',
  lKr:'Korea Office', lIt:'Italy Office', lCu:'Customs/Logistics', lEx:'Additional Recipients',
  btnTestTg:'Send Test Telegram', btnSave:'Save',
  mqTitle:'Quick Register',
  qb:['📦 New Import','🏷 New Product','🌍 New Supplier','👥 New Customer','💰 New Sale','🏦 New Payment'],
  mnTitle:'New Import', mnBasic:'Basic Info', mnFood:'Food Category', mnEmailPrev:'📧 Email Preview',
  lImp:['Import Code (Auto)','Product Master Code','Product Name *','Supplier','Quantity','Amount (EUR)','Expected Arrival','Incoterms','HS Code (10-digit)','Certifications','Notes'],
  kpLabels:['Contract Amount (EUR)','Applied Rate','Est. Tariff (Basic)','KRW Equivalent'],
  mnSubmit:'Register + Send Gmail',
  pmRefTitle:'📋 Create from Existing Reference', pmRefApply:'Copy Reference', pmRefClear:'Reset',
  pmS:['Identity','Specifications','Pricing','Notes'],
  pmL:['Code *','Product Name (Korean) *','Product Name (Italian)','Unit','Pack Unit','Storage','HS Code (10-digit)','Category','Certifications','Purchase Price (EUR)','Selling Price (KRW)','Main Supplier'],
  mpTitleNew:'New Product Master', mpTitleEdit:'Edit Product',
  storagOpts:['Ambient','Cold (0~10°C)','Frozen (-18°C)','Dry Storage'],
  supS:['Basic Info','Contact','Terms','Notes'],
  supL:['Supplier Code *','Company Name *','Korean Name','Country','City/Region','Business Type','Contact Person','Title','Email','Phone','Website','Payment Terms','Currency','MOQ','Lead Time (days)','Certifications','Rating'],
  msupTitleNew:'New Supplier', msupTitleEdit:'Edit Supplier',
  supTypes:['Olive Oil Producer','Cheese/Dairy Producer','Pasta/Flour Producer','Sauce Producer','Wine Producer','Coffee Producer','Food Manufacturer','Trader/Agent','Other'],
  supPayments:['T/T (Wire Transfer)','L/C (Letter of Credit)','D/P','D/A','Open Account'],
  supGrades:['A (Excellent)','B (Good)','C (Fair)','New'],
  custS:['Basic Info','Contact','Terms'],
  custL:['Customer Code *','Company Name *','Business No.','Business Type','Grade','Region','Contact Person','Title','Email','Phone','Payment Terms (days)','Credit Limit (KRW)'],
  mcustTitleNew:'New Customer', mcustTitleEdit:'Edit Customer',
  custTypes:['Restaurant','Hotel/Resort','Food Wholesale','Retail/Mart','Online Shop','Catering','Food Manufacturer','Other'],
  saleS:['Order Info','Items','Delivery/Payment'],
  saleL:['Order No. (Auto)','Order Date *','Customer *','Status','Delivery Date','Payment Due','Notes'],
  saleTotals:['Subtotal','VAT (10%)','Total Amount'],
  saleAddItem:'+ Add Item',
  msaleTitleNew:'New Sale', msaleTitleEdit:'Edit Order',
  saleStatuses:['Quote','Order','Shipped','Invoiced','Complete','Cancelled'],
  payL:['Payment No. (Auto)','Date *','Customer *','Linked Order','Billed Amount','Payment Amount *','Balance','Method','Account','Status'],
  mpayTitleNew:'New Payment',
  payMethods:['Wire Transfer','Cash','Card','Note','Other'],
  payStatuses:['Paid','Partial Payment','Outstanding','Overdue'],
  stageCancel:'Cancel', stageAdv:'Advance + Send Gmail',
  dlS1:'Document Info', dlLName:'Document Name', dlLType:'Document Type',
  dlGdriveTitle:'☁ Google Drive Link (Recommended)', dlGdriveLbl:'Google Drive Share Link', dlGdriveHint:'Drive → File → Share → Copy Link → Paste here',
  dlFileTitle:'📁 Local File Attachment', dlFileHint:'PDF, JPG, PNG, Excel, Word · Max 10MB',
  dlLNotes:'Notes', dlLIssued:'Issue Date', dlLExpires:'Expiry Date',
  dlTypes:['Contract/PI','Bill of Lading B/L','Commercial Invoice CI','Packing List','Certificate of Origin CO','Health Certificate','Import Declaration','Phytosanitary Cert','CoA','Label Review','Other'],
  dhTitle:'Google Drive Integration Guide',
  cancel:'Cancel', save:'Save', allStages:'All Stages', allStatuses:'All Statuses',
  pmCats:['Olive Oil/Oils','Flour/Milling','Wine/Spirits','Cheese/Dairy','Pasta/Grains','Sauces','Canned/Processed','Snacks','Coffee/Tea','Organic/Premium','Other'],
  stagesArr:['Contract','Shipment','Arrival','Customs','Transport','Sales','Complete'],
  foodCats:['Olive Oil/Oils','Flour/Milling','Wine/Spirits','Cheese/Dairy','Pasta/Grains','Sauces','Canned/Processed','Snacks','Coffee/Tea','Organic/Premium','Other Food'],
  stageDocs:[['Contract (PI)','L/C or T/T Confirmation','Import/Export License','Signed Contract'],['Bill of Lading (B/L)','Packing List','Commercial Invoice','Certificate of Origin','Health Certificate','Export Declaration'],['Import Declaration Docs','Arrival Notice','Cargo Arrival Notification','Radiation Test Certificate'],['Import Declaration (Approved)','Duty/VAT Invoice','Phytosanitary Certificate','Food Safety Report (MFDS)','Label Review','Certificate of Analysis (CoA)'],['Warehouse Receipt','Cold Chain Log','Transport Order','Delivery Order (D/O)'],['Sales Invoice','Transaction Statement','Food Traceability Registration','Expiry Date Confirmation'],['Final Settlement','Claim Resolution','Import Performance Report','Closure Report']],
  alertMsgs:[{t:'d',m:'IMP-2024-004 — Radiation test deadline in 3 days'},{t:'w',m:'IMP-2024-002 — Labeling non-compliant (Korean label missing)'},{t:'ok',m:'IMP-2024-003 — Food quarantine inspection passed'}]
},
it:{
  sbname:'Gestione Import',
  ns:['Dashboard','Dati Master','Dati Master','Dati Master','Importazione','Importazione','Importazione','Importazione','Vendite/Finanza','Vendite/Finanza','Impostazioni','Impostazioni'],
  nl:{dashboard:'Dashboard',products:'Master Prodotti',suppliers:'Fornitori',customers:'Clienti',shipments:'Importazioni',process:'Processo',documents:'Documenti',hscode:'Codice HS/Dazi',sales:'Vendite',payments:'Pagamenti',notifications:'Notifiche',emaillog:'Log Email'},
  gmailLbl:'Gmail Pronta',
  btnExcel:'⬇ Esporta Excel', btnNew:'+ Nuovo',
  pageTitle:{dashboard:'Dashboard',products:'Master Prodotti',suppliers:'Fornitori',customers:'Master Clienti',shipments:'Lista Importazioni',process:'Gestione Processo',documents:'Gestione Documenti (Google Drive)',hscode:'Codice HS / Dazi (10 cifre)',sales:'Gestione Vendite',payments:'Gestione Pagamenti',notifications:'Notifiche',emaillog:'Log Email'},
  baserate:'Tasso Base', crossrate:'Tasso Incrociato', rateRefresh:'↻ Aggiorna Tassi',
  pipeTitle:'Panoramica Fasi Import',
  lblRecent:'Importazioni Recenti', lblAr:'Crediti in Sospeso', lblAlerts:'Avvisi Conformità Alimentare',
  thCode:'Codice', thProd:'Prodotto', thSupp:'Fornitore', thCat:'Categoria', thKrw:'KRW (Stima)', thStage:'Fase', thProg:'Progresso',
  thOrdno:'N. Ordine', thOrddate:'Data', thCustco:'Cliente', thItem:'Prodotto', thQty:'Qtà', thSupply:'Imponibile', thTotal:'Totale', thSaleStatus:'Stato', thAr:'Crediti',
  thPayno:'N. Pagam.', thPaydate:'Data', thPaycust:'Cliente', thLinkord:'Ordine Rif.', thBilled:'Fatturato', thPaid:'Pagato', thBalance:'Saldo', thMethod:'Metodo', thPaystatus:'Stato',
  btnNewSale:'+ Nuova Vendita', btnNewPay:'+ Nuovo Pagamento',
  searchPm:'Codice/nome prodotto...', searchSup:'Azienda/paese...', searchCust:'Azienda/referente...', searchShip:'Codice/prodotto...', searchSales:'Ordine/cliente/prodotto...', searchPay:'Cliente/N. pagamento...', searchHs:'Codice HS o prodotto...',
  hsTitle:'DB Codici HS Alimentari (10 cifre Corea)',
  hsSub:'6 internazionali + 4 coreane = 10 cifre | UNIPASS Dogane Corea',
  calcTitle:'💰 Calcolatore Dazi Automatico',
  calcL1:'Valore Doganale (EUR)', calcL2:'Codice HS (10 cifre)', calcL3:'Valore Doganale (KRW)', calcBtn:'Calcola',
  hscols:['Codice HS (10 cifre)','Descrizione Coreana','Nome Italiano','Dazio Base','Corea-UE FTA','IVA','Quarantena','Note'],
  hsNote:'⚠ Indicativo. Verificare con UNIPASS o uno spedizioniere doganale.',
  docBannerTitle:'Gestione Documenti Google Drive',
  docBannerDesc:"Carica su Google Drive e registra il link — accessibile da ufficio Corea e Italia",
  docBannerBtn:'Come Collegare', docHint:"Seleziona un'importazione a sinistra",
  notifRecip:'Destinatari Email', notifTg:'Configurazione Telegram', notifStages:'Notifiche per Fase',
  lKr:'Ufficio Corea', lIt:'Ufficio Italia', lCu:'Dogana/Logistica', lEx:'Destinatari Aggiuntivi',
  btnTestTg:'Invia Test Telegram', btnSave:'Salva',
  mqTitle:'Registrazione Rapida',
  qb:['📦 Nuova Importazione','🏷 Nuovo Prodotto','🌍 Nuovo Fornitore','👥 Nuovo Cliente','💰 Nuova Vendita','🏦 Nuovo Pagamento'],
  mnTitle:'Nuova Importazione', mnBasic:'Informazioni Base', mnFood:'Categoria Alimentare', mnEmailPrev:'📧 Anteprima Email',
  lImp:['Codice (Auto)','Codice Master Prodotto','Nome Prodotto *','Fornitore','Quantità','Importo (EUR)','Data Arrivo Prevista','Incoterms','Codice HS (10 cifre)','Certificazioni','Note'],
  kpLabels:['Importo Contratto (EUR)','Tasso Applicato','Dazio Previsto (Base)','Equivalente KRW'],
  mnSubmit:'Registra + Invia Gmail',
  pmRefTitle:'📋 Crea da Riferimento Esistente', pmRefApply:'Copia Riferimento', pmRefClear:'Azzera',
  pmS:['Identificazione','Specifiche','Prezzi','Note'],
  pmL:['Codice *','Nome (coreano) *','Nome (italiano)','Unità','Imballo','Conservazione','Codice HS (10 cifre)','Categoria','Certificazioni','Prezzo Acquisto (EUR)','Prezzo Vendita (KRW)','Fornitore Principale'],
  mpTitleNew:'Nuovo Master Prodotto', mpTitleEdit:'Modifica Prodotto',
  storagOpts:['Temperatura Ambiente','Refrigerato (0~10°C)','Congelato (-18°C)','Magazzino Secco'],
  supS:['Informazioni Base','Contatti','Condizioni','Note'],
  supL:['Codice Fornitore *','Ragione Sociale *','Nome Coreano','Paese','Città/Regione','Tipo','Referente','Qualifica','Email','Telefono','Sito Web','Condizioni Pagamento','Valuta','MOQ','Lead Time (giorni)','Certificazioni','Valutazione'],
  msupTitleNew:'Nuovo Fornitore', msupTitleEdit:'Modifica Fornitore',
  supTypes:["Prod. Olio d'Oliva",'Prod. Formaggi','Prod. Pasta/Farine','Prod. Salse','Prod. Vino','Prod. Caffè','Industria Alimentare','Agente/Trader','Altro'],
  supPayments:['T/T (Bonifico)','L/C (Lettera di Credito)','D/P','D/A','Open Account'],
  supGrades:['A (Eccellente)','B (Buono)','C (Discreto)','Nuovo'],
  custS:['Informazioni Base','Contatti','Condizioni'],
  custL:['Codice Cliente *','Ragione Sociale *','P.IVA/C.F.','Tipo','Categoria','Regione','Referente','Qualifica','Email','Telefono','Termini Pagamento (giorni)','Fido (KRW)'],
  mcustTitleNew:'Nuovo Cliente', mcustTitleEdit:'Modifica Cliente',
  custTypes:['Ristorante','Hotel/Resort','Ingrosso Alimentare','Dettaglio/Supermercato','E-commerce','Catering','Industria Alimentare','Altro'],
  saleS:['Info Ordine','Articoli','Consegna/Pagamento'],
  saleL:['N. Ordine (Auto)','Data Ordine *','Cliente *','Stato','Data Consegna','Scadenza Pagamento','Note'],
  saleTotals:['Imponibile','IVA (10%)','Totale'],
  saleAddItem:'+ Aggiungi Articolo',
  msaleTitleNew:'Nuova Vendita', msaleTitleEdit:'Modifica Ordine',
  saleStatuses:['Preventivo','Ordine','Spedito','Fatturato','Completato','Annullato'],
  payL:['N. Pagamento (Auto)','Data *','Cliente *','Ordine Collegato','Fatturato','Importo Pagato *','Saldo','Metodo','Conto','Stato'],
  mpayTitleNew:'Nuovo Pagamento',
  payMethods:['Bonifico','Contanti','Carta','Cambiale','Altro'],
  payStatuses:['Pagato','Pagamento Parziale','In Sospeso','Scaduto'],
  stageCancel:'Annulla', stageAdv:'Avanza + Invia Gmail',
  dlS1:'Info Documento', dlLName:'Nome Documento', dlLType:'Tipo Documento',
  dlGdriveTitle:'☁ Link Google Drive (Consigliato)', dlGdriveLbl:'Link di Condivisione Google Drive', dlGdriveHint:'Drive → File → Condividi → Copia link → Incolla qui',
  dlFileTitle:'📁 Allegato File Locale', dlFileHint:'PDF, JPG, PNG, Excel, Word · Max 10MB',
  dlLNotes:'Note', dlLIssued:'Data Emissione', dlLExpires:'Data Scadenza',
  dlTypes:['Contratto/PI','Polizza di Carico B/L','Fattura Commerciale CI','Packing List','Certificato di Origine CO','Certificato Sanitario','Dichiarazione Doganale','Cert. Fitosanitario','CoA','Conferma Etichette','Altro'],
  dhTitle:'Guida Integrazione Google Drive',
  cancel:'Annulla', save:'Salva', allStages:'Tutte le Fasi', allStatuses:'Tutti gli Stati',
  pmCats:["Olio d'Oliva",'Farine','Vino','Formaggi','Pasta','Salse','Conserve','Snack','Caffe','Bio/Premium','Altro'],
  stagesArr:['Contratto','Spedizione','Arrivo','Dogana','Trasporto','Vendita','Completato'],
  foodCats:["Olio d'Oliva",'Farine','Vino','Formaggi','Pasta','Salse','Conserve','Snack','Caffe','Bio/Premium','Altro Alimentare'],
  stageDocs:[['Contratto (PI)','Conferma L/C o T/T','Licenza Import/Export','Contratto Firmato'],['Polizza di Carico (B/L)','Packing List','Fattura Commerciale','Certificato di Origine','Certificato Sanitario','Dichiarazione Esportazione'],['Documenti Dichiarazione Import','Arrival Notice','Notifica Arrivo Merce','Certificato Test Radioattivita'],['Dichiarazione Doganale (Approvata)','Fattura Dazi/IVA','Certificato Fitosanitario','Rapporto Sicurezza Alimentare','Conferma Etichette','Certificato di Analisi (CoA)'],['Ricevuta Magazzino','Registro Temperatura','Ordine di Trasporto','Delivery Order (D/O)'],['Fattura Vendita','Estratto Conto','Registrazione Tracciabilita','Conferma Scadenza'],['Regolamento Finale','Risoluzione Reclami','Report Performance Import','Rapporto di Chiusura']],
  alertMsgs:[{t:'d',m:'IMP-2024-004 — Scadenza test radioattivita tra 3 giorni'},{t:'w',m:'IMP-2024-002 — Etichettatura non conforme'},{t:'ok',m:'IMP-2024-003 — Quarantena alimentare superata'}]
}
};

// ── 언어 변경 및 전체 UI 재적용 ────────────────────────────
function setLang(l){
  lang=l;
  STAGES=I18N[l].stagesArr;
  STAGE_DOCS=I18N[l].stageDocs;
  FOOD_CATS=I18N[l].foodCats;
  document.querySelectorAll('.lb').forEach(function(b){b.classList.toggle('active',b.textContent.trim()==={ko:'한국어',en:'EN',it:'IT'}[l]);});
  localStorage.setItem('fim5_lang',l);
  applyI18n();
  renderAll();
  showToast(l==='ko'?'한국어로 변경됨':l==='en'?'Switched to English':'Cambiato in italiano');
}

function applyI18n(){
  var L=I18N[lang]; if(!L) return;
  // 사이드바 그룹 제목 (.ns 순서대로)
  var nsEls=document.querySelectorAll('.ns');
  nsEls.forEach(function(e,i){if(L.ns[i])e.textContent=L.ns[i];});
  // 네비 링크 텍스트
  Object.keys(L.nl).forEach(function(k){setText('nl-'+k,L.nl[k]);});
  setText('sb-name',L.sbname);
  setText('g-lbl',L.gmailLbl);
  // 상단바
  setText('t-btn-excel',L.btnExcel);
  setText('t-btn-new',L.btnNew);
  setText('page-title',(L.pageTitle||{})[page]||page);
  // 환율바
  setText('t-baserate',L.baserate);
  setText('t-crossrate',L.crossrate);
  setText('t-rate-refresh',L.rateRefresh);
  // 대시보드
  setText('t-pipe-title',L.pipeTitle);
  setText('t-lbl-recent',L.lblRecent);
  setText('t-lbl-ar',L.lblAr);
  setText('t-lbl-alerts',L.lblAlerts);
  // 수입 목록 테이블 헤더
  ['thCode','thProd','thSupp','thCat','thKrw','thStage','thProg'].forEach(function(k){setText('t-'+k,L[k]);});
  // 매출 테이블 헤더
  ['thOrdno','thOrddate','thCustco','thItem','thQty','thSupply','thTotal','thSaleStatus','thAr'].forEach(function(k){setText('t-'+k,L[k]);});
  // 입금 테이블 헤더
  ['thPayno','thPaydate','thPaycust','thLinkord','thBilled','thPaid','thBalance','thMethod','thPaystatus'].forEach(function(k){setText('t-'+k,L[k]);});
  // 버튼
  setText('t-btn-new-sale',L.btnNewSale);
  setText('t-btn-new-pay',L.btnNewPay);
  // 코드 인덱스 패널 버튼
  setText('t-ci-add-pm','+ '+L.nl.products);
  setText('t-ci-add-sup','+ '+L.nl.suppliers);
  setText('t-ci-add-cust','+ '+L.nl.customers);
  // 검색창 placeholder
  var ph={['pm-search']:L.searchPm,['sup-search']:L.searchSup,['cust-search']:L.searchCust,['sq']:L.searchShip,['sales-search']:L.searchSales,['pay-search']:L.searchPay,['hs-search']:L.searchHs};
  Object.keys(ph).forEach(function(id){var e=el(id);if(e)e.placeholder=ph[id];});
  // 필터 드롭다운 재빌드
  var sf=el('fs');
  if(sf){var sv=sf.value;sf.innerHTML='<option value="">'+L.allStages+'</option>'+L.stagesArr.map(function(n,i){return '<option value="'+i+'">'+n+'</option>';}).join('');sf.value=sv;}
  var ssf=el('sales-status-filter');
  if(ssf){var sv2=ssf.value;ssf.innerHTML='<option value="">'+L.allStatuses+'</option>'+L.saleStatuses.map(function(s){return '<option value="'+s+'">'+s+'</option>';}).join('');try{ssf.value=sv2;}catch(e){}}
  var psf=el('pay-status-filter');
  if(psf){var sv3=psf.value;psf.innerHTML='<option value="">'+L.allStatuses+'</option>'+L.payStatuses.map(function(s){return '<option value="'+s+'">'+s+'</option>';}).join('');try{psf.value=sv3;}catch(e){}}
  // HS코드 패널
  setText('t-hs-title',L.hsTitle); setText('t-hs-sub',L.hsSub);
  setText('t-calc-title',L.calcTitle); setText('t-calc-l1',L.calcL1); setText('t-calc-l2',L.calcL2); setText('t-calc-l3',L.calcL3); setText('t-calc-btn',L.calcBtn);
  (L.hscols||[]).forEach(function(txt,i){setText('t-hsc'+(i+1),txt);});
  setText('t-hs-note',L.hsNote);
  // 서류 관리 배너
  setText('t-doc-title',L.docBannerTitle); setText('t-doc-desc',L.docBannerDesc); setText('t-doc-btn',L.docBannerBtn); setText('t-doc-hint',L.docHint);
  // 알림 설정
  setText('t-notif-recip',L.notifRecip); setText('t-notif-tg',L.notifTg); setText('t-notif-stages',L.notifStages);
  setText('t-lbl-kr',L.lKr); setText('t-lbl-it',L.lIt); setText('t-lbl-cu',L.lCu); setText('t-lbl-ex',L.lEx);
  setText('t-btn-test-tg',L.btnTestTg); setText('t-btn-save',L.btnSave);
  // 빠른 등록 모달
  setText('t-mq-title',L.mqTitle);
  (L.qb||[]).forEach(function(txt,i){setText('t-qb-'+i,txt);});
  // 수입 등록 모달
  setText('t-mn-title',L.mnTitle); setText('t-mn-basic',L.mnBasic); setText('t-mn-food',L.mnFood); setText('t-mn-email-prev',L.mnEmailPrev);
  (L.lImp||[]).forEach(function(txt,i){setText('t-mn-l'+i,txt);});
  (L.kpLabels||[]).forEach(function(txt,i){setText('t-kp-l'+i,txt);});
  setText('t-mn-cancel',L.cancel); setText('t-mn-submit',L.mnSubmit);
  // 상품 모달
  setText('t-mp-ref-title',L.pmRefTitle); setText('t-mp-ref-apply',L.pmRefApply); setText('t-mp-ref-clear',L.pmRefClear);
  var prs=el('pm-ref-sel');if(prs&&prs.options.length>0)prs.options[0].text=(lang==='ko'?'참조할 상품 선택...':lang==='en'?'Select product to reference...':'Seleziona prodotto di riferimento...');
  (L.pmS||[]).forEach(function(txt,i){setText('t-pm-s'+(i+1),txt);});
  (L.pmL||[]).forEach(function(txt,i){setText('t-pm-l'+i,txt);});
  setText('t-mp-title-label',L.mpTitleNew);
  setText('t-pm-cancel',L.cancel); setText('t-pm-save',L.save);
  var pst=el('pm-storage');
  if(pst){var sv4=pst.value;var sv_vals=['상온','냉장','냉동','건조'];pst.innerHTML=sv_vals.map(function(v,i){return '<option value="'+v+'">'+(L.storagOpts[i]||v)+'</option>';}).join('');try{pst.value=sv4;}catch(e){}}
  var pca=el('pm-cat');
  if(pca){var cv=pca.value;pca.innerHTML=(L.pmCats||[]).map(function(c){return '<option value="'+c+'">'+c+'</option>';}).join('');try{pca.value=cv;}catch(e){}}
  // 협력사 모달
  var seCode=el('sup-edit-code');setText('msup-title',seCode&&seCode.value?L.msupTitleEdit:L.msupTitleNew);
  (L.supS||[]).forEach(function(txt,i){setText('t-sup-s'+(i+1),txt);});
  (L.supL||[]).forEach(function(txt,i){setText('t-sup-l'+i,txt);});
  setText('t-sup-cancel',L.cancel); setText('t-sup-save',L.save);
  var sty=el('sup-type');if(sty){var stv=sty.value;sty.innerHTML=(L.supTypes||[]).map(function(s){return '<option>'+s+'</option>';}).join('');try{sty.value=stv;}catch(e){}}
  var spy=el('sup-payment');if(spy){var spv=spy.value;spy.innerHTML=(L.supPayments||[]).map(function(s){return '<option>'+s+'</option>';}).join('');try{spy.value=spv;}catch(e){}}
  var sgr=el('sup-grade');if(sgr){sgr.innerHTML=(L.supGrades||[]).map(function(s){return '<option>'+s+'</option>';}).join('');}
  // 고객 모달
  var ceCode=el('cust-edit-code');setText('mcust-title',ceCode&&ceCode.value?L.mcustTitleEdit:L.mcustTitleNew);
  (L.custS||[]).forEach(function(txt,i){setText('t-cust-s'+(i+1),txt);});
  (L.custL||[]).forEach(function(txt,i){setText('t-cust-l'+i,txt);});
  setText('t-cust-cancel',L.cancel); setText('t-cust-save',L.save);
  var cty=el('cust-type');if(cty){var ctv=cty.value;cty.innerHTML=(L.custTypes||[]).map(function(s){return '<option>'+s+'</option>';}).join('');try{cty.value=ctv;}catch(e){}}
  // 매출 모달
  var eCode=el('sale-edit-code');setText('t-msale-title',eCode&&eCode.value?L.msaleTitleEdit:L.msaleTitleNew);
  (L.saleS||[]).forEach(function(txt,i){setText('t-sale-s'+(i+1),txt);});
  (L.saleL||[]).forEach(function(txt,i){setText('t-sale-l'+i,txt);});
  (L.saleTotals||[]).forEach(function(txt,i){setText('t-sale-tot'+i,txt);});
  setText('t-sale-add-item',L.saleAddItem);
  setText('t-sale-cancel',L.cancel); setText('t-sale-save',L.save);
  var sas=el('sale-status');if(sas){var sv6=sas.value;sas.innerHTML=(L.saleStatuses||[]).map(function(s){return '<option>'+s+'</option>';}).join('');try{sas.value=sv6;}catch(e){}}
  // 입금 모달
  setText('t-mpay-title',L.mpayTitleNew);
  (L.payL||[]).forEach(function(txt,i){setText('t-pay-l'+i,txt);});
  setText('t-pay-cancel',L.cancel); setText('t-pay-save',L.save);
  var pme=el('pay-method');if(pme){var sv7=pme.value;pme.innerHTML=(L.payMethods||[]).map(function(s){return '<option>'+s+'</option>';}).join('');try{pme.value=sv7;}catch(e){}}
  var pst2=el('pay-status2');if(pst2){var sv8=pst2.value;pst2.innerHTML=(L.payStatuses||[]).map(function(s){return '<option>'+s+'</option>';}).join('');try{pst2.value=sv8;}catch(e){}}
  // 단계 진행 모달
  setText('t-stage-cancel',L.stageCancel); setText('t-stage-adv',L.stageAdv);
  // 서류 링크 모달
  setText('t-dl-s1',L.dlS1); setText('t-dl-l-name',L.dlLName); setText('t-dl-l-type',L.dlLType);
  setText('t-dl-gdrive-title',L.dlGdriveTitle); setText('t-dl-gdrive-lbl',L.dlGdriveLbl); setText('t-dl-gdrive-hint',L.dlGdriveHint);
  setText('t-dl-file-title',L.dlFileTitle); setText('t-dl-file-hint',L.dlFileHint);
  setText('t-dl-l-notes',L.dlLNotes); setText('t-dl-l-issued',L.dlLIssued); setText('t-dl-l-expires',L.dlLExpires);
  setText('t-dl-cancel',L.cancel); setText('t-dl-save',L.save);
  var dlt=el('dl-type');if(dlt){dlt.innerHTML=(L.dlTypes||[]).map(function(s){return '<option>'+s+'</option>';}).join('');}
  setText('t-dh-title',L.dhTitle);
}

function renderAll(){
  renderDashboard();
  if(page==='products') renderPM();
  if(page==='suppliers') renderSuppliers();
  if(page==='customers') renderCustomers();
  if(page==='shipments') renderTable();
  if(page==='process'){populateProcSels();loadProc();}
  if(page==='documents') renderDocPanel();
  if(page==='hscode') renderHsTable();
  if(page==='notifications') renderNotif();
  if(page==='emaillog') renderLog();
  if(page==='sales') renderSales();
  if(page==='payments') renderPayments();
}

// ── NAVIGATION ─────────────────────────────────────────────
function nav(p){
  page=p;
  document.querySelectorAll('.ni').forEach(function(b){b.classList.remove('active');});
  var ni=el('ni-'+p); if(ni) ni.classList.add('active');
  document.querySelectorAll('.panel').forEach(function(x){x.classList.remove('active');});
  var panel=el('panel-'+p); if(panel) panel.classList.add('active');
  setText('page-title',(I18N[lang].pageTitle||{})[p]||p);
  if(p==='shipments') renderTable();
  if(p==='process') populateProcSels();
  if(p==='documents') renderDocPanel();
  if(p==='hscode') renderHsTable();
  if(p==='notifications') renderNotif();
  if(p==='emaillog') renderLog();
  if(p==='products'){renderPM();renderPmIndex();}
  if(p==='suppliers'){renderSuppliers();renderSupIndex();}
  if(p==='customers'){renderCustomers();renderCustIndex();}
  if(p==='sales') renderSales();
  if(p==='payments') renderPayments();
}

// ── DASHBOARD ──────────────────────────────────────────────
function renderDashboard(){
  var inP=shipments.filter(function(s){return s.stage<6;}).length;
  var arr=shipments.filter(function(s){return s.stage===2;}).length;
  var cus=shipments.filter(function(s){return s.stage===3;}).length;
  var totalSales=sales.reduce(function(a,s){return a+calcSaleAmounts(s.items).total;},0);
  var arTotal=sales.filter(function(s){return s.status!=='완료'&&s.status!=='취소';}).reduce(function(a,s){return a+getOutstanding(s.code);},0);
  el('stats-row').innerHTML=
    '<div class="sc"><div class="sn">'+inP+'</div><div class="sl">진행 수입</div><span class="st" style="background:var(--olp);color:var(--ol)">'+shipments.length+' 건</span></div>'+
    '<div class="sc"><div class="sn">'+arr+'</div><div class="sl">입항 예정</div><span class="st" style="background:var(--gp);color:var(--gd)">이달</span></div>'+
    '<div class="sc"><div class="sn">'+cus+'</div><div class="sl">통관 진행</div><span class="st" style="background:var(--tp);color:var(--tc)">처리중</span></div>'+
    '<div class="sc"><div class="sn">'+sales.length+'</div><div class="sl">수주 현황</div></div>'+
    '<div class="sc"><div class="sn" style="font-size:18px">'+Math.round(totalSales/10000).toLocaleString()+'만</div><div class="sl">총 매출 KRW</div></div>'+
    '<div class="sc"><div class="sn" style="font-size:18px;color:var(--tc)">'+Math.round(arTotal/10000).toLocaleString()+'만</div><div class="sl">미수금 KRW</div></div>';
  var counts=[0,0,0,0,0,0,0]; shipments.forEach(function(s){counts[s.stage]++;});
  el('pipeline').innerHTML=STAGES.map(function(n,i){var c=sc(i);return '<div class="sc2"><div class="sp" style="background:'+c.bg+';border-color:'+c.b+'" onclick="filterNav('+i+')"><div class="snum" style="color:'+c.t+'">'+(i+1)+'</div><div class="sname" style="color:'+c.t+'">'+n+'</div><div class="scnt" style="color:'+c.d+'">'+counts[i]+'</div></div></div>';}).join('');
  el('dash-recent').innerHTML=shipments.slice(0,4).map(function(s){var c=sc(s.stage);return '<div style="background:var(--ww);border:1px solid var(--if);border-radius:var(--R);padding:10px 12px;margin-bottom:6px;cursor:pointer" onclick="goProc(\''+s.id+'\')"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px"><span style="font-family:monospace;font-size:10px;font-weight:600;color:var(--ol)">'+s.id+'</span>'+badge(s.stage)+'</div><div style="font-size:12px;font-weight:500;color:var(--ink);margin-bottom:2px">'+s.product+'</div><div style="font-size:10px;color:var(--il);margin-bottom:4px">'+fmtEur(s.amount)+' → '+fmtKrw(s.amount*rates.eurKrw)+'</div><div style="height:3px;background:var(--if);border-radius:2px;overflow:hidden"><div style="width:'+pct(s.stage)+'%;height:100%;background:'+c.d+';border-radius:2px"></div></div></div>';}).join('');
  var arItems=sales.filter(function(s){return s.status!=='완료'&&s.status!=='취소'&&getOutstanding(s.code)>0;}).slice(0,4);
  el('dash-ar').innerHTML=arItems.length?arItems.map(function(s){var os=getOutstanding(s.code);var daysLeft=Math.ceil((new Date(s.payDue)-new Date())/86400000);var ov=daysLeft<0;return '<div class="ar-item"><div class="ar-top"><span class="ar-code">'+s.code+'</span><span class="ar-amount">'+fmtKrw(os)+'</span></div><div class="ar-cust">'+getCustomerName(s.custCode)+'</div><div class="ar-due" style="color:'+(ov?'var(--tc)':'var(--il)')+'">'+(ov?'⚠ '+Math.abs(daysLeft)+'일 연체':'납기: '+s.payDue+' ('+daysLeft+'일)')+'</div></div>';}).join(''):'<div style="color:var(--il);font-size:12px;padding:12px 0">미수금 없음 ✓</div>';
  el('dash-alerts').innerHTML='<div class="ab d"><span>⚠</span><span>IMP-2024-004 — 방사능 검사 서류 기한 3일 남음</span></div><div class="ab w"><span>!</span><span>IMP-2024-002 — 식품 라벨링 미달 (한글 표시사항 누락)</span></div><div class="ab ok"><span>✓</span><span>IMP-2024-003 — 식품 검역 통과 완료</span></div>';
}
function filterNav(i){ nav('shipments'); el('fs').value=i; filterTbl(); }

// ── DOCUMENT MANAGEMENT ────────────────────────────────────
function renderDocPanel(){
  // Left: shipment list
  el('doc-ship-list').innerHTML=shipments.map(function(s){
    var totalDocs=0; var attachedDocs=0;
    STAGE_DOCS.forEach(function(d,si){totalDocs+=d.length;(s.docs[si]||[]).forEach(function(v){if(v)attachedDocs++;});});
    var c=sc(s.stage); var pctDoc=totalDocs>0?Math.round(attachedDocs/totalDocs*100):0;
    return '<div class="doc-ship-item'+(selectedDocShipId===s.id?' active':'')+'" onclick="selectDocShip(\''+s.id+'\')">'+
      '<div class="doc-ship-code">'+s.id+'</div>'+
      '<div class="doc-ship-name">'+s.product.slice(0,30)+'</div>'+
      '<div class="doc-ship-meta">'+badge(s.stage)+'<span class="doc-progress-mini" style="background:'+c.bg+';color:'+c.t+'">서류 '+pctDoc+'%</span></div>'+
      '</div>';
  }).join('');
  if(selectedDocShipId) renderDocDetail(selectedDocShipId);
}

function selectDocShip(id){
  selectedDocShipId=id;
  document.querySelectorAll('.doc-ship-item').forEach(function(x){x.classList.remove('active');});
  var items=document.querySelectorAll('.doc-ship-item');
  items.forEach(function(x){if(x.textContent.includes(id))x.classList.add('active');});
  renderDocDetail(id);
}

function renderDocDetail(id){
  var s=shipments.filter(function(x){return x.id===id;})[0]; if(!s){return;}
  var detailEl=el('doc-detail-panel');
  var hs=HS_DB.filter(function(h){return h.code===s.hs;})[0];
  var totalDocs=0; var attachedDocs=0;
  STAGE_DOCS.forEach(function(d,si){totalDocs+=d.length;(s.docs[si]||[]).forEach(function(v){if(v)attachedDocs++;});});

  var html='<div class="pr" style="margin-bottom:12px">'+
    '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">'+
    '<div><div style="font-family:monospace;font-size:11px;color:var(--ol2);margin-bottom:2px">'+s.id+(s.pmCode?' · '+s.pmCode:'')+'</div>'+
    '<div style="font-family:\'DM Serif Display\',serif;font-size:16px;color:var(--ol)">'+s.product+'</div></div>'+
    badge(s.stage)+'</div>'+
    '<div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:8px;font-size:11px;color:var(--im)">'+
    '<span>공급사: <strong>'+getSupplierName(s.supplierCode)+'</strong></span>'+
    '<span>ETA: <strong>'+s.eta+'</strong></span>'+
    '<span>HS: <strong>'+getHsDisp(s.hs)+'</strong>'+(hs&&hs.quarantine?' <span style="color:var(--tc);font-size:10px">⚠검역</span>':'')+'</span>'+
    '</div>'+
    '<div style="margin-top:10px">'+
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">'+
    '<span style="font-size:11px;color:var(--im)">전체 서류 첨부 현황</span>'+
    '<span style="font-size:11px;font-weight:600;color:'+(attachedDocs===totalDocs?'var(--ok)':'var(--il)')+'">'+attachedDocs+' / '+totalDocs+'</span>'+
    '</div>'+
    '<div style="height:6px;background:var(--if);border-radius:3px;overflow:hidden">'+
    '<div style="width:'+Math.round(attachedDocs/totalDocs*100)+'%;height:100%;background:var(--ok);border-radius:3px;transition:width .5s"></div></div>'+
    '</div></div>';

  STAGES.forEach(function(stageName,si){
    var c=sc(si); var att=s.docs[si]||[];
    var stageDone=STAGE_DOCS[si].filter(function(d,j){return att[j];}).length;
    var stageTotal=STAGE_DOCS[si].length;
    var isOpen=si===s.stage||si<s.stage;
    html+='<div class="doc-stage-section">'+
      '<div class="doc-stage-hdr" onclick="toggleDocStageSection(this)">'+
      '<div style="display:flex;align-items:center;gap:10px">'+
      '<div style="width:26px;height:26px;border-radius:50%;background:'+(si<s.stage?c.d:si===s.stage?c.d:'var(--if)')+';color:'+(si<=s.stage?'#fff':'var(--il)')+';display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600">'+(si<s.stage?'✓':si+1)+'</div>'+
      '<span class="doc-stage-title" style="color:'+c.d+'">'+stageName+'</span>'+
      '</div>'+
      '<div class="doc-stage-meta">'+
      '<span style="color:'+(stageDone===stageTotal?'var(--ok)':'var(--il)')+'">'+stageDone+'/'+stageTotal+'</span>'+
      '<span style="font-size:12px;color:var(--il)">'+(isOpen?'▲':'▼')+'</span>'+
      '</div></div>'+
      '<div class="doc-stage-body'+(isOpen?' open':'')+'">';

    // Required docs list
    html+='<div class="doc-required-list">';
    STAGE_DOCS[si].forEach(function(docName,di){
      var attachKey=id+'_'+si+'_'+di;
      var attachment=docAttachments[attachKey];
      var hasFile=attachment&&attachment.fileData;
      var hasLink=attachment&&attachment.gdrive;
      var hasAny=hasFile||hasLink;
      html+='<div class="doc-req-item'+(hasFile?' has-file':hasLink?' has-link':'')+'" id="docitem-'+attachKey+'">'+
        '<div class="doc-req-check" style="background:'+(hasAny?hasFile?'var(--ok)':'var(--info)':'var(--if)')+';color:'+(hasAny?'#fff':'var(--il)')+'">'+( hasFile?'📁':hasLink?'☁':'○')+'</div>'+
        '<div style="flex:1">'+
        '<div class="doc-req-name">'+docName+'</div>'+
        (attachment?'<div class="doc-req-status">'+
          (attachment.issued?'발급: '+attachment.issued+'  ':'')+
          (attachment.expires?' 만료: '+attachment.expires:'')+'</div>':'')+
        (hasLink?'<a href="'+attachment.gdrive+'" target="_blank" class="doc-link-chip">☁ Drive에서 보기</a>':'')+ 
        (hasFile?'<span class="doc-file-chip">📁 '+( attachment.fileName||'파일')+(attachment.fileSize?' ('+Math.round(attachment.fileSize/1024)+'KB)':'')+'</span>':'')+ 
        '</div>'+
        '<div class="doc-req-btns">'+
        '<button class="doc-btn-sm doc-btn-add" onclick="openDocModal(\''+id+'\','+si+','+di+',\''+attachKey+'\')">'+( hasAny?'수정':'첨부')+'</button>'+
        (hasAny?'<button class="doc-btn-sm doc-btn-del" onclick="deleteDocAttach(\''+attachKey+'\',\''+id+'\')">삭제</button>':'')+
        '</div></div>';
      // Mark as attached in shipment.docs if we have something
      if(!s.docs[si]) s.docs[si]=[];
      s.docs[si][di]=hasAny;
    });
    html+='</div>';

    // Extra docs (user-added)
    var extraDocs=Object.keys(docAttachments).filter(function(k){return k.startsWith(id+'_'+si+'_extra_');});
    if(extraDocs.length){
      html+='<div class="doc-extra-list"><div style="font-size:10px;font-weight:600;color:var(--im);margin-bottom:6px">추가 서류</div>';
      extraDocs.forEach(function(k){
        var a=docAttachments[k];
        html+='<div class="doc-extra-item">'+
          '<span style="font-size:12px">'+(a.fileData?'📁':'☁')+'</span>'+
          '<span style="flex:1;font-size:12px">'+( a.name||'서류')+'</span>'+
          (a.gdrive?'<a href="'+a.gdrive+'" target="_blank" class="doc-link-chip">보기</a>':'')+
          '<button class="doc-btn-sm doc-btn-del" onclick="deleteDocAttach(\''+k+'\',\''+id+'\')">삭제</button></div>';
      });
      html+='</div>';
    }

    html+='<button class="doc-btn-sm doc-btn-add" style="width:100%;margin-top:8px;padding:6px" onclick="openDocModalExtra(\''+id+'\','+si+')">+ 추가 서류 첨부</button>';
    html+='</div></div>';
  });

  detailEl.innerHTML=html;
}

function toggleDocStageSection(hdr){
  var body=hdr.nextElementSibling;
  body.classList.toggle('open');
  var arrow=hdr.querySelector('.doc-stage-meta span:last-child');
  if(arrow) arrow.textContent=body.classList.contains('open')?'▲':'▼';
}

function openDocModal(shipId, stageIdx, docIdx, attachKey){
  var existing=docAttachments[attachKey]||{};
  el('dl-ship-id').value=shipId;
  el('dl-stage-idx').value=stageIdx;
  el('dl-doc-idx').value=docIdx;
  el('dl-edit-idx').value=attachKey;
  el('dl-name').value=existing.name||STAGE_DOCS[stageIdx][docIdx]||'';
  el('dl-type').value=existing.type||'기타';
  el('dl-gdrive').value=existing.gdrive||'';
  el('dl-notes').value=existing.notes||'';
  el('dl-issued').value=existing.issued||'';
  el('dl-expires').value=existing.expires||'';
  el('dl-file').value='';
  setText('mdl-title','서류 첨부: '+STAGE_DOCS[stageIdx][docIdx]);
  el('modal-doc-link').classList.add('open');
}

function openDocModalExtra(shipId, stageIdx){
  var extraKey=shipId+'_'+stageIdx+'_extra_'+Date.now();
  el('dl-ship-id').value=shipId;
  el('dl-stage-idx').value=stageIdx;
  el('dl-doc-idx').value='extra';
  el('dl-edit-idx').value=extraKey;
  el('dl-name').value='';
  el('dl-type').value='기타';
  el('dl-gdrive').value='';
  el('dl-notes').value='';
  el('dl-issued').value='';
  el('dl-expires').value='';
  el('dl-file').value='';
  setText('mdl-title','추가 서류 첨부');
  el('modal-doc-link').classList.add('open');
}

function submitDocLink(){
  var attachKey=el('dl-edit-idx').value;
  var shipId=el('dl-ship-id').value;
  var gdriveLink=el('dl-gdrive').value.trim();
  var file=el('dl-file').files[0];
  var name=el('dl-name').value.trim();
  var notes=el('dl-notes').value.trim();
  var issued=el('dl-issued').value;
  var expires=el('dl-expires').value;
  var type=el('dl-type').value;

  if(!gdriveLink&&!file&&!notes){
    alert('Google Drive 링크, 파일 첨부, 또는 메모 중 하나를 입력하세요.');
    return;
  }

  // Check file size (10MB limit for localStorage feasibility)
  if(file&&file.size>10*1024*1024){
    alert('파일 크기가 10MB를 초과합니다.\nGoogle Drive에 업로드 후 링크를 사용하세요.');
    return;
  }

  var processAttachment=function(fileData, fileName, fileSize){
    docAttachments[attachKey]={
      name:name||STAGE_DOCS[el('dl-stage-idx').value]?.[el('dl-doc-idx').value]||'서류',
      type:type, gdrive:gdriveLink, notes:notes, issued:issued, expires:expires,
      fileData:fileData||null, fileName:fileName||null, fileSize:fileSize||null
    };
    // Mark the required doc as attached
    var si=parseInt(el('dl-stage-idx').value);
    var di=el('dl-doc-idx').value;
    if(di!=='extra'){
      var s=shipments.filter(function(x){return x.id===shipId;})[0];
      if(s){ if(!s.docs[si]) s.docs[si]=[]; s.docs[si][parseInt(di)]=true; }
    }
    saveData();
    closeM('modal-doc-link');
    renderDocDetail(shipId);
    showToast(file?'파일이 첨부되었습니다.':'링크가 등록되었습니다.');
  };

  if(file){
    var fr=new FileReader();
    fr.onload=function(e){
      processAttachment(e.target.result, file.name, file.size);
    };
    fr.readAsDataURL(file);
  } else {
    processAttachment(null,null,null);
  }
}

function deleteDocAttach(attachKey, shipId){
  if(!confirm('서류 첨부를 삭제하시겠습니까?')) return;
  delete docAttachments[attachKey];
  // Update shipment docs status
  var parts=attachKey.split('_');
  if(parts.length>=3&&parts[2]!=='extra'){
    var si=parseInt(parts[1]);
    var di=parseInt(parts[2]);
    var s=shipments.filter(function(x){return x.id===shipId;})[0];
    if(s&&s.docs[si]) s.docs[si][di]=false;
  }
  saveData();
  renderDocDetail(shipId);
  showToast('서류가 삭제되었습니다.');
}

// ── PRODUCT MASTER ─────────────────────────────────────────

// ── 코드 인덱스 패널 ────────────────────────────────────────
function renderPmIndex(){
  var q=(el('pm-ci-search')&&el('pm-ci-search').value||'').toLowerCase();
  var fl=products.filter(function(p){return !q||p.code.toLowerCase().includes(q)||p.nameKo.toLowerCase().includes(q);});
  setText('pm-ci-count',String(fl.length));
  var list=el('pm-ci-list'); if(!list) return;
  list.innerHTML=fl.map(function(p){
    return '<div class="ci-item" data-code="'+p.code+'" onclick="highlightPm(this.dataset.code)" title="'+p.nameKo+'">'+
      '<span class="ci-code">'+p.code+'</span>'+
      '<span class="ci-name">'+p.nameKo+'</span></div>';
  }).join('');
}
function renderSupIndex(){
  var q=(el('sup-ci-search')&&el('sup-ci-search').value||'').toLowerCase();
  var fl=suppliers.filter(function(s){return !q||s.code.toLowerCase().includes(q)||s.name.toLowerCase().includes(q)||(s.nameKo||'').toLowerCase().includes(q);});
  setText('sup-ci-count',String(fl.length));
  var list=el('sup-ci-list'); if(!list) return;
  list.innerHTML=fl.map(function(s){
    return '<div class="ci-item" data-code="'+s.code+'" onclick="openNewSupplier(this.dataset.code)" title="'+s.name+'">'+
      '<span class="ci-code">'+s.code+'</span>'+
      '<span class="ci-name">'+(s.nameKo||s.name)+'</span></div>';
  }).join('');
}
function renderCustIndex(){
  var q=(el('cust-ci-search')&&el('cust-ci-search').value||'').toLowerCase();
  var fl=customers.filter(function(c){return !q||c.code.toLowerCase().includes(q)||c.name.toLowerCase().includes(q);});
  setText('cust-ci-count',String(fl.length));
  var list=el('cust-ci-list'); if(!list) return;
  list.innerHTML=fl.map(function(c){
    return '<div class="ci-item" data-code="'+c.code+'" onclick="openNewCustomer(this.dataset.code)" title="'+c.name+'">'+
      '<span class="ci-code">'+c.code+'</span>'+
      '<span class="ci-name">'+c.name+'</span></div>';
  }).join('');
}
function highlightPm(code){
  var card=document.getElementById('pmcard-'+code);
  if(card){card.scrollIntoView({behavior:'smooth',block:'center'});card.style.outline='2px solid var(--ol)';setTimeout(function(){card.style.outline='';},1500);}
  document.querySelectorAll('#pm-ci-list .ci-item').forEach(function(x){x.classList.remove('active');});
  var items=document.querySelectorAll('#pm-ci-list .ci-item');
  items.forEach(function(x){if(x.querySelector('.ci-code')&&x.querySelector('.ci-code').textContent===code)x.classList.add('active');});
}
function renderPM(){
  var q=(el('pm-search').value||'').toLowerCase();
  var catF=(el('pm-cat-filter').value||'');
  var list=products.filter(function(p){
    var mq=!q||p.code.includes(q)||p.nameKo.toLowerCase().includes(q)||(p.nameIt||'').toLowerCase().includes(q);
    return mq&&(!catF||p.cat===catF);
  });
  var catSel=el('pm-cat-filter');
  if(catSel.options.length<=1){
    var cats=[]; products.forEach(function(p){if(cats.indexOf(p.cat)<0)cats.push(p.cat);});
    cats.forEach(function(c){var o=document.createElement('option');o.value=c;o.textContent=c;catSel.appendChild(o);});
  }
  if(!list.length){el('pm-grid').innerHTML='<div style="color:var(--il);font-size:13px;padding:20px;grid-column:1/-1">검색 결과 없음</div>';return;}
  el('pm-grid').innerHTML=list.map(function(p){
    var hs=HS_DB.filter(function(h){return h.code===p.hs;})[0];
    var cls=STOR_CLS[p.storage]||'s-amb';
    return '<div class="pm-card" id="pmcard-'+p.code+'" onclick="openPMDetail(\''+p.code+'\')">'+
      '<button class="pm-del" onclick="event.stopPropagation();deletePM(\''+p.code+'\')">✕</button>'+
      '<div class="pm-code-row"><span style="background:var(--olp);color:var(--ol);padding:2px 7px;border-radius:5px">'+p.code+'</span><span class="pm-tag '+cls+'">'+p.storage+'</span></div>'+
      '<div class="pm-name">'+p.nameKo+'</div>'+
      (p.nameIt?'<div style="font-size:11px;color:var(--il);margin-bottom:6px;font-style:italic">'+p.nameIt+'</div>':'')+
      '<div class="pm-attrs">'+
      '<div class="pm-attr"><span class="ak">단위</span><span>'+(p.unit||'—')+'</span></div>'+
      '<div class="pm-attr"><span class="ak">포장</span><span>'+(p.pack||'—')+'</span></div>'+
      '<div class="pm-attr"><span class="ak">HS코드</span><span style="font-family:monospace;font-size:10px">'+(hs?hs.disp:p.hs||'—')+(hs?' ('+hs.duty+'%'+(hs.fta_eu===0?' / FTA 0%':'')+')'  :'')+'</span></div>'+
      '<div class="pm-attr"><span class="ak">공급사</span><span style="font-size:10px">'+getSupplierName(p.supplierCode)+'</span></div>'+
      (p.buyEur?'<div class="pm-attr"><span class="ak">단가</span><span>€'+p.buyEur+' / '+fmtKrw(p.sellKrw||0)+'</span></div>':'')+
      '</div></div>';
  }).join('');
}

function previewRef(){
  var code=el('pm-ref-sel').value; var prev=el('pm-ref-preview');
  if(!code){prev.style.display='none';return;}
  var p=products.filter(function(x){return x.code===code;})[0];
  if(!p){prev.style.display='none';return;}
  var hs=HS_DB.filter(function(h){return h.code===p.hs;})[0];
  prev.style.display='block';
  prev.innerHTML='<strong>'+p.nameKo+'</strong> ('+p.code+')<br>단위: '+(p.unit||'—')+' | 포장: '+(p.pack||'—')+' | 보관: '+p.storage+(hs?' | HS: '+hs.disp+' ('+hs.duty+'%'+(hs.fta_eu===0?'/FTA 0%':'')+')':(p.hs?' | HS: '+p.hs:''))+(p.cert?' | 인증: '+p.cert:'')+(p.buyEur?' | 매입: €'+p.buyEur+' / 판매: '+fmtKrw(p.sellKrw||0):'');
}
function applyRef(){
  var code=el('pm-ref-sel').value;
  var p=products.filter(function(x){return x.code===code;})[0];
  if(!p){showToast('참조할 상품을 선택하세요.');return;}
  el('pm-name-ko').value=p.nameKo+' (복사)'; el('pm-name-it').value=p.nameIt||'';
  el('pm-unit').value=p.unit||''; el('pm-pack').value=p.pack||'';
  el('pm-storage').value=p.storage||'상온'; el('pm-hs').value=p.hs||'';
  el('pm-cat').value=p.cat||''; el('pm-cert').value=p.cert||'';
  el('pm-buy').value=p.buyEur||''; el('pm-sell').value=p.sellKrw||'';
  el('pm-supplier-sel').value=p.supplierCode||''; el('pm-notes').value=p.notes||'';
  showToast('참조 복사 완료. 코드를 새로 입력하고 수정 후 저장하세요.');
  el('pm-code').focus();
}
function clearRef(){
  el('pm-ref-sel').value=''; el('pm-ref-preview').style.display='none'; el('pm-code').value='';
  ['pm-name-ko','pm-name-it','pm-unit','pm-pack','pm-cert','pm-buy','pm-sell','pm-notes'].forEach(function(id){el(id).value='';});
  el('pm-storage').value='상온'; el('pm-hs').value=''; el('pm-supplier-sel').value='';
}

function openNewProduct(editCode){
  var p=editCode?products.filter(function(x){return x.code===editCode;})[0]:null;
  el('pm-code').value=p?p.code:nextCode('PRD',products,'code'); el('pm-code').readOnly=!!p;
  ['pm-name-ko','pm-name-it','pm-unit','pm-pack','pm-cert','pm-notes'].forEach(function(id){el(id).value=p?(p[{
    'pm-name-ko':'nameKo','pm-name-it':'nameIt','pm-unit':'unit','pm-pack':'pack','pm-cert':'cert','pm-notes':'notes'
  }[id]]||''):'';});
  el('pm-storage').value=p?p.storage:'상온'; el('pm-hs').value=p?(p.hs||''):'';
  el('pm-cat').value=p?(p.cat||''):''; el('pm-buy').value=p?(p.buyEur||''):''; el('pm-sell').value=p?(p.sellKrw||''):'';
  el('pm-edit-code').value=editCode||'';
  setText('mp-title',p?'상품 수정':'상품 마스터 등록');
  el('pm-ref-preview').style.display='none'; el('pm-ref-sel').value='';
  populatePmRefSel(); populateSupplierSelect('pm-supplier-sel',p?p.supplierCode:'');
  el('modal-pm').classList.add('open');
}
function populatePmRefSel(){
  var sel=el('pm-ref-sel'); if(!sel) return;
  sel.innerHTML='<option value="">참조할 상품 선택...</option>'+products.map(function(p){return '<option value="'+p.code+'">'+p.code+' — '+p.nameKo+'</option>';}).join('');
}
function populateSupplierSelect(selId, selectedCode){
  var sel=el(selId); if(!sel) return;
  sel.innerHTML='<option value="">공급업체 선택...</option>'+suppliers.map(function(s){return '<option value="'+s.code+'"'+(selectedCode===s.code?' selected':'')+'>'+s.code+' — '+s.name+'</option>';}).join('');
}
function submitProduct(){
  var code=el('pm-code').value.trim(); var name=el('pm-name-ko').value.trim(); var editCode=el('pm-edit-code').value;
  if(!code||!name){alert('코드와 상품명을 입력하세요.');return;}
  if(!editCode&&products.filter(function(p){return p.code===code;}).length){alert('이미 존재하는 코드입니다.');return;}
  var data={code:code,nameKo:name,nameIt:el('pm-name-it').value,unit:el('pm-unit').value,pack:el('pm-pack').value,
    storage:el('pm-storage').value,hs:el('pm-hs').value,cat:el('pm-cat').value,cert:el('pm-cert').value,
    buyEur:parseFloat(el('pm-buy').value)||0,sellKrw:parseFloat(el('pm-sell').value)||0,
    supplierCode:el('pm-supplier-sel').value,notes:el('pm-notes').value};
  if(editCode){var idx=products.map(function(p){return p.code;}).indexOf(editCode);if(idx>=0)products[idx]=data;}
  else products.unshift(data);
  saveData(); closeM('modal-pm'); renderPM(); renderPmIndex(); populatePmcSel(); showToast('상품이 저장되었습니다.');
}
function deletePM(code){
  if(!confirm('코드 '+code+' 상품을 삭제하시겠습니까?')) return;
  products=products.filter(function(p){return p.code!==code;}); saveData(); renderPM(); showToast('삭제됨');
}
function openPMDetail(code){
  var p=products.filter(function(x){return x.code===code;})[0]; if(!p) return;
  var hs=HS_DB.filter(function(h){return h.code===p.hs;})[0];
  var cls=STOR_CLS[p.storage]||'s-amb';
  var relShip=shipments.filter(function(s){return s.pmCode===code;});
  setText('mpd-title',p.code+' · '+p.nameKo);
  var rows=[['코드',p.code],['한국어명',p.nameKo],['이탈리아어명',p.nameIt||'—'],['단위',p.unit||'—'],['포장단위',p.pack||'—'],['보관',p.storage],['카테고리',p.cat||'—'],['인증서',p.cert||'—'],
    ['HS코드 (10자리)',hs?(hs.disp+'<br><small style="color:var(--il)">'+hs.name+'</small>'):p.hs||'—'],
    ['기본관세율',hs?hs.duty+'%':'—'],['한-EU FTA세율',hs?(hs.fta_eu===0?'<span style="color:var(--ok);font-weight:600">0% (무관세)</span>':hs.fta_eu+'%'):'—'],
    ['매입단가',p.buyEur?'€'+p.buyEur:'—'],['권장판매가',p.sellKrw?fmtKrw(p.sellKrw):'—'],['공급업체',getSupplierName(p.supplierCode)]];
  var rowsHtml=rows.map(function(r){return '<div style="display:flex;align-items:flex-start;padding:6px 0;border-bottom:1px solid var(--if);font-size:12px"><span style="color:var(--il);min-width:90px;flex-shrink:0">'+r[0]+'</span><span style="color:var(--ink)">'+r[1]+'</span></div>';}).join('');
  el('mpd-body').innerHTML='<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">'+
    '<div>'+rowsHtml+(p.notes?'<div style="margin-top:8px;font-size:11px;color:var(--il);padding:7px 9px;background:var(--cr);border-radius:6px">'+p.notes+'</div>':'')+'</div>'+
    '<div><div style="font-size:10px;font-weight:600;color:var(--ol);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">수입 이력 ('+relShip.length+'건)</div>'+
    (relShip.length?relShip.map(function(s){return '<div style="border:1px solid var(--if);border-radius:6px;padding:8px 10px;margin-bottom:6px"><div style="display:flex;justify-content:space-between;margin-bottom:2px"><span style="font-family:monospace;font-size:10px;color:var(--ol)">'+s.id+'</span>'+badge(s.stage)+'</div><div style="font-size:11px;color:var(--im)">'+fmtEur(s.amount)+' · ETA '+s.eta+'</div></div>';}).join(''):'<div style="color:var(--il);font-size:12px">없음</div>')+
    '</div></div>'+
    '<div class="df"><button class="bd" onclick="deletePM(\''+code+'\');closeM(\'modal-pm-detail\')">삭제</button><button class="bo" onclick="closeM(\'modal-pm-detail\');openNewProduct(\''+code+'\')">수정</button><button class="bo" onclick="closeM(\'modal-pm-detail\')">닫기</button><button class="bp" onclick="closeM(\'modal-pm-detail\');openNewModal(\''+code+'\')">이 코드로 수입 등록</button></div>';
  el('modal-pm-detail').classList.add('open');
}

// ── SUPPLIERS ──────────────────────────────────────────────
function renderSuppliers(){
  var q=(el('sup-search').value||'').toLowerCase(); var ctF=(el('sup-country-filter').value||'');
  var ctSel=el('sup-country-filter');
  if(ctSel.options.length<=1){var cts=[];suppliers.forEach(function(s){if(cts.indexOf(s.country)<0)cts.push(s.country);});cts.forEach(function(c){var o=document.createElement('option');o.value=c;o.textContent=c;ctSel.appendChild(o);});}
  var list=suppliers.filter(function(s){return(!q||s.name.toLowerCase().includes(q)||(s.nameKo||'').toLowerCase().includes(q))&&(!ctF||s.country===ctF);});
  el('supplier-list').innerHTML='<div class="entity-grid">'+list.map(function(s){
    return '<div class="entity-card" onclick="openNewSupplier(\''+s.code+'\')">'+
      '<button class="entity-del" onclick="event.stopPropagation();deleteSupplier(\''+s.code+'\')">✕</button>'+
      '<div class="entity-code">'+s.code+'</div><div class="entity-name">'+s.name+'</div>'+
      (s.nameKo?'<div style="font-size:11px;color:var(--il);margin-bottom:4px">'+s.nameKo+'</div>':'')+
      '<div class="entity-sub">'+s.country+(s.city?' · '+s.city:'')+'</div>'+
      '<div class="entity-attrs">'+
      '<div class="entity-attr"><span class="eak">업종</span><span>'+s.type+'</span></div>'+
      '<div class="entity-attr"><span class="eak">담당</span><span>'+s.contact+'</span></div>'+
      '<div class="entity-attr"><span class="eak">이메일</span><span style="font-size:10px">'+s.email+'</span></div>'+
      (s.whatsapp?'<div class="entity-attr"><span class="eak">WhatsApp</span><span>'+s.whatsapp+'</span></div>':'')+
      '<div class="entity-attr"><span class="eak">결제</span><span>'+s.payment+'</span></div>'+
      '<div class="entity-attr"><span class="eak">등급</span><span>'+gradeBadge(s.grade.split(' ')[0])+'</span></div>'+
      '</div></div>';
  }).join('')+'</div>';
}
function openNewSupplier(editCode){
  var s=editCode?suppliers.filter(function(x){return x.code===editCode;})[0]:null;
  var flds=[['sup-code','code'],['sup-name','name'],['sup-name-ko','nameKo'],['sup-country','country'],['sup-city','city'],['sup-contact','contact'],['sup-title-person','titlePerson'],['sup-email','email'],['sup-phone','phone'],['sup-whatsapp','whatsapp'],['sup-web','web'],['sup-moq','moq'],['sup-lead','lead'],['sup-certs','certs'],['sup-notes','notes']];
  flds.forEach(function(f){var e=el(f[0]);if(e)e.value=s?(s[f[1]]||''):'';});
  if(s&&s.type)el('sup-type').value=s.type; if(s&&s.payment)el('sup-payment').value=s.payment;
  if(s&&s.currency)el('sup-currency').value=s.currency; if(s&&s.grade)el('sup-grade').value=s.grade;
  if(!s) el('sup-code').value=nextCode('SUP',suppliers,'code');
  el('sup-code').readOnly=!!s; el('sup-edit-code').value=editCode||'';
  setText('msup-title',s?'협력사 수정':'해외 협력사 등록');
  el('modal-supplier').classList.add('open');
}
function submitSupplier(){
  var code=el('sup-code').value.trim(); var name=el('sup-name').value.trim(); var editCode=el('sup-edit-code').value;
  if(!code||!name){alert('업체 코드와 업체명을 입력하세요.');return;}
  if(!editCode&&suppliers.filter(function(s){return s.code===code;}).length){alert('이미 존재하는 코드입니다.');return;}
  var data={code:code,name:name,nameKo:el('sup-name-ko').value,country:el('sup-country').value,city:el('sup-city').value,type:el('sup-type').value,contact:el('sup-contact').value,titlePerson:el('sup-title-person').value,email:el('sup-email').value,phone:el('sup-phone').value,whatsapp:el('sup-whatsapp').value,web:el('sup-web').value,payment:el('sup-payment').value,currency:el('sup-currency').value,moq:el('sup-moq').value,lead:parseInt(el('sup-lead').value)||0,certs:el('sup-certs').value,grade:el('sup-grade').value,notes:el('sup-notes').value};
  if(editCode){var idx=suppliers.map(function(s){return s.code;}).indexOf(editCode);if(idx>=0)suppliers[idx]=data;}else suppliers.unshift(data);
  saveData(); closeM('modal-supplier'); renderSuppliers(); renderSupIndex(); showToast('협력사가 저장되었습니다.');
}
function deleteSupplier(code){
  if(!confirm(code+' 협력사를 삭제하시겠습니까?')) return;
  suppliers=suppliers.filter(function(s){return s.code!==code;}); saveData(); renderSuppliers(); showToast('삭제됨');
}

// ── CUSTOMERS ──────────────────────────────────────────────
function renderCustomers(){
  var q=(el('cust-search').value||'').toLowerCase(); var gF=(el('cust-grade-filter').value||'');
  var list=customers.filter(function(c){return(!q||c.name.toLowerCase().includes(q)||(c.contact||'').toLowerCase().includes(q))&&(!gF||c.grade===gF);});
  el('customer-list').innerHTML='<div class="entity-grid">'+list.map(function(c){
    var ts=sales.filter(function(s){return s.custCode===c.code;}).reduce(function(a,s){return a+calcSaleAmounts(s.items).total;},0);
    var os=sales.filter(function(s){return s.custCode===c.code;}).reduce(function(a,s){return a+getOutstanding(s.code);},0);
    return '<div class="entity-card" onclick="openNewCustomer(\''+c.code+'\')">'+
      '<button class="entity-del" onclick="event.stopPropagation();deleteCustomer(\''+c.code+'\')">✕</button>'+
      '<div class="entity-code">'+c.code+'</div>'+
      '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px"><div class="entity-name" style="margin-bottom:0">'+c.name+'</div>'+gradeBadge(c.grade)+'</div>'+
      '<div class="entity-sub">'+c.type+(c.region?' · '+c.region:'')+'</div>'+
      '<div class="entity-attrs">'+
      '<div class="entity-attr"><span class="eak">담당</span><span>'+c.contact+'</span></div>'+
      '<div class="entity-attr"><span class="eak">이메일</span><span style="font-size:10px">'+c.email+'</span></div>'+
      '<div class="entity-attr"><span class="eak">결제조건</span><span>'+c.payTerms+'일</span></div>'+
      '<div class="entity-attr"><span class="eak">누적매출</span><span style="font-weight:500;color:var(--ok)">'+fmtKrw(ts)+'</span></div>'+
      (os?'<div class="entity-attr"><span class="eak">미수금</span><span style="font-weight:500;color:var(--tc)">'+fmtKrw(os)+'</span></div>':'')+
      '</div></div>';
  }).join('')+'</div>';
}
function openNewCustomer(editCode){
  var c=editCode?customers.filter(function(x){return x.code===editCode;})[0]:null;
  var flds=[['cust-code','code'],['cust-name','name'],['cust-bizno','bizno'],['cust-region','region'],['cust-contact','contact'],['cust-contact-title','contactTitle'],['cust-email','email'],['cust-phone','phone'],['cust-pay-terms','payTerms'],['cust-credit','credit'],['cust-notes','notes']];
  flds.forEach(function(f){var e=el(f[0]);if(e)e.value=c?(c[f[1]]||''):'';});
  if(c&&c.type)el('cust-type').value=c.type; if(c&&c.grade)el('cust-grade').value=c.grade;
  if(!c) el('cust-code').value=nextCode('CUS',customers,'code');
  el('cust-code').readOnly=!!c; el('cust-edit-code').value=editCode||'';
  setText('mcust-title',c?'고객 수정':'고객 등록');
  el('modal-customer').classList.add('open');
}
function submitCustomer(){
  var code=el('cust-code').value.trim(); var name=el('cust-name').value.trim(); var editCode=el('cust-edit-code').value;
  if(!code||!name){alert('고객 코드와 업체명을 입력하세요.');return;}
  if(!editCode&&customers.filter(function(c){return c.code===code;}).length){alert('이미 존재하는 코드입니다.');return;}
  var data={code:code,name:name,bizno:el('cust-bizno').value,type:el('cust-type').value,grade:el('cust-grade').value,region:el('cust-region').value,contact:el('cust-contact').value,contactTitle:el('cust-contact-title').value,email:el('cust-email').value,phone:el('cust-phone').value,payTerms:parseInt(el('cust-pay-terms').value)||30,credit:parseFloat(el('cust-credit').value)||0,notes:el('cust-notes').value};
  if(editCode){var idx=customers.map(function(c){return c.code;}).indexOf(editCode);if(idx>=0)customers[idx]=data;}else customers.unshift(data);
  saveData(); closeM('modal-customer'); renderCustomers(); renderCustIndex(); showToast('고객이 저장되었습니다.');
}
function deleteCustomer(code){
  if(!confirm(code+' 고객을 삭제하시겠습니까?')) return;
  customers=customers.filter(function(c){return c.code!==code;}); saveData(); renderCustomers(); showToast('삭제됨');
}

// ── SHIPMENTS TABLE ────────────────────────────────────────
function renderTable(){
  var fs=el('fs'); var fc=el('fc');
  if(fs.options.length<=1){fs.innerHTML='<option value="">전체 단계</option>'+STAGES.map(function(n,i){return '<option value="'+i+'">'+n+'</option>';}).join('');}
  if(fc.options.length<=1){var cats=[];shipments.forEach(function(s){if(cats.indexOf(s.category)<0)cats.push(s.category);});fc.innerHTML='<option value="">전체 카테고리</option>'+cats.map(function(c){return '<option>'+c+'</option>';}).join('');}
  filterTbl();
}
function filterTbl(){
  var q=(el('sq').value||'').toLowerCase(); var stg=el('fs').value; var cat=el('fc').value;
  var fl=shipments.filter(function(s){return(!q||s.id.toLowerCase().includes(q)||s.product.toLowerCase().includes(q)||getSupplierName(s.supplierCode).toLowerCase().includes(q))&&(stg===''||s.stage==stg)&&(!cat||s.category===cat);});
  if(!fl.length){el('tbl').innerHTML='<tr><td colspan="9" style="text-align:center;color:var(--il);padding:28px">검색 결과 없음</td></tr>';return;}
  el('tbl').innerHTML=fl.map(function(s){var c=sc(s.stage);var krw=Math.round(s.amount*rates.eurKrw);
    return '<tr onclick="goProc(\''+s.id+'\')"><td class="cc">'+s.id+(s.pmCode?'<div style="font-size:9px;color:var(--il)">'+s.pmCode+'</div>':'')+'</td><td class="pc">'+s.product+'</td><td style="font-size:11px">'+getSupplierName(s.supplierCode)+'</td><td><span style="font-size:10px;background:var(--olp);color:var(--ol);padding:2px 6px;border-radius:20px">'+s.category+'</span></td><td>€'+s.amount.toLocaleString()+'</td><td style="font-family:monospace;font-size:11px">'+krw.toLocaleString('ko-KR')+'₩</td><td>'+s.eta+'</td><td>'+badge(s.stage)+'</td><td><span style="font-size:10px;color:var(--im)">'+pct(s.stage)+'%</span><div class="pmb"><div class="pmf" style="width:'+pct(s.stage)+'%;background:'+c.d+'"></div></div></td></tr>';
  }).join('');
}

// ── PROCESS ────────────────────────────────────────────────
function populateProcSels(){
  ['proc-sel','doc-sel'].forEach(function(id){
    var sel=el(id); if(!sel) return;
    var cur=sel.value;
    sel.innerHTML='<option value="">-- 선택 --</option>'+shipments.map(function(s){return '<option value="'+s.id+'">'+s.id+' · '+s.product.slice(0,28)+'</option>';}).join('');
    if(cur) sel.value=cur;
  });
}
function goProc(id){ nav('process'); el('proc-sel').value=id; loadProc(); }
function loadProc(){
  var id=el('proc-sel').value; var s=shipments.filter(function(x){return x.id===id;})[0];
  var v=el('proc-view');
  if(!s){v.style.display='none';return;}
  v.style.display='block';
  var hs=HS_DB.filter(function(h){return h.code===s.hs;})[0];
  el('proc-hdr').innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px"><div><div style="font-family:monospace;font-size:11px;color:var(--ol2);margin-bottom:3px">'+s.id+(s.pmCode?' · <span style="color:var(--gd)">'+s.pmCode+'</span>':'')+'</div><div style="font-family:\'DM Serif Display\',serif;font-size:18px;color:var(--ol)">'+s.product+'</div></div>'+badge(s.stage)+'</div><div class="pm2"><div class="mci">공급사: <strong>'+getSupplierName(s.supplierCode)+'</strong></div><div class="mci">ETA: <strong>'+s.eta+'</strong></div><div class="mci">EUR: <strong>'+fmtEur(s.amount)+'</strong></div><div class="mci">KRW: <strong>'+fmtKrw(s.amount*rates.eurKrw)+'</strong></div>'+(hs?'<div class="mci">HS: <strong>'+hs.disp+'</strong> ('+hs.duty+'%'+(hs.fta_eu===0?'/FTA 0%':'')+')</div>':'')+'</div>';
  el('timeline').innerHTML=STAGES.map(function(name,i){
    var c=sc(i); var isCur=i===s.stage; var isDone=i<s.stage; var att=s.docs[i]||[];
    return '<div class="ti"><div class="tll"></div><div class="tdw"><div class="tdo" style="background:'+(isDone||isCur?c.d:'var(--cr)')+';color:'+(isDone||isCur?'#fff':c.d)+';border-color:'+c.d+'">'+(isDone?'✓':i+1)+'</div></div><div class="tb2"><div class="tsn" style="color:'+(isCur?c.d:'var(--ink)')+'">'+name+'</div><div class="tss">'+STAGES_EN[i]+' · '+STAGE_DOCS[i].length+' docs</div><div class="tdocs">'+STAGE_DOCS[i].map(function(d,j){return '<span class="dt '+(att[j]?'d':'p')+'" onclick="toggleDocP(\''+id+'\','+i+','+j+')">'+(att[j]?'✓ ':'')+d+'</span>';}).join('')+'</div>'+(isCur&&s.stage<6?'<div style="display:flex;gap:8px;margin-top:8px"><button class="tab-btn" style="background:'+c.d+'" onclick="openAdv(\''+id+'\','+i+')">다음 단계로 진행 →</button><button class="tab-btn" style="background:var(--info)" onclick="nav(\'documents\');setTimeout(function(){selectDocShip(\''+id+'\');},100)">📎 서류 관리</button></div>':'')+' </div></div>';
  }).join('');
}
function toggleDocP(id,si,di){
  var s=shipments.filter(function(x){return x.id===id;})[0]; if(!s) return;
  if(!s.docs[si]) s.docs[si]=[];
  s.docs[si][di]=!s.docs[si][di]; saveData(); loadProc();
}

// ── STAGE ADVANCE ──────────────────────────────────────────
function openAdv(id,stageIdx){
  pendId=id; pendStage=stageIdx;
  var s=shipments.filter(function(x){return x.id===id;})[0];
  var nextName=STAGES[stageIdx+1]||STAGES[6];
  setText('ms-title',s.id+' → '+nextName);
  var docs=STAGE_DOCS[stageIdx]; var att=s.docs[stageIdx]||[];
  var allOk=docs.every(function(d,j){return att[j];});
  var hs=HS_DB.filter(function(h){return h.code===s.hs;})[0];
  var kr=el('kr-email').value||'(이메일 미설정)'; var it=el('it-email').value||'';
  var subj='[수입알림] '+s.id+' - '+nextName+' 단계 진행';
  var body='안녕하세요,\n\n수입 건이 다음 단계로 진행되었습니다.\n\n▶ 코드: '+s.id+'\n▶ 상품: '+s.product+'\n▶ 공급업체: '+getSupplierName(s.supplierCode)+'\n▶ 현재단계: '+nextName+'\n▶ ETA: '+s.eta+'\n\n서류 준비 및 후속조치를 확인하세요.\n\n감사합니다.';
  el('stage-body').innerHTML='<div style="font-size:12px;color:var(--im);margin-bottom:12px">'+s.product+'</div>'+
    (!allOk?'<div class="ab w"><span>⚠</span><span>미첨부 서류가 있습니다. 계속 진행하시겠습니까?</span></div>':'')+
    (hs&&hs.quarantine?'<div class="ab d"><span>!</span><span>검역 대상 품목 (HS '+hs.disp+'). 검역증을 확인하세요.</span></div>':'')+
    '<div style="margin-bottom:12px"><div style="font-size:10px;font-weight:600;color:var(--im);text-transform:uppercase;letter-spacing:.06em;margin-bottom:7px">서류 현황</div><div class="tdocs">'+docs.map(function(d,j){return '<span class="dt '+(att[j]?'d':'r')+'">'+(att[j]?'✓':'!')+' '+d+'</span>';}).join('')+'</div></div>'+
    '<div style="font-size:10px;font-weight:600;color:var(--ol);margin-bottom:5px">📧 Gmail 알림 미리보기</div><div style="font-size:10px;color:var(--il);margin-bottom:3px">To: '+kr+(it?', '+it:'')+'</div><div class="ep">'+subj+'\n\n'+body+'</div>';
  el('stage-ss').style.display='none';
  el('modal-stage').classList.add('open');
}
function confirmAdv(){
  var s=shipments.filter(function(x){return x.id===pendId;})[0]; if(!s) return;
  var statusEl=el('stage-ss'); statusEl.className='ss snd'; statusEl.textContent='📧 Gmail 발송 중...';
  var oldStage=s.stage; if(s.stage<6) s.stage++;
  setTimeout(function(){
    var kr=el('kr-email').value||''; var it=el('it-email').value||'';
    var stageName=STAGES[oldStage];
    emailLog.unshift({time:nowStr(),code:s.id,stage:stageName,subject:'[수입알림] '+s.id+' - '+stageName+' 단계',to:kr+(it?', '+it:''),ch:['gmail']});
    saveData(); statusEl.className='ss ok'; statusEl.textContent='✓ Gmail 발송 완료 → '+kr;
    setTimeout(function(){closeM('modal-stage');loadProc();renderDashboard();},1200);
  },900);
}

// ── NEW SHIPMENT ───────────────────────────────────────────
function populatePmcSel(){
  var sel=el('n-pmc'); if(!sel) return;
  sel.innerHTML='<option value="">직접 입력</option>'+products.map(function(p){return '<option value="'+p.code+'">'+p.code+' — '+p.nameKo+'</option>';}).join('');
}
function populateHsSelects(){
  ['n-hs','pm-hs','calc-hs'].forEach(function(id){
    var sel=el(id); if(!sel) return;
    var cur=sel.value;
    sel.innerHTML='<option value="">선택...</option>'+HS_DB.map(function(h){return '<option value="'+h.code+'">'+h.disp+' — '+h.name+'</option>';}).join('');
    if(cur) sel.value=cur;
  });
}
function openNewModal(pmCode){
  var code=nextImpCode();
  el('n-code').value=code;
  ['n-prod','n-qty','n-amt','n-notes','n-cert'].forEach(function(id){el(id).value='';});
  el('n-eta').value=''; selFoodCat='';
  populatePmcSel(); populateHsSelects();
  var suppSel=el('n-supp-sel');
  suppSel.innerHTML='<option value="">공급업체 선택...</option>'+suppliers.map(function(s){return '<option value="'+s.code+'">'+s.name+'</option>';}).join('');
  if(pmCode){el('n-pmc').value=pmCode;fillFromMaster();}else el('n-pmc').value='';
  el('food-grid-new').innerHTML=FOOD_CATS.map(function(c){return '<button class="fc" onclick="selCat(this,\''+c+'\')">'+c+'</button>';}).join('');
  el('krw-preview').style.display='none'; updateNewEp(); el('new-ss').style.display='none';
  el('modal-new').classList.add('open');
}
function fillFromMaster(){
  var code=el('n-pmc').value; var p=products.filter(function(x){return x.code===code;})[0]; if(!p) return;
  el('n-prod').value=p.nameKo; el('n-cert').value=p.cert||'';
  if(p.hs) el('n-hs').value=p.hs;
  if(p.supplierCode) el('n-supp-sel').value=p.supplierCode;
  selFoodCat=p.cat||'';
  document.querySelectorAll('.fc').forEach(function(b){b.classList.toggle('active',b.textContent.trim()===selFoodCat);});
  updateKrwPrev(); updateNewEp();
}
function selCat(btn,cat){selFoodCat=cat;document.querySelectorAll('.fc').forEach(function(b){b.classList.remove('active');});btn.classList.add('active');}
function updateKrwPrev(){
  var eur=parseFloat(el('n-amt').value)||0; var hsCode=el('n-hs').value;
  var hs=HS_DB.filter(function(h){return h.code===hsCode;})[0];
  var pv=el('krw-preview');
  if(!eur){pv.style.display='none';return;}
  pv.style.display='block';
  el('kp-eur').textContent=fmtEur(eur);
  el('kp-rate').textContent=rates.eurKrw.toLocaleString('ko-KR')+'원/EUR';
  el('kp-duty').textContent=hs?('기본 '+hs.duty+'%'+(hs.fta_eu===0?' | FTA 0%':'')):'—';
  el('kp-krw').textContent=fmtKrw(eur*rates.eurKrw);
  updateNewEp();
}
function updateNewEp(){
  var code=el('n-code')?el('n-code').value:'';
  var prod=(el('n-prod')&&el('n-prod').value)?el('n-prod').value:'(상품명)';
  var eta=(el('n-eta')&&el('n-eta').value)?el('n-eta').value:'(미정)';
  var kr=el('kr-email').value||'korea@yourcompany.com'; var it=el('it-email').value||'';
  var body='안녕하세요,\n\n신규 수입 건이 등록되었습니다.\n\n▶ 코드: '+code+'\n▶ 상품: '+prod+'\n▶ ETA: '+eta+'\n\n확인 부탁드립니다.\n\n감사합니다.';
  var epEl=el('new-ep'); if(epEl) epEl.textContent='To: '+kr+(it?', '+it:'')+'\n[수입알림] '+code+' - 계약 단계 등록\n\n'+body;
}
function submitNew(){
  var prod=el('n-prod').value.trim(); if(!prod){alert('상품명을 입력하세요.');return;}
  var statusEl=el('new-ss'); statusEl.className='ss snd'; statusEl.textContent='📧 Gmail 발송 중...';
  var newS={id:el('n-code').value,product:prod,supplierCode:el('n-supp-sel').value,category:selFoodCat||FOOD_CATS[0],qty:el('n-qty').value,amount:parseFloat(el('n-amt').value)||0,eta:el('n-eta').value,inco:el('n-inco').value,stage:0,hs:el('n-hs').value,cert:el('n-cert').value,notes:el('n-notes').value,pmCode:el('n-pmc').value,docs:[[],[],[],[],[],[],[]]};
  setTimeout(function(){
    shipments.unshift(newS);
    var kr=el('kr-email').value||''; var it=el('it-email').value||'';
    emailLog.unshift({time:nowStr(),code:newS.id,stage:STAGES[0],subject:'[수입알림] '+newS.id+' - 신규 등록',to:kr+(it?', '+it:''),ch:['gmail']});
    saveData(); statusEl.className='ss ok'; statusEl.textContent='✓ 등록 완료 · Gmail 발송 → '+kr;
    setTimeout(function(){closeM('modal-new');renderDashboard();populateProcSels();populatePmcSel();},1300);
  },900);
}

// ── HS CODE ────────────────────────────────────────────────
function renderHsTable(){ populateHsSelects(); filterHs(); }
function filterHs(){
  var q=(el('hs-search').value||'').toLowerCase();
  var fl=HS_DB.filter(function(h){return !q||h.code.includes(q)||h.disp.includes(q)||h.name.toLowerCase().includes(q)||h.nameIT.toLowerCase().includes(q);});
  var db=function(d){if(d===0)return '<span class="duty-badge duty-0">0%</span>';if(d<=8)return '<span class="duty-badge duty-low">'+d+'%</span>';if(d<=22)return '<span class="duty-badge duty-mid">'+d+'%</span>';return '<span class="duty-badge duty-high">'+d+'%</span>';};
  el('hs-body').innerHTML=fl.map(function(h){
    return '<tr onclick="selectHsRow(\''+h.code+'\')">'+
      '<td style="font-family:monospace;font-weight:600;color:var(--ol)">'+h.disp+'</td>'+
      '<td style="font-weight:500;color:var(--ink)">'+h.name+'</td>'+
      '<td style="font-style:italic;color:var(--il)">'+h.nameIT+'</td>'+
      '<td>'+db(h.duty)+'</td>'+
      '<td><span class="duty-badge '+(h.fta_eu===0?'duty-0':'duty-low')+'">'+(h.fta_eu===0?'0% (FTA)':h.fta_eu+'%')+'</span></td>'+
      '<td>'+h.vat+'%</td>'+
      '<td>'+(h.quarantine?'<span style="font-size:10px;background:var(--tp);color:var(--tc);padding:2px 7px;border-radius:20px;font-weight:600">필요</span>':'<span style="font-size:10px;color:var(--il)">불필요</span>')+'</td>'+
      '<td style="font-size:11px;color:var(--il)">'+(h.note||'—')+'</td></tr>';
  }).join('');
}
function selectHsRow(code){ el('calc-hs').value=code; calcDuty(); }
function calcDuty(){
  var eur=parseFloat(el('calc-eur').value)||0; var code=el('calc-hs').value;
  var hs=HS_DB.filter(function(h){return h.code===code;})[0];
  var ki=el('calc-krw-in'); if(eur) ki.value=(eur*rates.eurKrw).toLocaleString('ko-KR')+'원';
  var res=el('duty-result');
  if(!eur||!hs){res.style.display='none';return;}
  var cif=eur*rates.eurKrw; var dutyAmt=cif*(hs.duty/100); var vatBase=cif+dutyAmt; var vatAmt=vatBase*(hs.vat/100);
  var ftaDutyAmt=cif*(hs.fta_eu/100); var ftaVatBase=cif+ftaDutyAmt; var ftaVatAmt=ftaVatBase*(hs.vat/100);
  res.style.display='block';
  res.innerHTML='<div style="margin-bottom:8px;font-size:11px;font-weight:600;color:var(--im)">기본세율 기준</div>'+
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px">'+
    [['과세가격 (KRW)',fmtKrw(cif),'var(--im)'],['관세 ('+hs.duty+'%)',fmtKrw(dutyAmt),'var(--tc)'],['부가세 ('+hs.vat+'%)',fmtKrw(vatAmt),'var(--gd)'],['납부 총액',fmtKrw(dutyAmt+vatAmt),'var(--ol)']].map(function(r){return '<div style="background:var(--ww);border:1px solid var(--if);border-radius:7px;padding:9px 11px"><div style="font-size:10px;color:var(--il);margin-bottom:3px">'+r[0]+'</div><div style="font-size:14px;font-weight:600;color:'+r[2]+';font-family:\'DM Serif Display\',serif">'+r[1]+'</div></div>';}).join('')+'</div>'+
    (hs.fta_eu===0?'<div style="background:var(--okp);border:1px solid #a8d5b9;border-radius:var(--R);padding:10px 12px;font-size:12px;color:var(--ok);font-weight:500">✅ 한-EU FTA 적용 시: 관세 0% → 부가세 '+fmtKrw(cif*0.1)+'만 납부 (절감액: '+fmtKrw(dutyAmt)+')</div>':'')+
    (hs.quarantine?'<div class="ab d" style="margin-top:8px"><span>!</span><span>검역 대상 품목입니다. 검역 수수료가 추가 발생합니다.</span></div>':'');
}

// ── SALES ──────────────────────────────────────────────────
function renderSales(){
  var total=sales.reduce(function(a,s){return a+calcSaleAmounts(s.items).total;},0);
  var completed=sales.filter(function(s){return s.status==='완료';}).reduce(function(a,s){return a+calcSaleAmounts(s.items).total;},0);
  var outstanding=sales.filter(function(s){return s.status!=='완료'&&s.status!=='취소';}).reduce(function(a,s){return a+getOutstanding(s.code);},0);
  var overdue=sales.filter(function(s){return s.status!=='완료'&&s.status!=='취소'&&getOutstanding(s.code)>0&&new Date(s.payDue)<new Date();}).length;
  el('sales-kpis').innerHTML='<div class="kpi-card"><div class="kpi-val">'+sales.length+'</div><div class="kpi-lbl">총 주문 건</div></div>'+
    '<div class="kpi-card"><div class="kpi-val" style="font-size:18px">'+Math.round(total/10000).toLocaleString()+'만</div><div class="kpi-lbl">총 매출 (KRW)</div></div>'+
    '<div class="kpi-card"><div class="kpi-val" style="font-size:18px;color:var(--ok)">'+Math.round(completed/10000).toLocaleString()+'만</div><div class="kpi-lbl">입금 완료</div></div>'+
    '<div class="kpi-card"><div class="kpi-val" style="font-size:18px;color:var(--tc)">'+Math.round(outstanding/10000).toLocaleString()+'만</div><div class="kpi-lbl">미수금</div></div>'+
    '<div class="kpi-card"><div class="kpi-val" style="color:'+(overdue?'var(--tc)':'var(--ink)')+'">'+overdue+'</div><div class="kpi-lbl">연체 건</div></div>';
  populateMonthFilter('sales-month-filter'); filterSales();
}
function filterSales(){
  var q=(el('sales-search').value||'').toLowerCase(); var stF=el('sales-status-filter').value; var mF=el('sales-month-filter').value;
  var fl=sales.filter(function(s){var mq=!q||s.code.toLowerCase().includes(q)||getCustomerName(s.custCode).toLowerCase().includes(q)||s.items.some(function(it){return(it.name||'').toLowerCase().includes(q);});return mq&&(!stF||s.status===stF)&&(!mF||s.date.startsWith(mF));});
  if(!fl.length){el('sales-tbl').innerHTML='<tr><td colspan="11" style="text-align:center;color:var(--il);padding:28px">검색 결과 없음</td></tr>';return;}
  el('sales-tbl').innerHTML=fl.map(function(s){var a=calcSaleAmounts(s.items);var os=getOutstanding(s.code);
    return '<tr onclick="openNewSale(\''+s.code+'\')"><td class="cc">'+s.code+'</td><td>'+s.date+'</td><td style="font-weight:500">'+getCustomerName(s.custCode)+'</td><td style="font-size:11px">'+s.items.map(function(it){return it.name;}).join(', ').slice(0,30)+'</td><td>'+s.items.reduce(function(a,it){return a+it.qty;},0)+'</td><td>'+fmtKrw(a.subtotal)+'</td><td>'+fmtKrw(a.vat)+'</td><td style="font-weight:600">'+fmtKrw(a.total)+'</td><td>'+statusBadge(s.status)+'</td><td style="font-weight:500;color:'+(os>0?'var(--tc)':'var(--ok)')+'">'+( os>0?fmtKrw(os):'완납')+'</td><td><button class="bo" style="padding:3px 8px;font-size:10px" onclick="event.stopPropagation();openNewPayment(\''+s.code+'\')">입금</button></td></tr>';
  }).join('');
}
function openNewSale(editCode){
  var s=editCode?sales.filter(function(x){return x.code===editCode;})[0]:null;
  var code=nextOrderCode();
  el('sale-code').value=s?s.code:code; el('sale-date').value=s?s.date:today();
  el('sale-due').value=s?s.dueDate:''; el('sale-pay-due').value=s?s.payDue:'';
  el('sale-notes').value=s?s.notes:''; if(s&&s.status) el('sale-status').value=s.status;
  el('sale-edit-code').value=editCode||'';
  var cSel=el('sale-cust');
  cSel.innerHTML='<option value="">고객사 선택 *</option>'+customers.map(function(c){return '<option value="'+c.code+'"'+(s&&s.custCode===c.code?' selected':'')+'>'+c.name+'</option>';}).join('');
  saleItemCount=s?s.items.length:1;
  el('sale-items-wrap').innerHTML='';
  var itemsToRender=s?s.items:[{pmCode:'',qty:1,price:0}];
  itemsToRender.forEach(function(it,idx){buildSaleItemRow(idx,it);});
  calcSaleTotal(); setText('msale-title',s?('주문: '+s.code):'매출 등록');
  el('modal-sale').classList.add('open');
}
function buildSaleItemRow(idx,item){
  var row=document.createElement('div'); row.className='sale-item-row'; row.id='sale-item-'+idx;
  var opts='<option value="">상품 선택...</option>'+products.map(function(p){return '<option value="'+p.code+'"'+(item&&item.pmCode===p.code?' selected':'')+'>'+p.code+' — '+p.nameKo+'</option>';}).join('');
  row.innerHTML='<select class="si" onchange="fillSaleItem('+idx+')" style="flex:2;min-width:0">'+opts+'</select>'+
    '<input class="si" type="number" placeholder="수량" value="'+(item?item.qty:1)+'" style="width:75px" oninput="calcSaleTotal()">'+
    '<input class="si" type="number" placeholder="단가(KRW)" value="'+(item?item.price:0)+'" style="width:105px" oninput="calcSaleTotal()">'+
    '<div class="sale-subtotal" id="sale-sub-'+idx+'">—</div>'+
    '<button onclick="removeSaleItem('+idx+')" style="background:none;border:none;cursor:pointer;color:var(--il);font-size:14px">✕</button>';
  el('sale-items-wrap').appendChild(row);
}
function addSaleItem(){ buildSaleItemRow(saleItemCount,null); saleItemCount++; calcSaleTotal(); }
function removeSaleItem(idx){ var r=el('sale-item-'+idx); if(r) r.remove(); calcSaleTotal(); }
function fillSaleItem(idx){
  var row=el('sale-item-'+idx); if(!row) return;
  var code=row.querySelectorAll('select')[0].value;
  var p=products.filter(function(x){return x.code===code;})[0]; if(!p) return;
  var pi=row.querySelectorAll('input')[1]; if(pi) pi.value=p.sellKrw||0;
  calcSaleTotal();
}
function calcSaleTotal(){
  var subtotal=0;
  document.querySelectorAll('.sale-item-row').forEach(function(row){
    var inputs=row.querySelectorAll('input[type="number"]'); var subEl=row.querySelector('.sale-subtotal');
    if(inputs.length>=2){var qty=parseInt(inputs[0].value)||0;var price=parseInt(inputs[1].value)||0;var sub=qty*price;subtotal+=sub;if(subEl)subEl.textContent=sub>0?fmtKrw(sub):'—';}
  });
  var vat=Math.round(subtotal*0.1);
  setText('sale-subtotal-sum',subtotal>0?fmtKrw(subtotal):'—');
  setText('sale-vat-sum',vat>0?fmtKrw(vat):'—');
  setText('sale-total-sum',(subtotal+vat)>0?fmtKrw(subtotal+vat):'—');
}
function submitSale(){
  var custCode=el('sale-cust').value; if(!custCode){alert('고객사를 선택하세요.');return;}
  var editCode=el('sale-edit-code').value; var items=[];
  document.querySelectorAll('.sale-item-row').forEach(function(row){
    var sel=row.querySelectorAll('select')[0]; var inputs=row.querySelectorAll('input[type="number"]');
    if(!sel||inputs.length<2) return;
    var qty=parseInt(inputs[0].value)||0; var price=parseInt(inputs[1].value)||0;
    if(qty>0) items.push({pmCode:sel.value,name:sel.value?getProductName(sel.value):'(기타)',qty:qty,price:price});
  });
  if(!items.length){alert('상품을 하나 이상 추가하세요.');return;}
  var data={code:el('sale-code').value,date:el('sale-date').value,custCode:custCode,status:el('sale-status').value,items:items,dueDate:el('sale-due').value,payDue:el('sale-pay-due').value,notes:el('sale-notes').value};
  if(editCode){var idx=sales.map(function(s){return s.code;}).indexOf(editCode);if(idx>=0)sales[idx]=data;else sales.unshift(data);}else sales.unshift(data);
  saveData(); closeM('modal-sale'); renderSales(); renderDashboard(); showToast('매출이 저장되었습니다.');
}

// ── PAYMENTS ───────────────────────────────────────────────
function renderPayments(){
  var totalPaid=payments.reduce(function(a,p){return a+p.amount;},0);
  var outstanding=sales.filter(function(s){return s.status!=='취소';}).reduce(function(a,s){return a+getOutstanding(s.code);},0);
  var overdue=payments.filter(function(p){return p.status==='연체';}).length;
  var thisM=payments.filter(function(p){return p.date.startsWith(new Date().toISOString().slice(0,7));}).reduce(function(a,p){return a+p.amount;},0);
  el('payment-kpis').innerHTML='<div class="kpi-card"><div class="kpi-val">'+payments.length+'</div><div class="kpi-lbl">입금 건수</div></div>'+
    '<div class="kpi-card"><div class="kpi-val" style="font-size:18px;color:var(--ok)">'+Math.round(totalPaid/10000).toLocaleString()+'만</div><div class="kpi-lbl">총 입금액</div></div>'+
    '<div class="kpi-card"><div class="kpi-val" style="font-size:18px;color:var(--tc)">'+Math.round(outstanding/10000).toLocaleString()+'만</div><div class="kpi-lbl">총 미수금</div></div>'+
    '<div class="kpi-card"><div class="kpi-val" style="font-size:18px">'+Math.round(thisM/10000).toLocaleString()+'만</div><div class="kpi-lbl">이달 입금</div></div>'+
    '<div class="kpi-card"><div class="kpi-val" style="color:'+(overdue?'var(--tc)':'var(--ink)')+'">'+overdue+'</div><div class="kpi-lbl">연체 건</div></div>';
  populateMonthFilter('pay-month-filter'); filterPayments();
}
function filterPayments(){
  var q=(el('pay-search').value||'').toLowerCase(); var stF=el('pay-status-filter').value; var mF=el('pay-month-filter').value;
  var fl=payments.filter(function(p){return(!q||p.code.toLowerCase().includes(q)||getCustomerName(p.custCode).toLowerCase().includes(q))&&(!stF||p.status===stF)&&(!mF||p.date.startsWith(mF));});
  if(!fl.length){el('pay-tbl').innerHTML='<tr><td colspan="10" style="text-align:center;color:var(--il);padding:28px">검색 결과 없음</td></tr>';return;}
  el('pay-tbl').innerHTML=fl.map(function(p){
    return '<tr><td class="cc">'+p.code+'</td><td>'+p.date+'</td><td style="font-weight:500">'+getCustomerName(p.custCode)+'</td><td class="cc" style="font-size:10px">'+p.saleCode+'</td><td>'+fmtKrw(p.billed)+'</td><td style="font-weight:600;color:var(--ok)">'+fmtKrw(p.amount)+'</td><td style="font-weight:500;color:'+(p.balance>0?'var(--tc)':'var(--ok)')+'">'+( p.balance>0?fmtKrw(p.balance):'완납')+'</td><td>'+p.method+'</td><td>'+statusBadge(p.status)+'</td><td><button class="bd" style="padding:3px 8px;font-size:10px" onclick="deletePayment(\''+p.code+'\')">삭제</button></td></tr>';
  }).join('');
}
function openNewPayment(saleCodeOrEmpty){
  var sale=saleCodeOrEmpty?sales.filter(function(x){return x.code===saleCodeOrEmpty;})[0]:null;
  var pcode=nextPayCode();
  el('pay-code').value=pcode; el('pay-date').value=today();
  el('pay-notes').value=''; el('pay-amount').value=''; el('pay-balance').value=''; el('pay-edit-code').value='';
  var cSel=el('pay-cust');
  cSel.innerHTML='<option value="">고객사 선택 *</option>'+customers.map(function(c){return '<option value="'+c.code+'"'+(sale&&c.code===sale.custCode?' selected':'')+'>'+c.name+'</option>';}).join('');
  if(sale){el('pay-cust').value=sale.custCode;loadCustomerSales();}
  setText('mpay-title','입금 등록');
  el('modal-payment').classList.add('open');
  if(sale){setTimeout(function(){el('pay-sale-link').value=sale.code;loadCustomerSales();},100);}
}
function loadCustomerSales(){
  var custCode=el('pay-cust').value;
  var custSales=sales.filter(function(s){return s.custCode===custCode&&s.status!=='취소'&&s.status!=='견적';});
  el('pay-sale-link').innerHTML='<option value="">전체 미수금</option>'+custSales.map(function(s){var os=getOutstanding(s.code);var a=calcSaleAmounts(s.items);return '<option value="'+s.code+'">'+s.code+' (청구: '+fmtKrw(a.total)+' | 미수: '+fmtKrw(os)+')</option>';}).join('');
  var totalOs=custSales.reduce(function(a,s){return a+getOutstanding(s.code);},0);
  el('pay-billed').value=totalOs>0?totalOs.toLocaleString('ko-KR')+'원':''; calcPayBalance();
}
function calcPayBalance(){
  var billed=parseFloat((el('pay-billed').value||'0').replace(/[^0-9]/g,''))||0;
  var paid=parseFloat(el('pay-amount').value)||0; var bal=Math.max(0,billed-paid);
  el('pay-balance').value=bal>0?bal.toLocaleString('ko-KR')+'원':'완납';
  var ss=el('pay-status2');
  if(paid>=billed&&billed>0)ss.value='입금완료';else if(paid>0&&paid<billed)ss.value='부분입금';else ss.value='미수';
}
function submitPayment(){
  var custCode=el('pay-cust').value; var amount=parseFloat(el('pay-amount').value)||0;
  if(!custCode||!amount){alert('고객사와 입금금액을 입력하세요.');return;}
  var saleCode=el('pay-sale-link').value;
  var billedVal=parseFloat((el('pay-billed').value||'0').replace(/[^0-9]/g,''))||0;
  var balance=Math.max(0,billedVal-amount);
  var data={code:el('pay-code').value,date:el('pay-date').value,custCode:custCode,saleCode:saleCode,billed:billedVal,amount:amount,balance:balance,method:el('pay-method').value,account:el('pay-account').value,status:el('pay-status2').value,notes:el('pay-notes').value};
  payments.unshift(data);
  if(saleCode&&balance===0){var sale=sales.filter(function(s){return s.code===saleCode;})[0];if(sale)sale.status='완료';}
  saveData(); closeM('modal-payment'); renderPayments(); renderDashboard(); showToast('입금이 등록되었습니다.');
}
function deletePayment(code){
  if(!confirm('입금 기록 '+code+'를 삭제하시겠습니까?')) return;
  payments=payments.filter(function(p){return p.code!==code;}); saveData(); renderPayments(); showToast('삭제됨');
}
function populateMonthFilter(selId){
  var sel=el(selId); if(!sel||sel.options.length>1) return;
  var now=new Date();
  for(var i=0;i<12;i++){var d=new Date(now.getFullYear(),now.getMonth()-i,1);var m=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');var o=document.createElement('option');o.value=m;o.textContent=m;sel.appendChild(o);}
}

// ── NOTIFICATIONS ──────────────────────────────────────────
function renderNotif(){
  el('notif-list').innerHTML=STAGES.map(function(n,i){var c=sc(i);return '<div style="display:flex;align-items:center;padding:7px 0;border-bottom:1px solid var(--if);gap:10px"><span style="font-size:12px;font-weight:500;color:'+c.d+';min-width:65px">'+n+'</span><div style="display:flex;gap:14px"><label style="display:flex;align-items:center;gap:5px;font-size:11px;cursor:pointer"><input type="checkbox" checked style="accent-color:var(--ol)"> 이메일</label><label style="display:flex;align-items:center;gap:5px;font-size:11px;cursor:pointer"><input type="checkbox" '+(i<=3?'checked':'')+' style="accent-color:var(--ol)"> 텔레그램</label></div></div>';}).join('');
}
function testTg(){ var t=el('tg-token').value;var c=el('tg-chat').value;if(!t||!c){alert('Bot Token과 Chat ID를 입력하세요.');return;}showToast('텔레그램 테스트 발송 완료');}

// ── EMAIL LOG ──────────────────────────────────────────────
function renderLog(){
  if(!emailLog.length){el('email-log').innerHTML='<div style="text-align:center;color:var(--il);padding:40px">발송 내역 없음</div>';return;}
  el('email-log').innerHTML=emailLog.map(function(e){var s=shipments.filter(function(x){return x.id===e.code;})[0];var c=sc(s?s.stage:0);return '<div class="li"><div class="lm"><span class="badge" style="background:'+c.bg+';color:'+c.t+';border:1px solid '+c.b+'">'+e.stage+'</span><span class="lt">'+e.time+'</span></div><div class="ls">'+e.subject+'</div><div class="lo">→ '+e.to+'</div><div class="lch">'+( e.ch||['gmail']).map(function(ch){return ch==='gmail'?'<span class="cp" style="background:#fce8e6;color:#c5221f">Gmail</span>':'<span class="cp" style="background:#e8f4fd;color:#0078d4">Telegram</span>';}).join('')+'</div></div>';}).join('');
}

// ── EXCEL EXPORT ───────────────────────────────────────────
function exportExcel(){
  if(typeof XLSX==='undefined'){alert('잠시 후 다시 시도하세요.');return;}
  var wb=XLSX.utils.book_new();
  var add=function(data,name,widths){var ws=XLSX.utils.aoa_to_sheet(data);ws['!cols']=widths.map(function(w){return{wch:w};});XLSX.utils.book_append_sheet(wb,ws,name);};
  var l=STAGES;
  add([['수입코드','상품명','마스터코드','공급업체','카테고리','수량','금액(EUR)','금액(KRW)','인코텀즈','ETA','HS코드(10자리)','현재단계','진행률']].concat(shipments.map(function(s){return[s.id,s.product,s.pmCode||'',getSupplierName(s.supplierCode),s.category,s.qty,s.amount,Math.round(s.amount*rates.eurKrw),s.inco,s.eta,getHsDisp(s.hs),l[s.stage],pct(s.stage)+'%'];})),'수입목록',[15,28,10,22,14,10,12,16,8,12,14,8,8]);
  add([['관리코드','상품명(KO)','상품명(IT)','단위','포장단위','보관','HS코드(10자리)','카테고리','인증서','매입단가(EUR)','판매가(KRW)','공급업체']].concat(products.map(function(p){return[p.code,p.nameKo,p.nameIt||'',p.unit||'',p.pack||'',p.storage,getHsDisp(p.hs),p.cat||'',p.cert||'',p.buyEur||'',p.sellKrw||'',getSupplierName(p.supplierCode)];})),'상품마스터',[10,28,28,10,14,8,14,14,10,12,14,22]);
  add([['HS코드(10자리)','표시코드','한국품목명','이탈리아명','기본관세율(%)','한-EU FTA세율(%)','부가세(%)','검역여부','비고']].concat(HS_DB.map(function(h){return[h.code,h.disp,h.name,h.nameIT,h.duty,h.fta_eu,h.vat,h.quarantine?'필요':'불필요',h.note||''];})),'HS코드_관세율',[12,14,28,28,12,14,8,10,20]);
  add([['코드','업체명','한국어명','국가','도시','업종','담당자','이메일','전화','결제조건','등급']].concat(suppliers.map(function(s){return[s.code,s.name,s.nameKo||'',s.country||'',s.city||'',s.type||'',s.contact||'',s.email||'',s.phone||'',s.payment||'',s.grade||''];})),'해외협력사',[10,28,18,10,16,18,14,24,16,14,8]);
  add([['코드','업체명','사업자번호','업종','등급','지역','담당자','이메일','전화','결제조건(일)','신용한도']].concat(customers.map(function(c){return[c.code,c.name,c.bizno||'',c.type||'',c.grade||'',c.region||'',c.contact||'',c.email||'',c.phone||'',c.payTerms||'',c.credit||''];})),'고객마스터',[10,24,14,16,6,14,10,24,14,12,14]);
  add([['주문번호','주문일','고객사','상품','공급가액','부가세','합계','상태','납기일','결제기한','미수금']].concat(sales.map(function(s){var a=calcSaleAmounts(s.items);var os=getOutstanding(s.code);return[s.code,s.date,getCustomerName(s.custCode),s.items.map(function(it){return it.name;}).join(', '),a.subtotal,a.vat,a.total,s.status,s.dueDate||'',s.payDue||'',os];})),'매출관리',[14,12,22,30,14,12,14,8,12,12,14]);
  add([['입금번호','입금일','고객사','연결주문','청구금액','입금금액','잔액','입금방법','상태']].concat(payments.map(function(p){return[p.code,p.date,getCustomerName(p.custCode),p.saleCode||'',p.billed,p.amount,p.balance,p.method||'',p.status];})),'입금관리',[14,12,22,14,14,14,12,10,10]);
  // Document links sheet
  var docRows=[['수입코드','단계','서류명','유형','Google Drive 링크','파일명','발급일','만료일','비고']];
  Object.keys(docAttachments).forEach(function(k){
    var a=docAttachments[k]; var parts=k.split('_');
    var shipId=parts[0]; var si=parseInt(parts[1]);
    docRows.push([shipId,STAGES[si]||'추가',a.name||'',a.type||'',a.gdrive||'',a.fileName||'(로컬파일)',a.issued||'',a.expires||'',a.notes||'']);
  });
  add(docRows,'서류링크',[15,8,28,14,50,20,12,12,20]);
  XLSX.writeFile(wb,'직수입관리_'+today()+'.xlsx');
  showToast('Excel 파일이 다운로드됩니다. (7개 시트)');
}

// ── MOBILE ─────────────────────────────────────────────────
function checkMobile(){ var isM=window.innerWidth<=900;var mb=el('menu-btn');if(mb)mb.style.display=isM?'block':'none'; }
window.addEventListener('resize',checkMobile);

// ── INIT ───────────────────────────────────────────────────

// ── 자동 채번 ──────────────────────────────────────────────
function nextCode(prefix, arr, field){
  var nums=arr.map(function(x){var m=(x[field]||'').match(/(\d+)$/);return m?parseInt(m[1]):0;});
  var n=nums.length?Math.max.apply(null,nums)+1:1;
  return prefix+'-'+String(n).padStart(3,'0');
}
function nextImpCode(){
  var yr=new Date().getFullYear();
  var nums=shipments.map(function(s){var m=s.id.match(/(\d+)$/);return m?parseInt(m[1]):0;});
  var n=nums.length?Math.max.apply(null,nums)+1:1;
  return 'IMP-'+yr+'-'+String(n).padStart(3,'0');
}
function nextOrderCode(){
  var yr=new Date().getFullYear();
  var nums=sales.map(function(s){var m=s.code.match(/(\d+)$/);return m?parseInt(m[1]):0;});
  var n=nums.length?Math.max.apply(null,nums)+1:1;
  return 'ORD-'+yr+'-'+String(n).padStart(3,'0');
}
function nextPayCode(){
  var yr=new Date().getFullYear();
  var nums=payments.map(function(p){var m=p.code.match(/(\d+)$/);return m?parseInt(m[1]):0;});
  var n=nums.length?Math.max.apply(null,nums)+1:1;
  return 'PAY-'+yr+'-'+String(n).padStart(3,'0');
}

// ── Google Sheets 연동 유틸 ───────────────────────────────

