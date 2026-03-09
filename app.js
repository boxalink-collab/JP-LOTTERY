// =========================================================
//  JP-LOTTERY — app.js  (Firebase SDK compat)
// =========================================================

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

const S = {
  user:null, profile:null, gains:0, jeu:0,
  bt:'', lot:null, nums:[],
  tickets:[], hist:[], lots:[], results:[], announces:[],
  bonusConfig:{ welcome:1000, active:true },
  unsubs:[],
};
let cfg = {};

// =========================================================
//  INIT
// =========================================================
function init() {
  loadPublicData();
  startTimer();
  auth.onAuthStateChanged(function(user){
    if (user){ S.user=user; loadUserProfile(user.uid, function(){ enterApp(); }); }
    else { S.user=null; S.profile=null; S.gains=0; S.jeu=0; showGuest(); }
  });
}

function loadPublicData(){
  loadLots(); loadResults(); loadAnnounces(); loadGameConfig(); loadBonusConfig();
}

// =========================================================
//  CHARGEMENT
// =========================================================
function loadLots(){
  db.collection('lots').where('active','==',true).orderBy('order').get()
    .then(function(snap){
      S.lots = snap.docs.map(function(d){ return Object.assign({id:d.id},d.data()); });
      renderCC(); renderLS(); renderFC();
      if (S.lots.length && !S.lot){ S.lot=S.lots[0]; _updateLotUI(S.lot); }
    }).catch(function(e){ console.warn('loadLots:',e.message); });
}

function _updateLotUI(l){
  var sl=document.getElementById('slt'); if(sl) sl.textContent=l.flag+' '+l.country;
  var sd=document.getElementById('sd');  if(sd) sd.textContent=l.drawTime||'—';
}

function loadResults(){
  db.collection('results').orderBy('drawnAt','desc').limit(30).get()
    .then(function(snap){
      S.results=snap.docs.map(function(d){ return Object.assign({id:d.id},d.data()); });
      renderRes(); renderHR(); renderJP();
    }).catch(function(e){ console.warn('loadResults:',e.message); });
}

function loadAnnounces(){
  db.collection('announces').where('active','==',true).orderBy('createdAt','desc').limit(10).get()
    .then(function(snap){
      S.announces=snap.docs.map(function(d){ return Object.assign({id:d.id},d.data()); });
      renderAnnounces();
    }).catch(function(){});
}

function loadGameConfig(){
  db.doc('gameConfigs/main').get()
    .then(function(snap){
      if (snap.exists && snap.data().betTypes){
        cfg=snap.data().betTypes;
        renderBetTypes();
      }
    }).catch(function(){});
}

function loadBonusConfig(){
  db.doc('bonusConfig/main').get()
    .then(function(snap){ if(snap.exists) S.bonusConfig=snap.data(); })
    .catch(function(){});
}

function loadUserProfile(uid,cb){
  db.doc('users/'+uid).get()
    .then(function(snap){
      if(snap.exists){ S.profile=snap.data(); S.gains=S.profile.gains||0; S.jeu=S.profile.jeu||0; }
      if(cb) cb();
    }).catch(function(){ if(cb) cb(); });
}

function loadUserTickets(uid){
  if(!uid) return;
  db.collection('tickets').where('uid','==',uid).orderBy('createdAt','desc').limit(50).get()
    .then(function(snap){
      S.tickets=snap.docs.map(function(d){ return Object.assign({id:d.id},d.data()); });
      renderTL();
    }).catch(function(){ renderTL(); });
}

function loadUserHistory(uid){
  if(!uid) return;
  db.collection('transactions').where('uid','==',uid).orderBy('createdAt','desc').limit(50).get()
    .then(function(snap){
      S.hist=snap.docs.map(function(d){ return Object.assign({id:d.id},d.data()); });
      renderMH();
    }).catch(function(){ renderMH(); });
}

// =========================================================
//  AUTH
// =========================================================
function showGuest(){
  S.unsubs.forEach(function(u){ try{u();}catch(e){} }); S.unsubs=[];
  _setGuestUI(); updBal();
  renderCC(); renderLS(); renderRes(); renderFC(); renderAnnounces(); renderHR(); renderTL();
  _showOnlyScreen(0);
}

function _setGuestUI(){
  var ghello=document.getElementById('ghello'); if(ghello) ghello.textContent='Bienvenue 👋';
  var gname=document.getElementById('gname');   if(gname)  gname.textContent='Visiteur';
  var guest=document.getElementById('guestBanner'); if(guest) guest.style.display='flex';
  var wallet=document.getElementById('walletRow');  if(wallet) wallet.style.display='none';
  var nb=document.getElementById('notifBtn'); if(nb) nb.style.display='none';
  var ab=document.getElementById('authBtn');  if(ab){ ab.textContent='🔐'; ab.title='Se connecter'; }
}

