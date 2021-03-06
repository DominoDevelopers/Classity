const express = require('express');
const mongoose = require('mongoose');
const { check, validationResult } = require('express-validator');
const gravatar = require('gravatar');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const auth = require('../../middleware/auth');

// Models
const userModels = require('../../models/User');
const User = userModels.User;
const EmailUser = userModels.EmailUser;

const getToken = require('../../utils/tokenGenerator');
const emailSend = require('../../utils/emailSend');
const { verifyEmailHTML } = require('../../utils/getHtmlBody');

// Init router
const router = express.Router();

// -----------------------------------------ROUTES --------------------------------------------------

/**
 * @route           POST api/users
 * @description     Register User
 * @access          Public
 */
router.post(
    '/',
    [
        check('name', 'Please enter name').not().isEmpty(),
        check('email', 'Please enter a valid email').isEmail(),
        check('password', 'Password should be atleast 6 charachters long').isLength({
            min: 6
        })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json(errors);
        }

        const session = await mongoose.startSession();

        try {
            await session.withTransaction(async () => {
                const { name, email, password } = req.body;
                let user = await User.findOne({ email });
                if (user) {
                    return res.status(400).json({ errors: [{ msg: 'User already exists' }] });
                }
                const avatar = gravatar.url(email, {
                    s: '200',
                    r: 'pg',
                    d: 'mm'
                });
                user = new EmailUser({
                    name,
                    email,
                    password,
                    avatar
                });
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(password, salt);
                let secretToken;
                [user.password, secretToken] = await Promise.all([
                    bcrypt.hash(password, salt),
                    getToken(100)
                ]);

                if (req.body.overide) {
                    user.verifyingToken = null;
                    await user.save();
                    const token = user.generateJWT();
                    return res.json({ token });
                } else {
                    user.verifyingToken = {
                        reason: 'email-verify',
                        token: secretToken,
                        expDate: Date.now() + 2 * 60 * 60 * 1000
                    };
                    user.nextTokenRequest = Date.now() + 15 * 60 * 1000;

                    await user.save();
                    emailSend(
                        email,
                        'Verify your email',
                        verifyEmailHTML(
                            name,
                            `http://localhost:3000/email-verify?_tk_=${secretToken}&_id_=${user.id}`
                        )
                    ).catch(err => console.error(err));
                    return res.json({ success: true, nextTokenRequest: user.nextTokenRequest });
                }
            });
        } catch (err) {
            console.error(err.message);
            res.status(500).json({ errors: [{ msg: 'Server Error' }] });
        } finally {
            session.endSession();
        }
    }
);

/**
 * @route           PUT api/users/email-verify
 * @description     Verify email
 * @access          Public
 */
router.put('/email-verify', async (req, res) => {
    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {
            const { token, id } = req.body;
            if (!token || !id) {
                return res
                    .status(400)
                    .json({ errors: [{ msg: 'Verification failed! Please try again' }] });
            }

            const user = await EmailUser.findById(id);

            if (!user) {
                return res
                    .status(400)
                    .json({ errors: [{ msg: 'Verification failed! Please try again' }] });
            }

            if (user.emailVerified()) {
                return res
                    .status(403)
                    .json({ errors: [{ msg: 'Verification failed! Please try again' }] });
            }

            const [token_, expDate_] = [user.verifyingToken.token, user.verifyingToken.expDate];

            if (expDate_ <= Date.now()) {
                return res.status(400).json({
                    errors: [{ msg: 'Link expired! Please rerequest verification email' }]
                });
            }

            if (token !== token_) {
                return res
                    .status(403)
                    .json({ errors: [{ msg: 'Verification failed! Please try again' }] });
            }

            user.verifyingToken = null;
            user.nextTokenRequest = Date.now();
            await user.save();

            return res.json({ msg: 'Email verification Success !' });
        });
    } catch (err) {
        if (err.kind === 'ObjectId')
            return res
                .status(400)
                .json({ errors: [{ msg: 'Verification failed! Please try again' }] });

        res.status(500).json({ errors: [{ msg: 'Server Error' }] });
    } finally {
        session.endSession();
    }
});

/**
 * @route           GET api/users
 * @description     Get all users name, email, score and contributions
 * @access          Public
 */
router.get('/', async (req, res) => {
    try {
        const { sort, limit, skip, name } = JSON.parse(req.query.source || '{}');
        const regex = new RegExp(
            name ? name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') : '.*?',
            'gi'
        );

        const users = await User.aggregate([
            { $match: { name: regex } },
            {
                $project: {
                    score: {
                        $reduce: {
                            input: { $objectToArray: '$score' },
                            initialValue: 0,
                            in: { $add: ['$$value', '$$this.v'] }
                        }
                    },
                    contribution: {
                        $reduce: {
                            input: { $objectToArray: '$contribution' },
                            initialValue: 0,
                            in: { $add: ['$$value', '$$this.v'] }
                        }
                    },
                    name: '$name',
                    email: '$email'
                }
            },
            { $sort: sort || { _id: 1 } },
            { $skip: skip || 0 },
            { $limit: limit || 10 }
        ]);

        return res.json(users);
    } catch (err) {
        console.log(err.message);
        return res.status(500).json({ errors: [{ msg: 'Server Error' }] });
    }
});

/**
 * @route           GET api/users/:userId
 * @description     Get user name, email, score and contributions by user Id
 * @access          Private
 */
router.get('/:userId', auth, async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).select('name email score contribution');

        return res.json(user);
    } catch (err) {
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ errors: [{ msg: 'Invalid User Id' }] });
        }
        console.log(err.message);
        return res.status(500).json({ errors: [{ msg: 'Server Error' }] });
    }
});

router.put(
    '/rerequest-link',
    [
        check('reason', 'reason should be there').not().isEmpty(),
        check('email', 'email should be there').not().isEmpty()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json(errors);
        }

        try {
            const { reason, email } = req.body;

            if (reason === 'email-verify') {
                const [user, secretToken] = await Promise.all([
                    EmailUser.findOne({ email }),
                    getToken(100)
                ]);

                if (!user) {
                    return res.status(400).json({ errors: [{ msg: 'Bad Request' }] });
                }

                if (user.emailVerified()) {
                    return res.status(400).json({ errors: [{ msg: 'Bad request' }] });
                }

                if (user.nextTokenRequest > Date.now()) {
                    return res.status(403).json({ errors: [{ msg: 'To early for new link' }] });
                }

                user.verifyingToken = {
                    reason,
                    token: secretToken,
                    expDate: Date.now() + 2 * 60 * 60 * 1000
                };
                user.nextTokenRequest = Date.now() + 15 * 60 * 1000;
                await user.save();
                emailSend(
                    user.email,
                    'Verify your email',
                    verifyEmailHTML(
                        user.name,
                        `http://localhost:3000/email-verify?_tk_=${secretToken}&_id_=${user.id}`
                    )
                );

                return res.json({ nextTokenRequest: user.nextTokenRequest });
            }
            return res.status(400).json({ errors: [{ msg: 'Bad Request' }] });
        } catch (err) {
            if (err.kind === 'ObjectId') {
                return res.status(400).json({ errors: [{ msg: 'Bad request' }] });
            }
            console.error(err);
            return res.status(500).json({ errors: [{ msg: 'Server Error' }] });
        }
    }
);

module.exports = router;
