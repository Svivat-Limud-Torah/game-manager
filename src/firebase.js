// Firebase Configuration and Database Functions
const { initializeApp } = require('firebase/app');
const { 
    getFirestore, 
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    setDoc, 
    updateDoc, 
    deleteDoc,
    onSnapshot,
    query,
    where
} = require('firebase/firestore');

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDfcM2RPynKCYzclKsppAg6zEvAErP-lTI",
    authDomain: "game-data-f1f43.firebaseapp.com",
    projectId: "game-data-f1f43",
    storageBucket: "game-data-f1f43.firebasestorage.app",
    messagingSenderId: "45764979610",
    appId: "1:45764979610:web:7a1c8c8b977fc672ab6823",
    measurementId: "G-VPCX0ZH54S"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Collection names
const COLLECTIONS = {
    USERS: 'users',
    QUESTIONS: 'questions',
    SHOP_ITEMS: 'shopItems',
    SETTINGS: 'settings'
};

// ============ USER FUNCTIONS ============

/**
 * Get a user by username
 */
async function getUser(username) {
    try {
        const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, username));
        if (userDoc.exists()) {
            return { success: true, data: userDoc.data() };
        }
        return { success: false, error: 'User not found' };
    } catch (error) {
        console.error('Error getting user:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get all users
 */
async function getAllUsers() {
    try {
        const usersSnapshot = await getDocs(collection(db, COLLECTIONS.USERS));
        const users = [];
        usersSnapshot.forEach((doc) => {
            users.push({ id: doc.id, ...doc.data() });
        });
        return { success: true, data: users };
    } catch (error) {
        console.error('Error getting users:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Create or update a user
 */
async function saveUser(username, userData) {
    try {
        await setDoc(doc(db, COLLECTIONS.USERS, username), {
            ...userData,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        return { success: true };
    } catch (error) {
        console.error('Error saving user:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Update user coins
 */
async function updateUserCoins(username, coins) {
    try {
        await updateDoc(doc(db, COLLECTIONS.USERS, username), {
            coins: coins,
            updatedAt: new Date().toISOString()
        });
        return { success: true };
    } catch (error) {
        console.error('Error updating coins:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Update user owned items
 */
async function updateUserOwnedItems(username, ownedItems) {
    try {
        await updateDoc(doc(db, COLLECTIONS.USERS, username), {
            ownedItems: ownedItems,
            updatedAt: new Date().toISOString()
        });
        return { success: true };
    } catch (error) {
        console.error('Error updating owned items:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Update user question progress
 */
async function updateUserProgress(username, answeredQuestions, correctAnswers) {
    try {
        await updateDoc(doc(db, COLLECTIONS.USERS, username), {
            answeredQuestions: answeredQuestions,
            correctAnswers: correctAnswers,
            updatedAt: new Date().toISOString()
        });
        return { success: true };
    } catch (error) {
        console.error('Error updating progress:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Delete a user
 */
async function deleteUser(username) {
    try {
        await deleteDoc(doc(db, COLLECTIONS.USERS, username));
        return { success: true };
    } catch (error) {
        console.error('Error deleting user:', error);
        return { success: false, error: error.message };
    }
}

// ============ QUESTIONS FUNCTIONS ============

/**
 * Get all questions
 */
async function getAllQuestions() {
    try {
        const questionsSnapshot = await getDocs(collection(db, COLLECTIONS.QUESTIONS));
        const questions = [];
        questionsSnapshot.forEach((doc) => {
            questions.push({ id: parseInt(doc.id), ...doc.data() });
        });
        // Sort by ID
        questions.sort((a, b) => a.id - b.id);
        return { success: true, data: questions };
    } catch (error) {
        console.error('Error getting questions:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Save a single question
 */
async function saveQuestion(questionId, questionData) {
    try {
        await setDoc(doc(db, COLLECTIONS.QUESTIONS, questionId.toString()), questionData);
        return { success: true };
    } catch (error) {
        console.error('Error saving question:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Save multiple questions (batch)
 */
async function saveAllQuestions(questions) {
    try {
        const promises = questions.map(q => 
            setDoc(doc(db, COLLECTIONS.QUESTIONS, q.id.toString()), {
                question: q.question,
                explanation: q.explanation,
                options: q.options,
                correctAnswer: q.correctAnswer
            })
        );
        await Promise.all(promises);
        return { success: true, count: questions.length };
    } catch (error) {
        console.error('Error saving questions:', error);
        return { success: false, error: error.message };
    }
}

// ============ SHOP ITEMS FUNCTIONS ============

/**
 * Get all shop items
 */
async function getAllShopItems() {
    try {
        const itemsSnapshot = await getDocs(collection(db, COLLECTIONS.SHOP_ITEMS));
        const items = [];
        itemsSnapshot.forEach((doc) => {
            items.push({ id: doc.id, ...doc.data() });
        });
        return { success: true, data: items };
    } catch (error) {
        console.error('Error getting shop items:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Save all shop items
 */
async function saveAllShopItems(items) {
    try {
        const promises = items.map(item => 
            setDoc(doc(db, COLLECTIONS.SHOP_ITEMS, item.id), item)
        );
        await Promise.all(promises);
        return { success: true, count: items.length };
    } catch (error) {
        console.error('Error saving shop items:', error);
        return { success: false, error: error.message };
    }
}

// ============ SETTINGS FUNCTIONS ============

/**
 * Get settings
 */
async function getSettings(settingName) {
    try {
        const settingDoc = await getDoc(doc(db, COLLECTIONS.SETTINGS, settingName));
        if (settingDoc.exists()) {
            return { success: true, data: settingDoc.data() };
        }
        return { success: false, error: 'Setting not found' };
    } catch (error) {
        console.error('Error getting setting:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Save settings
 */
async function saveSettings(settingName, data) {
    try {
        await setDoc(doc(db, COLLECTIONS.SETTINGS, settingName), data);
        return { success: true };
    } catch (error) {
        console.error('Error saving setting:', error);
        return { success: false, error: error.message };
    }
}

// ============ REAL-TIME LISTENERS ============

/**
 * Listen to user changes in real-time
 */
function onUserChange(username, callback) {
    return onSnapshot(doc(db, COLLECTIONS.USERS, username), (doc) => {
        if (doc.exists()) {
            callback({ success: true, data: doc.data() });
        } else {
            callback({ success: false, error: 'User not found' });
        }
    }, (error) => {
        callback({ success: false, error: error.message });
    });
}

/**
 * Listen to all users changes in real-time
 */
function onUsersChange(callback) {
    return onSnapshot(collection(db, COLLECTIONS.USERS), (snapshot) => {
        const users = [];
        snapshot.forEach((doc) => {
            users.push({ id: doc.id, ...doc.data() });
        });
        callback({ success: true, data: users });
    }, (error) => {
        callback({ success: false, error: error.message });
    });
}

// Export all functions
module.exports = {
    // Database reference
    db,
    COLLECTIONS,
    
    // User functions
    getUser,
    getAllUsers,
    saveUser,
    updateUserCoins,
    updateUserOwnedItems,
    updateUserProgress,
    deleteUser,
    
    // Questions functions
    getAllQuestions,
    saveQuestion,
    saveAllQuestions,
    
    // Shop items functions
    getAllShopItems,
    saveAllShopItems,
    
    // Settings functions
    getSettings,
    saveSettings,
    
    // Real-time listeners
    onUserChange,
    onUsersChange
};
