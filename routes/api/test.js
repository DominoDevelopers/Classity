const express = require('express');
const { check, validationResult } = require('express-validator');
const mongoose = require('mongoose');

// middlewares
const auth = require('../../middleware/auth');
const instructorAuth = require('../../middleware/instructorAuth');
const studentAuth = require('../../middleware/studentAuth');
const classroomAuth = require('../../middleware/classroomAuth');

// Models
const User = require('../../models/User');
const Topic = require('../../models/Topic');
const Comment = require('../../models/Comment');
const Test = require('../../models/Test');
const CourseProgress = require('../../models/CourseProgress');

// Initialize router
const router = express.Router();

// ----------------------------------- Routes ------------------------------------------

/**
 * @route		GET api/test/:testId
 * @description Get a test
 * @access		private + classroomOnly
 */
router.get('/:testId', [auth, classroomAuth], async (req, res) => {
    try {
        const test = await Test.findById(req.params.testId)
            .lean()
            .select('-_id');
        res.json(test);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

/**
 * @route		PATCH api/test/:testId
 * @description Update a test
 * @access		private + instructorOnly
 */
router.patch(
    '/:testId',
    [
        auth,
        instructorAuth,
        [
            check('name', "Can't be empty").not().isEmpty(),
            check('questions', "questions can't be empty").not().isEmpty()
        ]
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        try {
            // Create test object to validate for errors
            const test = new Test({
                ...req.body
            });

            // check for errors
            const ValidationErrors = test.validateSync();
            if (ValidationErrors) {
                const error_messages = {},
                    errors = ValidationErrors.errors;
                for (let field in errors)
                    error_messages[field] = errors[field].message;
                return res.status(400).json({ errors: error_messages });
            }

            // save the test
            await Test.findOneAndUpdate(
                { _id: req.params.testId },
                {
                    ...req.body
                }
            );
            res.json(test);
        } catch (err) {
            console.error(err.message);
            res.status(500).json({ msg: 'Server Error' });
        }
    }
);

/**
 * @route		PUT api/test/:testId
 * @description Add test score
 * @access		private + studentOnly
 */
router.put(
    '/:testId',
    [
        auth,
        studentAuth,
        check('score', 'Score must be a number').not().isEmpty()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        try {
            const courseObj = await Test.findById(req.params.testId).populate(
                'topic',
                'course'
            );
            const courseId = courseObj.topic.course;

            const newProgress = await CourseProgress.findOneAndUpdate(
                {
                    user: req.user.id,
                    course: courseId
                },
                {
                    [`testScores.${req.params.testId}`]: {
                        score: req.body.score,
                        lastAttemptDate: Date.now()
                    }
                },
                { new: true }
            );
            res.json(newProgress);
        } catch (err) {
            console.error(err.message);
            res.status(500).json({ msg: 'Server Error' });
        }
    }
);

module.exports = router;
