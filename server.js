const express = require('express')
const app = express()
const cors = require('cors')
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

require('dotenv').config()

main().catch(err => console.error(err));

async function main() {
  await mongoose.connect(process.env.MONGO_URL);
}

const userSchema = mongoose.Schema({
  username: {
    type: String,
    unique: true
  },
  log: [{
    description: String,
    duration: Number,
    date: Date
  }]
})

const User = mongoose.model('User', userSchema)

app.use(cors())
app.use(express.static('public'))
app.use(bodyParser.urlencoded({ extended: false }));
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

function responseUser(user) {
  return {
    _id: user._id,
    username: user.username
  }
}

app.route('/api/users')
  .post(function(req, res, next) {
  req.username = req.body.username
  next()
}, async function(req, res) {
  try {
    const user = new User()
    user.username = req.username
    await user.save()
    
    res.json(responseUser(user))
  } catch(err) {
    console.error(err)
    res.json({ error: err.message })
  }
}).get(async function(req, res) {
  try {
    const users = await User.find()
    const resp = users.map((user) => responseUser(user))
    res.json(resp)
  } catch(err) {
    console.error(err)
    res.json({ error: err.message })
  }
})

function createExercise(ex) {
  return {
    description: ex.description,
    duration: ex.duration,
    date: ex.date.toDateString()
  }
}

function responseExercise(user) {
  const index = user.log.length - 1
  const userExercise = user.log[index]  
  const exercise = createExercise(userExercise)
  
  return {
    ...responseUser(user),
    ...exercise
  }
}

app.route('/api/users/:_id/exercises')
  .post(function(req, res, next) {
    req._id = req.params._id
    req.exercise = {
      description: req.body.description,
      duration: req.body.duration,
      date: req.body.date ? new Date(req.body.date) : new Date()
    }
    
    next();
}, async function(req, res) {
  try {
    const user = await User.findById(req._id)
    
    user.log.push(req.exercise)
    await user.save()

    res.json(responseExercise(user))
  } catch(err) {
    console.error(err)
    res.json({ error: err.message })
  } 
})

function responseLogs(user) {
  return {
    ...user,
    log: user.log.map(log => createExercise(log))
  }
}

app.route('/api/users/:_id/logs')
  .get(function(req, res, next) {
    req._id = req.params._id
    req.q = {
      from: req.query.from || null,
      to: req.query.to || null,
      limit: req.query.limit || -1
    }
    if (req.q.from) {
      req.q.from = new Date(req.q.from)
    }
    if (req.q.to) {
      req.q.to = new Date(req.q.to)
    }
    next()
}, async function(req, res, next) {
  try {
    const user = await User.findById(req._id)
    
    let log = null
    function prepareLog() {
      log = log || [...user.log]
    }

    const from = req.q.from
    if (from) {
      prepareLog()
      log = log.filter(value => {
        if (value.date >= from) return value
      })
    }
    
    const to = req.q.to
    if (to) {
      prepareLog()
      log = log.filter(value => {
        if (value.date <= to) return value
      })
    }

    const limit = req.q.limit
    if (limit > 0) {
      prepareLog()
      const temp = []
      for(let i = 0; i < limit && log.length > i; i++) {
        temp.push(log[i])
      }
      log = temp
    }
    
    req.user = user
    req.log = log
    next()
  } catch(err) {
    console.error(err)
    res.json({ error: err.message })
  }
}, function(req, res) {
  const user = req.user
  const log = req.log

  const resUser = {
    ...responseUser(user),
    count: user.log.length,
    log: log ? log : user.log
  }

  res.json(responseLogs(resUser))
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
