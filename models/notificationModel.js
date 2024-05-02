const mongoose = require('mongoose')


//  Mongoose Schema - Notifications
const notificationSchema = new mongoose.Schema({
    type: String,
    reciever: {
        type: mongoose.Schema.ObjectId,
        ref: 'UserModel'
    },
    sender: {
        type: mongoose.Schema.ObjectId,
        ref: 'UserModel'
    },
    doc: {
        type: mongoose.Schema.ObjectId,
        ref: 'DocModel'
    },
    notification: {
        type: String,
        required: true
    }
})


const NotificationModel = mongoose.model('NotificationModel', notificationSchema)
module.exports = NotificationModel