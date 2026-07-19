/* Handler One — player app. All rules live server-side; this is display only. */
(function () {
  'use strict';

  var playerId = localStorage.getItem('h1_playerId');
  var currentTab = 'mission';
  var lastMission = null;
  var revealed = false;

  function $(id) { return document.getElementById(id); }

  function show(screenId) {
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });
    $(screenId).classList.add('active');
    $('tabbar').classList.toggle('visible', Boolean(playerId) && !revealed && screenId !== 'screen-register');
  }

  function api(path, opts) {
    return fetch(BACKEND_URL + path, opts).then(function (r) {
      return r.json().then(function (data) { return { ok: r.ok, data: data }; });
    });
  }

  // --- rendering ------------------------------------------------------------

  function render(view) {
    revealed = view.revealed;
    if (view.revealed) {
      renderLeaderboard(view.leaderboard || []);
      show('screen-reveal');
      return;
    }
    if (currentTab === 'lobby') { renderLobby(); return; }
    if (view.mission) {
      var card = $('mission-card');
      if (view.mission !== lastMission) {
        card.classList.remove('dealt');
        void card.offsetWidth; // restart deal animation
        card.classList.add('dealt');
        lastMission = view.mission;
      }
      $('mission-text').textContent = view.mission;
      $('folds-left').innerHTML = chips(view.foldsRemaining);
      $('btn-fold').disabled = view.foldsRemaining <= 0;
      show('screen-mission');
    } else if (view.exhausted) {
      show('screen-exhausted');
    } else {
      show('screen-mission');
      $('mission-text').textContent = 'Awaiting your next contract…';
    }
  }

  function chips(n) {
    var out = '';
    for (var i = 0; i < 3; i++) out += '<span class="chip">' + (i < n ? '●' : '○') + '</span>';
    return out;
  }

  function renderLeaderboard(rows) {
    var body = $('leaderboard-body');
    body.innerHTML = '';
    rows.forEach(function (r) {
      var tr = document.createElement('tr');
      if (r.rank === 1) tr.className = 'top';
      tr.innerHTML = '<td class="rank">' + r.rank + '</td><td></td><td></td>' +
        '<td class="score">' + (r.score * 100) + '</td>';
      tr.children[1].textContent = r.alias;
      tr.children[2].textContent = r.codename;
      body.appendChild(tr);
    });
  }

  function renderLobby() {
    api('/api/lobby').then(function (res) {
      if (!res.ok) return;
      var list = $('codename-list');
      list.innerHTML = '';
      res.data.codenames.forEach(function (name) {
        var li = document.createElement('li');
        li.textContent = '♠ ' + name;
        list.appendChild(li);
      });
      show('screen-lobby');
    });
  }

  function notice(id, msg, warn) {
    var el = $(id);
    el.textContent = msg || '';
    el.classList.toggle('warn', Boolean(warn));
    if (msg) setTimeout(function () { el.textContent = ''; }, 4000);
  }

  // --- state sync -----------------------------------------------------------

  function refresh() {
    if (!playerId) { show('screen-register'); return; }
    api('/api/state?playerId=' + encodeURIComponent(playerId)).then(function (res) {
      if (!res.ok) { // unknown player (server reset) — start over
        localStorage.removeItem('h1_playerId');
        playerId = null;
        show('screen-register');
        return;
      }
      render(res.data.view);
    }).catch(function () { /* offline; keep current screen */ });
  }

  // WebSocket: reveal push. Falls back to 10s polling regardless.
  function connectWS() {
    try {
      var ws = new WebSocket(BACKEND_URL.replace(/^http/, 'ws') + '/api/ws');
      ws.onmessage = function (ev) {
        var msg = JSON.parse(ev.data);
        if (msg.type === 'reveal') refresh();
      };
      ws.onclose = function () { setTimeout(connectWS, 3000); };
    } catch (e) { setTimeout(connectWS, 5000); }
  }

  // --- actions --------------------------------------------------------------

  $('register-btn').addEventListener('click', function () {
    var alias = $('alias-input').value.trim();
    if (!alias) { notice('register-notice', 'Give us a name, Agent.', true); return; }
    api('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias: alias }),
    }).then(function (res) {
      if (!res.ok) {
        notice('register-notice', res.data.message || res.data.error || 'The house declined.', true);
        return;
      }
      playerId = res.data.playerId;
      localStorage.setItem('h1_playerId', playerId);
      render(res.data.view);
    });
  });

  function act(action) {
    ['btn-complete', 'btn-failed', 'btn-fold'].forEach(function (b) { $(b).disabled = true; });
    api('/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: playerId, action: action }),
    }).then(function (res) {
      ['btn-complete', 'btn-failed'].forEach(function (b) { $(b).disabled = false; });
      if (!res.ok) return;
      if (res.data.result === 'warning') {
        notice('mission-notice', 'The house is watching, Agent. Patience.', true);
      } else if (res.data.result === 'fold_rejected') {
        notice('mission-notice', 'No folds left. Play the hand you were dealt.', true);
      }
      render(res.data.view);
    });
  }

  $('btn-complete').addEventListener('click', function () { act('complete'); });
  $('btn-failed').addEventListener('click', function () { act('failed'); });
  $('btn-fold').addEventListener('click', function () { act('fold'); });

  $('tab-mission').addEventListener('click', function () {
    currentTab = 'mission';
    $('tab-mission').classList.add('active');
    $('tab-lobby').classList.remove('active');
    refresh();
  });
  $('tab-lobby').addEventListener('click', function () {
    currentTab = 'lobby';
    $('tab-lobby').classList.add('active');
    $('tab-mission').classList.remove('active');
    renderLobby();
  });

  // --- boot -----------------------------------------------------------------
  refresh();
  connectWS();
  setInterval(refresh, 10000);
})();
