const fs = require('fs');

try {
    const rawData = fs.readFileSync('quiz_1.json', 'utf8');
    const data = JSON.parse(rawData);
    const rawList = Array.isArray(data) ? data : (data.results || []);

    console.log(`Found ${rawList.length} raw items.`);

    const questions = rawList.map((item, index) => {
        const q = item.prompt || item;
        const id = item.id || `mod-${index}`;

        const text = q.question || q.question_plain || item.question || "Testo domanda mancante";
        const options = Array.isArray(q.answers) ? q.answers : (item.answers || []);

        return {
            id,
            textLength: text.length,
            optionsCount: options.length
        };
    }).filter(q => q.optionsCount > 0);

    console.log(`Normalized ${questions.length} questions.`);
    if (questions.length > 0) {
        console.log('Sample question:', questions[0]);
    } else {
        console.log('No questions found after filtering!');
        if (rawList.length > 0) {
            console.log('First raw item prompt keys:', Object.keys(rawList[0].prompt || {}));
            console.log('First raw item prompt.answers:', (rawList[0].prompt || {}).answers);
        }
    }

} catch (e) {
    console.error('Error:', e.message);
}
