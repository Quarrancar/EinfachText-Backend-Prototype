require("dotenv").config();


const UserModel = require('../models/userModel')
const DocModel = require('../models/docModel')
const jwt = require('jsonwebtoken')
const { promisify } = require('util')
const NotificationModel = require('../models/notificationModel')


// Erstellung des JWT
const signToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN
    })
}


// Registrierung
exports.registrierung = async function (req, res) {
    try {
        const newUser = await UserModel.create({
            username: req.body.username,
            email: req.body.email,
            password: req.body.password,
            passwordConfirm: req.body.passwordConfirm,
        })

        res.status(201).json({
            status: 'success',
            data: {
                user: newUser
            }
        })
    } catch (err) {
        res.status(400).json({
            status: "fail",
            message: err.message
        })
    }
}


// Anmelden
exports.anmelden = async function (req, res) {
    try {
        const { email, password } = req.body
        if (!email || !password) {
            res.status(400).json({
                status: 'fail',
                message: "Bitte ergänzen Sie eine E-Mail und ein Passwort!"
            })
            return;
        }

        const user = await UserModel.findOne({ email }).select('+password')

        if (!user || !(await user.correctPassword(password, user.password))) {
            res.status(401).json({
                status: "fail",
                message: "Fehlerhaftes E-Mail oder Passwort!"
            })
            return;
        }

        const token = signToken(user._id)

        res.cookie('jwt', token, {
            expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000),
            sameSite: 'strict',
            httpOnly: true
        })

        res.status(200).json({
            status: "success",
            token
        })

    } catch (err) {
        res.status(400).json({
            status: 'fail',
            message: err.message
        })
    }
}


// Abmelden
exports.abmelden = async function (req, res) {
    try {
        res.cookie('jwt', '', {
            expires: new Date(Date.now() + 2 * 1000),
            httpOnly: true
        })
        res.status(200).json({
            status: "success"
        })

    } catch (err) {
        res.status(400).json({
            status: "fail",
            message: err.message
        })
    }
}


// Protect Account/User Credentials
exports.protect = async function (req, res, next) {
    try {
        let token;

        const authHeader = req.headers.authorization;
        const authCookie = req.cookies.jwt

        if (authHeader && authHeader.startsWith('Bearer')) {
            token = authHeader.split(' ')[1];
        } else if (authCookie) {
            token = authCookie
        }

        if (!token) {
            res.status(400).json({
                status: "fail",
                message: "Sie sind nicht angemeldet!"
            })
            return;
        }

        const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET)

        const freshUser = await UserModel.findById(decoded.id);
        if (!freshUser) {
            res.status(401).json({
                status: "fail",
                message: "Der User mit diesem Token existiert nicht mehr…"
            })
            return;
        }

        const isPasswordChanged = freshUser.isPasswordChanged(decoded.iat)

        if (isPasswordChanged) {
            res.status(400).json({
                status: "fail",
                message: "Das Passwort des Users wurde geändert… Bitte melden Sie sich erneut an!"
            })
            return;
        }

        req.user = freshUser
        next();

    } catch (err) {
        res.status(400).json({
            status: 'fail',
            err,
            messgae: err.message
        })
    }
}


// User ist eingeloggt
exports.isLoggedIn = async function (req, res) {

    try {
        const token = req.cookies.jwt

        if (token) {
            const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET)

            const currentUser = await UserModel.findById(decoded.id)

            if (!currentUser) {
                res.json({
                    status: "fail",
                    loggedIn: false
                })
                return
            }

            const isPasswordChanged = currentUser.isPasswordChanged(decoded.iat)

            if (isPasswordChanged) {
                res.json({
                    status: "fail",
                    loggedIn: false
                })
                return
            }

            res.status(200).json({
                status: "success",
                loggedIn: true,
                user: currentUser
            })

        } else {
            res.json({
                status: "fail",
                loggedIn: false
            })
        }


    } catch (err) {
        res.json(false)
    }
}


// Fetch/Get User
exports.getUser = async function (req, res) {
    try {
        const user = await UserModel.findById(req.params.id)

        res.status(200).json({
            status: "success",
            username: user.username
        })

    } catch (err) {
        res.status(400).json({
            status: "fail",
            message: err.message
        })
    }
}


// Fetch/Get Dokumentbesitzer
exports.getOwner = async function (req, res) {
    try {
        const doc = await DocModel.findById(req.params.docId)

        res.status(200).json({
            status: "success",
            owner: doc.owner
        })
    } catch (err) {
        res.status(400).json({
            status: "fail",
            message: err.message
        })
    }
}


// Dokumentbesitzer
exports.isOwner = async function (req, res, next) {
    try {
        const doc = await DocModel.findById(req.params.id)

        if (!req.user._id.equals(doc.owner)) {
            res.status(400).json({
                status: "fail",
                message: "Sie sind nicht authorisiert diese Aktion auszuführen!"
            })
            return
        }

        next()
    } catch (err) {
        res.status(400).json({
            status: "fail",
            message: err.message
        })
    }
}


// Ist entweder Dokumentbesitzer oder -autor
exports.isOwnerOrCollaborator = async function (req, res, next) {
    try {
        const doc = await DocModel.findById(req.params.id)

        if (!req.user._id.equals(doc.owner) && !doc.collaborators.includes(req.user._id)) {
            res.status(400).json({
                status: "fail",
                message: "Sie sind nicht berechtigt das gewünschte Dokument zu öffnen oder zu bearbeiten!"
            })
            return
        }   
        
        next()

    } catch (err) {
        res.status(400).json({
            status: "fail",
            message: err.message
        })
    }
}


