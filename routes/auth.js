const express = require('express')
const bcrypt = require('bcryptjs')
const router = express.Router()
const User = require('../models/user')
const { generateOTP, sendOTPEmail } = require('../utils/mailer')

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

router.get('/signup', (req, res) => {
  // Clear of hideSearch variables since navbar uses opt-in 'showSearch' now
  res.render('auth/signup')
})

router.post('/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body

    if (!EMAIL_REGEX.test(email)) {
      req.flash('error', 'Please enter a valid email address')
      return res.redirect('/signup')
    }

    const existing = await User.findOne({ $or: [{ username }, { email }] })
    if (existing) {
      req.flash('error', 'That username or email is already taken')
      return res.redirect('/signup')
    }

    const otp = generateOTP()
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000)

    const user = await User.create({
      username,
      email,
      password,
      isVerified: false,
      otp,
      otpExpiry
    })

    await sendOTPEmail(user.email, otp, 'verify')

    req.session.pendingUserId = user._id.toString()
    req.flash('success', 'We sent a verification code to your email')
    res.redirect('/verify-otp')
  } catch (e) {
    console.error(e)
    req.flash('error', 'Could not create your account. Please check your input.')
    res.redirect('/signup')
  }
})

router.get('/verify-otp', (req, res) => {
  if (!req.session.pendingUserId) {
    req.flash('error', 'Please sign up first')
    return res.redirect('/signup')
  }
  res.render('auth/verify-otp')
})

router.post('/verify-otp', async (req, res) => {
  try {
    const { otp } = req.body
    const userId = req.session.pendingUserId

    if (!userId) {
      req.flash('error', 'Please sign up first')
      return res.redirect('/signup')
    }

    const user = await User.findById(userId)
    if (!user) {
      req.flash('error', 'Account not found')
      return res.redirect('/signup')
    }

    if (!user.otp || user.otp !== otp) {
      req.flash('error', 'Invalid code. Please try again.')
      return res.redirect('/verify-otp')
    }

    if (!user.otpExpiry || user.otpExpiry < new Date()) {
      req.flash('error', 'This code has expired. Please request a new one.')
      return res.redirect('/verify-otp')
    }

    user.isVerified = true
    user.otp = undefined
    user.otpExpiry = undefined
    await user.save()

    delete req.session.pendingUserId
    req.session.user = { id: user._id.toString(), username: user.username }
    req.flash('success', `Welcome, ${user.username}! Your email is verified.`)
    res.redirect('/')
  } catch (e) {
    console.error(e)
    req.flash('error', 'Something went wrong verifying your code')
    res.redirect('/verify-otp')
  }
})

router.post('/resend-otp', async (req, res) => {
  try {
    const userId = req.session.pendingUserId
    if (!userId) {
      req.flash('error', 'Please sign up first')
      return res.redirect('/signup')
    }

    const user = await User.findById(userId)
    if (!user) {
      req.flash('error', 'Account not found')
      return res.redirect('/signup')
    }

    const otp = generateOTP()
    user.otp = otp
    user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000)
    await user.save()

    await sendOTPEmail(user.email, otp, 'verify')

    req.flash('success', 'A new code has been sent to your email')
    res.redirect('/verify-otp')
  } catch (e) {
    console.error(e)
    req.flash('error', 'Could not resend the code. Please try again.')
    res.redirect('/verify-otp')
  }
})

router.get('/login', (req, res) => {
  res.render('auth/login')
})

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body
    const user = await User.findOne({ $or: [{ username }, { email: username }] })
    if (!user) {
      req.flash('error', 'Invalid username or password')
      return res.redirect('/login')
    }
    const match = await bcrypt.compare(password, user.password)
    if (!match) {
      req.flash('error', 'Invalid username or password')
      return res.redirect('/login')
    }

    if (!user.isVerified) {
      const otp = generateOTP()
      user.otp = otp
      user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000)
      await user.save()
      await sendOTPEmail(user.email, otp, 'verify')

      req.session.pendingUserId = user._id.toString()
      req.flash('error', 'Please verify your email first. We sent you a new code.')
      return res.redirect('/verify-otp')
    }

    req.session.user = { id: user._id.toString(), username: user.username }
    req.flash('success', `Welcome back, ${user.username}!`)
    res.redirect('/')
  } catch (e) {
    console.error(e)
    req.flash('error', 'Something went wrong logging in')
    res.redirect('/login')
  }
})

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'))
})

