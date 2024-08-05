const surveyEmbeds = [
    {
        title: "Fee Proposal",
        description: "We are a community here at PaddyPool & Verus as a whole\nYour opinion matters to me\nSo this poll is to guage how you guys would feel about an increase of the pool fee\nThe increase would be to 3% instead of 1%\n with 1% going to the Verus Foundation to help with development\nThe other 1% to go towards server costs, which are very expensive\nThank you all for your support in making PaddyPool what it is",
        fields: [
            { name: "Agree to the proposal", value: "1️⃣" },
            { name: "Don't agree", value: "2️⃣" },
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