function enterApp(){
  var authSh=document.getElementById('authSh'); if(authSh) authSh.classList.remove('on');
  var guest=document.getElementById('guestBanner');  if(guest)  guest.style.display='none';
  var wallet=document.getElementById('walletRow');   if(wallet) wallet.style.display='flex';
  var nb=document.getElementById('notifBtn'); if(nb) nb.style.display='flex';
  var ab=document.getElementById('authBtn');  if(ab){ ab.textContent='👤'; ab.title='Mon profil'; }

  var phone  =(S.profile&&S.profile.phone)  ?S.profile.phone  :(S.user.email||'').replace('@jplottery.app','');
  var pseudo =(S.profile&&S.profile.pseudo) ?S.profile.pseudo :'';
  var nom    =(S.profile&&S.profile.nom)    ?S.profile.nom    :'';
  var prenom =(S.profile&&S.profile.prenom) ?S.profile.prenom :'';
  var display=pseudo||(prenom?prenom+' '+nom:phone)||'Joueur JP';
  var full   =(prenom&&nom)?prenom+' '+nom:display;

  var ghello=document.getElementById('ghello');   if(ghello)  ghello.textContent='Bonjour 👋';
  var gname=document.getElementById('gname');     if(gname)   gname.textContent=display;
  var pname=document.getElementById('pname');     if(pname)   pname.textContent=display;
  var pfull=document.getElementById('pfullname'); if(pfull)   pfull.textContent=full;
  var pph=document.getElementById('pph');         if(pph)     pph.textContent=phone;
  var ppseudo=document.getElementById('ppseudo'); if(ppseudo) ppseudo.textContent=pseudo?'@'+pseudo:'';

  updBal(); renderCC(); renderLS(); renderRes(); renderFC(); renderAnnounces(); renderHR();
  loadUserTickets(S.user.uid); loadUserHistory(S.user.uid);

  var unsubP=db.doc('users/'+S.user.uid).onSnapshot(function(snap){
    if(!snap.exists) return;
    S.profile=snap.data(); S.gains=S.profile.gains||0; S.jeu=S.profile.jeu||0; updBal();
  });
  S.unsubs.push(unsubP);

  var unsubT=db.collection('tickets').where('uid','==',S.user.uid)
    .orderBy('createdAt','desc').limit(30)
    .onSnapshot(function(snap){
      snap.docChanges().forEach(function(ch){
        if(ch.type!=='modified') return;
        var t=ch.doc.data(); if(!t.resolvedAt) return;
        var ms=t.resolvedAt.toMillis?t.resolvedAt.toMillis():0;
        if(Date.now()-ms>120000) return;
        if(t.status==='win')  showWinNotif(t.prizeAwarded||t.pot,t);
        if(t.status==='lose') toast((t.flag||'')+' '+(t.country||'')+' : ticket non gagnant.','😔','inf');
      });
      S.tickets=snap.docs.map(function(d){ return Object.assign({id:d.id},d.data()); });
      renderTL();
    });
  S.unsubs.push(unsubT);

  _showOnlyScreen(0);
}

function phoneToEmail(phone){
  var c=phone.replace(/\s+/g,'').replace(/[^0-9+]/g,'');
  if(!c.startsWith('+')) c='+'+c;
  return c+'@jplottery.app';
}

function openAuthOrProfile(){ if(S.user) openS('profSh'); else{ openS('authSh'); setATab('l'); } }

function requireAuth(){
  if(!S.user){ openS('authSh'); setATab('l'); toast('Connectez-vous pour effectuer cette action','🔐','inf'); return false; }
  return true;
}

function closeAuthSh(e){
  var el=document.getElementById('authSh');
  if(e&&e.target!==el) return;
  el.classList.remove('on');
}

function setATab(t){
  var tabL=document.getElementById('authTabL'); if(tabL) tabL.classList.toggle('on',t==='l');
  var tabR=document.getElementById('authTabR'); if(tabR) tabR.classList.toggle('on',t==='r');
  document.getElementById('lf').style.display=t==='l'?'block':'none';
  document.getElementById('rf').style.display=t==='r'?'block':'none';
}

function doLogin(){
  var phone=document.getElementById('lp').value.trim();
  var pw=document.getElementById('lpw').value;
  if(!phone||!pw){ toast('Remplissez tous les champs','❌','err'); return; }
  var btn=document.getElementById('loginBtn');
  btn.disabled=true; btn.innerHTML='<span class="spin"></span> Connexion…';
  auth.signInWithEmailAndPassword(phoneToEmail(phone),pw)
    .then(function(){ btn.disabled=false; btn.textContent='🔓 Se connecter'; })
    .catch(function(e){
      btn.disabled=false; btn.textContent='🔓 Se connecter';
      toast(['auth/invalid-credential','auth/wrong-password','auth/user-not-found'].includes(e.code)
        ?'Numéro ou mot de passe incorrect.':'Erreur : '+e.message,'❌','err');
    });
}