// Entfernen von Dokumentautor
exports.removeCollaborator = async function (req, res) {
    try {
        const doc = await DocModel.findById(req.params.id)

        if (!doc) {
            res.status(400).json({
                status: "fail",
                message: "Es existiert kein Dokument mit diesem Namen"
            })
            return
        }

        if (!doc.collaborators) {
            res.status(400).json({
                status: "fail",
                message: "Dieses Dokument hat keine weiteren Autoren"
            })
            return
        }

        let collaboratorsArray = [...doc.collaborators]

        const index = collaboratorsArray.findIndex(id => id.equals(req.body.collabId))

        if (index === -1) {
            res.status(400).json({
                status: "fail",
                message: "Dieser User ist kein Autor"
            })
            return
        }

        collaboratorsArray.splice(index, 1)

        const updatedDoc = await DocModel.findByIdAndUpdate(req.params.id, {
            collaborators: collaboratorsArray
        }, { new: true })

        res.status(200).json({
            status: "success",
            doc: updatedDoc
        })

    } catch (err) {
        res.status(400).json({
            status: "fail",
            message: err.message
        })
    }
}


// Anfrage zu Dokumentbearbeitung als Redakteur
exports.acceptRequest = async function (req, res) {
    try {
        const senderId = req.body.senderId
        const docId = req.params.docId

        const doc = await DocModel.findById(docId)
        const user = await UserModel.findById(senderId)

        if (!doc || !user) {
            res.status(400).json({
                status: "fail",
                message: "Error"
            })
            return
        }

        if (user._id.equals(doc.owner)) {
            res.status(400).json({
                status: "fail",
                message: "Sie sind bereits der Administrator"
            })
            return
        }

        if (doc.collaborators.includes(user._id)) {
            res.status(400).json({
                status: "fail",
                message: "Sie sind bereits ein Autor"
            })
            return
        }

        const collaboratorsNew = [...doc.collaborators]
        collaboratorsNew.push(user._id)

        const updatedDoc = await DocModel.findByIdAndUpdate(docId, {
            collaborators: collaboratorsNew
        }, { new: true })

        res.status(200).json({
            status: "success",
            doc: updatedDoc
        })


    } catch (err) {
        res.status(400).json({
            status: "fail",
            message: err.message
        })
    }
}

// Existiert eine Notifikation
exports.doesNotificationExist = async function (req, res, next) {
    try {
        const docId = req.body.docId
        const senderId = req.user._id

        const doc = await DocModel.findById(docId)

        if (doc.owner.equals(senderId) || doc.owner.equals(req.user._id)) {
            res.status(400).json({
                status: 'fail',
                message: 'Sie sind bereits der Administrator'
            })
            return
        }

        if (!req.user._id.equals(senderId)) {
            res.status(400).json({
                status: "fail",
                message: "Sie sind nicht der Absender der Anfrage"
            })
            return
        }

        const sender = req.user

        if (!sender || !doc) {
            res.status(400).json({
                status: 'fail',
                message: 'Es existiert kein Dokument mit diesem Namen oder ID'
            })
            return
        }

        const owner = await UserModel.findById(doc.owner)

        if (!owner) {
            res.status(400).json({
                status: "fail",
                message: "Es existiert kein User mit dieser ID"
            })
            return
        }

        const notification = `Der User ${sender.username} erbittet Zugang zum Dokument: ${doc.name}`

        const newNotification = await NotificationModel.findOne({
            type: "access request",
            reciever: owner._id,
            sender: req.user._id,
            doc: docId,
            notification: notification
        })

        if(newNotification) {
            res.status(400).json({
                status: "fail",
                message: "Die Anfrage existiert bereits; wurde jedoch noch nicht beantwortet!"
            })
            return
        }

        req.doc = doc
        req.docOwner = owner
        next()

    } catch (err) {
        res.status(400).json({
            status: "fail",
            message: err.message
        })
    }
}

exports.createAccessNotification = async function (req, res) {
    try {
        const docId = req.body.docId
        const doc = req.doc
        const owner = req.docOwner
        const sender = req.user

        if (!owner) {
            res.status(400).json({
                status: "fail",
                message: "Es existiert kein User mit dieser ID"
            })
            return
        }

        const notification = `Der User ${sender.username} erbittet Zugang zum Dokument: ${doc.name}`

        const newNotification = await NotificationModel.create({
            type: "access request",
            reciever: owner._id,
            sender: req.user._id,
            doc: docId,
            notification: notification
        })

        res.status(200).json({
            status: "success",
            notification: newNotification
        })

    } catch (err) {
        res.status(400).json({
            status: "fail",
            message: err.message
        })
    }
}


// Erhalten von Mitteilung nach Anfrage von anderen Usern
exports.getNotifications = async function (req, res) {
    try {
        const notifications = await NotificationModel.find({
            reciever: req.user._id
        })

        res.status(200).json({
            status: "success",
            results: notifications.length,
            notifications
        })

    } catch (err) {
        res.status(400).json({
            status: "fail",
            message: err.message
        })
    }
}


// Mitteilung löschen
exports.deleteNotification = async function (req, res) {
    try {

        await NotificationModel.findByIdAndDelete(req.params.id)

        res.status(200).json({
            status: "success",
            message: "Mitteilung wurde gelöscht!"
        })

    } catch (err) {
        res.status(400).json({
            status: "fail",
            message: err.message
        })
    }
}