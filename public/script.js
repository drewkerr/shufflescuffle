window.addEventListener("load", () => {

  var socket = io()
  
  socket.on('start', () => {
    let oldcards = document.getElementsByClassName('fadeout')
    while (oldcards.length > 0) oldcards[0].remove()
    let cards = document.getElementById('game').getElementsByTagName('span')
    for (let card of cards) {
      card.classList.add('fadeout')
    }
  })

  socket.on('end', confetti)

  socket.on('feedback', message => {
    let feedback = document.getElementById('feedback')
    feedback.textContent = message
  })

  socket.on('joined', (players) => {
    console.log(socket.user)
    for (let [user, name, image] of Object.values(players)) {
      let img = document.getElementById('img-'+user)
      if (!img) {
        img = document.createElement('img')
        img.id = 'img-'+user
        img.src = image
        img.title = name
        let playing = document.getElementById('container')
        playing.insertBefore(img, playing.firstChild)
      }
    }
  })

  socket.on('out', (user, name, image, score) => {
    let img = document.getElementById('img-'+user)
    img.remove()
    let scores = document.getElementById('scores')
    let div = document.getElementById('score-'+user)
    if (div) {
      if (div.dataset.score < score) {
        div.dataset.score = score
        let span = div.getElementsByTagName('span')[1]
        span.textContent = score
      }
    } else {
      div = document.createElement('div')
      div.id = 'score-'+user
      div.dataset.score = score
      for (let text of [name, score]) {
        let span = document.createElement('span')
        span.textContent = text
        div.appendChild(span)
      }
      scores.appendChild(div)
    }
    sortdsc(scores)
  })

  function sortdsc(parent) {
    var i, switching, b, shouldSwitch
    switching = true
    while (switching) {
      switching = false
      b = parent.getElementsByTagName('div')
      for (i = 0; i < (b.length - 1); i++) {
        shouldSwitch = false
        if (Number(b[i].dataset.score) < Number(b[i + 1].dataset.score)) {
          shouldSwitch = true
          break
        }
      }
      if (shouldSwitch) {
        b[i].parentNode.insertBefore(b[i + 1], b[i])
        switching = true
      }
    }
  }

  socket.on('controls', (enabled) => {
    let buttons = document.getElementById('controls').getElementsByTagName('button')
    for (let button of buttons) {
      button.disabled = enabled ? false : true
    }
  })

  socket.on('deal', cards => {
    for (let [card, probability] of cards) {
      let div = document.createElement('div')
      let span = document.createElement('span')
      if ( 15 < card && card < 46 ) span.classList.add('red')
      span.innerHTML = '&#1271' + ( card + 37 ) + ';'
      span.title = probability
      div.classList.add('flip')
      div.appendChild(span)
      let game = document.getElementById('game')
      game.insertBefore(div, game.firstChild)
    }
  })

  socket.on('timer', seconds => {
    let progress = document.createElement('div')
    progress.style.animationDuration = seconds + 's'
    progress.classList.add('timer')
    document.body.appendChild(progress)
    setTimeout(function() {
      if (progress) {
        progress.remove()
      }
    }, seconds * 1000)
  })

  socket.on('choose', (user, state) => {
    let player = document.getElementById('img-'+user)
    if (player) {
      player.classList.remove(...player.classList)
    }
    if (state) {
      player.classList.add(state)
    }
  })

  function choose(event) {
    socket.emit('choose', event.target.value)
  }

  let buttons = document.getElementById('controls').getElementsByTagName('button')
  for (let button of buttons) {
    button.onclick = choose
  }

  function confetti() {
    var d = document.createElement('div');
    var css = '@keyframes spin{0%,100%{transform:rotate(0) rotateX(0) translate(0,0);}50%{transform:rotate(180deg) rotateX(360deg) translate(5px,0);}}@keyframes drop{100%{top:150%;}}';
    d.innerHTML = '<style type="text/css"></style>';
    document.body.appendChild(d);
    for (var i = 0; i < 100; i++){
      var w = Math.random() * 5 + 10;
      var h = w * 0.5;
      var c = ['#f33','#f90','#fc0','#4d6','#3cf'][ Math.floor(Math.random() * 5) ];
      var t = -Math.random() * 10 - 10;
      var l = Math.random() * 100;
      var s = Math.random() + 0.5;
      var f = Math.random();
      css += '.confetti-'+i+'{position:fixed;background-color:'+c+';width:'+w+'px;height:'+h+'px;top:'+t+'%;left:'+l+'%;animation:spin '+s+'s linear infinite,drop '+(f+2)+'s ease-in;}'
      var x = document.createElement('div');
      x.classList.add('confetti-' + i);
      d.appendChild(x);
    }
    d.firstChild.innerHTML = css;
    setTimeout(function() {
      document.body.removeChild(d);
    }, 3000);
  }

})