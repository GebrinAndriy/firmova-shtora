const CFG = {

  phone: "+380 95 904 87 45",
  email: "dimetriskis@gmail.com",
  schedule: "Щодня з 09:00 до 21:00",
  links: {

    facebook:   "#",
    instagram:  "#",
    telegram:   "#",
    viberChat:  "#",
    viberGroup: "#",
    tiktok:     "#",
    youtube:    "#"
  },

  promo: { on: true, percent: 50 },

  vis: { person: "assets/vis-person.webp" },

  rollerExamples: [

    { name:"Вікно у ванній",   note:"вузька стулка",      w:60,  h:150, img:"assets/win-60x150" },
    { name:"Звичайна стулка",  note:"кухня або спальня",  w:80,  h:160, img:"assets/win-80x160" },
    { name:"Широка стулка",    note:"вітальня",           w:100, h:170, img:"assets/win-100x170" },
    { name:"Балконні двері",   note:"висока вузька",      w:70,  h:200, img:"assets/win-70x200" }
  ],

  details: { budova:"", tkanyny:"", zamir:"", chomu:"", tsina:"" },

  blocks: {
    budova:true, pro:true, vidhuky:true, chomu:true, tkanyny:true,
    kimnaty:true, pidbir:true, tsina:true, zamir:true, alt:true, blog:true
  },

  analytics: { ga4: "G-PFSGPCRDMZ", clarity: "z7vku8w5vi", metaPixel: "214279300508041" },

  measureVideo: "https://youtu.be/3ivn6dbjIK4",

  company: {
    since: "15 травня 2020",
    years_total: "15+",
    years_pro: "12+",
    clients: "54 000+"
  },

  lines: {
    daynight: {
      id: "daynight",
      name: "Фірмова Штора день-ніч",
      short: "День-ніч",
      claim: "Керує світлом протягом дня",
      text: "Полотно з двох смуг: прозорої та щільної. Зміщуючи їх ланцюжком, ви плавно регулюєте світло від майже повного до приглушеного, не піднімаючи штору.",
      good: ["Спальня", "Вітальня", "Кухня", "Дитяча", "Кабінет"],
      bullets: [
        "Плавне регулювання світла без тюлю",
        "Десять відтінків, чотири рівні затемнення",
        "Відкрита або закрита система",
        "Гарантія 3 роки на механізм"
      ],
      warranty: "3 роки",
      from: 520
    },
    roller: {
      id: "roller",
      name: "Класична рулонна штора",
      short: "Класична",
      claim: "Просто відкрити або закрити",
      text: "Суцільне полотно на тому самому механізмі. Піднімається й опускається одним рухом. Коли регулювати світло не потрібно, це найпряміше рішення.",
      good: ["Санвузол", "Комора", "Коридор", "Балкон", "Дача"],
      bullets: [
        "Суцільне полотно, без напівтонів",
        "Той самий механізм і кріплення",
        "Відкрита або закрита система",
        "Гарантія 2 роки на механізм"
      ],
      warranty: "2 роки",
      from: 340
    }
  },

  production: { public: "Виготовлення від 3 робочих днів" },

  prepay: { threshold: 3000, fixed: 300, percent: 10 },

  productExtraW: 4,

  priceExamples: [
    { id:"one",  name:"Одна штора на стулку",     note:"тканина 45 × 150 см",       w:45,  h:150, count:1 },
    { id:"two",  name:"Типове двостулкове вікно", note:"дві штори 70 × 150 см",     w:70,  h:150, count:2 },
    { id:"wide", name:"Широке вікно",             note:"одна штора 140 × 200 см",   w:140, h:200, count:1 }
  ],

  minPrice: 450,
  minArea: 0.4,

  rollerFormula: {
    minW: 20, maxW: 300,
    minH: 20, maxH: 500,
    fromW: 40,
    tiers: [
      { toH: 160, base: 190, perM: 770 },
      { toH: 200, base: 211, perM: 930 }
    ],
    note: "Точну ціну для такого розміру порахує менеджер і повідомить вам — зазвичай протягом робочого дня."
  },

  rollerTariffs: [],

  systems: {
    open: {
      name: "Відкрита", hint: "вал видно",
      note: "Відкрита система: механізм і вал залишаються на видноті. Найдоступніший варіант.",
      minW: 30, maxW: 140, minH: 30, maxH: 200, add: 0
    },
    closed: {
      name: "Закрита", hint: "у касеті",
      note: "Закрита система: вал закритий касетою, вигляд акуратніший, тканина менше запилюється.",
      minW: 30, maxW: 140, minH: 30, maxH: 200, add: 280
    }
  },

  sides: [
    { id: "right", name: "Праворуч" },
    { id: "left",  name: "Ліворуч" },
    { id: "ask",   name: "Не знаю, уточніть при дзвінку" }
  ],

  options: [
    { id: "string", name: "Нижня фіксація струною", price: 120 },
    { id: "extra_brackets", name: "Додаткові кріплення без свердління", price: 90 }
  ],

  fabrics: [
    { id:"bezh-lon", name:"Беж льон", transmission:"Напівзатемнення", price:580, roller:380,
      from:"#B7A890", to:"#A59679", img:"assets/rolls/bezh-lon.webp", thumb:"assets/rolls/bezh-lon-t.webp", win:"assets/fabwin/bezh-lon.webp" },
    { id:"bilyi-lon", name:"Білий льон", transmission:"Напівзатемнення", price:580, roller:380,
      from:"#DDDDDD", to:"#CFCFCF", img:"assets/rolls/bilyi-lon.webp", thumb:"assets/rolls/bilyi-lon-t.webp", win:"assets/fabwin/bilyi-lon.webp" },
    { id:"vanil-lon", name:"Ваніль льон", transmission:"Напівзатемнення", price:580, roller:380,
      from:"#CDBF8E", to:"#BFAF7C", img:"assets/rolls/vanil-lon.webp", thumb:"assets/rolls/vanil-lon-t.webp", win:"assets/fabwin/vanil-lon.webp" },
    { id:"dzhyns-lon", name:"Джинс льон", transmission:"Напівзатемнення", price:580, roller:380,
      from:"#4D64A8", to:"#4C65AC", img:"assets/rolls/dzhyns-lon.webp", thumb:"assets/rolls/dzhyns-lon-t.webp", win:"assets/fabwin/dzhyns-lon.webp" },
    { id:"kakao-lon", name:"Какао льон", transmission:"Напівзатемнення", price:580, roller:380,
      from:"#674940", to:"#60423B", img:"assets/rolls/kakao-lon.webp", thumb:"assets/rolls/kakao-lon-t.webp", win:"assets/fabwin/kakao-lon.webp" },
    { id:"liloviy-lon", name:"Ліловий льон", transmission:"Напівзатемнення", price:580, roller:380,
      from:"#B6A4C6", to:"#AC98BB", img:"assets/rolls/liloviy-lon.webp", thumb:"assets/rolls/liloviy-lon-t.webp", win:"assets/fabwin/liloviy-lon.webp" },
    { id:"persyk-lon", name:"Персик льон", transmission:"Напівзатемнення", price:580, roller:380,
      from:"#D3A97D", to:"#C6996A", img:"assets/rolls/persyk-lon.webp", thumb:"assets/rolls/persyk-lon-t.webp", win:"assets/fabwin/persyk-lon.webp" },
    { id:"slonova-kistka-lon", name:"Слонова кістка льон", transmission:"Напівзатемнення", price:580, roller:380,
      from:"#8E6F56", to:"#876950", img:"assets/rolls/slonova-kistka-lon.webp", thumb:"assets/rolls/slonova-kistka-lon-t.webp", win:"assets/fabwin/slonova-kistka-lon.webp" },
    { id:"siryi-lon", name:"Сірий льон", transmission:"Напівзатемнення", price:580, roller:380,
      from:"#8D8F93", to:"#85868A", img:"assets/rolls/siryi-lon.webp", thumb:"assets/rolls/siryi-lon-t.webp", win:"assets/fabwin/siryi-lon.webp" },
    { id:"feieriia-mokachyne", name:"Феєрія мокачине", transmission:"Напівзатемнення", price:600, roller:400,
      from:"#9F9283", to:"#978A7B", img:"assets/rolls/feieriia-mokachyne.webp", thumb:"assets/rolls/feieriia-mokachyne-t.webp", win:"assets/fabwin/feieriia-mokachyne.webp" },
    { id:"zelenyi-lon", name:"Зелений льон", transmission:"Напівзатемнення", price:580, roller:380,
      from:"#B3C43C", to:"#AABB36", img:"assets/rolls/zelenyi-lon.webp", thumb:"assets/rolls/zelenyi-lon-t.webp", win:"assets/fabwin/zelenyi-lon.webp" }
  ],

  fabricsDN: [
    { id:"bilosnizhnyi",    name:"Білосніжний", transmission:"Світлопрозора",    price:520, roller:340,
      from:"#C4C7C5", to:"#9C9F9D", img:"assets/fabrics/bilosnizhnyi.webp", thumb:"assets/fabrics/bilosnizhnyi-t.webp" },
    { id:"molochnyi",       name:"Молочний", transmission:"Світлопрозора",    price:520, roller:340,
      from:"#B6BCBB", to:"#919695", img:"assets/fabrics/molochnyi.webp", thumb:"assets/fabrics/molochnyi-t.webp" },
    { id:"bilyi-shovk",     name:"Білосніжний шовк", transmission:"Світлопрозора",    price:560, roller:370,
      from:"#A2A6A4", to:"#818483", img:"assets/fabrics/bilyi-shovk.webp", thumb:"assets/fabrics/bilyi-shovk-t.webp" },
    { id:"bezh-melanzh",    name:"Бежевий меланж", transmission:"Напівзатемнення",  price:580, roller:380,
      from:"#B3A393", to:"#8F8275", img:"assets/fabrics/bezh-melanzh.webp", thumb:"assets/fabrics/bezh-melanzh-t.webp" },
    { id:"svitlo-siryi",    name:"Світло-сірий", transmission:"Напівзатемнення",  price:580, roller:380,
      from:"#979B98", to:"#787C79", img:"assets/fabrics/svitlo-siryi.webp", thumb:"assets/fabrics/svitlo-siryi-t.webp" },
    { id:"svitle-sriblo",   name:"Світле срібло", transmission:"Напівзатемнення",  price:580, roller:380,
      from:"#8D8E8A", to:"#70716E", img:"assets/fabrics/svitle-sriblo.webp", thumb:"assets/fabrics/svitle-sriblo-t.webp" },
    { id:"nizhno-rozhevyi", name:"Ніжно-рожевий", transmission:"Напівзатемнення",  price:610, roller:400,
      from:"#B79C94", to:"#927C76", img:"assets/fabrics/nizhno-rozhevyi.webp", thumb:"assets/fabrics/nizhno-rozhevyi-t.webp" },
    { id:"myatnyi",         name:"М’ятний", transmission:"Напівзатемнення",  price:610, roller:400,
      from:"#9AAEAC", to:"#7B8B89", img:"assets/fabrics/myatnyi.webp", thumb:"assets/fabrics/myatnyi-t.webp" },
    { id:"nebesno-blakyt",  name:"Небесно-блакитний", transmission:"Напівзатемнення",  price:610, roller:400,
      from:"#9FB0B7", to:"#7F8C92", img:"assets/fabrics/nebesno-blakyt.webp", thumb:"assets/fabrics/nebesno-blakyt-t.webp" },
    { id:"fistashka",       name:"Фісташка", transmission:"Напівзатемнення",  price:610, roller:400,
      from:"#9C9B81", to:"#7C7C67", img:"assets/fabrics/fistashka.webp", thumb:"assets/fabrics/fistashka-t.webp" },
    { id:"pudrovyi-shovk",  name:"Пудровий шовк", transmission:"Напівзатемнення",  price:620, roller:410,
      from:"#86827B", to:"#6B6862", img:"assets/fabrics/pudrovyi-shovk.webp", thumb:"assets/fabrics/pudrovyi-shovk-t.webp" },
    { id:"sribnyi-shovk",   name:"Срібний шовк", transmission:"Напівзатемнення",  price:620, roller:410,
      from:"#8C908E", to:"#707371", img:"assets/fabrics/sribnyi-shovk.webp", thumb:"assets/fabrics/sribnyi-shovk-t.webp" },
    { id:"solona-karamel",  name:"Солона карамель", transmission:"Напівзатемнення",  price:620, roller:410,
      from:"#918A7D", to:"#746E64", img:"assets/fabrics/solona-karamel.webp", thumb:"assets/fabrics/solona-karamel-t.webp" },
    { id:"malakhit",        name:"Малахіт", transmission:"Напівзатемнення",  price:640, roller:420,
      from:"#908E6C", to:"#737156", img:"assets/fabrics/malakhit.webp", thumb:"assets/fabrics/malakhit-t.webp" },
    { id:"synii",           name:"Синій", transmission:"Затемнення",       price:690, roller:450,
      from:"#486177", to:"#394D5F", img:"assets/fabrics/synii.webp", thumb:"assets/fabrics/synii-t.webp" },
    { id:"chervonyi",       name:"Червоний", transmission:"Затемнення",       price:690, roller:450,
      from:"#C62A46", to:"#9E2138", img:"assets/fabrics/chervonyi.webp", thumb:"assets/fabrics/chervonyi-t.webp" },
    { id:"slyvovyi",        name:"Сливовий", transmission:"Затемнення",       price:690, roller:450,
      from:"#7C7167", to:"#635A52", img:"assets/fabrics/slyvovyi.webp", thumb:"assets/fabrics/slyvovyi-t.webp" },
    { id:"mol-shokolad",    name:"Молочний шоколад", transmission:"Затемнення",       price:690, roller:450,
      from:"#907861", to:"#73604D", img:"assets/fabrics/mol-shokolad.webp", thumb:"assets/fabrics/mol-shokolad-t.webp" },
    { id:"bel-shokolad",    name:"Бельгійський шоколад", transmission:"Затемнення",       price:690, roller:450,
      from:"#888074", to:"#6C665C", img:"assets/fabrics/bel-shokolad.webp", thumb:"assets/fabrics/bel-shokolad-t.webp" },
    { id:"grafit-shovk",    name:"Графітовий шовк", transmission:"Затемнення",       price:690, roller:450,
      from:"#79776F", to:"#605F58", img:"assets/fabrics/grafit-shovk.webp", thumb:"assets/fabrics/grafit-shovk-t.webp" }
  ],

  rooms: [
    { id:"bedroom", name:"Спальня", img:"assets/work-zebra-black.jpg",
      title:"Спальня: сон без вуличного світла",
      text:"Тут головне повністю прибрати світло від ліхтарів і ранкового сонця. Щільна тканина темних відтінків не пропускає засвітку й приглушує вуличний шум.",
      fabric:"Графітовий шовк або Бельгійський шоколад", light:"Затемнення" },
    { id:"kitchen", name:"Кухня", img:"assets/work-kitchen-grey.jpg",
      title:"Кухня: світло є, сторонніх поглядів немає",
      text:"Кухня потребує денного світла, але вікна часто виходять на прохідну зону. Напівзатемнення пропускає світло й закриває кімнату від вулиці.",
      fabric:"Світло-сірий або Бежевий меланж", light:"Напівзатемнення" },
    { id:"living", name:"Вітальня", img:"assets/work-mansard-zebra.jpg",
      title:"Вітальня: тепле світло протягом дня",
      text:"У вітальні світло має бути мʼяким і теплим. Тканини бурштинової гами розсіюють сонце й додають кімнаті затишку навіть у похмурий день.",
      fabric:"Солона карамель або Молочний", light:"Напівзатемнення" },
    { id:"office", name:"Офіс", img:"assets/corp-office.jpg",
      title:"Офіс: без відблисків на екранах",
      text:"Головна задача прибрати пряме сонце з моніторів, не занурюючи приміщення в темряву. Нейтральні відтінки не відволікають і підходять під будь-який інтерʼєр.",
      fabric:"Білосніжний або Срібний шовк", light:"Затемнення" }
  ],

  reviews: [
    { type:"photo", src:"assets/work-mansard-zebra.jpg", tag:"Наша робота", title:"Мансардне вікно", text:"Три стулки нестандартної форми" },
    { type:"photo", src:"assets/work-kitchen-grey.jpg",  tag:"Наша робота", title:"Кухня, сіра тканина", text:"Дві стулки, закрита система" },
    { type:"photo", src:"assets/work-zebra-tulle.jpg",   tag:"Наша робота", title:"Ваніль і тюль",     text:"Поєднання з наявним текстилем" },
    { type:"photo", src:"assets/work-wood-cream.jpg",    tag:"Наша робота", title:"Дерев'яне вікно",   text:"Кремова тканина, відкрита система" },
    { type:"photo", src:"assets/work-roller-white.jpg",  tag:"Наша робота", title:"Балконний блок",    text:"Вікно і двері в одному стилі" },
    { type:"photo", src:"assets/work-zebra-black.jpg",   tag:"Наша робота", title:"Графітова тканина", text:"Затемнення для спальні" }
  ],

  news: [
    { date:"2026-07-20", title:"Нові тканини в каталозі",
      excerpt:"Додали шість нових відтінків напівзатемнення, зокрема оливу й теракоту.",
      text:"Розширили базовий каталог тканин. Тепер доступні шість нових відтінків у категорії напівзатемнення. Усі новинки вже враховані в калькуляторі, вартість не змінилась." },
    { date:"2026-07-08", title:"Закрита система тепер і для класичних рулонних",
      excerpt:"Раніше касетний варіант був лише для штор день-ніч.",
      text:"Ми запустили виробництво закритих систем і для класичних рулонних штор. Вал закривається касетою, вигляд акуратніший, а тканина менше запилюється. Замовити можна прямо в калькуляторі." },
    { date:"2026-06-27", title:"Працюємо з корпоративними об'єктами",
      excerpt:"Замір, монтаж, документи та персональний менеджер для компаній.",
      text:"Для офісів, магазинів, навчальних закладів і спортивних залів працює окремий напрямок. Виїжджаємо на замір, підбираємо тканини під єдиний стиль об'єкта, готуємо документи та проводимо монтаж." }
  ]
};

window.CFG = CFG;

(function(){
  try{
    var тіло = document.body;
    var деньНіч = (тіло && тіло.dataset.onlyLine === 'daynight') ||
                  /den-nich/.test(location.pathname);
    if(деньНіч && CFG.fabricsDN && CFG.fabricsDN.length) CFG.fabrics = CFG.fabricsDN;
  }catch(e){}
})();