function doRegister(){
  var nom=document.getElementById('rnom').value.trim();
  var prenom=document.getElementById('rprenom').value.trim();
  var pseudo=document.getElementById('rpseudo').value.trim();
  var phone=document.getElementById('rph').value.trim();
  var pw=document.getElementById('rpw').value;
  var pw2=document.getElementById('rpw2').value;
  var pays=document.getElementById('rc').value;
  if(!nom||!prenom||!pseudo||!phone||!pw||!pw2){ toast('Remplissez tous les champs (*)','❌','err'); return; }
  if(pseudo.length<3){ toast('Pseudo : minimum 3 caractères','⚠️','err'); return; }
  if(pw.length<6){ toast('Mot de passe : minimum 6 caractères','⚠️','err'); return; }
  if(pw!==pw2){ toast('Les mots de passe ne correspondent pas','❌','err'); return; }
  var email=phoneToEmail(phone);
  var btn=document.getElementById('registerBtn');
  btn.disabled=true; btn.innerHTML='<span class="spin"></span> Création…';

  var welcomeBonus=(S.bonusConfig&&S.bonusConfig.active&&S.bonusConfig.welcome)?S.bonusConfig.welcome:0;

  auth.createUserWithEmailAndPassword(email,pw)
    .then(function(cred){
      var uid=cred.user.uid;
      return db.doc('users/'+uid).set({
        uid,nom,prenom,pseudo,phone,email,pays,
        gains:welcomeBonus, jeu:0, level:'Bronze',
        createdAt:firebase.firestore.FieldValue.serverTimestamp(),
      }).then(function(){
        if(welcomeBonus>0) return db.collection('transactions').add({
          uid,ty:'bonus',ic:'🎁',n:'Bonus de bienvenue',
          amt:welcomeBonus,wlt:'Compte Gains',
          createdAt:firebase.firestore.FieldValue.serverTimestamp(),
        });
      });
    })
    .then(function(){
      btn.disabled=false; btn.textContent='🎉 Créer mon compte';
      if(welcomeBonus>0) setTimeout(function(){ toast('Bienvenue ! '+welcomeBonus.toLocaleString('fr-FR')+' XOF crédités 🎁','🎁','gd'); },700);
    })
    .catch(function(e){
      btn.disabled=false; btn.textContent='🎉 Créer mon compte';
      toast(e.code==='auth/email-already-in-use'?'Ce numéro est déjà enregistré. Connectez-vous.':'Erreur : '+e.message,'❌','err');
    });
}

function doLogout(){
  closeS(null,'profSh'); S.tickets=[]; S.hist=[]; auth.signOut();
}

// =========================================================
//  NAVIGATION — correction affichage multi-onglet
// =========================================================
var scrIds=['s0','s1','s2','s3','s4'];
var navMap={0:'n0',2:'n2',3:'n3',4:'n4'};
var PROTECTED=[1,3,4];

// Affiche UNIQUEMENT l'écran idx, cache tous les autres
function _showOnlyScreen(idx){
  scrIds.forEach(function(id,i){
    var el=document.getElementById(id);
    if(!el) return;
    if(i===idx){ el.style.display='flex'; el.classList.add('on'); }
    else { el.style.display='none'; el.classList.remove('on'); }
  });
  document.querySelectorAll('.ni').forEach(function(n){ n.classList.remove('on'); });
  var nid=navMap[idx]; if(nid){ var nv=document.getElementById(nid); if(nv) nv.classList.add('on'); }
  var sc=document.getElementById(scrIds[idx]); if(sc) sc.scrollTop=0;
}

function goScr(idx){
  if(PROTECTED.indexOf(idx)!==-1&&!S.user){
    openS('authSh'); setATab('l');
    toast('Connectez-vous pour accéder à cette section','🔐','inf');
    return;
  }
  _showOnlyScreen(idx);
  if(idx===4) loadUserTickets(S.user&&S.user.uid);
  if(idx===3) loadUserHistory(S.user&&S.user.uid);
}

// =========================================================
//  RENDU
// =========================================================
function updBal(){
  var fmt=function(n){ return 'XOF '+Math.round(n||0).toLocaleString('fr-FR'); };
  ['hgb','bgb'].forEach(function(id){ var e=document.getElementById(id); if(e) e.textContent=fmt(S.gains); });
  ['hjb','bjb'].forEach(function(id){ var e=document.getElementById(id); if(e) e.textContent=fmt(S.jeu); });
  var wa=document.getElementById('wa'); if(wa) wa.textContent=fmt(S.gains);
  var tg=document.getElementById('tg'); if(tg) tg.textContent=fmt(S.gains);
  var tj=document.getElementById('tj'); if(tj) tj.textContent=fmt(S.jeu);
  var sjb=document.getElementById('sjb'); if(sjb) sjb.textContent=Math.round(S.jeu||0).toLocaleString('fr-FR');
}

function renderLS(){
  var el=document.getElementById('hls'); if(!el) return;
  el.innerHTML=S.lots.slice(0,7).map(lcHTML).join('')||
    '<p style="color:var(--tx3);font-size:11px;padding:8px;">Aucun jeu disponible.</p>';
}