router.get('/forgot-password', (req, res) => {
  res.render('auth/forgot-password')
})

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body

    if (!EMAIL_REGEX.test(email)) {
      req.flash('error', 'Please enter a valid email address')
      return res.redirect('/forgot-password')
    }

    const user = await User.findOne({ email })

    if (user) {
      const otp = generateOTP()
      user.resetOtp = otp
      user.resetOtpExpiry = new Date(Date.now() + 5 * 60 * 1000)
      await user.save()
      await sendOTPEmail(user.email, otp, 'reset')
      req.session.resetUserId = user._id.toString()
    }

    req.flash('success', 'If that email is registered, a reset code has been sent.')
    res.redirect('/reset-verify-otp')
  } catch (e) {
    console.error(e)
    req.flash('error', 'Something went wrong. Please try again.')
    res.redirect('/forgot-password')
  }
})

router.get('/reset-verify-otp', (req, res) => {
  if (!req.session.resetUserId) {
    req.flash('error', 'Please request a reset code first')
    return res.redirect('/forgot-password')
  }
  res.render('auth/reset-verify-otp')
})

router.post('/reset-verify-otp', async (req, res) => {
  try {
    const { otp } = req.body
    const userId = req.session.resetUserId

    if (!userId) {
      req.flash('error', 'Please request a reset code first')
      return res.redirect('/forgot-password')
    }

    const user = await User.findById(userId)
    if (!user) {
      req.flash('error', 'Account not found')
      return res.redirect('/forgot-password')
    }

    if (!user.resetOtp || user.resetOtp !== otp) {
      req.flash('error', 'Invalid code. Please try again.')
      return res.redirect('/reset-verify-otp')
    }

    if (!user.resetOtpExpiry || user.resetOtpExpiry < new Date()) {
      req.flash('error', 'This code has expired. Please request a new one.')
      return res.redirect('/forgot-password')
    }

    req.session.resetVerified = true
    res.redirect('/reset-password')
  } catch (e) {
    console.error(e)
    req.flash('error', 'Something went wrong verifying your code')
    res.redirect('/reset-verify-otp')
  }
})

router.get('/reset-password', (req, res) => {
  if (!req.session.resetUserId || !req.session.resetVerified) {
    req.flash('error', 'Please verify your reset code first')
    return res.redirect('/forgot-password')
  }
  res.render('auth/reset-password')
})

router.post('/reset-password', async (req, res) => {
  try {
    if (!req.session.resetUserId || !req.session.resetVerified) {
      req.flash('error', 'Please verify your reset code first')
      return res.redirect('/forgot-password')
    }

    const { password, confirmPassword } = req.body

    if (!password || password.length < 6) {
      req.flash('error', 'Password must be at least 6 characters')
      return res.redirect('/reset-password')
    }

    if (password !== confirmPassword) {
      req.flash('error', 'Passwords do not match')
      return res.redirect('/reset-password')
    }

    const user = await User.findById(req.session.resetUserId)
    if (!user) {
      req.flash('error', 'Account not found')
      return res.redirect('/forgot-password')
    }

    user.password = password
    user.resetOtp = undefined
    user.resetOtpExpiry = undefined
    await user.save()

    delete req.session.resetUserId
    delete req.session.resetVerified

    req.flash('success', 'Your password has been reset. Please log in.')
    res.redirect('/login')
  } catch (e) {
    console.error(e)
    req.flash('error', 'Something went wrong resetting your password')
    res.redirect('/reset-password')
  }
})

module.exports = router