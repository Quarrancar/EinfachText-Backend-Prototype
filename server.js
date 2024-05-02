require("dotenv").config();


const dotenv = require('dotenv')
const express = require('express')
const app = express()
const mongoose = require('mongoose')
const cookieParser = require('cookie-parser')
const path = require('path')
const cors = require('cors')
const socketio = require('socket.io')
const http = require('http')
const server = http.createServer(app)
const io = socketio(server)

io.on('connection', (socket) => {
    socket.on("notification-sent", (data) => {
        io.emit("notification-received", data)
    })
    socket.on("notification-deleted-sent", (data) => {
        io.emit("notification-deleted-recieved", data)
    })
    socket.on("new-operations", (data) => {
        io.emit('new-remote-operations', data)
    })
})


dotenv.config({ path: "./config.env" })


const {
    getAllDocs,
    createNewDocument,
    getSingleDoc,
    updateDoc,
    deleteDoc,
    doesDocExist,
    getSingleDocPopulated
} = require('./controllers/docController')

const {
    registrierung,
    anmelden,
    abmelden,
    protect,
    isLoggedIn,
    acceptRequest,
    isOwner,
    isOwnerOrCollaborator,
    createAccessNotification,
    getOwner, getNotifications,
    deleteNotification,
    getUser,
    removeCollaborator,
    doesNotificationExist
} = require('./controllers/authController')


const DB = process.env.DB.replace(
    'password',
    process.env.DB_PASS
)


mongoose.connect(DB, { useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false, useCreateIndex: true })
    .then(() => console.log("The database and collections are connected..."))


app.use(cookieParser())
app.use(express.json())
app.use(cors())


app.get('/api/docs', protect, getAllDocs)
app.get('/api/docs/:id', protect, isOwnerOrCollaborator, getSingleDoc)
app.get('/api/docs/populated/:id', protect, isOwner, getSingleDocPopulated)
app.get('/api/docs/getOwner/:docId', protect, getOwner)
app.get('/api/users/getUser/:id', protect, getUser)
app.get('/api/users/isLoggedIn', isLoggedIn)
app.get('/api/users/abmelden', abmelden)
app.get('/api/users/notifications', protect, getNotifications)


app.patch('/api/docs/:id', protect, isOwnerOrCollaborator, doesDocExist, updateDoc)
app.patch('/api/docs/:id/removeCollaborator', protect, isOwner, removeCollaborator)


app.post('/api/docs', protect, doesDocExist, createNewDocument)
app.post('/api/users/registrierung', registrierung)
app.post('/api/users/anmelden', anmelden)
app.post('/api/users/:docId', protect, acceptRequest)
app.post('/api/users/notifications/requestAccess', protect, doesNotificationExist,createAccessNotification)


app.delete('/api/docs/:id', protect, isOwner, deleteDoc)
app.delete('/api/notifications/:id', protect, deleteNotification)


if (process.env.NODE_ENV === "production") {
    app.use(express.static('client/build'))

    app.get("*", (req, res) => {
        res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'))
    })
}


const port = process.env.PORT || 8000
server.listen(port, () => {
    console.log(`Server started at port: ${port}`)
})