const surveyEmbeds = [
    {
        title: "Which do you prefer",
        description: "When blocks are found:\ndo you want to\nkeep general channel for notifactions ?\nOr change to specific Verus & VARRR channels ?",
        fields: [
            { name: "Keep as is", value: "1️⃣" },
            { name: "Change", value: "2️⃣" },
            // Add more fields as needed
        ],
        color: "#0099ff"
    },
    {
        title: "Survey 2",
        description: "Please answer the following questions:",
        fields: [
            { name: "Question 1", value: "Answer 1" },
            { name: "Question 2", value: "Answer 2" },
            // Add more fields as needed
        ],
        color: "#ff9900"
    }
    // Add more survey embed objects as needed
];

module.exports = surveyEmbeds;