// shared.js — NurseConnect core library v2
'use strict';

(function() {
  var STORAGE_KEY = 'nc_data';
  var SESSION_KEY = 'nc_current_user';

  // ── DEFAULT DATA ──────────────────────────────────────────────────────
  var defaultData = {
    users: [],
    consultations: [],
    medNotes: [],
    ratings: []
  };

  // ── STORAGE ───────────────────────────────────────────────────────────
  function loadData() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return JSON.parse(JSON.stringify(defaultData));
      var parsed = JSON.parse(raw);
      if (!parsed.medNotes)      parsed.medNotes      = [];
      if (!parsed.ratings)       parsed.ratings       = [];
      if (!parsed.consultations) parsed.consultations = [];
      if (!parsed.users)         parsed.users         = [];
      return parsed;
    } catch(e) {
      console.warn('NC: gagal parse storage', e);
      return JSON.parse(JSON.stringify(defaultData));
    }
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        users:         NC.users,
        consultations: NC.consultations,
        medNotes:      NC.medNotes,
        ratings:       NC.ratings
      }));
    } catch(e) {
      console.error('NC: gagal simpan data', e);
    }
  }

  function reloadData() {
    var fresh = loadData();
    NC.users         = fresh.users;
    NC.consultations = fresh.consultations;
    NC.medNotes      = fresh.medNotes;
    NC.ratings       = fresh.ratings;
  }

  // ── SESSION ───────────────────────────────────────────────────────────
  function getCurrentUser() {
    var id = null;
    try { id = sessionStorage.getItem(SESSION_KEY); } catch(e) {}
    if (!id) { try { id = localStorage.getItem(SESSION_KEY); } catch(e) {} }
    if (!id) return null;
    reloadData();
    return NC.users.find(function(u){ return u.id === id; }) || null;
  }

  function logout() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch(e) {}
    try { localStorage.removeItem(SESSION_KEY);   } catch(e) {}
    window.location.href = 'auth.html';
  }

  // ── ID GENERATOR ──────────────────────────────────────────────────────
  function genId()      { return 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,7); }
  function genConsultId(){ return 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,7); }
  function genNoteId()  { return 'n_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,7); }
  function genRatingId(){ return 'r_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,7); }

  // ── USER ──────────────────────────────────────────────────────────────
  function registerUser(fields) {
    reloadData();
    var exists = NC.users.find(function(u){
      return u.email && u.email.toLowerCase() === (fields.email||'').toLowerCase();
    });
    if (exists) return null;
    var user = Object.assign({ id: genId(), createdAt: Date.now() }, fields);
    NC.users.push(user);
    saveData();
    return user;
  }

  function loginUser(email, password) {
    reloadData();
    return NC.users.find(function(u){
      return u.email && u.email.toLowerCase() === email.toLowerCase() && u.password === password;
    }) || null;
  }

  function updateUser(id, fields) {
    reloadData();
    var idx = NC.users.findIndex(function(u){ return u.id === id; });
    if (idx === -1) return null;
    NC.users[idx] = Object.assign({}, NC.users[idx], fields);
    saveData();
    return NC.users[idx];
  }

  // ── CONSULTATION ──────────────────────────────────────────────────────
  function createConsultation(fields) {
    reloadData();
    var c = Object.assign({
      id: genConsultId(),
      status: 'waiting',
      messages: [],
      createdAt: Date.now()
    }, fields);
    NC.consultations.push(c);
    saveData();
    return c;
  }

  function updateConsultation(id, fields) {
    reloadData();
    var idx = NC.consultations.findIndex(function(c){ return c.id === id; });
    if (idx === -1) return null;
    NC.consultations[idx] = Object.assign({}, NC.consultations[idx], fields);
    saveData();
    return NC.consultations[idx];
  }

  function addMessage(consultId, from, text, type) {
    reloadData();
    var idx = NC.consultations.findIndex(function(c){ return c.id === consultId; });
    if (idx === -1) return null;
    var msg = {
      id: genId(), from: from, text: text,
      type: type || 'text', ts: Date.now(),
      readByNurse:   from === 'nurse',
      readByPatient: from === 'patient'
    };
    if (!NC.consultations[idx].messages) NC.consultations[idx].messages = [];
    NC.consultations[idx].messages.push(msg);
    saveData();
    return msg;
  }

  function getConsultationMessages(consultId) {
    reloadData();
    var c = NC.consultations.find(function(x){ return x.id === consultId; });
    return c ? (c.messages || []) : [];
  }

  function markMessagesRead(consultId, by) {
    reloadData();
    var idx = NC.consultations.findIndex(function(c){ return c.id === consultId; });
    if (idx === -1) return;
    (NC.consultations[idx].messages || []).forEach(function(m){
      if (by === 'nurse'   && m.from === 'patient') m.readByNurse   = true;
      if (by === 'patient' && m.from === 'nurse')   m.readByPatient = true;
    });
    saveData();
  }

  // ── MEDICAL NOTES ─────────────────────────────────────────────────────
  function addMedNote(fields) {
    reloadData();
    var note = Object.assign({ id: genNoteId(), createdAt: Date.now() }, fields);
    NC.medNotes.push(note);
    saveData();
    return note;
  }

  // ── RATINGS ───────────────────────────────────────────────────────────
  function addRating(fields) {
    reloadData();
    var r = Object.assign({ id: genRatingId(), ts: Date.now() }, fields);
    NC.ratings.push(r);
    var nurseRatings = NC.ratings.filter(function(x){ return x.nurseId === fields.nurseId; });
    var avg = nurseRatings.reduce(function(s,x){ return s+x.score; }, 0) / nurseRatings.length;
    updateUser(fields.nurseId, { rating: parseFloat(avg.toFixed(1)), reviewCount: nurseRatings.length });
    saveData();
    return r;
  }

  // ── FORMAT HELPERS ────────────────────────────────────────────────────
  function formatTime(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' });
  }
  function formatDate(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });
  }
  function timeAgo(ts) {
    if (!ts) return '';
    var diff = Date.now() - ts;
    var m = Math.floor(diff / 60000);
    if (m < 1)  return 'Baru saja';
    if (m < 60) return m + ' menit lalu';
    var h = Math.floor(m / 60);
    if (h < 24) return h + ' jam lalu';
    return Math.floor(h/24) + ' hari lalu';
  }
  function calcAge(dob) {
    if (!dob) return null;
    var today = new Date(), birth = new Date(dob);
    var age = today.getFullYear() - birth.getFullYear();
    var m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  }
  function getInitials(name) {
    if (!name) return '?';
    var parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length-1][0]).toUpperCase();
  }
  var AVA_COLORS = ['#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444','#ec4899','#14b8a6','#f97316'];
  function avaColor(name) {
    if (!name) return AVA_COLORS[0];
    var idx = 0;
    for (var i = 0; i < name.length; i++) idx += name.charCodeAt(i);
    return AVA_COLORS[idx % AVA_COLORS.length];
  }

  // ── INIT ──────────────────────────────────────────────────────────────
  var data = loadData();

  window.NC = {
    users:         data.users,
    consultations: data.consultations,
    medNotes:      data.medNotes,
    ratings:       data.ratings,
    save:          saveData,
    reload:        reloadData,
    genId:         genId,
    getCurrentUser:          getCurrentUser,
    logout:                  logout,
    register:                registerUser,
    login:                   loginUser,
    updateUser:              updateUser,
    createConsultation:      createConsultation,
    updateConsultation:      updateConsultation,
    addMessage:              addMessage,
    getConsultationMessages: getConsultationMessages,
    markMessagesRead:        markMessagesRead,
    addMedNote:              addMedNote,
    addRating:               addRating,
    formatTime:              formatTime,
    formatDate:              formatDate,
    timeAgo:                 timeAgo,
    calcAge:                 calcAge,
    getInitials:             getInitials,
    avaColor:                avaColor
  };

  console.log('✅ NurseConnect shared.js v2 loaded. NC ready.');
})();
