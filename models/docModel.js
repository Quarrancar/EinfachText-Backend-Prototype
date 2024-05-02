const mongoose = require('mongoose')


//  Mongoose Schema - Docs
const docSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    owner: {
        type: mongoose.Schema.ObjectId,
        ref: 'UserModel'
    },
    collaborators: {
        type: [{
            type: mongoose.Schema.ObjectId,
            ref: 'UserModel'
        }],
        default: []
    },
    content: {
        type: Array,
        default: [
            {
                type: 'paragraph',
                children: [
                    { text: 'Beispiel: \n'},
                    { text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Morbi eros libero, elementum eu quam eget, lacinia vestibulum nunc… '}
                ]
            }
        ],
        required: true
    }
})

const DocModel = mongoose.model('DocModel', docSchema)
module.exports = DocModel