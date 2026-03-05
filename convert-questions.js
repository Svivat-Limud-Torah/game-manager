const fs = require('fs');

// Read all question files
const files = [
    'C:\\Users\\user\\Dropbox\\Data\\q-1.txt',
    'C:\\Users\\user\\Dropbox\\Data\\q-2.txt',
    'C:\\Users\\user\\Dropbox\\Data\\q-3.txt',
    'C:\\Users\\user\\Dropbox\\Data\\q-4.txt'
];

const allQuestions = [];
const seenQuestions = new Set(); // To track duplicates by question text

files.forEach(file => {
    try {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        
        let i = 0;
        while (i < lines.length) {
            if (i + 5 >= lines.length) break;
            
            const explanation = lines[i].trim();
            const question = lines[i + 1].trim();
            
            // Skip if we've seen this question before (duplicate check)
            if (seenQuestions.has(question)) {
                i += 6;
                continue;
            }
            seenQuestions.add(question);
            
            const options = [];
            let correctAnswer = 0;
            
            for (let j = 0; j < 4; j++) {
                let option = lines[i + 2 + j].trim();
                if (option.endsWith('*')) {
                    correctAnswer = j;
                    option = option.slice(0, -1).trim();
                }
                options.push(option);
            }
            
            allQuestions.push({
                question,
                explanation,
                options,
                correctAnswer
            });
            
            i += 6;
        }
        console.log(`Processed ${file}`);
    } catch (e) {
        console.log(`Skipped ${file}: ${e.message}`);
    }
});

// Assign IDs after removing duplicates
const questions = allQuestions.map((q, idx) => ({ id: idx + 1, ...q }));

console.log(`\nFound ${questions.length} unique questions (removed duplicates)`);

// Generate JavaScript code
let jsCode = `function getDefaultQuestions() {
    // שאלות על הלכות שבת - כל השאלות מהמאגר המקורי
    const questions = [\n`;

questions.forEach((q, idx) => {
    const escapedQuestion = q.question.replace(/'/g, "\\'").replace(/"/g, '\\"');
    const escapedExplanation = q.explanation.replace(/'/g, "\\'").replace(/"/g, '\\"');
    const escapedOptions = q.options.map(o => o.replace(/'/g, "\\'").replace(/"/g, '\\"'));
    
    jsCode += `        { id: ${q.id}, question: '${escapedQuestion}', explanation: '${escapedExplanation}', options: ['${escapedOptions.join("', '")}'], correctAnswer: ${q.correctAnswer} }`;
    if (idx < questions.length - 1) jsCode += ',';
    jsCode += '\n';
});

jsCode += `    ];
    store.set('questions', questions);
    return questions;
}`;

// Write output
fs.writeFileSync('c:\\Game-Data\\game-manager\\questions-output.js', jsCode, 'utf8');
console.log('Output written to questions-output.js');
console.log('\nFirst 3 questions:');
console.log(JSON.stringify(questions.slice(0, 3), null, 2));