function renderCC(){
  var el=document.getElementById('cc'); if(!el) return;
  el.innerHTML=S.lots.map(function(l,i){
    return '<div class="cchip'+(i===0?' sel':'')+'" onclick="selLot(\''+l.id+'\')">'+
      '<div class="cchip-f">'+l.flag+'</div><div class="cchip-n">'+l.country+'</div></div>';
  }).join('')||'<p style="color:var(--tx3);font-size:11px;padding:12px 20px;">Aucun jeu. Créez-en via l\'admin.</p>';
}

function lcHTML(l){
  return '<div class="lcard" onclick="selLot(\''+l.id+'\')">'+
    '<div class="lctop '+(l.colorClass||'c1')+'">'+l.flag+
    (l.hot?'<div class="lhot">🔥 HOT</div>':'')+
    '</div><div class="lcbot">'+
    '<div class="lcountry">'+l.country+'</div>'+
    '<div class="ljp">XOF '+(l.jackpot||0).toLocaleString('fr-FR')+'</div>'+
    '<div class="ldraw">⏰ '+(l.drawTime||'--')+'</div></div></div>';
}

function renderRes(filter){
  var el=document.getElementById('rl'); if(!el) return;
  var data=filter?S.results.filter(function(r){ return r.country===filter; }):S.results;
  el.innerHTML=data.length?data.map(rcHTML).join(''):
    '<p style="text-align:center;padding:30px;color:var(--tx3);">Aucun résultat.</p>';
}

function renderHR(){
  var el=document.getElementById('hrl'); if(!el) return;
  el.innerHTML=S.results.slice(0,3).map(rcHTML).join('');
}

function rcHTML(r){
  var nums=(r.numbers||[]).map(function(n){ return '<div class="ball">'+(n<10?'0'+n:n)+'</div>'; }).join('');
  var bon=r.bonus!=null?'<div class="ball bon">'+r.bonus+'</div>':'';
  return '<div class="rcard">'+
    '<div class="rchead"><div class="rctrow"><div class="rcflag">'+(r.flag||'')+'</div>'+
    '<div><div class="rcname">'+(r.name||r.country||'')+'</div>'+
    '<div class="rcdate">'+(r.drawLabel||'')+'</div></div></div>'+
    '<div class="rcjp"><div class="rcprize">XOF '+(r.jackpot||0).toLocaleString('fr-FR')+'</div>'+
    '<div class="rcplbl">Jackpot</div></div></div>'+
    '<div class="brow">'+nums+bon+'</div></div>';
}

function renderFC(){
  var el=document.getElementById('fc'); if(!el) return;
  var countries=['Tous'].concat(S.lots.slice(0,8).map(function(l){ return l.country; }));
  el.innerHTML=countries.map(function(c,i){
    return '<button class="fchip'+(i===0?' on':'')+'" onclick="filterR(this,\''+c+'\')">'+c+'</button>';
  }).join('');
}

function filterR(btn,c){
  document.querySelectorAll('.fchip').forEach(function(b){ b.classList.remove('on'); });
  btn.classList.add('on'); renderRes(c==='Tous'?null:c);
}

function renderJP(){
  if(!S.results.length) return;
  var r=S.results[0];
  var jpAmt=document.getElementById('jpAmt'); if(jpAmt) jpAmt.textContent='XOF '+(r.jackpot||0).toLocaleString('fr-FR');
  var jpC=document.getElementById('jpCountry'); if(jpC) jpC.textContent=(r.flag||'')+' '+(r.name||r.country||'')+(r.drawLabel?' – '+r.drawLabel:'');
  var jpB=document.getElementById('jpBalls');
  if(jpB) jpB.innerHTML=(r.numbers||[]).map(function(n,i){
    return '<div class="jpball'+(i===4?' g':'')+'">'+( n<10?'0'+n:n)+'</div>';
  }).join('');
}

function renderAnnounces(){
  var band=document.getElementById('annBand'),txt=document.getElementById('annBandTxt'),dot=document.getElementById('notifDot');
  if(S.announces.length>0){
    if(band) band.style.display='flex';
    if(txt)  txt.textContent=S.announces[0].title||'Nouvelle annonce';
    if(dot)  dot.style.display='block';
  }
  var list=document.getElementById('annList');
  if(list) list.innerHTML=S.announces.map(function(a){
    return '<div class="ann-card '+(a.type||'')+'">'+
      '<div class="ann-title">'+(a.icon||'📢')+' '+(a.title||'')+'</div>'+
      '<div class="ann-body">'+(a.body||'')+'</div>'+
      '<div class="ann-date">'+(a.createdAt?new Date(a.createdAt.seconds*1000).toLocaleDateString('fr-FR'):'')+'</div></div>';
  }).join('')||'<p style="text-align:center;padding:20px;color:var(--tx3);">Aucune annonce.</p>';
}

