const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')


//  Mongoose Schema
const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, "Username wird benötigt"],
        unique: [true, "Username existiert bereits"]
    },
    email: {
        type: String,
        required: [true, "E-Mail wird benötigt"],
        unique: [true, "E-Mail existiert bereits"]
    },
    password: {
        type: String,
        minlength: [8, "Das gewählte Passwort ist zu kurz; es muss mindestens 8 Zeichen enthalten!"],
        required: [true, "Passwort wird benötigt!"],
        select: false
    },
    passwordConfirm: {
        type: String,
        required: [true, "Passwort bestätigen wird benötigt!"],
        validate: {
            validator: function (currElement) {
                return currElement === this.password
            },
            message: "Eingaben stimmen nicht überein!"
        }
    }
})

userSchema.pre('save', async function (next) {

    if (!this.isModified('password')) {
        return
    }

    this.password = await bcrypt.hash(this.password, 12)
    this.passwordConfirm = undefined
    next()
})

userSchema.methods.correctPassword = async function (candidatePassword, userPassword) {
    return await bcrypt.compare(candidatePassword, userPassword)
}

userSchema.methods.isPasswordChanged = function (timeStamp) {
    if (!this.passwordChangedAt) {
        return
    }
    const changedTimeStamp = parseInt(this.passwordChangedAt.getTime() / 1000);

    if (this.passwordChangedAt) {
        return timeStamp < changedTimeStamp
    }

    return false;
}

const UserModel = mongoose.model('UserModel', userSchema)
module.exports = UserModel