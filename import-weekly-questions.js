// Script to import all weekly questions from the הסבר/שאלות folder
const fs = require('fs');
const path = require('path');
const firebase = require('./src/firebase');

// Path to questions folder
const QUESTIONS_FOLDER = path.join(__dirname, '..', 'הסבר', 'שאלות');

/**
 * Parse a single question file
 * Format:
 * - Source/explanation line
 * - Question line
 * - 4 option lines (correct one marked with *)
 */
function parseQuestionsFile(content) {
    const questions = [];
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    let i = 0;
    let questionId = 1;
    
    while (i < lines.length) {
        // Try to find a question block
        // Look for a line that starts with "מקור:" or just text followed by a question
        let explanation = '';
        let questionText = '';
        let options = [];
        let correctAnswer = -1;
        
        // Find explanation (line that starts with מקור: or contains source info)
        if (lines[i] && (lines[i].startsWith('מקור:') || lines[i].startsWith('"') || !lines[i].includes('?'))) {
            explanation = lines[i].replace(/^מקור:\s*/, '').replace(/^[""]|[""]$/g, '').trim();
            i++;
        }
        
        // Find question (line with ? or starts with "שאלה:")
        if (i < lines.length) {
            if (lines[i].startsWith('שאלה:')) {
                questionText = lines[i].replace(/^שאלה:\s*/, '').trim();
            } else if (lines[i].includes('?')) {
                questionText = lines[i].trim();
            } else {
                // This might be continuation of explanation, skip
                i++;
                continue;
            }
            i++;
        }
        
        // Get 4 options
        while (i < lines.length && options.length < 4) {
            let option = lines[i].trim();
            
            // Skip empty lines or lines that look like new questions
            if (!option || option.startsWith('מקור:') || option.includes('?')) {
                break;
            }
            
            // Remove leading dash or number
            option = option.replace(/^[-–]\s*/, '').replace(/^\d+[.)]\s*/, '').trim();
            
            // Check if this is the correct answer (marked with *)
            if (option.endsWith('*') || option.startsWith('*')) {
                correctAnswer = options.length;
                option = option.replace(/\*+/g, '').trim();
            }
            
            if (option.length > 0) {
                options.push(option);
            }
            i++;
        }
        
        // If we have a valid question, add it
        if (questionText && options.length >= 2) {
            // If no correct answer marked, try to find it by content
            if (correctAnswer === -1) {
                // Default to first option if none marked
                correctAnswer = 0;
            }
            
            questions.push({
                id: questionId++,
                question: questionText,
                explanation: explanation || '',
                options: options,
                correctAnswer: correctAnswer
            });
        }
    }
    
    return questions;
}

/**
 * Alternative parser - more robust
 */
function parseQuestionsFileV2(content) {
    const questions = [];
    const lines = content.split('\n');
    
    let currentExplanation = '';
    let currentQuestion = '';
    let currentOptions = [];
    let correctAnswerIndex = -1;
    let questionId = 1;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (!line) continue;
        
        // Check if this is an explanation/source line
        if (line.startsWith('מקור:') || (line.startsWith('"') && !line.includes('?'))) {
            // Save previous question if exists
            if (currentQuestion && currentOptions.length >= 2) {
                questions.push({
                    id: questionId++,
                    question: currentQuestion,
                    explanation: currentExplanation,
                    options: currentOptions.slice(0, 4),
                    correctAnswer: correctAnswerIndex >= 0 ? correctAnswerIndex : 0
                });
            }
            
            // Start new question
            currentExplanation = line.replace(/^מקור:\s*/, '').replace(/^[""]|[""]$/g, '').trim();
            currentQuestion = '';
            currentOptions = [];
            correctAnswerIndex = -1;
            continue;
        }
        
        // Check if this is a question line (contains ? or starts with שאלה:)
        if (line.includes('?') || line.startsWith('שאלה:')) {
            // If we have a previous question, save it
            if (currentQuestion && currentOptions.length >= 2) {
                questions.push({
                    id: questionId++,
                    question: currentQuestion,
                    explanation: currentExplanation,
                    options: currentOptions.slice(0, 4),
                    correctAnswer: correctAnswerIndex >= 0 ? correctAnswerIndex : 0
                });
                currentExplanation = '';
                currentOptions = [];
                correctAnswerIndex = -1;
            }
            
            currentQuestion = line.replace(/^שאלה:\s*/, '').trim();
            continue;
        }
        
        // This must be an option
        if (currentQuestion) {
            let option = line.replace(/^[-–•]\s*/, '').replace(/^\d+[.)]\s*/, '').trim();
            
            // Check for correct answer marker
            if (option.includes('*')) {
                correctAnswerIndex = currentOptions.length;
                option = option.replace(/\*+/g, '').trim();
            }
            
            if (option.length > 0 && currentOptions.length < 4) {
                currentOptions.push(option);
            }
        } else if (!currentExplanation) {
            // This might be an explanation without "מקור:"
            currentExplanation = line;
        }
    }
    
    // Don't forget the last question
    if (currentQuestion && currentOptions.length >= 2) {
        questions.push({
            id: questionId++,
            question: currentQuestion,
            explanation: currentExplanation,
            options: currentOptions.slice(0, 4),
            correctAnswer: correctAnswerIndex >= 0 ? correctAnswerIndex : 0
        });
    }
    
    return questions;
}

