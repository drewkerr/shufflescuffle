// Authentication

var passport = require('passport')
var GoogleStrategy = require('passport-google-oauth20').Strategy;

function extractProfile(profile) {
  let imageUrl = ''
  if (profile.photos && profile.photos.length) {
    imageUrl = profile.photos[0].value
  }
  return {
    id: profile.id,
    displayName: profile.displayName,
    image: imageUrl
  }
}

passport.use(new GoogleStrategy({
  clientID: process.env.CLIENT,
  clientSecret: process.env.SECRET,
  callbackURL: 'https://'+process.env.PROJECT_DOMAIN+'.glitch.me/login/google/return',
  scope: 'profile'
}, (token, tokenSecret, profile, cb) => {
  return cb(null, extractProfile(profile))
}))

passport.serializeUser((user, done) => {
  done(null, user)
})

passport.deserializeUser((obj, done) => {
  done(null, obj)
})

// Init server

var express = require('express')
var app = express()
var expressSession = require('express-session')

app.use(express.static('public'))
app.set('view engine', 'pug')
app.locals.pretty = true;
app.set('json spaces', 2)

var sessionMiddleware = expressSession({
  secret: process.env.SESSION,
  resave: false,
  saveUninitialized: false })

app.use(sessionMiddleware)
app.use(passport.initialize())
app.use(passport.session())

// Routes

app.get('/login', passport.authenticate('google'))

app.get('/login/google/return', 
  passport.authenticate('google', 
    { successRedirect: '/', failureRedirect: '/' }
  )
)

app.get('/logout',
  (req, res) => {
    res.clearCookie('connect.sid')
    res.redirect('/')
  }
)

app.get('/', (request, response) => {
  response.render('index', { profile: request.user } )
})

app.get('/test', (request, response) => {
  response.render('test')
})

var server = require('http').createServer(app)
var listener = server.listen(process.env.PORT, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})

// Socket.io

const io = require('socket.io')(server)
  .use((socket, next) => {
    sessionMiddleware(socket.handshake, {}, next)
  })

io.on('connection', (socket) => {

  if (socket.handshake.session.passport) {
    socket.user = socket.handshake.session.passport.user.id
    socket.name = socket.handshake.session.passport.user.displayName
    socket.image = socket.handshake.session.passport.user.image
    socket.state = ''
    console.log('Connected:', socket.name)

    if (game.dealt.length == 0) {
      game.start()
    }

    if (game.dealt.length <= 1) {
      game.join(socket)
    } else {
      game.joining(socket)
    }

  } else {
    game.spectator(socket)
  }
  
  socket.on('choose', (choice) => {
    if (socket.rooms.has('game')) {
      console.log(socket.name + ':', choice)
      socket.state = choice
      io.emit('choose', socket.user, socket.state)
    }
  })
  
  socket.on('disconnecting', (reason) => {
    if (socket.user) {
      game.leave(socket)
      console.log('Disconnected:', socket.name)
    }
  })

})

// Game logic

class Game {
  constructor() {
    this.reset()
  }

  reset() {
    console.log('Shuffling cards...')
    if (this.timer) {
      clearTimeout(this.timer)
    }
    this.deck = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13]
      .map( (v) => Array(4).fill(v).map( (x, y) => x + y*16) )
      .reduce((a, b) => a.concat(b))
    this.dealt = []
    this.players = {}
  }

  load(func) {
    const delay = 10
    io.emit('timer', delay)
    this.timer = setTimeout(func.bind(this), delay * 1000)
  }

  start() {
    console.log('Starting new game')
    io.emit('start')
    this.deal()
    this.load(this.check)
  }

  join(socket) {
    console.log('Entered game:', socket.name)
    socket.join('game')
    let player = {}
    player[socket.id] = [socket.user, socket.name, socket.image]
    io.emit('joined', player)
    socket.emit('joined', this.players)
    this.players[socket.id] = [socket.user, socket.name, socket.image]
    socket.emit('controls', true)
  }

  joining(socket) {
    console.log('Entered lobby:', socket.name)
    socket.join('lobby')
    socket.emit('feedback', 'Joining next round...')
    this.spectator(socket)
  }

  spectator(socket) {
    console.log('Logged out user spectating')
    socket.emit('deal', this.dealt)
    socket.emit('joined', this.players)
  }

  out(socket) {
    console.log(`${socket.name} is out`)
    socket.leave('game')
    socket.join('lobby')
    socket.emit('controls', false)
    io.emit('out', socket.user, socket.name, socket.image, this.dealt.length - 2)
  }

  leave(socket) {
    io.emit('out', socket.user, socket.name, socket.image, this.dealt.length - 2)
    let game = io.sockets.adapter.rooms.get('game')
    if (!game) {
      this.end()
    }
  }

  deal() {
    if (this.deck.length) {
      let random = Math.floor((Math.random() * this.deck.length))
      let card = this.deck.splice(random, 1)[0]
      let prob = this.probability(card, this.deck, random)
      this.dealt.push([card, prob])
      io.emit('deal', [[card, prob]])
      return (card % 16)
    } else {
      io.emit('feedback', 'No more cards in the deck!')
      this.end()
    }
  }

  probability(card, deck, random) {
    let same = deck.reduce((acc, cur) => {
      if (cur % 16 == card % 16) {
        if (card > cur) {
          acc[0] += 1
        } else {
          acc[1] += 1
        }
      }
      return acc
    }, [0, 0])
    let total = deck.length
    let higher = total - random - same[1]
    let lower = random - same[0]
    let samenum = same[0] + same[1]
    return `Pr(higher) = ${higher}/${total}\nPr(lower) = ${lower}/${total}\nPr(same) = ${samenum}/${total}`
  }

  check() {
    let last = this.dealt[this.dealt.length - 1][0] % 16
    let card = this.deal()
    let [right, wrong] = (card > last) ? ['higher', 'lower'] : ['lower', 'higher']    
    let game = io.sockets.adapter.rooms.get('game')
    if (game) {
      for (let id of game) {
        let socket = io.sockets.sockets.get(id)
        if (card == last) {
          socket.emit('feedback', 'Oh no, it was the same! Try again...')
          this.out(socket)
        } else if (socket.state == right) {
          socket.emit('feedback', `Yes, it was ${right}!`)
        } else if (socket.state == wrong) {
          socket.emit('feedback', `Oh no, it was ${right}! Try again...`)
          this.out(socket)
        } else if (socket.state == '') {
          socket.emit('feedback', 'Too slow! Try again...')
          this.out(socket)
        }
        socket.state = ''
        io.emit('choose', socket.user, socket.state)
      }
    }
    game = io.sockets.adapter.rooms.get('game')
    if (game) {
      console.log(`${game.size} player(s) in the game`)
      this.load(this.check)
    } else {
      this.end()
    }
  }

  end() {
    io.emit('end')
    this.reset()
    let game = io.sockets.adapter.rooms.get('game')
    let lobby = io.sockets.adapter.rooms.get('lobby')
    if (lobby || game) {
      this.start()
      console.log(`${lobby.size} player(s) in the lobby`)
      for (let id of lobby) {
        let socket = io.sockets.sockets.get(id)
        socket.leave('lobby')
        this.join(socket)
      }
    } else {
      console.log('No players.')
    }
  }
}

const game = new Game()