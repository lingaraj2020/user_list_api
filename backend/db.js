const mongoose = require('mongoose');

const customPropertySchema = new mongoose.Schema({
    title: { type: String, required: true },
    fallback: { type: String, required: true }
});

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    properties: { type: Map, of: String },
    unsubscribed: { type: Boolean, default: false }
});

const userListSchema = new mongoose.Schema({
    title: { type: String, required: true },
    customProperties: [customPropertySchema],
    users: [userSchema]
});

module.exports = mongoose.model('UserList', userListSchema);
