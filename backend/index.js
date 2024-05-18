require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const csvParser = require('csv-parser');
const fs = require('fs');
const nodemailer = require('nodemailer');
const UserList = require('./db');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.json());

mongoose.connect('mongodb+srv://raj2020:hbZbztZLkhJnCq2e@cluster0.yhlsrrr.mongodb.net/user_list', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Endpoint to create a new user list
app.post('/lists', async (req, res) => {
    const { title, customProperties } = req.body;
    const userList = new UserList({ title, customProperties });
    await userList.save();
    res.status(201).send(userList);
});

// Endpoint to upload users via CSV
app.post('/lists/:id/users', upload.single('file'), async (req, res) => {
    const userListId = req.params.id;
    const filePath = req.file.path;
    const userList = await UserList.findById(userListId);

    if (!userList) {
        return res.status(404).send({ error: 'List not found' });
    }

    const results = [];
    const errors = [];
    const existingEmails = new Set(userList.users.map(user => user.email));
    
    fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            for (const row of results) {
                if (!row.name || !row.email) {
                    errors.push({ ...row, error: 'Name and email are required' });
                    continue;
                }
                if (existingEmails.has(row.email)) {
                    errors.push({ ...row, error: 'Duplicate email' });
                    continue;
                }
                const userProperties = {};
                userList.customProperties.forEach(prop => {
                    userProperties[prop.title] = row[prop.title] || prop.fallback;
                });
                userList.users.push({ name: row.name, email: row.email, properties: userProperties });
                existingEmails.add(row.email);
            }
            await userList.save();
            fs.unlinkSync(filePath);
            res.status(200).send({
                addedCount: results.length - errors.length,
                errorCount: errors.length,
                errors
            });
        });
});

// send emails to list (bonus)
app.post('/lists/:id/send-email', async (req, res) => {
    const { subject, body } = req.body;
    const userList = await UserList.findById(req.params.id);

    if (!userList) {
        return res.status(404).send({ error: 'List not found' });
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_PASS
        }
    });

    for (const user of userList.users) {
        const emailBody = body.replace(/\[([^\]]+)\]/g, (match, propName) => user.properties.get(propName) || '');
        const mailOptions = {
            from: 'your-email@gmail.com',
            to: user.email,
            subject,
            text: emailBody
        };
        await transporter.sendMail(mailOptions);
    }

    res.send({ message: 'Emails sent' });
});

// Unsubscribe user (bonus)
app.get('/lists/:listId/unsubscribe/:email', async (req, res) => {
    const { listId, email } = req.params;
    const userList = await UserList.findById(listId);

    if (!userList) {
        return res.status(404).send({ error: 'List not found' });
    }

    const user = userList.users.find(user => user.email === email);
    if (!user) {
        return res.status(404).send({ error: 'User not found' });
    }

    user.unsubscribed = true;
    await userList.save();

    res.send({ message: 'Unsubscribed successfully' });
});

// Modify email (bonus)
app.post('/lists/:id/send-email', async (req, res) => {
    const { subject, body } = req.body;
    const userList = await UserList.findById(req.params.id);

    if (!userList) {
        return res.status(404).send({ error: 'List not found' });
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'your-email@gmail.com',
            pass: 'your-email-password'
        }
    });

    for (const user of userList.users.filter(user => !user.unsubscribed)) {
        const emailBody = body.replace(/\[([^\]]+)\]/g, (match, propName) => user.properties.get(propName) || '');
        const unsubscribeLink = `http://localhost:3000/lists/${userList.id}/unsubscribe/${user.email}`;
        const finalEmailBody = `${emailBody}\n\nUnsubscribe: ${unsubscribeLink}`;
        const mailOptions = {
            from: 'your-email@gmail.com',
            to: user.email,
            subject,
            text: finalEmailBody
        };
        await transporter.sendMail(mailOptions);
    }

    res.send({ message: 'Emails sent' });
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