async function importAllQuestions() {
    console.log('🚀 Starting import of weekly questions...\n');
    
    const allWeeks = [];
    
    // Read all 6 weeks
    for (let week = 1; week <= 6; week++) {
        const fileName = `שאלות שבוע ${week}.txt`;
        const filePath = path.join(QUESTIONS_FOLDER, fileName);
        
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const questions = parseQuestionsFileV2(content);
            
            console.log(`📖 Week ${week}: Found ${questions.length} questions`);
            
            // Add week number to each question
            const weekQuestions = questions.map((q, idx) => ({
                ...q,
                id: idx + 1,
                week: week
            }));
            
            allWeeks.push({
                week: week,
                questions: weekQuestions
            });
            
        } catch (error) {
            console.log(`❌ Error reading week ${week}: ${error.message}`);
        }
    }
    
    // Calculate total questions
    const totalQuestions = allWeeks.reduce((sum, w) => sum + w.questions.length, 0);
    console.log(`\n📊 Total: ${totalQuestions} questions across ${allWeeks.length} weeks\n`);
    
    // Upload to Firebase
    console.log('📤 Uploading to Firebase...\n');
    
    try {
        // Save each week's questions
        for (const weekData of allWeeks) {
            // Save as a collection: questions/week1, questions/week2, etc.
            const result = await firebase.saveSettings(`week${weekData.week}Questions`, {
                week: weekData.week,
                totalQuestions: weekData.questions.length,
                questions: weekData.questions,
                updatedAt: new Date().toISOString()
            });
            
            if (result.success) {
                console.log(`  ✅ Week ${weekData.week}: ${weekData.questions.length} questions uploaded`);
            } else {
                console.log(`  ❌ Week ${weekData.week}: Upload failed - ${result.error}`);
            }
        }
        
        // Save metadata about all weeks
        await firebase.saveSettings('questionsMetadata', {
            totalWeeks: 6,
            totalQuestions: totalQuestions,
            weeksInfo: allWeeks.map(w => ({
                week: w.week,
                count: w.questions.length
            })),
            updatedAt: new Date().toISOString()
        });
        
        console.log('\n✨ All questions uploaded successfully!');
        
        // Show sample
        console.log('\n📋 Sample questions from Week 1:');
        if (allWeeks[0] && allWeeks[0].questions.length > 0) {
            const sample = allWeeks[0].questions.slice(0, 3);
            sample.forEach((q, i) => {
                console.log(`\n  ${i + 1}. ${q.question}`);
                q.options.forEach((opt, j) => {
                    const marker = j === q.correctAnswer ? '✓' : ' ';
                    console.log(`     ${marker} ${opt}`);
                });
            });
        }
        
    } catch (error) {
        console.log(`❌ Firebase upload failed: ${error.message}`);
    }
    
    console.log('\n🔗 View your data at:');
    console.log('https://console.firebase.google.com/project/game-data-f1f43/firestore');
    
    process.exit(0);
}

importAllQuestions().catch(error => {
    console.error('Import failed:', error);
    process.exit(1);
});
