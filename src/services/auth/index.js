// src/auth/index.js
import {router} from 'src/router/index'
import ROUTER from 'src/router'
import {Howl} from 'howler'
import Vue from 'vue'
import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
import Config from 'src/config.js'
import COMMON from 'src/common.js'
export default {
  user: {
    userID: 0,
    username: '',
    code: null,
    email: null,
    type: null,
    status: null,
    linked_account: null,
    location: null,
    assigned_location: null,
    profile: null,
    subAccount: null,
    information: null,
    notifications: {
      data: null,
      current: null,
      prevCurrent: null
    },
    notifSetting: null,
    messages: {
      data: null,
      totalUnreadMessages: 0
    }
  },
  messenger: {
    messages: [],
    badge: 0,
    messengerGroupId: null,
    group: null
  },
  support: {
    messages: null,
    badge: 0,
    messengerGroupId: null
  },
  notifTimer: {
    timer: null,
    speed: 1000
  },
  tokenData: {
    token: null,
    tokenTimer: false,
    verifyingToken: false,
    loading: false
  },
  otpDataHolder: {
    userInfo: null,
    data: null
  },
  google: {
    code: null,
    scope: null
  },
  echo: null,
  currentPath: false,
  setUser(userID, username, email, type, status, profile, notifSetting, subAccount, code, location, linkedAccount, assignedLocation, information, flag){
    if(userID === null){
      username = null
      email = null
      type = null
      status = null
      profile = null
      notifSetting = null
      subAccount = null
      code = null
      location = null
      linkedAccount = null
      assignedLocation = null
    }
    this.user.userID = userID * 1
    this.user.username = username
    this.user.email = email
    this.user.type = type
    this.user.status = status
    this.user.profile = profile
    this.user.notifSetting = notifSetting
    this.user.subAccount = subAccount
    this.user.code = code
    this.user.location = location
    this.user.linked_account = linkedAccount
    this.user.assigned_location = assignedLocation
    this.user.information = information
    localStorage.setItem('account_id', this.user.userID)
    localStorage.setItem('account/' + code, JSON.stringify(this.user))
    if(this.user.userID > 0){
      this.checkConsent(this.user.userID)
    }
    if(flag === true){
      this.redirectRoute()
    }
    setTimeout(() => {
      this.tokenData.loading = false
    }, 1000)
  },
  setToken(token){
    this.tokenData.token = token
    localStorage.setItem('usertoken', token)
    if(token){
      setTimeout(() => {
        let vue = new Vue()
        vue.APIRequest('authenticate/refresh', {}, (response) => {
          this.setToken(response['token'])
        }, (response) => {
          this.deaunthenticate()
        })
      }, 1000 * 60 * 60) // 50min
    }
  },
  authenticate(username, password, callback, errorCallback){
    let vue = new Vue()
    let credentials = {
      username: username,
      password: password,
      status: 'VERIFIED'
    }
    vue.APIRequest('authenticate', credentials, (response) => {
      this.tokenData.token = response.token
      this.setToken(response.token)
      vue.APIRequest('authenticate/user', {}, (userInfo) => {
        this.tokenData.loading = true
        this.setUser(userInfo.id, userInfo.username, userInfo.email, userInfo.account_type, userInfo.status, null, null, null, userInfo.code, null, null, null, null, true)
        let parameter = {
          'condition': [{
            'value': userInfo.id,
            'clause': '=',
            'column': 'id'
          }]
        }
        vue.APIRequest('accounts/retrieve', parameter).then(response => {
          if(response.data.length > 0){
            let profile = response.data[0].account_profile
            let notifSetting = response.data[0].notification_settings
            let subAccount = response.data[0].sub_account
            let location = response.data[0].location
            let linkedAccount = response.data[0].linked_account
            let assignedLocation = response.data[0].assigned_location
            let information = response.data[0].account_information
            this.setUser(userInfo.id, userInfo.username, userInfo.email, userInfo.account_type, userInfo.status, profile, notifSetting, subAccount, userInfo.code, location, linkedAccount, assignedLocation, information, false)
          }
        })
        this.retrieveNotifications(userInfo.id)
        // this.retrieveMessages(userInfo.id, userInfo.account_type)
        if(callback){
          callback(userInfo)
        }
      })
    }, (response, status) => {
      if(errorCallback){
        errorCallback(response, status)
      }
    })
  },
  checkAuthentication(callback, flag = false){
    this.tokenData.verifyingToken = true
    let token = localStorage.getItem('usertoken')
    if(token){
      if(flag === false){
        this.tokenData.loading = true
      }
      this.setToken(token)
      let vue = new Vue()
      vue.APIRequest('authenticate/user', {}, (userInfo) => {
        this.setUser(userInfo.id, userInfo.username, userInfo.email, userInfo.account_type, userInfo.status, null, null, null, userInfo.code, null, null, null, null, false)
        let parameter = {
          'condition': [{
            'value': userInfo.id,
            'clause': '=',
            'column': 'id'
          }]
        }
        vue.APIRequest('accounts/retrieve', parameter).then(response => {
          let profile = response.data[0].account_profile
          let notifSetting = response.data[0].notification_settings
          let subAccount = response.data[0].sub_account
          let location = response.data[0].location
          let linkedAccount = response.data[0].linked_account
          let assignedLocation = response.data[0].assigned_location
          let information = response.data[0].account_information
          this.setUser(userInfo.id, userInfo.username, userInfo.email, userInfo.account_type, userInfo.status, profile, notifSetting, subAccount, userInfo.code, location, linkedAccount, assignedLocation, information, false)
        }).done(response => {
          this.tokenData.verifyingToken = false
          this.tokenData.loading = false
          let location = window.location.href
          if(this.currentPath){
            // ROUTER.push(this.currentPath)
          }else{
            window.location.href = location
          }
        })
        this.retrieveNotifications(userInfo.id)
        // this.retrieveMessages(userInfo.id, userInfo.account_type)
        this.getGoogleCode()
      }, (response) => {
        this.setToken(null)
        this.tokenData.verifyingToken = false
        ROUTER.push({
          path: this.currentPath
        })
      })
      return true
    }else{
      this.tokenData.verifyingToken = false
      this.setUser(null)
      return false
    }

  },
  deaunthenticate(){
    this.tokenData.loading = true
    localStorage.removeItem('usertoken')
    localStorage.removeItem('account_id')
    localStorage.removeItem('google_code')
    localStorage.removeItem('google_scope')
    this.setUser(null)
    let vue = new Vue()
    vue.APIRequest('authenticate/invalidate')
    this.clearNotifTimer()
    this.tokenData.token = null
    ROUTER.go('/')
  },
  retrieveNotifications(accountId){
    let vue = new Vue()
    let parameter = {
      'account_id': accountId
    }
    vue.APIRequest('notifications/retrieve', parameter).then(response => {
      if(response.data.length > 0){
        this.user.notifications.data = response.data
        this.user.notifications.current = response.size
        if(this.user.notifications.current > 0){
          // this.playNotificationSound()
        }
      }else{
        this.user.notifications.data = null
        this.user.notifications.current = null
      }
    })
  },
  addNotification(notification){
    if(notification.payload !== undefined){
      if(parseInt(this.user.userID) === parseInt(notification.to)){
        if(this.user.notifications.data === null){
          this.user.notifications.data = []
          this.user.notifications.data.push(notification)
          this.user.notifications.current = 1
        }else{
          this.user.notifications.data.unshift(notification)
          this.user.notifications.current += 1
        }
        let audio = require('src/assets/audio/notification.mp3')
        let sound = new Howl({
          src: [audio]
        })
        sound.play()
      }
    }else if(parseInt(this.user.userID) === parseInt(notification.id)){
      $('#alertModal').modal('show')
      COMMON.alertFlag = true
      this.playNotificationSound(true)
    }else{
      $('#alertModal').modal('hide')
      COMMON.alertFlag = false
    }
  },
  retrieveMessages(accountId, type){
    let vue = new Vue()
    let parameter = {
      account_id: accountId
    }
    vue.APIRequest('messenger_groups/retrieve_summary_payhiram', parameter).then(response => {
      if(response.data !== null){
        this.user.messages.data = response.data
        this.user.messages.totalUnreadMessages = response.size
      }else{
        this.user.messages.data = null
        this.user.messages.totalUnreadMessages = null
      }
    })
  },
  addMessage(message){
    if(parseInt(message.messenger_group_id) === this.messenger.messengerGroupId && parseInt(message.account_id) !== this.user.userID){
      $('#alertModal').modal('show')
      this.playNotificationSound()
      this.messenger.messages.push(message)
    }
  },
  startNotifTimer(accountId){
    if(this.notifTimer.timer === null){
      this.notifTimer.timer = window.setInterval(() => {
        if(accountId !== null){
          this.retrieveNotifications(accountId)
        }
      }, this.notifTimer.speed)
    }
  },
  clearNotifTimer(){
    if(this.notifTimer.timer !== null){
      window.clearInterval(this.notifTimer.timer)
      this.notifTimer.timer = null
    }
  },
  playNotificationSound(flag = true){
    let sound = null
    let audio = require('src/assets/audio/notification.mp3')
    if(flag === true){
      sound = new Howl({
        src: [audio]
      })
      setTimeout(() => {
        setInterval(() => {
          sound.play()
        }, 2000)
      }, 100)
    }else{
      ROUTER.go('/')
    }
  },
  checkPlan(){
    if(Config.plan === true){
      if(this.user.plan !== null){
        if(this.user.plan.title === 'Expired' && this.user.type !== 'ADMIN'){
          ROUTER.push('/plan')
        }
      }
    }
  },
  redirect(path){
    ROUTER.push(path)
  },
  validateEmail(email){
    let reg = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+.[a-zA-Z0-9]*$/
    if(reg.test(email) === false){
      return false
    }else{
      return true
    }
  },
  redirectRoute(){
    const locationCode = localStorage.getItem('location_code')
    if (locationCode) {
      ROUTER.push(`/scanned/location/${locationCode}`)
    } else {
      ROUTER.push('/dashboard')
    }
  },
  setGoogleCode(code, scope){
    localStorage.setItem('google_code', code)
    localStorage.setItem('google_scope', scope)
    this.google.code = code
    this.google.scope = scope
  },
  getGoogleCode(){
    this.google.code = localStorage.getItem('google_code')
    this.google.scope = localStorage.getItem('google_scope')
  },
  checkConsent(userID){
    let vue = new Vue()
    if(this.user.type !== 'USER' && this.user.type !== 'BUSINESS_AUTHORIZED' && this.user.type !== 'TEMP_SCANNER'){
      return
    }
    let parameter = {
      condition: [{
        value: userID,
        column: 'account_id',
        clause: '='
      }]
    }
    vue.APIRequest('consents/retrieve', parameter, (response) => {
      if(response.data.length > 0){
        $('#consentModal').modal('hide')
      }else{
        $('#consentModal').modal('show')
      }
    })
  }
}