function renderMH(){
  var el=document.getElementById('mh');
  if(el) el.innerHTML=S.hist.slice(0,4).map(hHTML).join('')||'<p style="font-size:11px;color:var(--tx3);padding:6px 0;">Aucune transaction.</p>';
  var fh=document.getElementById('fh');
  if(fh) fh.innerHTML=S.hist.map(hHTML).join('')||'<p style="font-size:11px;color:var(--tx3);text-align:center;padding:16px;">Aucune transaction.</p>';
}

function hHTML(h){
  var amt=h.amt||0,pos=amt>0,isBet=h.ty==='bet'||h.ty==='trans';
  var cls=isBet?'bet':pos?'pos':'neg',sign=(isBet||!pos)?'-':'+';
  return '<div class="hitem"><div class="hico '+(h.ty||'dep')+'">'+(h.ic||'💰')+'</div>'+
    '<div class="hinfo"><div class="hn">'+(h.n||'')+'</div><div class="hd">'+(h.wlt||'')+'</div></div>'+
    '<div class="hamt"><div class="hv '+cls+'">'+sign+Math.abs(amt).toLocaleString('fr-FR')+' XOF</div></div></div>';
}

function renderTL(){
  var el=document.getElementById('tl'); if(!el) return;
  if(!S.user){
    el.innerHTML='<div style="text-align:center;padding:40px 20px;color:var(--tx3);"><div style="font-size:40px;margin-bottom:7px;">🔐</div><p style="font-size:12px;">Connectez-vous pour voir vos tickets.</p></div>';
    return;
  }
  if(!S.tickets.length){
    el.innerHTML='<div style="text-align:center;padding:40px 20px;color:var(--tx3);"><div style="font-size:40px;margin-bottom:7px;">🎟</div><p style="font-size:12px;">Aucun ticket pour le moment.</p>'+
      '<button onclick="goScr(1)" style="margin-top:12px;padding:9px 18px;border-radius:10px;background:var(--b);color:#fff;font-weight:800;border:none;cursor:pointer;font-family:inherit;font-size:12px;">Jouer maintenant →</button></div>';
    return;
  }
  el.innerHTML=S.tickets.map(function(t){
    var sc=t.status==='win'?'ts-w':t.status==='lose'?'ts-l':'ts-p';
    var sl=t.status==='win'?'🏆 Gagné':t.status==='lose'?'❌ Perdu':'⏳ En attente';
    var nums=(t.nums||[]).map(function(n){ return n<10?'0'+n:n; }).join(' - ');
    var dt=t.createdAt?new Date(t.createdAt.seconds*1000).toLocaleString('fr-FR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):(t.date||'');
    return '<div class="titem"><div class="tflag">'+(t.flag||'🎰')+'</div>'+
      '<div class="tinfo"><div class="ttitle">'+(t.country||'')+' – '+(t.type||'')+'</div>'+
      '<div class="tnums">'+nums+'</div>'+
      '<div class="tdate">'+dt+' • Mise: '+(t.amt||0).toLocaleString('fr-FR')+' XOF • <span style="color:var(--gdp);font-weight:800;">'+(t.pot||0).toLocaleString('fr-FR')+' XOF</span></div></div>'+
      '<div class="tstatus '+sc+'">'+sl+'</div></div>';
  }).join('');
}

// =========================================================
//  BET TYPES — 100% depuis Firestore, rien en dur
// =========================================================
function renderBetTypes(){
  var el=document.getElementById('betTypesRow'); if(!el) return;
  var keys=Object.keys(cfg);
  if(!keys.length){
    el.innerHTML='<p style="color:var(--tx3);font-size:11px;padding:12px 20px;">Aucun type de pari configuré. Ajoutez-en via l\'admin.</p>';
    return;
  }
  el.innerHTML=keys.map(function(k,i){
    var v=cfg[k];
    return '<button class="btype'+(i===0?' on':'')+'" onclick="setBT(this,\''+k+'\')">'+
      v.l+'<span class="btype-odds">×'+v.o.toLocaleString('fr-FR')+'</span></button>';
  }).join('');
  // Sélectionner le premier
  S.bt=keys[0];
  var c=cfg[S.bt];
  var ph=document.getElementById('ph'); if(ph) ph.textContent=c.n;
  var so=document.getElementById('so'); if(so) so.textContent='×'+c.o.toLocaleString('fr-FR');
  var st=document.getElementById('stp'); if(st) st.textContent=c.l;
}

// =========================================================
//  LOTERIE
// =========================================================
function selLot(id){
  var l=S.lots.find(function(x){ return x.id===id; }); if(!l) return;
  S.lot=l; S.nums=[];
  document.querySelectorAll('.cchip').forEach(function(c,i){ c.classList.toggle('sel',S.lots[i]&&S.lots[i].id===id); });
  _updateLotUI(l); renderNG(); updSlip(); goScr(1);
}

function renderNG(){
  var ng=document.getElementById('ng'); if(!ng) return;
  ng.innerHTML='';
  for(var i=1;i<=90;i++){
    var b=document.createElement('button');
    b.className='nb'+(S.nums.includes(i)?' sel':'');
    b.textContent=i<10?'0'+i:i;
    b.onclick=(function(n){ return function(){ togN(n); }; })(i);
    ng.appendChild(b);
  }
}

function togN(n){
  if(!cfg[S.bt]) return;
  var c=cfg[S.bt],idx=S.nums.indexOf(n);
  if(idx>-1) S.nums.splice(idx,1);
  else{ if(S.nums.length>=c.n) S.nums.shift(); S.nums.push(n); }
  renderNG(); updSlip();
}

function randPick(){
  if(!cfg[S.bt]) return;
  var c=cfg[S.bt]; S.nums=[];
  var pool=Array.from({length:90},function(_,i){ return i+1; });
  for(var i=0;i<c.n;i++){
    var r=Math.floor(Math.random()*(pool.length-i));
    S.nums.push(pool.splice(r,1)[0]);
  }
  renderNG(); updSlip();
}

function setBT(btn,t){
  if(!cfg[t]) return;
  document.querySelectorAll('.btype').forEach(function(b){ b.classList.remove('on'); });
  btn.classList.add('on'); S.bt=t; S.nums=[];
  var c=cfg[t];
  var ph=document.getElementById('ph'); if(ph) ph.textContent=c.n;
  var so=document.getElementById('so'); if(so) so.textContent='×'+c.o.toLocaleString('fr-FR');
  var st=document.getElementById('stp'); if(st) st.textContent=c.l;
  renderNG(); updSlip();
}

function setA(a){ var el=document.getElementById('ba'); if(el){ el.value=a; updSlip(); } }

function updSlip(){
  var amt=parseFloat((document.getElementById('ba')||{}).value)||0;
  var c=cfg[S.bt]||{o:0};
  var sn=document.getElementById('sn');
  if(sn) sn.textContent=S.nums.length?S.nums.slice().sort(function(a,b){return a-b;}).map(function(n){return n<10?'0'+n:n;}).join(' - '):'—';
  var pw=document.getElementById('pw'); if(pw) pw.textContent='XOF '+(amt*(c.o||0)).toLocaleString('fr-FR');
  var sjb=document.getElementById('sjb'); if(sjb) sjb.textContent=Math.round(S.jeu||0).toLocaleString('fr-FR');
}

// =========================================================
//  PARIER
// =========================================================
function placeBet(){
  if(!requireAuth()) return;
  if(!S.lot){ toast('Sélectionnez une loterie','⚠️','err'); return; }
  if(!cfg[S.bt]){ toast('Type de pari non configuré','⚠️','err'); return; }
  var amt=parseFloat(document.getElementById('ba').value)||0;
  var c=cfg[S.bt];
  if(S.nums.length<c.n){ toast('Sélectionnez '+c.n+' numéro(s) !','⚠️','err'); return; }
  if(amt<200){ toast('Mise minimum : 200 XOF','⚠️','err'); return; }
  if(S.jeu<amt){ toast('Compte Jeu insuffisant – Alimentez !','💳','err'); setTimeout(function(){ openS('transSh'); },500); return; }

  var nums=S.nums.slice().sort(function(a,b){return a-b;}),pot=amt*c.o,uid=S.user.uid;

  db.doc('users/'+uid).update({ jeu:firebase.firestore.FieldValue.increment(-amt) })
    .then(function(){
      S.jeu-=amt; updBal();
      return db.collection('tickets').add({
        uid,lotId:S.lot.id,flag:S.lot.flag,country:S.lot.country,
        type:c.l,typeKey:S.bt,nums,amt,pot,
        status:'pending',processed:false,
        createdAt:firebase.firestore.FieldValue.serverTimestamp(),
      });
    })
    .then(function(ref){
      return db.collection('transactions').add({
        uid,ty:'bet',ic:'🎰',
        n:'Pari '+c.l+' – '+S.lot.flag+' '+S.lot.country,
        amt:-amt,wlt:'Compte Jeu',ticketId:ref.id,
        createdAt:firebase.firestore.FieldValue.serverTimestamp(),
      }).then(function(){ return ref; });
    })
    .then(function(ref){
      document.getElementById('tid').textContent='#'+ref.id.slice(-8).toUpperCase();
      document.getElementById('tcd').innerHTML=
        '<div class="tdetrow"><span class="tdlbl">Loterie</span><span class="tdval">'+S.lot.flag+' '+S.lot.country+'</span></div>'+
        '<div class="tdetrow"><span class="tdlbl">Type</span><span class="tdval">'+c.l+'</span></div>'+
        '<div class="tdetrow"><span class="tdlbl">Tirage</span><span class="tdval">'+(S.lot.drawTime||'—')+'</span></div>'+
        '<div class="tdetrow"><span class="tdlbl">Mise</span><span class="tdval">'+amt.toLocaleString('fr-FR')+' XOF</span></div>'+
        '<div class="tdetrow"><span class="tdlbl">Gain potentiel</span><span class="tdval win">'+pot.toLocaleString('fr-FR')+' XOF</span></div>';
      document.getElementById('tcb').innerHTML=nums.map(function(n){ return '<div class="ball">'+(n<10?'0'+n:n)+'</div>'; }).join('');
      S.nums=[]; renderNG();
      var ba=document.getElementById('ba'); if(ba) ba.value='';
      updSlip(); openS('tcSh');
    })
    .catch(function(e){ toast('Erreur : '+e.message,'❌','err'); });
}

// =========================================================
//  PORTEFEUILLE
//  Recharge MM  → Compte JEU  (pour parier)
//  Transfert    → Compte GAINS → Compte JEU
//  Retrait      → Compte GAINS uniquement
// =========================================================
function doDeposit(){
  if(!requireAuth()) return;
  var amt=parseFloat(document.getElementById('da').value)||0;
  var ph=document.getElementById('dp').value.trim();
  if(amt<500){ toast('Montant minimum : 500 XOF','⚠️','err'); return; }
  if(!ph){ toast('Entrez votre numéro Mobile Money','⚠️','err'); return; }
  var uid=S.user.uid;

  // Calcul bonus dépôt
  var bonus=0;
  if(S.bonusConfig&&S.bonusConfig.depositBonusActive&&S.bonusConfig.depositBonusPercent){
    if(amt>=(S.bonusConfig.depositMinAmount||0)){
      bonus=Math.floor(amt*S.bonusConfig.depositBonusPercent/100);
    }
  }

  var updates={ jeu:firebase.firestore.FieldValue.increment(amt) };
  if(bonus>0) updates.gains=firebase.firestore.FieldValue.increment(bonus);

  db.doc('users/'+uid).update(updates)
    .then(function(){
      var ops=[db.collection('transactions').add({
        uid,ty:'dep',ic:'⬆️',n:'Recharge Mobile Money ('+ph+')',
        amt:amt,wlt:'Compte Jeu',
        createdAt:firebase.firestore.FieldValue.serverTimestamp(),
      })];
      if(bonus>0) ops.push(db.collection('transactions').add({
        uid,ty:'bonus',ic:'🎁',n:'Bonus dépôt '+S.bonusConfig.depositBonusPercent+'%',
        amt:bonus,wlt:'Compte Gains',
        createdAt:firebase.firestore.FieldValue.serverTimestamp(),
      }));
      return Promise.all(ops);
    })
    .then(function(){
      S.jeu+=amt; if(bonus>0) S.gains+=bonus; updBal();
      loadUserHistory(uid); closeS(null,'depSh');
      var msg='+'+amt.toLocaleString('fr-FR')+' XOF → Compte Jeu ✅';
      if(bonus>0) msg+=' | Bonus +'+bonus.toLocaleString('fr-FR')+' XOF 🎁';
      toast(msg,'💳','ok');
      document.getElementById('da').value=''; document.getElementById('dp').value='';
    })
    .catch(function(e){ toast('Erreur : '+e.message,'❌','err'); });
}

function doWithdraw(){
  if(!requireAuth()) return;
  var amt=parseFloat(document.getElementById('wia').value)||0;
  var ph=document.getElementById('wip').value.trim();
  if(amt<1000){ toast('Retrait minimum : 1 000 XOF','⚠️','err'); return; }
  if(S.gains<amt){ toast('Solde Compte Gains insuffisant','❌','err'); return; }
  if(!ph){ toast('Entrez votre numéro','⚠️','err'); return; }
  var uid=S.user.uid;
  db.doc('users/'+uid).update({ gains:firebase.firestore.FieldValue.increment(-amt) })
    .then(function(){
      return db.collection('transactions').add({
        uid,ty:'wit',ic:'⬇️',n:'Retrait Mobile Money ('+ph+')',
        amt:-amt,wlt:'Compte Gains',
        createdAt:firebase.firestore.FieldValue.serverTimestamp(),
      });
    })
    .then(function(){
      S.gains-=amt; updBal(); loadUserHistory(uid); closeS(null,'witSh');
      toast('Retrait '+amt.toLocaleString('fr-FR')+' XOF en cours','💸','ok');
      document.getElementById('wia').value=''; document.getElementById('wip').value='';
    })
    .catch(function(e){ toast('Erreur : '+e.message,'❌','err'); });
}

function doTransfer(){
  if(!requireAuth()) return;
  var amt=parseFloat(document.getElementById('tra').value)||0;
  if(amt<100){ toast('Montant invalide','⚠️','err'); return; }
  if(S.gains<amt){ toast('Compte Gains insuffisant','❌','err'); return; }
  var uid=S.user.uid;
  db.doc('users/'+uid).update({
    gains:firebase.firestore.FieldValue.increment(-amt),
    jeu:firebase.firestore.FieldValue.increment(+amt),
  }).then(function(){
    return db.collection('transactions').add({
      uid,ty:'trans',ic:'⇄',n:'Transfert Gains → Jeu',amt:amt,wlt:'Interne',
      createdAt:firebase.firestore.FieldValue.serverTimestamp(),
    });
  }).then(function(){
    S.gains-=amt; S.jeu+=amt; updBal(); loadUserHistory(uid);
    closeS(null,'transSh');
    toast(amt.toLocaleString('fr-FR')+' XOF → Compte Jeu ✅','⇄','ok');
    document.getElementById('tra').value='';
  }).catch(function(e){ toast('Erreur : '+e.message,'❌','err'); });
}

// =========================================================
//  TIMER
// =========================================================
function startTimer(){
  function tick(){
    var now=new Date(),next=new Date(now);
    next.setHours(19,30,0,0); if(next<=now) next.setDate(next.getDate()+1);
    var diff=Math.floor((next-now)/1000);
    var h=Math.floor(diff/3600),m=Math.floor((diff%3600)/60),s=diff%60;
    var pad=function(n){ return n<10?'0'+n:n; };
    var jH=document.getElementById('jH'),jM=document.getElementById('jM'),jS=document.getElementById('jS');
    if(jH) jH.textContent=pad(h); if(jM) jM.textContent=pad(m); if(jS) jS.textContent=pad(s);
  }
  tick(); setInterval(tick,1000);
}

// =========================================================
//  SHEETS / UI
// =========================================================
function openS(id){
  var needAuth=['depSh','witSh','transSh','histSh','profSh'];
  if(needAuth.indexOf(id)!==-1&&!S.user){
    document.getElementById('authSh').classList.add('on'); setATab('l');
    toast('Connectez-vous pour accéder à cette section','🔐','inf'); return;
  }
  document.getElementById(id).classList.add('on');
  if(id==='transSh'){
    var tg=document.getElementById('tg'); if(tg) tg.textContent='XOF '+Math.round(S.gains).toLocaleString('fr-FR');
    var tj=document.getElementById('tj'); if(tj) tj.textContent='XOF '+Math.round(S.jeu).toLocaleString('fr-FR');
  }
  if(id==='witSh'){ var wa=document.getElementById('wa'); if(wa) wa.textContent='XOF '+Math.round(S.gains).toLocaleString('fr-FR'); }
  if(id==='histSh') renderMH();
  if(id==='annSh')  renderAnnounces();
}

function closeS(e,id,goTickets){
  if(e&&e.target!==document.getElementById(id)) return;
  document.getElementById(id).classList.remove('on');
  if(goTickets===true) goScr(4);
}

function selOp(el,gid){
  document.getElementById(gid).querySelectorAll('.opitem').forEach(function(i){ i.classList.remove('sel'); });
  el.classList.add('sel');
}

var _tt;
function toast(msg,ic,type){
  var t=document.getElementById('toast');
  document.getElementById('tmsg').textContent=msg;
  document.getElementById('tico').textContent=ic||'✅';
  t.className='toast '+(type||'inf');
  setTimeout(function(){ t.classList.add('on'); },10);
  clearTimeout(_tt); _tt=setTimeout(function(){ t.classList.remove('on'); },3400);
}

function showWinNotif(amount,ticket){
  var ex=document.getElementById('winOverlay'); if(ex) ex.remove();
  var el=document.createElement('div'); el.id='winOverlay';
  var info=ticket?(ticket.flag||'')+' '+(ticket.country||'')+' — '+(ticket.type||''):'Votre pari';
  el.innerHTML='<div style="text-align:center;padding:28px 24px;max-width:340px;">'+
    '<div style="font-size:64px;margin-bottom:8px;animation:bounceY .6s ease infinite alternate;">🏆</div>'+
    '<div style="font-family:\'Orbitron\',sans-serif;font-size:13px;font-weight:900;color:rgba(255,255,255,.7);letter-spacing:2px;margin-bottom:5px;">FÉLICITATIONS !</div>'+
    '<div style="font-size:12px;color:rgba(255,255,255,.7);margin-bottom:13px;">'+info+'</div>'+
    '<div style="font-family:\'Orbitron\',sans-serif;font-size:34px;font-weight:900;color:var(--gd);text-shadow:0 0 28px rgba(240,180,41,.6);">+'+Math.round(amount||0).toLocaleString('fr-FR')+' XOF</div>'+
    '<div style="font-size:11px;color:rgba(255,255,255,.6);margin-top:5px;">Crédité sur votre Compte Gains</div>'+
    '<button onclick="document.getElementById(\'winOverlay\').remove()" style="margin-top:26px;padding:13px 30px;border-radius:50px;background:linear-gradient(135deg,var(--gdp),var(--gd));border:none;color:#000;font-size:14px;font-weight:900;cursor:pointer;font-family:inherit;">💰 Voir mon portefeuille</button>'+
    '</div>';
  document.getElementById('app').appendChild(el);
}

init();
