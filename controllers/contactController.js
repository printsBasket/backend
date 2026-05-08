const asyncHandler = require('express-async-handler');
const { sendEmail } = require('../utils/emailService');

// @desc    Send contact email
// @route   POST /api/contact
// @access  Public
const sendContactEmail = asyncHandler(async (req, res) => {
    const { type } = req.body;

    let subject, html, text, fromName, replyToEmail;


    if (type === 'return-exchange') {
        const { 
            email, 
            orderNumber, 
            reason, 
            resolution, 
            additionalDetails 
        } = req.body;

        // Only require email and orderNumber
        if (!email || !orderNumber) {
            res.status(400);
            throw new Error('Please provide your email and order number');
        }

        fromName = `Return Request - Order #${orderNumber}`;
        replyToEmail = email;
        subject = `Return/Exchange Request: Order #${orderNumber}`;
        text = `
Return/Exchange Request

Customer Email: ${email}

Order Information:
Order Number: ${orderNumber}

Reason for Return: ${reason || 'Not specified'}

Resolution Requested: ${resolution || 'Not specified'}

Additional Details:
${additionalDetails || 'None provided'}
            `;
        html = `
<h3>New Return/Exchange Request</h3>

<p><strong>Customer Email:</strong> ${email}</p>

<h4>Order Information</h4>
<p><strong>Order Number:</strong> ${orderNumber}</p>

<h4>Reason for Return</h4>
<p>${reason || 'Not specified'}</p>

<h4>Resolution Requested</h4>
<p><strong>${resolution || 'Not specified'}</strong></p>

<h4>Additional Details</h4>
<p>${(additionalDetails || 'None provided').replace(/\n/g, '<br>')}</p>
            `;

    } else {
        // Default Contact Form
        const { name, email, orderNumber, subject: reqSubject, message } = req.body;

        if (!name || !email || !reqSubject || !message) {
            res.status(400);
            throw new Error('Please fill in all required fields');
        }

        fromName = name;
        replyToEmail = email;
        subject = `Contact Form: ${reqSubject} from ${name}`;
        text = `
Name: ${name}
Email: ${email}
Order Number: ${orderNumber || 'N/A'}
Subject: ${reqSubject}

Message:
${message}
            `;
        html = `
<h3>New Contact Form Submission</h3>
<p><strong>Name:</strong> ${name}</p>
<p><strong>Email:</strong> ${email}</p>
<p><strong>Order Number:</strong> ${orderNumber || 'N/A'}</p>
<p><strong>Subject:</strong> ${reqSubject}</p>
<p><strong>Message:</strong></p>
<p>${message.replace(/\n/g, '<br>')}</p>
            `;
    }

    // Send email using shared service
    try {
        await sendEmail({
             to: process.env.CONTACT_RECEIVER_EMAIL || 'support@printsbasket.com',
             subject,
             html,
             text,
             from: `"${fromName}" <${process.env.EMAIL_FROM || 'support@printsbasket.com'}>`,
             replyTo: replyToEmail
        });
        res.status(200).json({ message: 'Email sent successfully' });
    } catch (error) {
        console.error('Contact email sending error:', error);
        res.status(500);
        throw new Error('Failed to send email. Please try again later.');
    }
});

module.exports = { sendContactEmail };
