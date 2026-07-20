/* Handler One — host console. The passphrase is checked server-side on every call
   and kept only in this page's memory (never localStorage, never the repo). */
(function () {
  'use strict';

  var passphrase = null;
  var pollTimer = null;

  function $(id) { return document.getElementById(id); }

  function api(path, body) {
    return fetch(BACKEND_URL + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Host-Passphrase': passphrase },
      body: body === undefined ? undefined : JSON.stringify(body),
    }).then(function (r) {
      return r.json().then(function (data) { return { ok: r.ok, data: data }; });
    });
  }

  $('login-btn').addEventListener('click', function () {
    passphrase = $('pass-input').value;
    api('/api/admin/login').then(function (res) {
      if (!res.ok) { $('login-notice').textContent = 'The house does not know you.'; return; }
      $('screen-login').classList.remove('active');
      $('screen-admin').classList.add('active');
      refreshDash();
      pollTimer = setInterval(refreshDash, 3000);
    });
  });

  $('seed-btn').addEventListener('click', function () {
    var raw = $('missions-input').value.trim();
    var missions;
    try {
      missions = JSON.parse(raw);
      if (!Array.isArray(missions)) throw new Error('not array');
    } catch (e) {
      missions = raw.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    }
    api('/api/admin/missions', { missions: missions }).then(function (res) {
      $('seed-notice').textContent = res.ok
        ? 'Bank seeded: ' + res.data.count + ' contracts.'
        : (res.data.message || 'Seeding failed.');
    });
  });

  $('cooldown-btn').addEventListener('click', function () {
    api('/api/admin/cooldown', { seconds: Number($('cooldown-input').value) });
  });

  $('reveal-btn').addEventListener('click', function () {
    api('/api/admin/reveal', { on: true }).then(refreshDash);
  });
  $('undo-btn').addEventListener('click', function () {
    api('/api/admin/reveal', { on: false }).then(refreshDash);
  });

  $('reset-btn').addEventListener('click', function () {
    if (!confirm('Reset the game? All agents, scores, and progress will be cleared. The mission bank stays.')) return;
    api('/api/admin/reset').then(function (res) {
      $('reset-notice').textContent = res.ok ? 'Game reset. Mission bank kept.' : (res.data.message || 'Reset failed.');
      refreshDash();
    });
  });

  function refreshDash() {
    api('/api/admin/dashboard').then(function (res) {
      if (!res.ok) return;
      var d = res.data;
      $('cooldown-input').value = d.cooldownSeconds;
      $('reveal-notice').textContent = d.revealed
        ? 'REVEALED — the game is over.'
        : 'Game in play. Missions in bank: ' + d.missionCount + '.';
      var body = $('dash-body');
      body.innerHTML = '';
      d.players.forEach(function (p) {
        var tr = document.createElement('tr');
        for (var i = 0; i < 6; i++) tr.appendChild(document.createElement('td'));
        tr.children[0].textContent = p.alias;
        tr.children[1].textContent = p.codename;
        tr.children[2].textContent = p.score;
        tr.children[3].textContent = p.warnings;
        tr.children[4].textContent = p.foldsUsed + '/3';
        tr.children[5].textContent = p.shadowZero ? 'SHADOW-ZERO' : (p.onMission ? 'on mission' : 'done');
        if (p.shadowZero) tr.children[5].className = 'tag-shadow';
        body.appendChild(tr);
      });
    });
  }
})();
