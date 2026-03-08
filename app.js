// =========================================================
//  JP-LOTTERY — app.js
//  Firebase SDK compat (pas de modules ES6)
//  Fonctionne directement dans index.html via <script src>
// =========================================================

// ---- CONFIGURATION FIREBASE — remplacez par vos clés ----
const firebaseConfig = {
  apiKey:            "VOTRE_API_KEY",
  authDomain:        "VOTRE_PROJECT.firebaseapp.com",
  projectId:         "VOTRE_PROJECT_ID",
  storageBucket:     "VOTRE_PROJECT.appspot.com",
  messagingSenderId: "VOTRE_SENDER_ID",
  appId:             "VOTRE_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

// ---- STATE GLOBAL ----
const S = {
  user:    null,   // objet Firebase Auth
  profile: null,   // doc Firestore /users/{uid}
  gains:   0,
  jeu:     0,
  bt:      's',    // type de pari courant
  lot:     null,   // loterie sélectionnée
  nums:    [],     // numéros sélectionnés
  tickets: [],
  hist:    [],
  lots:    [],
  results: [],
  announces: [],
  unsubs:  [],     // listeners à détacher au logout
};

// ---- CONFIGS PARIS (cotes par défaut, écrasées par Firestore) ----
let cfg = {
  s:  { n:1, o:70,      l:'Simple'     },
  d:  { n:2, o:700,     l:'Double'     },
  t:  { n:3, o:5000,    l:'Triple'     },
  q:  { n:4, o:50000,   l:'Quadruple'  },
  '5':{ n:5, o:1000000, l:'Quinte'     },
};

// =========================================================
//  DONNÉES PAR DÉFAUT (affichées avant Firestore)
// =========================================================
function defaultLots() {
  return [
    { id:'tg', flag:'🇹🇬', country:'Togo',          name:'Loto Togo',      jackpot:85000000, drawTime:'19h30', colorClass:'c1', hot:true,  order:1 },
    { id:'bj', flag:'🇧🇯', country:'Bénin',          name:'Loto Bénin',     jackpot:72000000, drawTime:'20h00', colorClass:'c2', hot:true,  order:2 },
    { id:'gh', flag:'🇬🇭', country:'Ghana',          name:'Ghana Lotto',    jackpot:65000000, drawTime:'18h45', colorClass:'c3', hot:false, order:3 },
    { id:'ci', flag:'🇨🇮', country:"Côte d'Ivoire", name:'Loto CI',        jackpot:90000000, drawTime:'20h30', colorClass:'c4', hot:true,  order:4 },
    { id:'ne', flag:'🇳🇪', country:'Niger',          name:'Loto Niger',     jackpot:45000000, drawTime:'19h00', colorClass:'c5', hot:false, order:5 },
    { id:'bf', flag:'🇧🇫', country:'Burkina',        name:'Loto Burkina',   jackpot:52000000, drawTime:'19h15', colorClass:'c1', hot:false, order:6 },
    { id:'ml', flag:'🇲🇱', country:'Mali',           name:'Loto Mali',      jackpot:38000000, drawTime:'18h30', colorClass:'c2', hot:false, order:7 },
    { id:'sn', flag:'🇸🇳', country:'Sénégal',        name:'Loto Sénégal',   jackpot:61000000, drawTime:'20h15', colorClass:'c3', hot:false, order:8 },
    { id:'gn', flag:'🇬🇳', country:'Guinée',         name:'Loto Guinée',    jackpot:29000000, drawTime:'19h45', colorClass:'c4', hot:false, order:9 },
    { id:'cm', flag:'🇨🇲', country:'Cameroun',       name:'Loto Cameroun',  jackpot:77000000, drawTime:'20h45', colorClass:'c5', hot:false, order:10 },
    { id:'za', flag:'🇿🇦', country:'Afrique du Sud', name:'SA Lottery',     jackpot:120000000,drawTime:'21h00', colorClass:'c1', hot:true,  order:11 },
  ];
}

function defaultResults() {
  return [
    { id:'r1', lotId:'tg', flag:'🇹🇬', country:'Togo',    name:'Loto Togo',    drawLabel:'Hier 19h30', numbers:[7,14,23,45,62],  bonus:9,  jackpot:85000000 },
    { id:'r2', lotId:'bj', flag:'🇧🇯', country:'Bénin',   name:'Loto Bénin',   drawLabel:'Hier 20h00', numbers:[3,18,31,56,78],  bonus:12, jackpot:72000000 },
    { id:'r3', lotId:'gh', flag:'🇬🇭', country:'Ghana',   name:'Ghana Lotto',  drawLabel:'Hier 18h45', numbers:[11,22,33,44,55], bonus:6,  jackpot:65000000 },
    { id:'r4', lotId:'ci', flag:'🇨🇮', country:"Côte d'Ivoire", name:'Loto CI', drawLabel:'Hier 20h30', numbers:[5,19,37,61,80], bonus:15, jackpot:90000000 },
  ];
}

// =========================================================
//  INITIALISATION
// =========================================================
function init() {
  loadLots();
  loadResults();
  loadAnnounces();
  loadGameConfig();
  startTimer();
  renderNG();

  auth.onAuthStateChanged(function(user) {
    if (user) {
      S.user = user;
      loadUserProfile(user.uid, function() {
        enterApp();
      });
    } else {
      S.user = null;
      S.profile = null;
      S.gains = 0;
      S.jeu = 0;
      showAuth();
    }
  });
}

// =========================================================
//  CHARGEMENT DONNÉES
// =========================================================
function loadLots() {
  db.collection('lots').orderBy('order').get()
    .then(function(snap) {
      if (!snap.empty) {
        S.lots = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
      } else {
        S.lots = defaultLots();
      }
      renderCC();
      renderLS();
      renderFC();
      if (S.lots.length > 0) {
        S.lot = S.lots[0];
        var sl = document.getElementById('slt');
        if (sl) sl.textContent = S.lot.flag + ' ' + S.lot.country;
        var sd = document.getElementById('sd');
        if (sd) sd.textContent = S.lot.drawTime || '—';
      }
    })
    .catch(function() {
      S.lots = defaultLots();
      renderCC();
      renderLS();
      renderFC();
      if (S.lots.length > 0) {
        S.lot = S.lots[0];
      }
    });
}

function loadResults() {
  db.collection('results').orderBy('drawnAt','desc').limit(30).get()
    .then(function(snap) {
      if (!snap.empty) {
        S.results = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
      } else {
        S.results = defaultResults();
      }
      renderRes();
      renderHR();
      renderJP();
    })
    .catch(function() {
      S.results = defaultResults();
      renderRes();
      renderHR();
      renderJP();
    });
}

function loadAnnounces() {
  db.collection('announces').where('active','==',true).orderBy('createdAt','desc').limit(10).get()
    .then(function(snap) {
      S.announces = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
      renderAnnounces();
    })
    .catch(function() { S.announces = []; });
}

function loadGameConfig() {
  db.doc('gameConfigs/main').get()
    .then(function(snap) {
      if (snap.exists && snap.data().betTypes) cfg = snap.data().betTypes;
    })
    .catch(function() {});
}

function loadUserProfile(uid, cb) {
  db.doc('users/' + uid).get()
    .then(function(snap) {
      if (snap.exists) {
        S.profile = snap.data();
        S.gains = S.profile.gains || 0;
        S.jeu   = S.profile.jeu   || 0;
      }
      if (cb) cb();
    })
    .catch(function() { if (cb) cb(); });
}

function loadUserTickets(uid) {
  db.collection('tickets').where('uid','==',uid).orderBy('createdAt','desc').limit(50).get()
    .then(function(snap) {
      S.tickets = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
      renderTL();
    })
    .catch(function() { renderTL(); });
}

function loadUserHistory(uid) {
  db.collection('transactions').where('uid','==',uid).orderBy('createdAt','desc').limit(40).get()
    .then(function(snap) {
      S.hist = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
      renderMH();
    })
    .catch(function() { renderMH(); });
}

// =========================================================
//  AUTH
// =========================================================
function showAuth() {
  S.unsubs.forEach(function(u) { try { u(); } catch(e){} });
  S.unsubs = [];
  document.getElementById('authScr').classList.add('on');
  document.getElementById('mainApp').style.display = 'none';
}

function enterApp() {
  document.getElementById('authScr').classList.remove('on');
  document.getElementById('mainApp').style.display = 'flex';

  var phone = (S.profile && S.profile.phone) ? S.profile.phone : (S.user.email || '').replace('@jplottery.app','');
  var displayName = phone || 'Joueur JP';
  document.getElementById('gname').textContent = displayName;
  document.getElementById('pname').textContent = displayName;
  document.getElementById('pph').textContent   = phone;

  updBal();
  renderCC();
  renderLS();
  renderRes();
  renderFC();
  renderAnnounces();
  renderHR();
  loadUserTickets(S.user.uid);
  loadUserHistory(S.user.uid);

  // Listener temps réel soldes
  var unsubProfile = db.doc('users/' + S.user.uid).onSnapshot(function(snap) {
    if (!snap.exists) return;
    var prevGains = S.gains;
    S.profile = snap.data();
    S.gains   = S.profile.gains || 0;
    S.jeu     = S.profile.jeu   || 0;
    updBal();
    if (S.gains > prevGains && prevGains !== 0) {
      showWinNotif(S.gains - prevGains, null);
    }
  });
  S.unsubs.push(unsubProfile);

  // Listener temps réel tickets — détecte win/lose après validation GitHub Actions
  var unsubTickets = db.collection('tickets')
    .where('uid','==', S.user.uid)
    .orderBy('createdAt','desc')
    .limit(30)
    .onSnapshot(function(snap) {
      snap.docChanges().forEach(function(change) {
        if (change.type !== 'modified') return;
        var t = change.doc.data();
        if (!t.resolvedAt) return;
        var ms = t.resolvedAt.toMillis ? t.resolvedAt.toMillis() : 0;
        if (Date.now() - ms > 120000) return; // plus de 2 min = on ignore
        if (t.status === 'win') {
          showWinNotif(t.prizeAwarded || t.pot, t);
        } else if (t.status === 'lose') {
          toast(t.flag + ' ' + t.country + ' : ticket non gagnant.', '😔', 'inf');
        }
      });
      S.tickets = snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
      renderTL();
    });
  S.unsubs.push(unsubTickets);

  goScr(0);
}

// Convertit le numéro de téléphone en email fictif pour Firebase Auth
function phoneToEmail(phone) {
  var clean = phone.replace(/\s+/g,'').replace(/[^0-9+]/g,'');
  if (!clean.startsWith('+')) clean = '+' + clean;
  return clean + '@jplottery.app';
}

function setATab(t) {
  document.querySelectorAll('.atab').forEach(function(el, i) {
    el.classList.toggle('on', (i===0 && t==='l') || (i===1 && t==='r'));
  });
  document.getElementById('lf').style.display = t==='l' ? 'block' : 'none';
  document.getElementById('rf').style.display = t==='r' ? 'block' : 'none';
}

function doLogin() {
  var phone = document.getElementById('lp').value.trim();
  var pw    = document.getElementById('lpw').value;
  if (!phone || !pw) { toast('Remplissez tous les champs','❌','err'); return; }
  var email = phoneToEmail(phone);
  var btn = document.getElementById('loginBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> Connexion…';
  auth.signInWithEmailAndPassword(email, pw)
    .then(function() { btn.disabled=false; btn.textContent='🔓 Se connecter'; })
    .catch(function(e) {
      btn.disabled=false; btn.textContent='🔓 Se connecter';
      var msg = e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential'
        ? 'Numéro ou mot de passe incorrect.' : 'Erreur : ' + e.message;
      toast(msg, '❌', 'err');
    });
}

function doRegister() {
  var phone = document.getElementById('rph').value.trim();
  var pw    = document.getElementById('rpw').value;
  var pw2   = document.getElementById('rpw2').value;
  var pays  = document.getElementById('rc').value;
  if (!phone || !pw || !pw2) { toast('Remplissez les champs (*)','❌','err'); return; }
  if (pw.length < 6) { toast('Mot de passe : minimum 6 caractères','⚠️','err'); return; }
  if (pw !== pw2) { toast('Les mots de passe ne correspondent pas','❌','err'); return; }
  var email = phoneToEmail(phone);
  var btn = document.getElementById('registerBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> Création…';
  auth.createUserWithEmailAndPassword(email, pw)
    .then(function(cred) {
      var uid = cred.user.uid;
      return db.doc('users/' + uid).set({
        uid:       uid,
        phone:     phone,
        email:     email,
        pays:      pays,
        gains:     1000,
        jeu:       0,
        level:     'Bronze',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      }).then(function() {
        return db.collection('transactions').add({
          uid:       uid,
          ty:        'dep',
          ic:        '🎁',
          n:         'Bonus de bienvenue',
          amt:       1000,
          wlt:       'Compte Gains',
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      });
    })
    .then(function() {
      btn.disabled=false; btn.textContent='🎉 Créer mon compte';
      setTimeout(function() { toast('Bienvenue ! 1 000 XOF crédités 🎁','🎁','gd'); }, 700);
    })
    .catch(function(e) {
      btn.disabled=false; btn.textContent='🎉 Créer mon compte';
      var msg = e.code === 'auth/email-already-in-use'
        ? 'Ce numéro est déjà enregistré. Connectez-vous.' : 'Erreur : ' + e.message;
      toast(msg,'❌','err');
    });
}

function doLogout() {
  closeS(null,'profSh');
  auth.signOut();
  S.tickets = [];
  S.hist = [];
  S.gains = 0;
  S.jeu = 0;
}

// =========================================================
//  NAVIGATION
// =========================================================
var scrIds = ['s0','s1','s2','s3','s4'];
var navMap  = { 0:'n0', 2:'n2', 3:'n3', 4:'n4' };

function goScr(idx) {
  scrIds.forEach(function(id, i) {
    var el = document.getElementById(id);
    if (el) el.classList.toggle('on', i === idx);
  });
  document.querySelectorAll('.ni').forEach(function(n) { n.classList.remove('on'); });
  var nid = navMap[idx];
  if (nid) { var nv = document.getElementById(nid); if (nv) nv.classList.add('on'); }
  if (idx === 4) { loadUserTickets(S.user && S.user.uid); }
  if (idx === 3) { loadUserHistory(S.user && S.user.uid); }
  var sc = document.getElementById(scrIds[idx]);
  if (sc) sc.scrollTop = 0;
}

// =========================================================
//  RENDU INTERFACE
// =========================================================
function updBal() {
  var fmt = function(n) { return 'XOF ' + Math.round(n).toLocaleString('fr-FR'); };
  ['hgb','bgb'].forEach(function(id) { var el=document.getElementById(id); if(el) el.textContent=fmt(S.gains); });
  ['hjb','bjb'].forEach(function(id) { var el=document.getElementById(id); if(el) el.textContent=fmt(S.jeu); });
  var wa=document.getElementById('wa'); if(wa) wa.textContent=fmt(S.gains);
  var tg=document.getElementById('tg'); if(tg) tg.textContent=fmt(S.gains);
  var tj=document.getElementById('tj'); if(tj) tj.textContent=fmt(S.jeu);
  var sjb=document.getElementById('sjb'); if(sjb) sjb.textContent=Math.round(S.jeu).toLocaleString('fr-FR');
}

function renderLS() {
  var el = document.getElementById('hls'); if(!el) return;
  el.innerHTML = S.lots.slice(0,7).map(lcHTML).join('');
}

function renderCC() {
  var el = document.getElementById('cc'); if(!el) return;
  el.innerHTML = S.lots.map(function(l,i) {
    return '<div class="cchip' + (i===0?' sel':'') + '" onclick="selLot(\'' + l.id + '\')">' +
      '<div class="cchip-f">' + l.flag + '</div>' +
      '<div class="cchip-n">' + l.country + '</div></div>';
  }).join('');
}

function renderLS_full() {
  var el = document.getElementById('hls'); if(!el) return;
  el.innerHTML = S.lots.map(lcHTML).join('');
}

function lcHTML(l) {
  return '<div class="lcard" onclick="selLot(\'' + l.id + '\')">' +
    '<div class="lctop ' + (l.colorClass||'c1') + '">' + l.flag +
    (l.hot ? '<div class="lhot">🔥 HOT</div>' : '') + '</div>' +
    '<div class="lcbot"><div class="lcountry">' + l.country + '</div>' +
    '<div class="ljp">XOF ' + (l.jackpot||0).toLocaleString('fr-FR') + '</div>' +
    '<div class="ldraw">⏰ ' + (l.drawTime||'--') + '</div></div></div>';
}

function renderRes(filter) {
  var el = document.getElementById('rl'); if(!el) return;
  var data = filter ? S.results.filter(function(r) { return r.country===filter; }) : S.results;
  el.innerHTML = data.length ? data.map(rcHTML).join('') : '<p style="text-align:center;padding:30px;color:var(--tx3);">Aucun résultat.</p>';
}

function renderHR() {
  var el = document.getElementById('hrl'); if(!el) return;
  el.innerHTML = S.results.slice(0,3).map(rcHTML).join('');
}

function rcHTML(r) {
  var nums = (r.numbers||[]).map(function(n) {
    return '<div class="ball">' + (n<10?'0'+n:n) + '</div>';
  }).join('');
  var bon = r.bonus != null ? '<div class="ball bon">' + r.bonus + '</div>' : '';
  return '<div class="rcard">' +
    '<div class="rchead">' +
    '<div class="rctrow"><div class="rcflag">' + (r.flag||'') + '</div>' +
    '<div><div class="rcname">' + (r.name||r.country||'') + '</div>' +
    '<div class="rcdate">' + (r.drawLabel||'') + '</div></div></div>' +
    '<div class="rcjp"><div class="rcprize">XOF ' + (r.jackpot||0).toLocaleString('fr-FR') + '</div>' +
    '<div class="rcplbl">Jackpot</div></div></div>' +
    '<div class="brow">' + nums + bon + '</div></div>';
}

function renderFC() {
  var el = document.getElementById('fc'); if(!el) return;
  var countries = ['Tous'].concat(S.lots.slice(0,8).map(function(l) { return l.country; }));
  el.innerHTML = countries.map(function(c,i) {
    return '<button class="fchip' + (i===0?' on':'') + '" onclick="filterR(this,\'' + c + '\')">' + c + '</button>';
  }).join('');
}

function filterR(btn, c) {
  document.querySelectorAll('.fchip').forEach(function(b) { b.classList.remove('on'); });
  btn.classList.add('on');
  renderRes(c==='Tous' ? null : c);
}

function renderJP() {
  if (!S.results.length) return;
  var r = S.results[0];
  var jpAmt = document.getElementById('jpAmt');
  if (jpAmt) jpAmt.textContent = 'XOF ' + (r.jackpot||0).toLocaleString('fr-FR');
  var jpCountry = document.getElementById('jpCountry');
  if (jpCountry) jpCountry.textContent = (r.flag||'') + ' ' + (r.name||r.country||'') + (r.drawLabel?' – '+r.drawLabel:'');
  var jpBalls = document.getElementById('jpBalls');
  if (jpBalls) {
    jpBalls.innerHTML = (r.numbers||[]).map(function(n,i) {
      return '<div class="jpball' + (i===4?' g':'') + '">' + (n<10?'0'+n:n) + '</div>';
    }).join('');
  }
}

function renderAnnounces() {
  var band = document.getElementById('annBand');
  var txt  = document.getElementById('annBandTxt');
  var dot  = document.getElementById('notifDot');
  if (S.announces.length > 0) {
    if (band) band.style.display = 'flex';
    if (txt)  txt.textContent = S.announces[0].title || 'Nouvelle annonce';
    if (dot)  dot.style.display = 'block';
  }
  var list = document.getElementById('annList');
  if (list) {
    list.innerHTML = S.announces.map(function(a) {
      return '<div class="ann-card ' + (a.type||'') + '">' +
        '<div class="ann-title">' + (a.icon||'📢') + ' ' + (a.title||'') + '</div>' +
        '<div class="ann-body">' + (a.body||'') + '</div>' +
        '<div class="ann-date">' + (a.createdAt ? new Date(a.createdAt.seconds*1000).toLocaleDateString('fr-FR') : '') + '</div>' +
        '</div>';
    }).join('') || '<p style="text-align:center;padding:20px;color:var(--tx3);">Aucune annonce.</p>';
  }
}

function renderMH() {
  var el = document.getElementById('mh');
  if (el) el.innerHTML = S.hist.slice(0,4).map(hHTML).join('') ||
    '<p style="font-size:11px;color:var(--tx3);padding:6px 0;">Aucune transaction.</p>';
  var fh = document.getElementById('fh');
  if (fh) fh.innerHTML = S.hist.map(hHTML).join('') ||
    '<p style="font-size:11px;color:var(--tx3);text-align:center;padding:16px;">Aucune transaction.</p>';
}

function hHTML(h) {
  var amt = h.amt || 0;
  var pos = amt > 0;
  var isBet   = h.ty === 'bet';
  var isTrans = h.ty === 'trans';
  var cls = isBet ? 'bet' : isTrans ? 'bet' : pos ? 'pos' : 'neg';
  var sign = (isBet || (!pos && !isTrans)) ? '-' : '+';
  return '<div class="hitem"><div class="hico ' + (h.ty||'dep') + '">' + (h.ic||'💰') + '</div>' +
    '<div class="hinfo"><div class="hn">' + (h.n||'') + '</div>' +
    '<div class="hd">' + (h.wlt||'') + '</div></div>' +
    '<div class="hamt"><div class="hv ' + cls + '">' + sign + Math.abs(amt).toLocaleString('fr-FR') + ' XOF</div></div></div>';
}

function renderTL() {
  var el = document.getElementById('tl'); if(!el) return;
  if (!S.user) {
    el.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--tx3);"><div style="font-size:40px;margin-bottom:7px;">🔐</div><p style="font-size:12px;">Connectez-vous pour voir vos tickets.</p></div>';
    return;
  }
  if (!S.tickets.length) {
    el.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--tx3);"><div style="font-size:40px;margin-bottom:7px;">🎟</div><p style="font-size:12px;">Aucun ticket pour le moment.</p><button onclick="goScr(1)" style="margin-top:12px;padding:9px 18px;border-radius:10px;background:var(--b);color:#fff;font-weight:800;border:none;cursor:pointer;font-family:inherit;font-size:12px;">Jouer maintenant →</button></div>';
    return;
  }
  el.innerHTML = S.tickets.map(function(t) {
    var statusCls = t.status==='win' ? 'ts-w' : t.status==='lose' ? 'ts-l' : 'ts-p';
    var statusTxt = t.status==='win' ? '🏆 Gagné' : t.status==='lose' ? '❌ Perdu' : '⏳ En attente';
    var nums = (t.nums||[]).map(function(n) { return n<10?'0'+n:n; }).join(' - ');
    var dt = t.createdAt ? new Date(t.createdAt.seconds*1000).toLocaleString('fr-FR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : (t.date||'');
    return '<div class="titem"><div class="tflag">' + (t.flag||t.f||'🎰') + '</div>' +
      '<div class="tinfo"><div class="ttitle">' + (t.country||t.lot||'') + ' – ' + (t.type||'') + '</div>' +
      '<div class="tnums">' + nums + '</div>' +
      '<div class="tdate">' + dt + ' • Mise: ' + (t.amt||0).toLocaleString('fr-FR') + ' XOF • <span style="color:var(--gdp);font-weight:800;">' + (t.pot||0).toLocaleString('fr-FR') + ' XOF</span></div></div>' +
      '<div class="tstatus ' + statusCls + '">' + statusTxt + '</div></div>';
  }).join('');
}

// =========================================================
//  LOTERIE & NUMÉROS
// =========================================================
function selLot(id) {
  var l = S.lots.find(function(x) { return x.id===id; });
  if (!l) return;
  S.lot  = l;
  S.nums = [];
  document.querySelectorAll('.cchip').forEach(function(c, i) {
    c.classList.toggle('sel', S.lots[i] && S.lots[i].id === id);
  });
  var sl = document.getElementById('slt'); if(sl) sl.textContent = l.flag + ' ' + l.country;
  var sd = document.getElementById('sd');  if(sd) sd.textContent = l.drawTime || '—';
  renderNG();
  updSlip();
  goScr(1);
}

function renderNG() {
  var ng = document.getElementById('ng'); if(!ng) return;
  ng.innerHTML = '';
  for (var i=1; i<=90; i++) {
    var b = document.createElement('button');
    b.className = 'nb' + (S.nums.includes(i) ? ' sel' : '');
    b.textContent = i < 10 ? '0'+i : i;
    b.onclick = (function(n) { return function() { togN(n); }; })(i);
    ng.appendChild(b);
  }
}

function togN(n) {
  var c = cfg[S.bt];
  var idx = S.nums.indexOf(n);
  if (idx > -1) { S.nums.splice(idx, 1); }
  else {
    if (S.nums.length >= c.n) S.nums.shift();
    S.nums.push(n);
  }
  renderNG();
  updSlip();
}

function randPick() {
  var c = cfg[S.bt];
  S.nums = [];
  var pool = Array.from({length:90}, function(_,i) { return i+1; });
  for (var i=0; i<c.n; i++) {
    var r = Math.floor(Math.random() * (pool.length - i));
    S.nums.push(pool.splice(r, 1)[0]);
  }
  renderNG();
  updSlip();
}

function setBT(btn, t) {
  document.querySelectorAll('.btype').forEach(function(b) { b.classList.remove('on'); });
  btn.classList.add('on');
  S.bt   = t;
  S.nums = [];
  var c  = cfg[t];
  var ph = document.getElementById('ph'); if(ph) ph.textContent = c.n;
  var so = document.getElementById('so'); if(so) so.textContent = '×' + c.o.toLocaleString('fr-FR');
  var st = document.getElementById('stp'); if(st) st.textContent = c.l;
  renderNG();
  updSlip();
}

function setA(a) { var el=document.getElementById('ba'); if(el){ el.value=a; updSlip(); } }

function updSlip() {
  var amt = parseFloat(document.getElementById('ba') && document.getElementById('ba').value) || 0;
  var c   = cfg[S.bt];
  var sn  = document.getElementById('sn');
  if (sn) sn.textContent = S.nums.length
    ? S.nums.slice().sort(function(a,b){return a-b;}).map(function(n){return n<10?'0'+n:n;}).join(' - ')
    : '—';
  var pw = document.getElementById('pw');
  if (pw) pw.textContent = 'XOF ' + (amt * c.o).toLocaleString('fr-FR');
  var sjb = document.getElementById('sjb');
  if (sjb) sjb.textContent = Math.round(S.jeu).toLocaleString('fr-FR');
}

// =========================================================
//  PARIER
// =========================================================
function placeBet() {
  if (!S.user) { toast('Connectez-vous pour parier','⚠️','err'); return; }
  if (!S.lot)  { toast('Sélectionnez une loterie','⚠️','err'); return; }
  var amt = parseFloat(document.getElementById('ba').value) || 0;
  var c   = cfg[S.bt];
  if (S.nums.length < c.n) { toast('Sélectionnez ' + c.n + ' numéro(s) !','⚠️','err'); return; }
  if (amt < 200) { toast('Mise minimum : 200 XOF','⚠️','err'); return; }
  if (S.jeu < amt) { toast('Compte Jeu insuffisant – Alimentez !','💳','err'); setTimeout(function(){openS('transSh');},500); return; }

  var nums    = S.nums.slice().sort(function(a,b){return a-b;});
  var pot     = amt * c.o;
  var now     = new Date();
  var dateStr = now.toLocaleString('fr-FR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
  var uid     = S.user.uid;

  // Débit immédiat du Compte Jeu
  db.doc('users/' + uid).update({
    jeu: firebase.firestore.FieldValue.increment(-amt)
  }).then(function() {
    S.jeu -= amt;
    updBal();
    return db.collection('tickets').add({
      uid:       uid,
      lotId:     S.lot.id,
      flag:      S.lot.flag,
      country:   S.lot.country,
      type:      c.l,
      typeKey:   S.bt,
      nums:      nums,
      amt:       amt,
      pot:       pot,
      status:    'pending',
      processed: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }).then(function(ref) {
    return db.collection('transactions').add({
      uid:       uid,
      ty:        'bet',
      ic:        '🎰',
      n:         'Pari ' + c.l + ' – ' + S.lot.flag + ' ' + S.lot.country,
      amt:       -amt,
      wlt:       'Compte Jeu',
      ticketId:  ref.id,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    }).then(function() { return ref; });
  }).then(function(ref) {
    // Affiche confirmation
    document.getElementById('tid').textContent = '#' + ref.id.slice(-8).toUpperCase();
    document.getElementById('tcd').innerHTML =
      '<div class="tdetrow"><span class="tdlbl">Loterie</span><span class="tdval">' + S.lot.flag + ' ' + S.lot.country + '</span></div>' +
      '<div class="tdetrow"><span class="tdlbl">Type</span><span class="tdval">' + c.l + '</span></div>' +
      '<div class="tdetrow"><span class="tdlbl">Tirage</span><span class="tdval">' + (S.lot.drawTime||'—') + '</span></div>' +
      '<div class="tdetrow"><span class="tdlbl">Mise</span><span class="tdval">' + amt.toLocaleString('fr-FR') + ' XOF</span></div>' +
      '<div class="tdetrow"><span class="tdlbl">Gain potentiel</span><span class="tdval win">' + pot.toLocaleString('fr-FR') + ' XOF</span></div>';
    document.getElementById('tcb').innerHTML = nums.map(function(n) {
      return '<div class="ball">' + (n<10?'0'+n:n) + '</div>';
    }).join('');
    S.nums = [];
    renderNG();
    var ba = document.getElementById('ba'); if(ba) ba.value='';
    updSlip();
    openS('tcSh');
  })
  .catch(function(e) { toast('Erreur : ' + e.message,'❌','err'); });
}

// =========================================================
//  PORTEFEUILLE
// =========================================================
function doDeposit() {
  var amt = parseFloat(document.getElementById('da').value)||0;
  var ph  = document.getElementById('dp').value.trim();
  if (!S.user) { toast('Connectez-vous','❌','err'); return; }
  if (amt < 500) { toast('Montant minimum : 500 XOF','⚠️','err'); return; }
  if (!ph) { toast('Entrez votre numéro Mobile Money','⚠️','err'); return; }
  var uid = S.user.uid;
  db.doc('users/' + uid).update({ gains: firebase.firestore.FieldValue.increment(amt) })
    .then(function() {
      return db.collection('transactions').add({
        uid:       uid, ty:'dep', ic:'⬆️',
        n:         'Recharge Mobile Money (' + ph + ')',
        amt:       amt, wlt:'Compte Gains',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    })
    .then(function() {
      S.gains += amt;
      updBal();
      loadUserHistory(uid);
      closeS(null,'depSh');
      toast('+' + amt.toLocaleString('fr-FR') + ' XOF → Compte Gains ✅','💳','ok');
      document.getElementById('da').value='';
      document.getElementById('dp').value='';
    })
    .catch(function(e) { toast('Erreur : ' + e.message,'❌','err'); });
}

function doWithdraw() {
  var amt = parseFloat(document.getElementById('wia').value)||0;
  var ph  = document.getElementById('wip').value.trim();
  if (amt < 1000) { toast('Retrait minimum : 1 000 XOF','⚠️','err'); return; }
  if (S.gains < amt) { toast('Solde Compte Gains insuffisant','❌','err'); return; }
  if (!ph) { toast('Entrez votre numéro','⚠️','err'); return; }
  var uid = S.user.uid;
  db.doc('users/' + uid).update({ gains: firebase.firestore.FieldValue.increment(-amt) })
    .then(function() {
      return db.collection('transactions').add({
        uid:       uid, ty:'wit', ic:'⬇️',
        n:         'Retrait Mobile Money (' + ph + ')',
        amt:       -amt, wlt:'Compte Gains',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    })
    .then(function() {
      S.gains -= amt;
      updBal();
      loadUserHistory(uid);
      closeS(null,'witSh');
      toast('Retrait ' + amt.toLocaleString('fr-FR') + ' XOF en cours','💸','ok');
      document.getElementById('wia').value='';
      document.getElementById('wip').value='';
    })
    .catch(function(e) { toast('Erreur : ' + e.message,'❌','err'); });
}

function doTransfer() {
  var amt = parseFloat(document.getElementById('tra').value)||0;
  if (amt < 100) { toast('Montant invalide','⚠️','err'); return; }
  if (S.gains < amt) { toast('Compte Gains insuffisant','❌','err'); return; }
  var uid = S.user.uid;
  db.doc('users/' + uid).update({
    gains: firebase.firestore.FieldValue.increment(-amt),
    jeu:   firebase.firestore.FieldValue.increment(+amt),
  }).then(function() {
    return db.collection('transactions').add({
      uid:       uid, ty:'trans', ic:'⇄',
      n:         'Transfert Gains → Jeu',
      amt:       amt, wlt:'Interne',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }).then(function() {
    S.gains -= amt;
    S.jeu   += amt;
    updBal();
    loadUserHistory(uid);
    closeS(null,'transSh');
    toast(amt.toLocaleString('fr-FR') + ' XOF → Compte Jeu ✅','⇄','ok');
    document.getElementById('tra').value='';
  })
  .catch(function(e) { toast('Erreur : ' + e.message,'❌','err'); });
}

// =========================================================
//  TIMER COUNTDOWN
// =========================================================
function startTimer() {
  function tick() {
    var now   = new Date();
    var next  = new Date(now);
    next.setHours(19, 30, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    var diff = Math.floor((next - now) / 1000);
    var h    = Math.floor(diff/3600);
    var m    = Math.floor((diff%3600)/60);
    var s    = diff%60;
    var pad  = function(n) { return n<10?'0'+n:n; };
    var jH=document.getElementById('jH'), jM=document.getElementById('jM'), jS=document.getElementById('jS');
    if(jH) jH.textContent=pad(h);
    if(jM) jM.textContent=pad(m);
    if(jS) jS.textContent=pad(s);
  }
  tick();
  setInterval(tick, 1000);
}

// =========================================================
//  SHEETS & UI UTILITAIRES
// =========================================================
function openS(id) {
  document.getElementById(id).classList.add('on');
  if (id==='transSh') {
    var tg=document.getElementById('tg'); if(tg) tg.textContent='XOF '+Math.round(S.gains).toLocaleString('fr-FR');
    var tj=document.getElementById('tj'); if(tj) tj.textContent='XOF '+Math.round(S.jeu).toLocaleString('fr-FR');
  }
  if (id==='witSh') { var wa=document.getElementById('wa'); if(wa) wa.textContent='XOF '+Math.round(S.gains).toLocaleString('fr-FR'); }
  if (id==='histSh') renderMH();
  if (id==='annSh')  renderAnnounces();
}

function closeS(e, id, goTickets) {
  if (e && e.target !== document.getElementById(id)) return;
  document.getElementById(id).classList.remove('on');
  if (goTickets === true) goScr(4);
}

function selOp(el, gid) {
  document.getElementById(gid).querySelectorAll('.opitem').forEach(function(i) { i.classList.remove('sel'); });
  el.classList.add('sel');
}

var _toastTimer;
function toast(msg, ic, type) {
  var t = document.getElementById('toast');
  document.getElementById('tmsg').textContent = msg;
  document.getElementById('tico').textContent = ic || '✅';
  t.className = 'toast ' + (type||'inf');
  setTimeout(function() { t.classList.add('on'); }, 10);
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function() { t.classList.remove('on'); }, 3400);
}

// =========================================================
//  WIN OVERLAY
// =========================================================
function showWinNotif(amount, ticket) {
  var existing = document.getElementById('winOverlay');
  if (existing) existing.remove();
  var el = document.createElement('div');
  el.id = 'winOverlay';
  var lotInfo = ticket ? (ticket.flag||'') + ' ' + (ticket.country||'') + ' — ' + (ticket.type||'') : 'Votre pari';
  el.innerHTML =
    '<div style="text-align:center;padding:28px 24px;max-width:340px;">' +
    '<div style="font-size:64px;margin-bottom:8px;animation:bounceY .6s ease infinite alternate;">🏆</div>' +
    '<div style="font-family:\'Orbitron\',sans-serif;font-size:13px;font-weight:900;color:rgba(255,255,255,.7);letter-spacing:2px;margin-bottom:5px;">FÉLICITATIONS !</div>' +
    '<div style="font-size:12px;color:rgba(255,255,255,.7);margin-bottom:13px;">' + lotInfo + '</div>' +
    '<div style="font-family:\'Orbitron\',sans-serif;font-size:34px;font-weight:900;color:var(--gd);text-shadow:0 0 28px rgba(240,180,41,.6);">+' + Math.round(amount||0).toLocaleString('fr-FR') + ' XOF</div>' +
    '<div style="font-size:11px;color:rgba(255,255,255,.6);margin-top:5px;">Crédité sur votre Compte Gains</div>' +
    '<button onclick="document.getElementById(\'winOverlay\').remove()" style="margin-top:26px;padding:13px 30px;border-radius:50px;background:linear-gradient(135deg,var(--gdp),var(--gd));border:none;color:#000;font-size:14px;font-weight:900;cursor:pointer;font-family:inherit;box-shadow:0 4px 18px rgba(240,180,41,.5);">💰 Voir mon portefeuille</button>' +
    '</div>';
  document.getElementById('app').appendChild(el);
}

// =========================================================
//  LANCEMENT
// =========================================================
init();
