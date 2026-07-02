require('dotenv').config()

const path = require('path')
const express = require('express')
const session = require('express-session')
const MongoStore = require('connect-mongo')
const flash = require('connect-flash')
const methodOverride = require('method-override')

const connectDB = require('./config/database')
const Article = require('./models/article')
const articleRouter = require('./routes/articles')
const authRouter = require('./routes/auth')

const app = express()
app.set('trust proxy', 1)

console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'FOUND' : 'MISSING')

app.set('view engine', 'ejs')

app.use(express.urlencoded({ extended: false }))
app.use(methodOverride('_method'))
app.use(express.static(path.join(__dirname, 'public')))

app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
}))

app.use(flash())

app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null
  res.locals.messages = {
    error: req.flash('error'),
    success: req.flash('success')
  }
  // Initialize showSearch as false by default so it stays hidden on auth pages/404s
  res.locals.showSearch = false 
  next()
})

const PAGE_SIZE = 6

app.get('/', async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1)
    const q = (req.query.q || '').trim()

    const filter = q
      ? { title: { $regex: q, $options: 'i' } }
      : {}

    const totalArticles = await Article.countDocuments(filter)

    const totalPages = Math.max(
      Math.ceil(totalArticles / PAGE_SIZE),
      1
    )

    const articles = await Article.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)

    // FIXED: Forcing the visibility into the global template context block
    res.locals.showSearch = true 

    res.render('articles/index', {
      articles,
      page,
      totalPages,
      q
    })
  } catch (err) {
    next(err)
  }
})

app.use('/', authRouter)
app.use('/articles', articleRouter)

app.use((req, res) => {
  res.status(404).render('404')
})

app.use((err, req, res, next) => {
  console.error('Application Error:', err)
  res.status(500).send('Something went wrong on our end.')
})

const PORT = process.env.PORT || 4401

connectDB()
  .then(() => {
    console.log('✅ Database connected successfully')

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`)
    })
  })
  .catch((err) => {
    console.error('❌ Failed to connect to MongoDB')
    console.error(err)
    process.exit(1)
  })